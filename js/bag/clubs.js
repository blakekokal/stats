import { showAuthPage } from '../coaching/core.js';
import { onEnter } from '../coaching/core.js';
import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { fyShowStep1 } from './find-yardage.js';
import { _SPEED_KEY, getSpeedSessions, renderSpeedTab } from './speed.js';
import { WG_SWINGS, WG_WEDGE_LIST, _WG_KEY, getWgSessions, renderWgTab, saveWgSessions } from './wedge-gapping.js';
import { _viewingAsStudent, activeUserId } from '../coaching/core.js';
import { _sb, loadScript } from '../coaching/core.js';
import { store } from '../store.js';

// ─── MY BAG ─────────────────────────────────────────────────────────────────
export var _BAG_KEY = 'myBag_v1';
export var _BAG_ORDER = ['Dr','Dr2','2W','3W','4W','5W','6W','7W','2HY','3HY','4HY','5HY','6HY','7HY','2I','3I','4I','5I','6I','7I','8I','9I','48','PW','GW','AW','SW','50','52','54','56','58','60','62','LW'];

// Coach viewing a student's bag
 // cached clubs array when viewing student
 // cached wedge gapping for student

export function getBagClubs() {
  if (S.bagViewingStudentId && S.bagStudentClubs !== null) return S.bagStudentClubs;
  try { return JSON.parse(localStorage.getItem(_BAG_KEY)) || []; }
  catch(e) { return []; }
}

export function saveBagClubs(clubs) {
  if (S.bagViewingStudentId) {
    // Save to student's profile in Supabase
    S.bagStudentClubs = clubs;
    _sb.from('profiles').update({ bag_clubs: clubs }).eq('id', S.bagViewingStudentId)
      .select('bag_clubs').then(function(res) {
        if (res.error) console.warn('Save student bag error:', res.error.message);
      }).catch(function(e) { console.warn('Save student bag error:', e); });
    return;
  }
  localStorage.setItem(_BAG_KEY, JSON.stringify(clubs));
  // Sync to Supabase so coach can view/edit
  if (S.currentUser) {
    _sb.from('profiles').update({ bag_clubs: clubs }).eq('id', activeUserId()).then(function(){}).catch(function(){});
  }
}

function getWgSessionsForBag() {
  if (S.bagViewingStudentId && S.bagStudentWgSessions !== null) return S.bagStudentWgSessions;
  return getWgSessions();
}

export function bagWgGetLatestForClub(clubName) {
  var sessions = getWgSessionsForBag();
  for (var i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].clubs && sessions[i].clubs.indexOf(clubName) >= 0) return sessions[i];
  }
  return null;
}

export async function onBagStudentChange(val) {
  if (!val) {
    // Switch back to coach's own bag
    S.bagViewingStudentId = null;
    S.bagViewingStudentName = null;
    S.bagStudentClubs = null;
    S.bagStudentWgSessions = null;
    S.bagStudentSpeedSessions = null;
    renderBagClubs();
    return;
  }
  var parts = val.split('|');
  S.bagViewingStudentId = parts[0];
  S.bagViewingStudentName = parts[1] || 'Student';
  // Fetch student's bag, wedge gapping, and speed data from Supabase
  try {
    var { data, error } = await _sb.from('profiles')
      .select('bag_clubs, wedge_gapping, speed_sessions')
      .eq('id', S.bagViewingStudentId).single();
    if (error) { console.warn('Fetch student bag error:', error.message); }
    S.bagStudentClubs = (data && Array.isArray(data.bag_clubs)) ? data.bag_clubs : [];
    S.bagStudentWgSessions = (data && Array.isArray(data.wedge_gapping)) ? data.wedge_gapping : [];
    S.bagStudentSpeedSessions = (data && Array.isArray(data.speed_sessions)) ? data.speed_sessions : [];
  } catch(e) {
    S.bagStudentClubs = [];
    S.bagStudentWgSessions = [];
    S.bagStudentSpeedSessions = [];
  }
  renderBagClubs();
}

export async function populateBagStudentSelect() {
  var bar = document.getElementById('bagCoachStudentBar');
  if (!bar) return;
  // Coaches (and admins) can open a student's bag. The role is read from the profile.
  var isCoach = false;
  try {
    var prof = await _sb.from('profiles').select('role, is_admin').eq('id', S.currentUser.id).single();
    isCoach = !!(prof.data && (prof.data.role === 'coach' || prof.data.is_admin));
  } catch(e) {}
  if (!isCoach) { bar.style.display = 'none'; return; }
  bar.style.display = 'block';
  var sel = document.getElementById('bagStudentSelect');
  // Keep current selection
  var curVal = sel.value;
  sel.innerHTML = '<option value="">My Bag</option>';
  try {
    var { data } = await _sb.from('coach_students')
      .select('student_id, student_name')
      .eq('coach_id', S.currentUser.id)
      .order('student_name', { ascending: true });
    if (data) {
      data.forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = s.student_id + '|' + (s.student_name || 'Student');
        opt.textContent = s.student_name || 'Student';
        sel.appendChild(opt);
      });
    }
  } catch(e) {}
  // Restore selection if still valid
  if (curVal) sel.value = curVal;
}

// Pull bag, wedge gapping, and speed data from Supabase and merge into localStorage
export async function syncBagFromSupabase() {
  if (!S.currentUser) return;
  try {
    var uid = activeUserId();
    var { data, error } = await _sb.from('profiles').select('bag_clubs, wedge_gapping, speed_sessions').eq('id', uid).single();
    if (error) { console.warn('syncBagFromSupabase: fetch error', error.message); return; }
    if (!data) return;

    // --- Bag clubs ---
    var remote = data.bag_clubs;
    if (Array.isArray(remote)) {
      var local = getBagClubs();
      if (remote.length === 0 && local.length === 0) { /* nothing */ }
      else if (remote.length === 0) {
        _sb.from('profiles').update({ bag_clubs: local }).eq('id', uid).then(function(){}).catch(function(){});
      } else if (local.length === 0) {
        localStorage.setItem(_BAG_KEY, JSON.stringify(remote));
      } else {
        var localMap = {};
        local.forEach(function(c) { localMap[c.name] = c; });
        var merged = remote.map(function(rc) {
          var lc = localMap[rc.name];
          if (!lc) return rc;
          var m = {};
          Object.keys(lc).forEach(function(k) { m[k] = lc[k]; });
          m.carry = rc.carry;
          m.total = rc.total;
          return m;
        });
        var remoteNames = {};
        remote.forEach(function(c) { remoteNames[c.name] = true; });
        local.forEach(function(c) {
          if (!remoteNames[c.name]) merged.push(c);
        });
        localStorage.setItem(_BAG_KEY, JSON.stringify(sortBagClubs(merged)));
      }
    }

    // --- Wedge gapping ---
    var remoteWg = data.wedge_gapping;
    if (Array.isArray(remoteWg)) {
      var localWg = getWgSessions();
      if (remoteWg.length === 0 && localWg.length > 0) {
        _sb.from('profiles').update({ wedge_gapping: localWg }).eq('id', uid).then(function(){}).catch(function(){});
      } else if (remoteWg.length > 0) {
        localStorage.setItem(_WG_KEY, JSON.stringify(remoteWg));
      }
    }

    // --- Speed sessions ---
    var remoteSp = data.speed_sessions;
    if (Array.isArray(remoteSp)) {
      var localSp = getSpeedSessions();
      if (remoteSp.length === 0 && localSp.length > 0) {
        _sb.from('profiles').update({ speed_sessions: localSp }).eq('id', uid).then(function(){}).catch(function(){});
      } else if (remoteSp.length > 0) {
        localStorage.setItem(_SPEED_KEY, JSON.stringify(remoteSp));
      }
    }
  } catch(e) { console.warn('syncBagFromSupabase: error', e.message || e); }
}

export function sortBagClubs(clubs) {
  return clubs.sort(function(a, b) {
    var ai = _BAG_ORDER.indexOf(a.name), bi = _BAG_ORDER.indexOf(b.name);
    if (ai === -1) ai = 999;
    if (bi === -1) bi = 999;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}


function populateBagDropdown() {
  var sel = document.getElementById('bagClubName');
  if (!sel) return;
  var clubs = getBagClubs();
  var inBag = {};
  clubs.forEach(function(c) { inBag[c.name.toLowerCase()] = true; });
  var opts = '<option value="" disabled selected>Select a club...</option>';
  _BAG_ORDER.forEach(function(name) {
    if (!inBag[name.toLowerCase()]) {
      opts += '<option value="' + name + '">' + name + '</option>';
    }
  });
  sel.innerHTML = opts;
}

function toggleBagAddClub() {
  var sec = document.getElementById('bagAddClubSection');
  if (!sec) return;
  sec.style.display = sec.style.display === 'none' ? '' : 'none';
}

function addBagClub() {
  var nameEl = document.getElementById('bagClubName');
  var labelEl = document.getElementById('bagClubLabel');
  var msg = document.getElementById('bagAddMsg');

  var name = nameEl ? nameEl.value : '';
  if (!name) {
    msg.style.color = '#d4706e'; msg.textContent = 'Select a club.'; return;
  }
  var clubs = getBagClubs();
  if (clubs.some(function(c) { return c.name.toLowerCase() === name.toLowerCase(); })) {
    msg.style.color = '#d4706e'; msg.textContent = name + ' is already in your bag.'; return;
  }
  var label = labelEl ? labelEl.value.trim() : '';
  var clubObj = { name: name, carry: null, total: null };
  if (label) clubObj.label = label;
  clubs.push(clubObj);
  saveBagClubs(sortBagClubs(clubs));
  if (labelEl) labelEl.value = '';
  msg.style.color = '#00b87a'; msg.textContent = name + (label ? ' (' + label + ')' : '') + ' added!';
  setTimeout(function() { msg.textContent = ''; }, 2500);
  renderBagClubs();
}

function removeBagClub(name) {
  var clubs = getBagClubs();
  var club = clubs.find(function(c) { return c.name === name; });
  var hasShots = club && ((club.shots && club.shots.length > 0) || (club.totalShots && club.totalShots.length > 0));
  var msg = hasShots
    ? 'Remove ' + name + ' and its ' + ((club.shots && club.shots.length) || 0) + ' shot(s) from your bag?'
    : 'Remove ' + name + ' from your bag?';
  if (!confirm(msg)) return;
  saveBagClubs(clubs.filter(function(c) { return c.name !== name; }));
  renderBagClubs();
}

function updateBagClub(name, field, value) {
  var clubs = getBagClubs();
  var club = clubs.find(function(c) { return c.name === name; });
  if (!club) return;
  if (field === 'label') {
    club.label = value || '';
    if (!club.label) delete club.label;
  } else {
    club[field] = value !== '' ? parseInt(value) : null;
  }
  saveBagClubs(clubs);
  renderBagClubs();
}

function updateWgAvg(clubName, swingIndex, value) {
  var sessions = getWgSessions();
  for (var i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].clubs && sessions[i].clubs.indexOf(clubName) >= 0) {
      var key = 'sw' + swingIndex;
      if (!sessions[i].results[clubName]) sessions[i].results[clubName] = {};
      if (!sessions[i].results[clubName][key]) sessions[i].results[clubName][key] = { shots: [], avg: null };
      sessions[i].results[clubName][key].avg = value !== '' ? parseInt(value) : null;
      saveWgSessions(sessions);
      renderBagClubs();
      return;
    }
  }
}

export function bagDisplayName(name) {
  return name.replace(/I$/, 'i').replace(/I(\d)/, 'i$1').replace(/^(\d+)I$/, '$1i');
}

export function renderBagClubs() {
  var clubs = sortBagClubs(getBagClubs());
  var list = document.getElementById('bagClubList');
  var emptyMsg = document.getElementById('bagEmptyMsg');
  var headers = document.getElementById('bagClubHeaders');
  if (!list) return;
  // Update My Bag tab label
  var tabBtn = document.getElementById('bagTabMyBag');
  if (tabBtn) tabBtn.textContent = S.bagViewingStudentId ? ((S.bagViewingStudentName || 'Student').split(' ')[0] + "'s Bag") : 'My Bag';
  populateBagDropdown();
  if (clubs.length === 0) {
    list.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = 'block';
    if (headers) headers.style.display = 'none';
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';
  if (headers) headers.style.display = 'none';
  list.innerHTML = clubs.map(function(club) {
    var safe = club.name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    var dName = bagDisplayName(club.name);
    var labelHtml = club.label ? '<div style="font-size:9px;color:#606060;font-weight:600;line-height:1;margin-top:1px;">(' + club.label.replace(/</g,'&lt;') + ')</div>' : '';
    var carry = (club.carry !== null && club.carry !== undefined) ? club.carry : '';
    var total = (club.total !== null && club.total !== undefined) ? club.total : '';
    var isWedge = (typeof WG_WEDGE_LIST !== 'undefined') && WG_WEDGE_LIST.indexOf(club.name) >= 0;
    var wgSess = isWedge ? bagWgGetLatestForClub(club.name) : null;
    var wgFullAvg = null;
    if (wgSess) {
      var _wgFE = (wgSess.results[club.name] || {})['sw0'];
      wgFullAvg = _wgFE && _wgFE.avg != null ? _wgFE.avg : null;
    }
    var displayCarry = (wgFullAvg !== null) ? wgFullAvg : carry;

    // Wedge tiles with gapping: span full width, show only partial carries
    if (isWedge && wgSess) {
      var wgSwings = WG_SWINGS[wgSess.swingType] || [];
      var wgClubData = wgSess.results[club.name] || {};
      var partialsHtml = wgSwings.map(function(label, si) {
        var entry = wgClubData['sw' + si];
        var avg = entry && entry.avg != null ? entry.avg : '—';
        return '<div style="display:flex;flex-direction:column;align-items:center;">' +
          '<span style="font-size:10px;color:#9a9a9a;font-weight:700;line-height:1;">' + label + '</span>' +
          '<span style="font-size:12px;color:#3d96ee;font-weight:800;line-height:1.3;">' + avg + '</span>' +
        '</div>';
      }).join('');
      return '<div onclick="openClubDetail(\'' + safe + '\')" style="grid-column:span 3;background:#222222;border-radius:10px;padding:8px 10px;cursor:pointer;border:1px solid #282828;display:flex;align-items:center;gap:10px;">' +
        '<div style="min-width:36px;text-align:center;">' +
          '<div style="font-size:14px;font-weight:800;color:#9a9a9a;line-height:1.2;">' + dName + '</div>' + labelHtml +
        '</div>' +
        '<div style="flex:1;display:grid;grid-template-columns:repeat(' + wgSwings.length + ',1fr);gap:4px;">' + partialsHtml + '</div>' +
      '</div>';
    }

    // Standard club tile (1 column)
    var carry34 = (club.carry34 !== null && club.carry34 !== undefined) ? club.carry34 : '';
    return '<div onclick="openClubDetail(\'' + safe + '\')" style="background:#222222;border-radius:10px;padding:10px 6px;cursor:pointer;border:1px solid #282828;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:68px;">' +
      '<div style="font-size:14px;font-weight:800;color:#9a9a9a;line-height:1.2;">' + dName + '</div>' + labelHtml +
      '<div style="display:flex;gap:4px;margin-top:6px;align-items:baseline;">' +
        '<div style="text-align:center;"><div style="font-size:8px;color:#2e2e2e;font-weight:600;line-height:1;">CARRY</div><div style="font-size:13px;font-weight:700;color:#3d96ee;line-height:1.3;">' + (displayCarry !== '' ? displayCarry : '—') + '</div></div>' +
        '<div style="color:#2e2e2e;font-size:10px;">|</div>' +
        '<div style="text-align:center;"><div style="font-size:8px;color:#2e2e2e;font-weight:600;line-height:1;">TOTAL</div><div style="font-size:13px;font-weight:700;color:#ffffff;line-height:1.3;">' + (total !== '' ? total : '—') + '</div></div>' +
        '<div style="color:#2e2e2e;font-size:10px;">|</div>' +
        '<div style="text-align:center;"><div style="font-size:12px;color:#606060;font-weight:700;line-height:1;">¾</div><div style="font-size:13px;font-weight:700;color:#ffffff;line-height:1.3;">' + (carry34 !== '' ? carry34 : '—') + '</div></div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function openClubDetail(name) {
  var clubs = getBagClubs();
  var club = clubs.find(function(c) { return c.name === name; });
  if (!club) return;
  var safe = name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  var carry = (club.carry !== null && club.carry !== undefined) ? club.carry : '';
  var total = (club.total !== null && club.total !== undefined) ? club.total : '';
  var hasShots = club.shots && club.shots.length > 0;
  var isWedge = (typeof WG_WEDGE_LIST !== 'undefined') && WG_WEDGE_LIST.indexOf(club.name) >= 0;
  var wgSess = isWedge ? bagWgGetLatestForClub(club.name) : null;
  var wgFullAvg = null;
  if (wgSess) {
    var _wgFE = (wgSess.results[club.name] || {})['sw0'];
    wgFullAvg = _wgFE && _wgFE.avg != null ? _wgFE.avg : null;
  }
  var displayCarry = (wgFullAvg !== null) ? wgFullAvg : carry;
  var inStyle = 'height:36px;font-size:14px;font-weight:700;text-align:center;background:#282828;border:1px solid #3d3d3d;border-radius:8px;color:#ffffff;width:100%;box-sizing:border-box;';

  var dName = bagDisplayName(club.name);
  var clubLabel = club.label || '';
  var escapedLabel = clubLabel.replace(/"/g,'&quot;').replace(/</g,'&lt;');
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
  html += '<div style="font-size:20px;font-weight:800;color:#9a9a9a;">' + dName + (clubLabel ? ' <span style="font-size:14px;color:#606060;font-weight:600;">(' + clubLabel.replace(/</g,'&lt;') + ')</span>' : '') + '</div>';
  html += '<button onclick="closeClubDetail()" style="width:32px;height:32px;background:transparent;border:1px solid #3d3d3d;border-radius:8px;color:#9a9a9a;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">×</button>';
  html += '</div>';
  html += '<div style="margin-bottom:12px;"><input type="text" value="' + escapedLabel + '" placeholder="Add label (e.g. 48°, Titleist)" maxlength="20" onchange="updateBagClub(\'' + safe + '\',\'label\',this.value.trim());openClubDetail(\'' + safe + '\')" style="width:100%;height:32px;font-size:12px;text-align:center;background:#282828;border:1px solid #3d3d3d;border-radius:8px;color:#ffffff;box-sizing:border-box;padding:0 10px;"></div>';

  // Carry / Total
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">';
  if (isWedge && wgSess) {
    // Wedge with gapping data: editable carry (from wg full avg) and total
    html += '<div style="text-align:center;"><div style="font-size:10px;color:#2e2e2e;font-weight:600;margin-bottom:4px;">CARRY</div><input type="number" inputmode="numeric" value="' + (displayCarry !== '' ? displayCarry : '') + '" placeholder="—" min="0" max="400" onchange="updateWgAvg(\'' + safe + '\',0,this.value);updateBagClub(\'' + safe + '\',\'carry\',this.value);openClubDetail(\'' + safe + '\')" style="' + inStyle + '"></div>';
    html += '<div style="text-align:center;"><div style="font-size:10px;color:#2e2e2e;font-weight:600;margin-bottom:4px;">TOTAL</div><input type="number" inputmode="numeric" value="' + total + '" placeholder="—" min="0" max="450" onchange="updateBagClub(\'' + safe + '\',\'total\',this.value);openClubDetail(\'' + safe + '\')" style="' + inStyle + '"></div>';
  } else if (hasShots) {
    html += '<div style="text-align:center;background:#282828;border-radius:8px;padding:10px;"><div style="font-size:10px;color:#2e2e2e;font-weight:600;margin-bottom:4px;">CARRY</div><div style="font-size:18px;font-weight:700;color:#ffffff;">' + (displayCarry !== '' ? displayCarry : '—') + '</div></div>';
    html += '<div style="text-align:center;background:#282828;border-radius:8px;padding:10px;"><div style="font-size:10px;color:#2e2e2e;font-weight:600;margin-bottom:4px;">TOTAL</div><div style="font-size:18px;font-weight:700;color:#ffffff;">' + (total !== '' ? total : '—') + '</div></div>';
  } else {
    html += '<div style="text-align:center;"><div style="font-size:10px;color:#2e2e2e;font-weight:600;margin-bottom:4px;">CARRY</div><input type="number" inputmode="numeric" value="' + displayCarry + '" placeholder="—" min="0" max="400" onchange="updateBagClub(\'' + safe + '\',\'carry\',this.value);openClubDetail(\'' + safe + '\')" style="' + inStyle + '"></div>';
    html += '<div style="text-align:center;"><div style="font-size:10px;color:#2e2e2e;font-weight:600;margin-bottom:4px;">TOTAL</div><input type="number" inputmode="numeric" value="' + total + '" placeholder="—" min="0" max="450" onchange="updateBagClub(\'' + safe + '\',\'total\',this.value);openClubDetail(\'' + safe + '\')" style="' + inStyle + '"></div>';
  }
  html += '</div>';

  // 3/4 carry for non-wedges
  if (!isWedge) {
    var carry34 = (club.carry34 !== null && club.carry34 !== undefined) ? club.carry34 : '';
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">';
    html += '<div style="font-size:11px;color:#2e2e2e;font-weight:700;">¾ CARRY</div>';
    html += '<input type="number" inputmode="numeric" value="' + carry34 + '" placeholder="—" min="0" max="400" onchange="updateBagClub(\'' + safe + '\',\'carry34\',this.value)" style="width:80px;height:32px;font-size:13px;font-weight:700;text-align:center;background:#282828;border:1px solid #3d3d3d;border-radius:8px;color:#ffffff;">';
    html += '</div>';
  }

  // Wedge gapping partials
  if (isWedge && wgSess) {
    var wgSwings = WG_SWINGS[wgSess.swingType] || [];
    var wgClubData = wgSess.results[club.name] || {};
    html += '<div style="margin-bottom:12px;"><div style="font-size:10px;color:#2e2e2e;font-weight:600;margin-bottom:6px;">PARTIAL SHOTS</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(' + wgSwings.length + ',1fr);gap:6px;">';
    wgSwings.forEach(function(label, si) {
      var entry = wgClubData['sw' + si];
      var avg = entry && entry.avg != null ? entry.avg : '';
      html += '<div style="text-align:center;background:#282828;border-radius:8px;padding:8px 4px;"><div style="font-size:11px;color:#9a9a9a;font-weight:700;">' + label + '</div>';
      html += '<input type="number" inputmode="numeric" value="' + avg + '" placeholder="—" min="0" max="400" onchange="updateWgAvg(\'' + safe + '\',' + si + ',this.value);openClubDetail(\'' + safe + '\')" style="width:100%;height:28px;font-size:14px;font-weight:800;text-align:center;background:transparent;border:1px solid #3d3d3d;border-radius:6px;color:#44b8f0;box-sizing:border-box;">';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // Arc width (this app): how wide the club's arc is drawn on a hole with Arc → Auto.
  if (!S.bagViewingStudentId) {
    var arcW = (store.get('clubArcs') || {})[club.name] || '';
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">';
    html += '<div style="font-size:11px;color:#2e2e2e;font-weight:700;">ARC WIDTH</div>';
    html += '<input type="number" inputmode="numeric" value="' + arcW + '" placeholder="auto" min="5" max="100" onchange="setBagClubArc(\'' + safe + '\',this.value)" style="width:80px;height:32px;font-size:13px;font-weight:700;text-align:center;background:#282828;border:1px solid #3d3d3d;border-radius:8px;color:#ffffff;">';
    html += '<div style="font-size:10px;color:#606060;text-align:left;line-height:1.3;">yds on the hole map. Blank = 15% of its yardage.</div>';
    html += '</div>';
  }

  // Remove button
  html += '<button onclick="closeClubDetail();removeBagClub(\'' + safe + '\')" style="width:100%;height:38px;background:#2a1a1a;border:1px solid #351a1a;border-radius:10px;color:#d4706e;font-size:13px;font-weight:700;cursor:pointer;">Remove from Bag</button>';

  var modal = document.getElementById('clubDetailModal');
  document.getElementById('clubDetailContent').innerHTML = html;
  modal.style.display = 'flex';

}

// Arc width per club, kept with this app's settings (used by Arc → Auto on a hole).
function setBagClubArc(name, value) {
  var arcs = Object.assign({}, store.get('clubArcs') || {});
  var v = Math.round(+value);
  if (v > 0) arcs[name] = Math.max(5, Math.min(100, v)); else delete arcs[name];
  store.set('clubArcs', arcs);
}

function closeClubDetail() {
  document.getElementById('clubDetailModal').style.display = 'none';
  renderBagClubs();
}

function normalizeBagClubName(name) {
  var lower = name.toLowerCase().trim();
  // Handle common aliases
  var aliases = { 'driver': 'Dr', 'drive': 'Dr', 'driver2': 'Dr2' };
  if (aliases[lower]) return aliases[lower];
  for (var i = 0; i < _BAG_ORDER.length; i++) {
    if (_BAG_ORDER[i].toLowerCase() === lower) return _BAG_ORDER[i];
  }
  return name;
}

function importBagFile(input) {
  var file = input.files[0];
  if (!file) return;
  var isExcel = /\.xlsx?$/i.test(file.name);

  if (isExcel) {
    var reader = new FileReader();
    reader.onload = async function(e) {
      // The Excel reader is only fetched when a workbook is imported.
      if (!window.XLSX) {
        try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'); }
        catch (err) { alert('Could not load the Excel reader. Check your connection, or import a CSV file instead.'); return; }
      }
      var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) { alert('Excel file is empty.'); return; }
      processBagImportRows(rows);
    };
    reader.readAsArrayBuffer(file);
  } else {
    var reader = new FileReader();
    reader.onload = function(e) {
      var lines = e.target.result.trim().split('\n');
      if (lines.length < 2) { alert('CSV is empty.'); return; }
      var header = lines[0].split(',').map(function(h) { return h.trim(); });
      var rows = [];
      for (var i = 1; i < lines.length; i++) {
        var cols = lines[i].split(',').map(function(c) { return c.trim(); });
        var obj = {};
        header.forEach(function(h, idx) { obj[h] = cols[idx] || ''; });
        rows.push(obj);
      }
      processBagImportRows(rows);
    };
    reader.readAsText(file);
  }
  input.value = '';
}

function processBagImportRows(rows) {
  // Find column names case-insensitively
  var keys = Object.keys(rows[0]);
  var clubKey = keys.find(function(k) { return k.trim().toLowerCase() === 'club'; });
  var totalKey = keys.find(function(k) { return k.trim().toLowerCase() === 'total'; });
  var sideKey = keys.find(function(k) { return k.trim().toLowerCase() === 'side'; });
  var targetKey = keys.find(function(k) { return k.trim().toLowerCase() === 'target'; });
  // New 8-column format columns
  var targetTotalKey = keys.find(function(k) { return k.trim().toLowerCase() === 'target_total'; });
  var totalRollKey = keys.find(function(k) { return k.trim().toLowerCase() === 'total_roll'; });
  var totalSideKey = keys.find(function(k) { return k.trim().toLowerCase() === 'total_side'; });
  var hasRollData = !!(targetTotalKey && totalRollKey && totalSideKey);
  if (!clubKey || !totalKey) { alert('Data must have Club and Total columns.'); return; }

  var clubMap = {};
  rows.forEach(function(row) {
    var cn = String(row[clubKey] || '').trim();
    var tot = parseFloat(row[totalKey]);
    var side = sideKey ? parseFloat(row[sideKey]) : 0;
    var target = targetKey ? parseFloat(row[targetKey]) : 0;
    if (!cn || isNaN(tot)) return;
    var norm = normalizeBagClubName(cn);
    if (!clubMap[norm]) clubMap[norm] = { totals: [], sides: [], targets: [], rollTotals: [], rollSides: [], rollTargets: [] };
    clubMap[norm].totals.push(tot);
    clubMap[norm].sides.push(isNaN(side) ? 0 : side);
    clubMap[norm].targets.push(isNaN(target) ? null : target);
    // Parse total/roll columns if present
    if (hasRollData) {
      var rollTot = parseFloat(row[totalRollKey]);
      var rollSide = parseFloat(row[totalSideKey]);
      var rollTarget = parseFloat(row[targetTotalKey]);
      clubMap[norm].rollTotals.push(isNaN(rollTot) ? tot : rollTot);
      clubMap[norm].rollSides.push(isNaN(rollSide) ? 0 : rollSide);
      clubMap[norm].rollTargets.push(isNaN(rollTarget) ? null : rollTarget);
    }
  });

  var clubs = getBagClubs();
  var count = 0;
  Object.keys(clubMap).forEach(function(name) {
    var d = clubMap[name];
    // Carry averages
    var avgCarry = Math.round(d.totals.reduce(function(s,v){return s+v;},0) / d.totals.length);
    var validTargets = d.targets.filter(function(t) { return t !== null; });
    var avgCarryTarget = validTargets.length > 0 ? Math.round(validTargets.reduce(function(s,v){return s+v;},0) / validTargets.length) : avgCarry;
    // Carry shots (total column = carry yardage, side = carry offline, target = carry target)
    var shots = d.totals.map(function(t, idx) {
      return { total: t, side: d.sides[idx] || 0, target: d.targets[idx] !== null ? d.targets[idx] : avgCarryTarget };
    });

    // Total/roll averages and shots
    var avgTotal = avgCarry;
    var totalShots = null;
    if (hasRollData && d.rollTotals.length > 0) {
      avgTotal = Math.round(d.rollTotals.reduce(function(s,v){return s+v;},0) / d.rollTotals.length);
      var validRollTargets = d.rollTargets.filter(function(t) { return t !== null; });
      var avgRollTarget = validRollTargets.length > 0 ? Math.round(validRollTargets.reduce(function(s,v){return s+v;},0) / validRollTargets.length) : avgTotal;
      totalShots = d.rollTotals.map(function(t, idx) {
        return { total: t, side: d.rollSides[idx] || 0, target: d.rollTargets[idx] !== null ? d.rollTargets[idx] : avgRollTarget };
      });
    }

    var existing = clubs.find(function(c) { return c.name === name; });
    if (existing) {
      existing.carry = avgCarryTarget;
      existing.total = avgTotal;
      existing.shots = shots;
      if (totalShots) existing.totalShots = totalShots;
    } else {
      var clubObj = { name: name, carry: avgCarryTarget, total: avgTotal, shots: shots };
      if (totalShots) clubObj.totalShots = totalShots;
      clubs.push(clubObj);
    }
    count++;
  });

  saveBagClubs(sortBagClubs(clubs));
  renderBagClubs();
  var msg = document.getElementById('bagAddMsg');
  msg.style.color = '#00b87a';
  msg.textContent = count + ' clubs imported!' + (hasRollData ? ' (carry + total data)' : '');
  setTimeout(function() { msg.textContent = ''; }, 3000);
}

// ─── BAG TABS ──────────────────────────────────────────────────────────────
export var _currentBagTab = 'myBag';
export function setBagTab(tab) {
  _currentBagTab = tab;
  var tabs = { myBag: 'bagTabMyBag', findYardages: 'bagTabFindYardages', wedgeGap: 'bagTabWedgeGap', speed: 'bagTabSpeed' };
  var contents = { myBag: 'bagTabContentMyBag', findYardages: 'bagTabContentFindYardages', wedgeGap: 'bagTabContentWedgeGap', speed: 'bagTabContentSpeed' };
  Object.keys(tabs).forEach(function(key) {
    var btn = document.getElementById(tabs[key]);
    var cont = document.getElementById(contents[key]);
    if (btn) { btn.style.background = key === tab ? '#2d7abc' : 'transparent'; btn.style.color = key === tab ? '#ffffff' : '#606060'; }
    if (cont) { cont.style.display = key === tab ? 'flex' : 'none'; }
  });
  if (tab === 'myBag') renderBagClubs();
  if (tab === 'findYardages') fyShowStep1();
  if (tab === 'wedgeGap') {
    document.getElementById('wgHistoryView').style.display = '';
    document.getElementById('wgEntryView').style.display = 'none';
    renderWgTab();
  }
  if (tab === 'speed') {
    document.getElementById('spHistoryView').style.display = '';
    document.getElementById('spEntryView').style.display = 'none';
    renderSpeedTab();
  }
}

onEnter('myBagPage', function() {
  if (!S.currentUser) {
    alert('Please log in to access My Bag.');
    showAuthPage();
    return false;
  }
  // Reset student view when entering bag page
  S.bagViewingStudentId = null;
  S.bagViewingStudentName = null;
  S.bagStudentClubs = null;
  S.bagStudentWgSessions = null;
  S.bagStudentSpeedSessions = null;
  var bss = document.getElementById('bagStudentSelect');
  if (bss) bss.value = '';

  if (_viewingAsStudent) {
    // Auto-load student's bag when viewing as student
    onBagStudentChange(_viewingAsStudent.id + '|' + _viewingAsStudent.name);
    // Hide the student selector since we're already viewing as student
    var bar = document.getElementById('bagCoachStudentBar');
    if (bar) bar.style.display = 'none';
  } else {
    populateBagStudentSelect();
    renderBagClubs(); // show local cache immediately
    // Pull latest from Supabase, then re-render
    syncBagFromSupabase().then(function() {
      renderBagClubs();
    });
  }
  setBagTab(_currentBagTab || 'myBag');
});

// Functions called from inline HTML handlers
expose({ onBagStudentChange, toggleBagAddClub, addBagClub, removeBagClub, updateBagClub, updateWgAvg, openClubDetail, closeClubDetail, importBagFile, setBagTab, setBagClubArc });

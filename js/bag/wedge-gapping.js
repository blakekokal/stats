import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { getBagClubs, renderBagClubs, saveBagClubs, sortBagClubs } from './clubs.js';
import { renderGapVisualizerChart } from './gap-visualizer.js';
import { activeUserId } from '../coaching/core.js';
import { _sb } from '../coaching/core.js';

// ─── WEDGE GAPPING ──────────────────────────────────────────────────────────
export var _WG_KEY = 'wedgeGap_v1';
export var WG_SWINGS = {
  percent:  ['Full', '75%', '50%'],
  fraction: ['Full', '3/4', '1/2'],
  body:     ['Full', 'Ears', 'Shldr', 'Ribs', 'Hips']
};
// All valid wedge clubs in loft order
var WG_WEDGE_NAMED  = ['PW','GW','AW','SW','LW'];
var WG_WEDGE_DEGREE = ['48','50','52','54','56','58','60','62'];
export var WG_WEDGE_LIST   = WG_WEDGE_NAMED.concat(WG_WEDGE_DEGREE);

// Global wedge club color palette & helper
var _WG_CLUB_PALETTE = ['#007a52', '#2d7abc', '#f0c830', '#9b59b6', '#d4706e', '#00b87a'];
export function getWedgeClubColor(clubName) {
  // Assign color based on position among user's bag wedges (sorted by loft)
  var clubs = sortBagClubs(getBagClubs());
  var wedges = [];
  clubs.forEach(function(c) {
    var isW = WG_WEDGE_LIST.indexOf(c.name) >= 0;
    if (isW && wedges.indexOf(c.name) === -1) wedges.push(c.name);
  });
  var idx = wedges.indexOf(clubName);
  if (idx === -1) return '#44b8f0'; // fallback
  return _WG_CLUB_PALETTE[idx % _WG_CLUB_PALETTE.length];
}
var _wgSelectedClubs = [];
var _wgSwingType = null;

export function getWgSessions() {
  if (S.bagViewingStudentId && S.bagStudentWgSessions !== null) return S.bagStudentWgSessions;
  try { return JSON.parse(localStorage.getItem(_WG_KEY)) || []; } catch(e) { return []; }
}
export function saveWgSessions(s) {
  if (S.bagViewingStudentId) {
    // Save to student's profile, also update local cache
    S.bagStudentWgSessions = s;
    _sb.from('profiles').update({ wedge_gapping: s }).eq('id', S.bagViewingStudentId)
      .then(function(){}).catch(function(e){ console.warn('Save student WG error:', e); });
    return;
  }
  localStorage.setItem(_WG_KEY, JSON.stringify(s));
  if (S.currentUser) {
    _sb.from('profiles').update({ wedge_gapping: s }).eq('id', activeUserId()).then(function(){}).catch(function(){});
  }
}

export function renderWgTab() {
  var list = document.getElementById('wgSessionList');
  var newBtn = document.getElementById('wgNewBtn');
  if (!list) return;
  var sessions = getWgSessions();
  // Use only the latest session (single session model)
  var s = sessions.length > 0 ? sessions[sessions.length - 1] : null;
  if (!s) {
    list.innerHTML = '<div style="background:#222222;border-radius:12px;padding:24px;text-align:center;color:#9a9a9a;font-size:13px;">No session yet. Tap + New Session to start.</div>';
    if (newBtn) newBtn.textContent = '+ New Session';
    return;
  }
  if (newBtn) newBtn.textContent = 'Update Session';
  var swingLabels = WG_SWINGS[s.swingType] || [];
  var typeLabel = s.swingType === 'percent' ? 'Percent' : s.swingType === 'fraction' ? 'Fraction' : 'Body';
  var d = new Date(s.date + 'T12:00:00');
  var dateStr = d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  var gridCols = '52px ' + swingLabels.map(function(){ return '1fr'; }).join(' ');
  var cells = '';
  // Header row
  cells += '<div style="font-size:9px;font-weight:700;color:#9a9a9a;padding:3px 2px;">Club</div>';
  swingLabels.forEach(function(l) {
    cells += '<div style="font-size:9px;font-weight:700;color:#9a9a9a;text-align:center;padding:3px 2px;">' + l + '</div>';
  });
  // Editable rows
  s.clubs.forEach(function(club) {
    var clubData = s.results[club] || {};
    cells += '<div style="font-size:13px;font-weight:800;color:#44b8f0;padding:4px 3px;display:flex;align-items:center;">' + club + '</div>';
    swingLabels.forEach(function(l, i) {
      var entry = clubData['sw' + i];
      var avg = entry && entry.avg != null ? entry.avg : '';
      var safeClub = club.replace(/[^a-zA-Z0-9]/g, '_');
      cells += '<div style="text-align:center;padding:2px 1px;">' +
        '<input type="number" inputmode="numeric" value="' + avg + '" placeholder="—" ' +
        'onchange="wgEditAvg(\'' + safeClub + '\',\'' + club + '\',' + i + ',this.value)" ' +
        'style="width:100%;height:32px;background:#1e1e1e;border:1px solid #333333;border-radius:6px;color:#9a9a9a;font-size:13px;font-weight:700;text-align:center;padding:0;box-sizing:border-box;">' +
      '</div>';
    });
  });
  // Swing type switcher buttons
  var typeBtns = ['percent','fraction','body'].map(function(t) {
    var lbl = t === 'percent' ? '%' : t === 'fraction' ? '½' : 'Body';
    var active = s.swingType === t;
    return '<button onclick="wgChangeSwingType(\'' + t + '\')" style="' +
      'width:56px;min-width:56px;max-width:56px;height:32px;flex:none;padding:0;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid ' +
      (active ? '#2d7abc' : '#333333') + ';background:' + (active ? '#2d7abc' : '#282828') +
      ';color:' + (active ? '#ffffff' : '#606060') + ';">' + lbl + '</button>';
  }).join('');

  list.innerHTML = '<div style="background:#222222;border-radius:12px;padding:12px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
      '<div style="display:flex;gap:4px;">' + typeBtns + '</div>' +
      '<button onclick="wgClearSession()" style="background:#2a1a1a;border:1px solid #351a1a;border-radius:6px;color:#d4706e;font-size:12px;font-weight:700;cursor:pointer;width:56px;min-width:56px;max-width:56px;height:32px;flex:none;padding:0;">Clear</button>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:' + gridCols + ';gap:3px 6px;align-items:center;">' + cells + '</div>' +
  '</div>';
}

function wgGetLatestForClub(clubName) {
  var sessions = getWgSessions();
  for (var i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].clubs && sessions[i].clubs.indexOf(clubName) >= 0) return sessions[i];
  }
  return null;
}

function wgDeleteSession(id) {
  if (!confirm('Delete this wedge gapping session?')) return;
  saveWgSessions(getWgSessions().filter(function(s){ return s.id !== id; }));
  renderWgTab();
}

function wgClearSession() {
  if (!confirm('Clear your wedge gapping data?')) return;
  saveWgSessions([]);
  renderWgTab();
  renderBagClubs();
}

function wgChangeSwingType(newType) {
  var sessions = getWgSessions();
  if (sessions.length === 0) return;
  var s = sessions[sessions.length - 1];
  if (s.swingType === newType) return;
  var oldSwings = WG_SWINGS[s.swingType] || [];
  var newSwings = WG_SWINGS[newType] || [];
  // Build index mapping between swing types
  // fraction/percent: sw0=Full, sw1=3/4(75%), sw2=1/2(50%)
  // body: sw0=Full, sw1=Ears, sw2=Shldr, sw3=Ribs, sw4=Hips
  var indexMap = {}; // indexMap[newIndex] = oldIndex (or -1 for empty)
  var oldIsBody = (s.swingType === 'body');
  var newIsBody = (newType === 'body');
  if (!oldIsBody && newIsBody) {
    // fraction/percent → body: sw0→sw0, sw1(3/4)→sw2(Shldr), sw2(1/2)→sw3(Ribs)
    indexMap = { 0: 0, 1: -1, 2: 1, 3: 2, 4: -1 };
  } else if (oldIsBody && !newIsBody) {
    // body → fraction/percent: sw0→sw0, sw2(Shldr)→sw1(3/4), sw3(Ribs)→sw2(1/2)
    indexMap = { 0: 0, 1: 2, 2: 3 };
  } else {
    // same category (fraction↔percent): 1:1 by index
    for (var m = 0; m < newSwings.length; m++) indexMap[m] = m;
  }
  // Remap results using the index mapping
  s.clubs.forEach(function(club) {
    var clubData = s.results[club] || {};
    var newData = {};
    for (var i = 0; i < newSwings.length; i++) {
      var srcIdx = indexMap[i];
      if (srcIdx >= 0 && clubData['sw' + srcIdx]) {
        newData['sw' + i] = clubData['sw' + srcIdx];
      } else {
        newData['sw' + i] = { shots: [], avg: null };
      }
    }
    s.results[club] = newData;
  });
  s.swingType = newType;
  saveWgSessions(sessions);
  renderWgTab();
  renderBagClubs();
  if (typeof renderGapVisualizerChart === 'function') renderGapVisualizerChart();
}

function wgEditAvg(safeClub, club, swingIndex, value) {
  var sessions = getWgSessions();
  if (sessions.length === 0) return;
  var s = sessions[sessions.length - 1];
  if (!s.results[club]) return;
  var key = 'sw' + swingIndex;
  var entry = s.results[club][key];
  if (!entry) entry = s.results[club][key] = { shots: [], avg: null };
  var newVal = value !== '' ? parseInt(value) : null;
  if (newVal !== null && isNaN(newVal)) return;
  entry.avg = newVal;
  entry.shots = newVal !== null ? [newVal] : [];
  saveWgSessions(sessions);
  // Update bag club carry if this is the full swing (sw0)
  if (swingIndex === 0 && newVal !== null) {
    var clubs = getBagClubs();
    var bagClub = clubs.find(function(c) { return c.name === club; });
    if (bagClub) {
      bagClub.carry = newVal;
      saveBagClubs(sortBagClubs(clubs));
    }
  }
  renderBagClubs();
  if (typeof renderGapVisualizerChart === 'function') renderGapVisualizerChart();
}

function wgStartNew() {
  // Pre-populate from existing session if available
  var sessions = getWgSessions();
  var existing = sessions.length > 0 ? sessions[sessions.length - 1] : null;
  _wgSelectedClubs = existing ? existing.clubs.slice() : [];
  _wgSwingType = existing ? existing.swingType : null;
  document.getElementById('wgHistoryView').style.display = 'none';
  document.getElementById('wgEntryView').style.display = '';
  document.getElementById('wgStep1').style.display = '';
  document.getElementById('wgStep2').style.display = 'none';
  document.getElementById('wgStep3').style.display = 'none';
  document.getElementById('wgStep1Msg').textContent = '';
  wgRenderClubGrid();
}

function wgCancelEntry() {
  document.getElementById('wgEntryView').style.display = 'none';
  document.getElementById('wgHistoryView').style.display = '';
  renderWgTab();
}

function wgRenderClubGrid() {
  var grid = document.getElementById('wgClubGrid');
  if (!grid) return;
  var bagNames = getBagClubs().map(function(c){ return c.name; });
  function btn(w) {
    var inBag = bagNames.indexOf(w) >= 0;
    var sel   = _wgSelectedClubs.indexOf(w) >= 0;
    return '<button onclick="wgToggleClub(\'' + w + '\')" style="' +
      'flex:1;min-width:0;height:36px;font-size:12px;font-weight:700;border-radius:8px;cursor:pointer;' +
      'background:' + (sel ? '#2d7abc' : '#282828') + ';' +
      'border:1px solid ' + (sel ? '#2d7abc' : inBag ? '#282828' : '#282828') + ';' +
      'color:' + (sel ? '#ffffff' : inBag ? '#ffffff' : '#3d3d3d') + ';">' + w + '</button>';
  }
  grid.innerHTML =
    '<div style="width:100%;">' +
      '<div style="font-size:9px;color:#9a9a9a;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Named</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px;">' + WG_WEDGE_NAMED.map(btn).join('') + '</div>' +
      '<div style="font-size:9px;color:#9a9a9a;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Degree</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">' + WG_WEDGE_DEGREE.map(btn).join('') + '</div>' +
    '</div>';
}

function wgToggleClub(name) {
  var idx = _wgSelectedClubs.indexOf(name);
  if (idx >= 0) {
    _wgSelectedClubs.splice(idx, 1);
  } else {
    if (_wgSelectedClubs.length >= 4) {
      document.getElementById('wgStep1Msg').textContent = 'Max 4 wedges.';
      return;
    }
    _wgSelectedClubs.push(name);
  }
  document.getElementById('wgStep1Msg').textContent = '';
  wgRenderClubGrid();
}

function wgNextStep1() {
  if (_wgSelectedClubs.length === 0) {
    document.getElementById('wgStep1Msg').textContent = 'Select at least 1 wedge.';
    return;
  }
  document.getElementById('wgStep1').style.display = 'none';
  document.getElementById('wgStep2').style.display = '';
  document.getElementById('wgStep2Msg').textContent = '';
  // Pre-select shot count from existing session
  var sessions = getWgSessions();
  var existing = sessions.length > 0 ? sessions[sessions.length - 1] : null;
  if (existing && existing.shotsPerSwing) {
    document.getElementById('wgShotCount').value = existing.shotsPerSwing;
  }
  wgUpdateTypeButtons();
}

function wgBackToStep1() {
  document.getElementById('wgStep2').style.display = 'none';
  document.getElementById('wgStep1').style.display = '';
}

function wgSelectType(type) {
  _wgSwingType = type;
  wgUpdateTypeButtons();
}

function wgUpdateTypeButtons() {
  ['percent','fraction','body'].forEach(function(t) {
    var btn = document.getElementById('wgTypeBtn' + t.charAt(0).toUpperCase() + t.slice(1));
    if (!btn) return;
    btn.style.background   = _wgSwingType === t ? '#2d7abc' : '#282828';
    btn.style.borderColor  = _wgSwingType === t ? '#2d7abc' : '#3d3d3d';
    btn.style.color        = _wgSwingType === t ? '#ffffff'    : '#606060';
  });
  var preview = document.getElementById('wgSwingPreview');
  if (preview) preview.textContent = _wgSwingType ? WG_SWINGS[_wgSwingType].join(' · ') : '';
}

function wgNextStep2() {
  if (!_wgSwingType) {
    document.getElementById('wgStep2Msg').textContent = 'Select a swing type.';
    return;
  }
  document.getElementById('wgStep2Msg').textContent = '';
  document.getElementById('wgStep2').style.display = 'none';
  document.getElementById('wgStep3').style.display = '';
  document.getElementById('wgStep3Msg').textContent = '';
  wgRenderInputs();
}

function wgBackToStep2() {
  document.getElementById('wgStep3').style.display = 'none';
  document.getElementById('wgStep2').style.display = '';
}

function wgRenderInputs() {
  var shotCount = parseInt(document.getElementById('wgShotCount').value) || 3;
  var swings = WG_SWINGS[_wgSwingType];
  var area = document.getElementById('wgInputArea');
  if (!area) return;
  // Get existing session data to pre-fill inputs
  var sessions = getWgSessions();
  var existing = sessions.length > 0 ? sessions[sessions.length - 1] : null;
  area.innerHTML = _wgSelectedClubs.map(function(club) {
    var safeClub = club.replace(/[^a-zA-Z0-9]/g, '_');
    var existingClub = existing && existing.results && existing.results[club] ? existing.results[club] : null;
    var blocks = swings.map(function(label, si) {
      var existingEntry = existingClub ? existingClub['sw' + si] : null;
      var existingShots = existingEntry ? existingEntry.shots || [] : [];
      var inputs = '';
      for (var i = 0; i < shotCount; i++) {
        var prefill = i < existingShots.length && existingShots[i] != null ? existingShots[i] : '';
        inputs += '<input type="number" id="wg_' + safeClub + '_' + si + '_' + i +
          '" inputmode="numeric" placeholder="—" value="' + prefill + '" style="width:50px;height:34px;background:#1e1e1e;border:1px solid #333333;border-radius:6px;color:#9a9a9a;font-size:13px;font-weight:700;text-align:center;padding:0;">';
      }
      return '<div style="background:#222222;border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<div style="font-size:11px;color:#606060;font-weight:700;min-width:64px;">' + label + '</div>' +
        '<div style="display:flex;gap:5px;flex-wrap:wrap;">' + inputs + '</div>' +
      '</div>';
    }).join('');
    return '<div style="background:#222222;border-radius:12px;padding:12px;">' +
      '<div style="font-size:14px;font-weight:800;color:#44b8f0;margin-bottom:8px;">' + club + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;">' + blocks + '</div>' +
    '</div>';
  }).join('');
}

function wgSaveSession() {
  var shotCount = parseInt(document.getElementById('wgShotCount').value) || 3;
  var swings = WG_SWINGS[_wgSwingType];
  var results = {};
  var hasAny = false;
  _wgSelectedClubs.forEach(function(club) {
    var safeClub = club.replace(/[^a-zA-Z0-9]/g, '_');
    results[club] = {};
    swings.forEach(function(label, si) {
      var shots = [];
      for (var i = 0; i < shotCount; i++) {
        var el = document.getElementById('wg_' + safeClub + '_' + si + '_' + i);
        var val = el && el.value !== '' ? parseInt(el.value) : null;
        if (val !== null && !isNaN(val)) { shots.push(val); hasAny = true; }
      }
      var avg = shots.length ? Math.round(shots.reduce(function(a,v){ return a+v; },0) / shots.length) : null;
      results[club]['sw' + si] = { shots: shots, avg: avg };
    });
  });
  if (!hasAny) {
    var msg = document.getElementById('wgStep3Msg');
    msg.style.color = '#d4706e';
    msg.textContent = 'Enter at least one carry distance.';
    return;
  }
  var today = new Date();
  var dateStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  var session = {
    id: Date.now().toString(),
    date: dateStr,
    clubs: _wgSelectedClubs.slice(),
    swingType: _wgSwingType,
    shotsPerSwing: shotCount,
    results: results
  };
  // Single session model: replace all with just this one
  saveWgSessions([session]);

  // Update bag clubs carry with full-swing averages from this session
  var clubs = getBagClubs();
  var changed = false;
  _wgSelectedClubs.forEach(function(club) {
    var fullEntry = results[club] && results[club]['sw0'];
    if (fullEntry && fullEntry.avg != null) {
      var bagClub = clubs.find(function(c) { return c.name === club; });
      if (bagClub) {
        bagClub.carry = fullEntry.avg;
        changed = true;
      }
    }
  });
  if (changed) saveBagClubs(sortBagClubs(clubs));

  var msg = document.getElementById('wgStep3Msg');
  msg.style.color = '#00b87a';
  msg.textContent = 'Session saved!';
  setTimeout(function() { wgCancelEntry(); }, 1200);
}

// Functions called from inline HTML handlers
expose({ wgClearSession, wgChangeSwingType, wgEditAvg, wgStartNew, wgCancelEntry, wgToggleClub, wgNextStep1, wgBackToStep1, wgSelectType, wgNextStep2, wgBackToStep2, wgSaveSession });

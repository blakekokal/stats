import { ic } from '../icons.js';
import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { _BAG_ORDER, getBagClubs, saveBagClubs, sortBagClubs } from './clubs.js';
import { activeUserId } from '../coaching/core.js';
import { _sb } from '../coaching/core.js';

// ─── SPEED TAB ──────────────────────────────────────────────────────────────
export var _SPEED_KEY = 'speedSessions_v1';
var _spSelectedClub = null;
var _spShotCount = 5;
var _spClubFilter = 'all';
var _spDateFilter = 'all';

export function getSpeedSessions() {
  if (S.bagViewingStudentId && S.bagStudentSpeedSessions !== null) return S.bagStudentSpeedSessions;
  try { return JSON.parse(localStorage.getItem(_SPEED_KEY)) || []; } catch(e) { return []; }
}
function saveSpeedSessions(s) {
  if (S.bagViewingStudentId) {
    S.bagStudentSpeedSessions = s;
    _sb.from('profiles').update({ speed_sessions: s }).eq('id', S.bagViewingStudentId)
      .then(function(){}).catch(function(e){ console.warn('Save student speed error:', e); });
    return;
  }
  localStorage.setItem(_SPEED_KEY, JSON.stringify(s));
  if (S.currentUser) {
    _sb.from('profiles').update({ speed_sessions: s }).eq('id', activeUserId()).then(function(){}).catch(function(){});
  }
}

function spClubGroup(name) {
  var n = (name || '').toLowerCase();
  if (n === 'dr' || n === 'dr2') return 'driver';
  if (/^\d+w$/.test(n)) return 'woods';
  if (/hy$/.test(n)) return 'hybrids';
  if (/^\d+i$/.test(n)) return 'irons';
  return 'wedges';
}

function spFilteredSessions() {
  var sessions = getSpeedSessions();
  var now = new Date();
  return sessions.filter(function(s) {
    // Club filter
    if (_spClubFilter !== 'all') {
      if (_spClubFilter === 'driver' && spClubGroup(s.club) !== 'driver') return false;
      if (_spClubFilter === 'woods'  && spClubGroup(s.club) !== 'woods')  return false;
      if (_spClubFilter === 'hybrids'&& spClubGroup(s.club) !== 'hybrids')return false;
      if (_spClubFilter === 'irons'  && spClubGroup(s.club) !== 'irons')  return false;
      if (_spClubFilter === 'wedges' && spClubGroup(s.club) !== 'wedges') return false;
    }
    // Date filter
    if (_spDateFilter !== 'all') {
      var days = { '1mo': 30, '3mo': 90, '6mo': 180, '1yr': 365 }[_spDateFilter];
      var cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - days);
      if (new Date(s.date) < cutoff) return false;
    }
    return true;
  }).sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
}

function spAvg(arr, key) {
  var vals = arr.filter(function(v){ return v[key] != null; });
  if (!vals.length) return null;
  return Math.round(vals.reduce(function(s,v){ return s + v[key]; }, 0) / vals.length * 10) / 10;
}

function spTrend(sessions, key) {
  if (sessions.length < 2) return '';
  var half = Math.ceil(sessions.length / 2);
  var recent = sessions.slice(0, half);
  var older  = sessions.slice(half);
  var r = spAvg(recent, key), o = spAvg(older, key);
  if (r == null || o == null) return '';
  var diff = Math.round((r - o) * 10) / 10;
  if (Math.abs(diff) < 0.5) return '<span style="color:#606060;font-size:10px;"> →</span>';
  return diff > 0
    ? '<span style="color:#00b87a;font-size:10px;"> ▲' + diff + '</span>'
    : '<span style="color:#d4706e;font-size:10px;"> ▼' + Math.abs(diff) + '</span>';
}

export function renderSpeedTab() {
  // Sync select values to current filter state
  var cs = document.getElementById('spClubFilterSel');
  var ds = document.getElementById('spDateFilterSel');
  if (cs) cs.value = _spClubFilter;
  if (ds) ds.value = _spDateFilter;

  var filtered = spFilteredSessions();

  // Summary card
  var summary = document.getElementById('spSummaryCard');
  var grid = document.getElementById('spSummaryGrid');
  if (filtered.length === 0) {
    if (summary) summary.style.display = 'none';
  } else {
    if (summary) summary.style.display = 'block';
    var metrics = [
      { key: 'avgClubSpeed', label: 'Club Spd', color: '#f0c830' },
      { key: 'avgBallSpeed', label: 'Ball Spd', color: '#44b8f0' },
      { key: 'avgCarry',     label: 'Carry',    color: '#ffffff' },
      { key: 'avgTotal',     label: 'Total',    color: '#ffffff' }
    ];
    if (grid) grid.innerHTML = metrics.map(function(m) {
      var val = spAvg(filtered, m.key);
      return '<div style="text-align:center;background:#282828;border-radius:8px;padding:8px 4px;">' +
        '<div style="font-size:9px;color:#9a9a9a;font-weight:600;margin-bottom:3px;">' + m.label + '</div>' +
        '<div style="font-size:16px;font-weight:800;color:' + m.color + ';">' + (val !== null ? val : '—') + '</div>' +
        spTrend(filtered, m.key) +
        '</div>';
    }).join('');
  }

  // Session list
  var list = document.getElementById('spSessionList');
  if (!list) return;
  if (filtered.length === 0) {
    list.innerHTML = '<div style="background:#222222;border-radius:12px;padding:24px;text-align:center;color:#9a9a9a;font-size:13px;">' +
      (getSpeedSessions().length === 0 ? 'No sessions yet. Tap + New Speed Session to start.' : 'No sessions match your filters.') + '</div>';
    return;
  }
  list.innerHTML = filtered.map(function(s) {
    var d = new Date(s.date + 'T12:00:00');
    var dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return '<div class="glasstile" style="padding:14px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<div style="font-size:14px;font-weight:800;color:#9a9a9a;">' + s.club + '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<div style="font-size:11px;color:#9a9a9a;">' + dateStr + ' · ' + s.shots.length + ' swings</div>' +
          '<button class="delbtn" onclick="spDeleteSession(\'' + s.id + '\')" title="Delete" aria-label="Delete">' + ic('trash') + '</button>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;">' +
        spStatCell('Club Spd', s.avgClubSpeed, '#f0c830') +
        spStatCell('Ball Spd', s.avgBallSpeed, '#44b8f0') +
        spStatCell('Carry',    s.avgCarry,     '#ffffff') +
        spStatCell('Total',    s.avgTotal,     '#ffffff') +
      '</div>' +
      (s.note ? '<div style="font-size:11px;color:#606060;margin-top:8px;font-style:italic;">' + s.note.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' : '') +
      '</div>';
  }).join('');
}

function spStatCell(label, val, color) {
  return '<div style="text-align:center;background:#282828;border-radius:8px;padding:6px 4px;">' +
    '<div style="font-size:9px;color:#9a9a9a;font-weight:600;margin-bottom:2px;">' + label + '</div>' +
    '<div style="font-size:15px;font-weight:800;color:' + color + ';">' + (val != null ? val : '—') + '</div>' +
    '</div>';
}

function spSetClubFilter(key) { _spClubFilter = key; renderSpeedTab(); }
function spSetDateFilter(key) { _spDateFilter = key; renderSpeedTab(); }

function spDeleteSession(id) {
  if (!confirm('Delete this speed session?')) return;
  saveSpeedSessions(getSpeedSessions().filter(function(s){ return s.id !== id; }));
  renderSpeedTab();
}

function spStartNewSession() {
  document.getElementById('spHistoryView').style.display = 'none';
  document.getElementById('spEntryView').style.display = '';
  spPopulateClubGrid();
  spPopulateNewClubDropdown();
  document.getElementById('spStep1').style.display = '';
  document.getElementById('spStep2').style.display = 'none';
  document.getElementById('spStep3').style.display = 'none';
  _spSelectedClub = null;
}

function spCancelEntry() {
  var noteEl = document.getElementById('spSessionNote');
  if (noteEl) noteEl.value = '';
  document.getElementById('spEntryView').style.display = 'none';
  document.getElementById('spHistoryView').style.display = '';
  renderSpeedTab();
}

function spPopulateClubGrid() {
  var clubs = getBagClubs();
  var grid = document.getElementById('spClubGrid');
  if (!grid) return;
  if (clubs.length === 0) {
    grid.innerHTML = '<div style="color:#9a9a9a;font-size:13px;width:100%;text-align:center;padding:8px 0;">No clubs in bag yet.</div>';
    return;
  }
  grid.innerHTML = clubs.map(function(c) {
    var safe = c.name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return '<button onclick="spSelectClub(\'' + safe + '\')" style="padding:8px 14px;background:#282828;border:1px solid #3d3d3d;border-radius:10px;color:#9a9a9a;font-size:13px;font-weight:700;cursor:pointer;">' + c.name + '</button>';
  }).join('');
}

function spPopulateNewClubDropdown() {
  var sel = document.getElementById('spNewClubSelect');
  if (!sel) return;
  var opts = '<option value="" disabled selected>Select a club...</option>';
  _BAG_ORDER.forEach(function(name) { opts += '<option value="' + name + '">' + name + '</option>'; });
  sel.innerHTML = opts;
}

function spPickNewClub() {
  var sel = document.getElementById('spNewClubSelect');
  var name = sel ? sel.value : '';
  if (!name) return;
  // Add to bag if not already there
  var clubs = getBagClubs();
  if (!clubs.some(function(c){ return c.name.toLowerCase() === name.toLowerCase(); })) {
    clubs.push({ name: name, carry: null, total: null });
    saveBagClubs(sortBagClubs(clubs));
  }
  spSelectClub(name);
}

function spSelectClub(name) {
  _spSelectedClub = name;
  document.getElementById('spSelectedClubLabel').textContent = name;
  document.getElementById('spStep3ClubLabel').textContent = name;
  document.getElementById('spStep1').style.display = 'none';
  document.getElementById('spStep2').style.display = '';
  spRenderShotCountBtns();
}

function spBackToStep1() {
  _spSelectedClub = null;
  document.getElementById('spStep2').style.display = 'none';
  document.getElementById('spStep1').style.display = '';
}

function spRenderShotCountBtns() {
  var container = document.getElementById('spShotCountBtns');
  if (!container) return;
  var counts = [3, 5, 10, 15, 20];
  container.innerHTML = counts.map(function(n) {
    var active = n === _spShotCount;
    return '<button onclick="spPickShotCount(' + n + ')" style="width:52px;height:44px;font-size:16px;font-weight:800;border-radius:10px;border:2px solid ' +
      (active ? '#2d7abc' : '#3d3d3d') + ';background:' + (active ? '#2d7abc' : '#282828') + ';color:' +
      (active ? '#ffffff' : '#9a9a9a') + ';cursor:pointer;">' + n + '</button>';
  }).join('') +
  '<button onclick="spGoToStep3()" style="width:100%;height:42px;margin-top:8px;background:#007a52;border:none;border-radius:10px;color:#00b87a;font-size:14px;font-weight:700;cursor:pointer;">Enter Swings →</button>';
}

function spPickShotCount(n) { _spShotCount = n; spRenderShotCountBtns(); }

function spGoToStep3() {
  document.getElementById('spStep2').style.display = 'none';
  document.getElementById('spStep3').style.display = '';
  spRenderShotInputs();
}

function spBackToStep2() {
  document.getElementById('spStep3').style.display = 'none';
  document.getElementById('spStep2').style.display = '';
  spRenderShotCountBtns();
}

function spRenderShotInputs() {
  var container = document.getElementById('spShotInputs');
  if (!container) return;
  var s1 = 'height:34px;font-size:12px;font-weight:700;text-align:center;background:#282828;border:1px solid #333333;border-radius:8px;color:#ffffff;width:100%;box-sizing:border-box;';
  var s2 = s1.replace('#282828','#2a2008').replace('#333333','#d49a10');
  var html = '';
  for (var i = 0; i < _spShotCount; i++) {
    html += '<div style="display:grid;grid-template-columns:20px 1fr 1fr 1fr 1fr;gap:4px;align-items:center;">' +
      '<div style="font-size:10px;color:#9a9a9a;font-weight:700;text-align:center;">' + (i + 1) + '</div>' +
      '<input type="number" id="spClubSpd_' + i + '" placeholder="—" min="0" max="200" style="' + s2 + 'color:#f0c830;">' +
      '<input type="number" id="spBallSpd_' + i + '" placeholder="—" min="0" max="250" style="' + s2 + 'color:#44b8f0;">' +
      '<input type="number" id="spCarry_'   + i + '" placeholder="—" min="0" max="400" style="' + s1 + '">' +
      '<input type="number" id="spTotal_'   + i + '" placeholder="—" min="0" max="450" style="' + s1 + '">' +
      '</div>';
  }
  container.innerHTML = html;
  document.getElementById('spMsg').textContent = '';
}

function spSaveSession() {
  var msg = document.getElementById('spMsg');
  var shots = [];
  for (var i = 0; i < _spShotCount; i++) {
    var cs = (function(el){ return el && el.value !== '' ? parseFloat(el.value) : null; })(document.getElementById('spClubSpd_' + i));
    var bs = (function(el){ return el && el.value !== '' ? parseFloat(el.value) : null; })(document.getElementById('spBallSpd_' + i));
    var ca = (function(el){ return el && el.value !== '' ? parseInt(el.value) : null; })(document.getElementById('spCarry_' + i));
    var to = (function(el){ return el && el.value !== '' ? parseInt(el.value) : null; })(document.getElementById('spTotal_' + i));
    if (cs !== null || bs !== null || ca !== null || to !== null) {
      shots.push({ clubSpeed: cs, ballSpeed: bs, carry: ca, total: to });
    }
  }
  if (shots.length === 0) {
    msg.style.color = '#d4706e'; msg.textContent = 'Enter at least one swing.'; return;
  }
  function avg(key) {
    var vals = shots.filter(function(s){ return s[key] != null; });
    return vals.length ? Math.round(vals.reduce(function(a,s){ return a + s[key]; }, 0) / vals.length * 10) / 10 : null;
  }
  var today = new Date();
  var dateStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  var noteEl = document.getElementById('spSessionNote');
  var session = {
    id: Date.now().toString(),
    date: dateStr,
    club: _spSelectedClub,
    note: noteEl ? noteEl.value.trim() : '',
    shots: shots,
    avgClubSpeed: avg('clubSpeed'),
    avgBallSpeed: avg('ballSpeed'),
    avgCarry:     avg('carry'),
    avgTotal:     avg('total')
  };
  var sessions = getSpeedSessions();
  sessions.push(session);
  saveSpeedSessions(sessions);
  msg.style.color = '#00b87a';
  msg.textContent = 'Session saved!';
  setTimeout(function() { spCancelEntry(); }, 1200);
}

// Functions called from inline HTML handlers
expose({ spSetClubFilter, spSetDateFilter, spDeleteSession, spStartNewSession, spCancelEntry, spPickNewClub, spSelectClub, spBackToStep1, spPickShotCount, spGoToStep3, spBackToStep2, spSaveSession });

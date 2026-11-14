import { S } from './core.js';
import { expose } from './core.js';
import { showSvMiscSubTab, showSvPracticeSubTab } from './student-misc.js';
import { loadSvNotes } from './student-notes.js';
import { loadStudentCombines, loadPerfCombineData, computePerfAnalysis, renderPerfAnalysis, escapeHtml } from './core.js';
import { studentRounds, viewRound, watchLive, liveStudents } from './gps.js';
import { _sb } from './core.js';
import { ordinalSuffix } from './core.js';
import { renderDashboard } from '../dashboard.js';

export function svHcpBadgeLabel(hcp) {
  if (hcp === 'pro') return 'vs Tour Pro';
  if (hcp === '0')   return 'vs Scratch';
  return 'vs ' + hcp + ' HCP';
}

var _hcpOptions = [
  { value: 'pro', label: 'Tour Pro' },
  { value: '0',   label: 'Scratch (0)' },
  { value: '5',   label: '5 HCP' },
  { value: '10',  label: '10 HCP' },
  { value: '15',  label: '15 HCP' },
  { value: '20',  label: '20 HCP' },
  { value: '25',  label: '25 HCP' },
  { value: '30',  label: '30 HCP' },
];

function toggleStudentHcpDropdown(e) {
  e.stopPropagation();
  var dd = document.getElementById('studentHcpDropdown');
  if (dd.style.display !== 'none') { dd.style.display = 'none'; return; }

  // Build options fresh each open so checkmark is current
  // Keep only the header (first 2 children), remove old option rows
  while (dd.children.length > 1) dd.removeChild(dd.lastChild);

  _hcpOptions.forEach(function(o) {
    var row = document.createElement('div');
    var isActive = o.value === S.currentStudentHcp;
    row.style.cssText = 'padding:7px 10px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:' + (isActive ? '700' : '500') + ';color:' + (isActive ? '#44b8f0' : '#9a9a9a') + ';background:' + (isActive ? '#1a4a8a' : 'transparent') + ';display:flex;align-items:center;gap:8px;white-space:nowrap;';
    row.innerHTML = '<span style="width:12px;font-size:10px;">' + (isActive ? '✓' : '') + '</span>' + o.label;
    row.onclick = function(ev) { ev.stopPropagation(); selectStudentHcp(o.value); };
    row.onmouseenter = function() { if (!isActive) this.style.background = '#282828'; };
    row.onmouseleave = function() { if (!isActive) this.style.background = 'transparent'; };
    dd.appendChild(row);
  });

  dd.style.display = 'block';
  // Close if user clicks anywhere else
  setTimeout(function() {
    document.addEventListener('click', function _close() {
      dd.style.display = 'none';
      document.removeEventListener('click', _close);
    });
  }, 0);
}

async function selectStudentHcp(hcp) {
  document.getElementById('studentHcpDropdown').style.display = 'none';
  S.currentStudentHcp = hcp;

  // Sync the grey badge label
  var label = document.getElementById('studentViewHcpLabel');
  if (label) label.textContent = svHcpBadgeLabel(hcp);

  // Sync the blue dashboard filter dropdown
  var hcpF = document.getElementById('svDashHcpFilter');
  if (hcpF) hcpF.value = hcp;

  // Persist to student's profiles row
  if (S.currentStudentId) {
    await _sb.from('profiles').update({ hcp_preference: hcp }).eq('id', S.currentStudentId);
  }

  // Re-render with new HCP (no data reload needed, just re-render)
  if (S.svDashAllData) applySvDashFilters();
  if (document.getElementById('svPerfTab').style.display !== 'none') loadStudentPerfAnalysis();
}

export function showStudentTab(tab) {
  document.getElementById('svDashTab').style.display          = tab === 'dashboard'   ? 'block' : 'none';
  document.getElementById('svPerfTab').style.display          = tab === 'performance' ? 'block' : 'none';
  document.getElementById('svRoundsTab').style.display        = tab === 'rounds'      ? 'block' : 'none';
  document.getElementById('svPracticePlanTab').style.display  = tab === 'practice'    ? 'block' : 'none';
  document.getElementById('svNotesTab').style.display         = tab === 'notes'       ? 'block' : 'none';
  document.getElementById('svMiscTab').style.display          = tab === 'misc'        ? 'block' : 'none';

  var dBtn = document.getElementById('svTabDash');
  var pBtn = document.getElementById('svTabPerf');
  var rBtn = document.getElementById('svTabRounds');
  var prBtn = document.getElementById('svTabPractice');
  var nBtn = document.getElementById('svTabNotes');
  var mBtn = document.getElementById('svTabMisc');

  [['dashboard', dBtn], ['performance', pBtn], ['rounds', rBtn], ['practice', prBtn], ['notes', nBtn], ['misc', mBtn]].forEach(function(pair) {
    var active = tab === pair[0];
    if (pair[1]) {
      pair[1].style.background = active ? '#2d7abc' : '#282828';
      pair[1].style.color      = active ? '#ffffff' : '#606060';
      pair[1].style.fontWeight = active ? '700' : '600';
    }
  });

  var scroll = document.getElementById('studentViewScroll');
  if (scroll) scroll.scrollTop = 0;

  if (tab === 'dashboard')   loadStudentDashboard();
  if (tab === 'performance') loadStudentPerfAnalysis();
  if (tab === 'rounds')      loadStudentRounds();
  if (tab === 'practice')    { showSvPracticeSubTab('combines'); loadStudentCombines(); }
  if (tab === 'notes')       loadSvNotes();
  if (tab === 'misc')        { showSvMiscSubTab('bag'); }
}

/* ── Student Performance Analysis ─────────────────────────────── */
var _svPerfCombineLoaded = false;
var _svPerfCachedRounds  = null;

function setSvPerfPage(page) {
  var isRounds = page === 'rounds';
  document.getElementById('svPerfPageRounds').style.display   = isRounds ? '' : 'none';
  document.getElementById('svPerfPageCombines').style.display = isRounds ? 'none' : '';
  var btnR = document.getElementById('svPerfBtnRounds');
  var btnC = document.getElementById('svPerfBtnCombines');
  if (btnR) { btnR.style.background = isRounds ? '#2d7abc' : 'transparent'; btnR.style.color = isRounds ? '#ffffff' : '#2e2e2e'; }
  if (btnC) { btnC.style.background = isRounds ? 'transparent' : '#2d7abc'; btnC.style.color = isRounds ? '#2e2e2e' : '#ffffff'; }
  if (!isRounds && !_svPerfCombineLoaded) {
    _svPerfCombineLoaded = true;
    loadSvPerfCombineData();
  }
}

async function loadStudentPerfAnalysis() {
  // Reset on each load
  _svPerfCombineLoaded = false;
  _svPerfCachedRounds  = null;
  setSvPerfPage('rounds');

  var subtitle = document.getElementById('svPerfSubtitle');
  var noRounds = document.getElementById('svPerfNoRounds');
  var content  = document.getElementById('svPerfContent');
  subtitle.textContent   = 'Loading...';
  noRounds.style.display = 'none';
  content.style.display  = 'none';

  if (!S.currentStudentId) {
    subtitle.textContent   = 'No student selected';
    noRounds.style.display = 'block';
    noRounds.textContent   = 'No student selected.';
    return;
  }

  try {
    var resp = { data: (await studentRounds(S.currentStudentId)).slice(0, 10) };

    if (resp.error) throw resp.error;
    var rounds = (resp.data || []).filter(function(r){ return r.round_data && r.round_data.allHoles; });

    if (rounds.length === 0) {
      subtitle.textContent   = 'No rounds with shot data';
      noRounds.style.display = 'block';
      noRounds.textContent   = 'This student has no rounds with detailed shot data yet.';
      return;
    }

    var hcp = S.currentStudentHcp || 'pro';
    subtitle.textContent  = 'Last ' + rounds.length + ' round' + (rounds.length > 1 ? 's' : '') + ' · ' + svHcpBadgeLabel(hcp);
    content.style.display = 'block';
    _svPerfCachedRounds   = rounds;

    var analysis = computePerfAnalysis(rounds, hcp);
    analysis.displayHcp = hcp;
    renderSvPerfAnalysis(analysis);

  } catch(e) {
    subtitle.textContent   = 'Error loading data';
    noRounds.style.display = 'block';
    noRounds.textContent   = 'Could not load rounds: ' + e.message;
  }
}

function toggleSvPerfTab(key) {
  var el = document.getElementById('svPerfTab-' + key);
  if (!el) return;
  var isOpen = el.style.display !== 'none';
  ['ott','app','arg','putt'].forEach(function(t) {
    var e = document.getElementById('svPerfTab-' + t);
    if (e) e.style.display = 'none';
  });
  if (!isOpen) el.style.display = '';
  var scroll = document.getElementById('studentViewScroll');
  if (scroll && !isOpen) setTimeout(function(){ el.scrollIntoView({behavior:'smooth',block:'nearest'}); }, 80);
}

function renderSvPerfAnalysis(a) {
  if (!a) return;
  // Priority card
  var pc = document.getElementById('svPerfPriorityCard');
  var tmpPc = document.getElementById('perfPriorityCard');
  // Reuse the existing renderPerfAnalysis internals by temporarily redirecting IDs
  // Strategy: swap IDs, call render, swap back
  var idMap = {
    'perfPriorityCard': 'svPerfPriorityCard',
    'perfCardOtt':  'svPerfCardOtt',
    'perfCardApp':  'svPerfCardApp',
    'perfCardArg':  'svPerfCardArg',
    'perfCardPutt': 'svPerfCardPutt',
    'perfTab-ott':  'svPerfTab-ott',
    'perfTab-app':  'svPerfTab-app',
    'perfTab-arg':  'svPerfTab-arg',
    'perfTab-putt': 'svPerfTab-putt',
  };
  // Temporarily rename elements so renderPerfAnalysis writes to svPerf* elements
  var origIds = {};
  Object.keys(idMap).forEach(function(origId) {
    var origEl = document.getElementById(origId);
    var newEl  = document.getElementById(idMap[origId]);
    if (origEl && newEl) {
      origIds[origId] = origEl;
      origEl.id = '__svperf_bak_' + origId;
      newEl.id  = origId;
    }
  });

  renderPerfAnalysis(a);

  // Restore IDs
  Object.keys(idMap).forEach(function(origId) {
    var newEl  = document.getElementById(origId); // currently pointing at svPerf element
    var origEl = document.getElementById('__svperf_bak_' + origId);
    if (newEl)  newEl.id  = idMap[origId];
    if (origEl) origEl.id = origId;
  });

  // Re-wire onclick for svPerf card toggles so they call toggleSvPerfTab
  ['ott','app','arg','putt'].forEach(function(k) {
    var card = document.getElementById('svPerfCard' + k.charAt(0).toUpperCase() + k.slice(1));
    if (card) card.onclick = function(){ toggleSvPerfTab(k); };
  });
}

async function loadSvPerfCombineData() {
  var loading = document.getElementById('svPerfCombineLoading');
  var grid    = document.getElementById('svPerfCombineGrid');
  var footer  = document.getElementById('svPerfCombineFooter');
  if (!loading || !grid) return;
  loading.style.display = 'block';
  grid.style.display    = 'none';

  if (!S.currentStudentId) {
    loading.textContent = 'No student selected.';
    return;
  }

  // Temporarily redirect perfCombine* IDs to svPerfCombine* so existing
  // loadPerfCombineData() writes into the student panel
  var combineIdMap = {
    'perfCombineLoading':      'svPerfCombineLoading',
    'perfCombineGrid':         'svPerfCombineGrid',
    'perfCombineFooter':       'svPerfCombineFooter',
    'perfCombinePuttFocus':    'svPerfCombinePuttFocus',
    'perfCombinePuttOverview': 'svPerfCombinePuttOverview',
    'perfCombinePuttDetail':   'svPerfCombinePuttDetail',
    'perfCombineWedgeFocus':   'svPerfCombineWedgeFocus',
    'perfCombineWedgeOverview':'svPerfCombineWedgeOverview',
    'perfCombineWedgeDetail':  'svPerfCombineWedgeDetail',
  };
  Object.keys(combineIdMap).forEach(function(origId) {
    var origEl = document.getElementById(origId);
    var newEl  = document.getElementById(combineIdMap[origId]);
    if (origEl && newEl) {
      origEl.id = '__svcomb_bak_' + origId;
      newEl.id  = origId;
    }
  });

  // Temporarily override currentUser so loadPerfCombineData queries the student
  var savedUser = S.currentUser;
  S.currentUser = { id: S.currentStudentId };

  try {
    await loadPerfCombineData();
  } catch(e) {
    var loadEl = document.getElementById('perfCombineLoading');
    if (loadEl) loadEl.textContent = 'Error loading combine data.';
  }

  S.currentUser = savedUser;

  // Restore IDs
  Object.keys(combineIdMap).forEach(function(origId) {
    var newEl  = document.getElementById(origId);
    var origEl = document.getElementById('__svcomb_bak_' + origId);
    if (newEl)  newEl.id = combineIdMap[origId];
    if (origEl) origEl.id = origId;
  });
}

async function loadStudentDashboard() {
  var loading = document.getElementById('svDashLoading');
  var content = document.getElementById('svDashContent');
  loading.style.display = 'block'; content.style.display = 'none';
  
  // The student's rounds from this app.
  var data = null, error = null;
  try { data = await studentRounds(S.currentStudentId); } catch (e) { error = e; }

  if (error || !data || data.length === 0) {
    loading.textContent = error ? 'Error: ' + error.message : 'No rounds found for this student.';
    return;
  }

  S.svDashAllData = data;
  applySvDashFilters();
}

async function onSvDashHcpChange(hcp) {
  S.currentStudentHcp = hcp;
  applySvDashFilters();
  // Sync the grey badge
  var label = document.getElementById('studentViewHcpLabel');
  if (label) label.textContent = svHcpBadgeLabel(hcp);
  var badge = document.getElementById('studentViewHcpBadge');
  if (badge) badge.style.display = 'inline-flex';
  // Save to student's profile in database
  if (S.currentStudentId) {
    await _sb.from('profiles').update({ hcp_preference: hcp }).eq('id', S.currentStudentId);
  }
}

function applySvDashFilters() {
  if (!S.svDashAllData) return;
  var typeF = document.getElementById('svDashFilterType').value;
  var timeF = document.getElementById('svDashFilterTime').value;
  var filtered = S.svDashAllData.filter(function(r) {
    if (typeF !== 'all' && r.round_type !== typeF) return false;
    if (timeF !== 'all') {
      var cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - parseInt(timeF));
      if (new Date(r.round_date) < cutoff) return false;
    }
    return true;
  });
  
  var loading = document.getElementById('svDashLoading');
  var content = document.getElementById('svDashContent');
  
  if (filtered.length === 0) {
    loading.style.display = 'block'; loading.textContent = 'No rounds match filters.';
    content.style.display = 'none'; return;
  }
  
  S.svDashData = filtered;
  S.activeDashTarget = 'svDashContent';
  loading.style.display = 'none'; content.style.display = 'block';
  
  // Reuse the same renderDashboard function but target svDashContent
  var hcpSel = document.getElementById('svDashHcpFilter');
  var hcp = hcpSel ? hcpSel.value : (S.currentStudentHcp || 'pro');
  renderDashboard(filtered, hcp, 'svDashContent');
}

export async function loadStudentRounds() {
  var msg = document.getElementById('svRoundsMsg');
  var list = document.getElementById('svRoundsList');
  msg.textContent = 'Loading...'; list.innerHTML = '';
  
  var data = null, error = null;
  try { data = await studentRounds(S.currentStudentId, true); } catch (e) { error = e; }

  if (error) { msg.textContent = 'Error: ' + error.message; return; }

  S.svAllRounds = data || [];
  // Rounds being played right now can be watched live.
  _svLive = {};
  try { (await liveStudents()).forEach(function(l) { if (l.student_id === S.currentStudentId) _svLive[l.roundId] = l.id; }); } catch (e) { /* no live list */ }
  
  if (S.svAllRounds.length === 0) { msg.textContent = 'No rounds found.'; return; }
  
  document.getElementById('svRoundSearch').value = '';
  document.getElementById('svRoundFilterType').value = 'all';
  document.getElementById('svRoundFilterHoles').value = 'all';
  document.getElementById('svRoundSortBy').value = 'date-desc';
  filterSvRounds();
}

function filterSvRounds() {
  if (!S.svAllRounds) return;
  var search = (document.getElementById('svRoundSearch').value || '').toLowerCase().trim();
  var typeF = document.getElementById('svRoundFilterType').value;
  var holesF = document.getElementById('svRoundFilterHoles').value;
  var sortBy = document.getElementById('svRoundSortBy').value;
  
  var filtered = S.svAllRounds.filter(function(r) {
    if (search && (r.course_name || '').toLowerCase().indexOf(search) === -1) return false;
    if (typeF !== 'all' && r.round_type !== typeF) return false;
    if (holesF !== 'all' && r.holes !== parseInt(holesF)) return false;
    return true;
  });
  
  // Sort the filtered results
  filtered.sort(function(a, b) {
    if (sortBy === 'date-desc') {
      return new Date(b.round_date) - new Date(a.round_date);
    } else if (sortBy === 'date-asc') {
      return new Date(a.round_date) - new Date(b.round_date);
    } else if (sortBy === 'score-asc') {
      return a.score - b.score;
    } else if (sortBy === 'score-desc') {
      return b.score - a.score;
    }
    return 0;
  });
  
  var msg = document.getElementById('svRoundsMsg');
  var list = document.getElementById('svRoundsList');
  list.innerHTML = '';
  msg.textContent = filtered.length + ' of ' + S.svAllRounds.length + ' round(s)';
  
  filtered.forEach(function(r) {
    var tp = r.to_par > 0 ? '+' + r.to_par : r.to_par === 0 ? 'E' : r.to_par;
    var d = new Date(r.round_date + 'T12:00:00');
    var dateStr = (d.getMonth()+1) + '/' + d.getDate() + '/' + d.getFullYear();
    var placeStr = (r.round_type === 'Tournament' && r.tournament_place) ? ' — ' + ordinalSuffix(r.tournament_place) + ' Place' : '';
    var typeTag = r.round_type === 'Tournament' ? '<div style="color:#f0c830;font-size:11px;font-weight:700;margin-top:2px;">★ Tournament' + placeStr + '</div>' : '';
    var card = document.createElement('div');
    card.style.cssText = 'background:#282828;border-radius:10px;padding:12px;margin:6px 0;';
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;">'
      + '<div style="text-align:left;"><div style="font-weight:700;font-size:14px;">' + escapeHtml(r.course_name) + '</div>'
      + typeTag
      + '<div style="font-size:12px;color:#9a9a9a;">' + dateStr + ' · ' + r.holes + 'h</div></div>'
      + '<div style="text-align:right;"><div style="font-size:20px;font-weight:800;">' + r.score + '</div>'
      + '<div style="font-size:13px;color:' + (r.to_par>0?'#d4706e':r.to_par<0?'#00a06d':'#9a9a9a') + '">' + tp + '</div></div></div>'
      + '<div style="display:flex;gap:6px;margin-top:8px;">'
      + (_svLive[r.id] ? '<button onclick="svWatchLive(\'' + r.id + '\')" style="flex:1;height:30px;font-size:12px;background:#c8102e;border-radius:6px;font-weight:700;">\u25cf Watch live</button>' : '')
      + '<button onclick="svViewRound(\'' + r.id + '\')" style="flex:1;height:30px;font-size:12px;background:#2d7abc;border-radius:6px;font-weight:700;">View round</button>'
      + '</div>';
    list.appendChild(card);
  });
}

// =============================================
// UPLOAD / IMPORT ROUND FROM EXCEL
// =============================================

// Open one of the student's rounds read-only on the hole screen, or watch it live.
var _svLive = {}; // round id -> live share id, for rounds being played now
function svViewRound(roundId) {
  var r = (S.svAllRounds || []).find(function(x) { return x.id === roundId; });
  if (r) viewRound(r._gps, document.getElementById('studentViewName').textContent);
}
function svWatchLive(roundId) { if (_svLive[roundId]) watchLive(_svLive[roundId]); }

// Functions called from inline HTML handlers
expose({ toggleStudentHcpDropdown, showStudentTab, setSvPerfPage, toggleSvPerfTab, onSvDashHcpChange, applySvDashFilters, filterSvRounds, svViewRound, svWatchLive });

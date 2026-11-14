import { S } from './core.js';
import { expose } from './core.js';
import { _BAG_ORDER, sortBagClubs } from './core.js';
import { loadStudentGoalsAndHandicap } from './student-goals.js';
import { loadStudentCombines } from './core.js';
import { _sb } from './core.js';
import { escHtml } from './core.js';

// ── Coach viewing student practice sessions ──
// ─── Student Bag (Coach View) ────────────────────────────────
var _svBagClubs = [];

export function showSvPracticeSubTab(tab) {
  var combinesEl = document.getElementById('svPracticeCombinesContent');
  var practiceEl = document.getElementById('svPracticeSubContent');
  var btnC = document.getElementById('svPracticeToggleCombines');
  var btnP = document.getElementById('svPracticeTogglePractice');
  if (tab === 'combines') {
    if (combinesEl) combinesEl.style.display = 'block';
    if (practiceEl) practiceEl.style.display = 'none';
    if (btnC) { btnC.style.background = '#2d7abc'; btnC.style.color = '#ffffff'; }
    if (btnP) { btnP.style.background = '#1e1e1e'; btnP.style.color = '#606060'; }
    loadStudentCombines();
  } else {
    if (combinesEl) combinesEl.style.display = 'none';
    if (practiceEl) practiceEl.style.display = 'block';
    if (btnC) { btnC.style.background = '#1e1e1e'; btnC.style.color = '#606060'; }
    if (btnP) { btnP.style.background = '#2d7abc'; btnP.style.color = '#ffffff'; }
    loadStudentPracticeSessions();
  }
}

export function showSvMiscSubTab(tab) {
  var bagEl = document.getElementById('svBagSubContent');
  var goalsEl = document.getElementById('svGoalsSubContent');
  var schedEl = document.getElementById('svScheduleSubContent');
  var btnB = document.getElementById('svMiscToggleBag');
  var btnG = document.getElementById('svMiscToggleGoals');
  var btnS = document.getElementById('svMiscToggleSchedule');
  var allBtns = [btnB, btnG, btnS];
  var allEls = [bagEl, goalsEl, schedEl];
  // Hide all
  allEls.forEach(function(el) { if (el) el.style.display = 'none'; });
  allBtns.forEach(function(b) { if (b) { b.style.background = '#1e1e1e'; b.style.color = '#606060'; } });
  if (tab === 'bag') {
    if (bagEl) bagEl.style.display = 'block';
    if (btnB) { btnB.style.background = '#2d7abc'; btnB.style.color = '#ffffff'; }
    loadStudentBag();
  } else if (tab === 'goals') {
    if (goalsEl) goalsEl.style.display = 'block';
    if (btnG) { btnG.style.background = '#2d7abc'; btnG.style.color = '#ffffff'; }
    loadStudentGoalsAndHandicap();
  } else {
    if (schedEl) schedEl.style.display = 'block';
    if (btnS) { btnS.style.background = '#2d7abc'; btnS.style.color = '#ffffff'; }
    loadStudentSchedule();
  }
}

/* ── Student Schedule (under Misc tab) ─────────────────────────── */
async function loadStudentSchedule() {
  if (!S.currentStudentId) return;
  var list = document.getElementById('svSchedList');
  var emptyMsg = document.getElementById('svSchedEmptyMsg');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;color:#606060;font-size:13px;padding:12px;">Loading...</div>';

  var { data, error } = await _sb.from('profiles').select('schedule').eq('id', S.currentStudentId).single();
  if (error) {
    list.innerHTML = '<div style="text-align:center;color:#d4706e;font-size:13px;padding:12px;">Error loading schedule</div>';
    return;
  }

  var entries = (data && data.schedule) ? data.schedule : [];
  // Sort by date ascending
  entries.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
  // Filter to only show future/today
  var today = new Date().toISOString().split('T')[0];
  entries = entries.filter(function(e) { return e.date >= today; });

  if (entries.length === 0) {
    if (emptyMsg) emptyMsg.style.display = 'block';
    list.innerHTML = '';
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';

  list.innerHTML = entries.map(function(e, idx) {
    var dateStr = e.date ? new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    return '<div style="background:#222222;border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;">' +
      '<div>' +
        '<div style="font-size:14px;font-weight:700;color:#9a9a9a;">' + (e.course || 'TBD') + '</div>' +
        (e.tournament ? '<div style="font-size:12px;color:#44b8f0;margin-top:2px;">' + e.tournament + '</div>' : '') +
        '<div style="font-size:11px;color:#606060;margin-top:2px;">📅 ' + dateStr + '</div>' +
      '</div>' +
      '<button onclick="removeSvScheduleEntry(' + idx + ')" style="width:28px;height:28px;background:#2a1a1a;border:1px solid #351a1a;border-radius:8px;color:#d4706e;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;flex-shrink:0;">×</button>' +
    '</div>';
  }).join('');
}

async function addSvScheduleEntry() {
  if (!S.currentStudentId) return;
  var dateVal = document.getElementById('svSchedDate').value;
  var courseVal = document.getElementById('svSchedCourse').value.trim();
  var tournVal = document.getElementById('svSchedTournament').value.trim();
  var msg = document.getElementById('svSchedAddMsg');

  if (!dateVal || !courseVal) {
    if (msg) { msg.style.color = '#d4706e'; msg.textContent = 'Date and course are required.'; }
    return;
  }

  var { data, error } = await _sb.from('profiles').select('schedule').eq('id', S.currentStudentId).single();
  var entries = (data && data.schedule) ? data.schedule : [];
  entries.push({ date: dateVal, course: courseVal, tournament: tournVal || null });

  var { error: err2 } = await _sb.from('profiles').update({ schedule: entries }).eq('id', S.currentStudentId);
  if (err2) {
    if (msg) { msg.style.color = '#d4706e'; msg.textContent = 'Error saving.'; }
    return;
  }

  document.getElementById('svSchedDate').value = '';
  document.getElementById('svSchedCourse').value = '';
  document.getElementById('svSchedTournament').value = '';
  if (msg) { msg.style.color = '#00b87a'; msg.textContent = 'Round added!'; setTimeout(function() { msg.textContent = ''; }, 3000); }
  loadStudentSchedule();
}

async function removeSvScheduleEntry(idx) {
  if (!S.currentStudentId) return;
  var { data } = await _sb.from('profiles').select('schedule').eq('id', S.currentStudentId).single();
  var entries = (data && data.schedule) ? data.schedule : [];
  // Re-sort and filter same as display
  entries.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
  var today = new Date().toISOString().split('T')[0];
  var future = entries.filter(function(e) { return e.date >= today; });
  var removed = future[idx];
  if (!removed) return;
  // Remove from original array
  var origIdx = entries.indexOf(removed);
  if (origIdx !== -1) entries.splice(origIdx, 1);
  await _sb.from('profiles').update({ schedule: entries }).eq('id', S.currentStudentId);
  loadStudentSchedule();
}

async function loadStudentBag() {
  if (!S.currentStudentId) return;
  var emptyMsg = document.getElementById('svBagEmptyMsg');
  var headers = document.getElementById('svBagClubHeaders');
  var list = document.getElementById('svBagClubList');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;color:#606060;font-size:13px;padding:12px;">Loading...</div>';

  var { data, error } = await _sb.from('profiles').select('bag_clubs').eq('id', S.currentStudentId).single();
  if (error) {
    list.innerHTML = '<div style="text-align:center;color:#d4706e;font-size:13px;padding:12px;">Error loading bag</div>';
    return;
  }

  _svBagClubs = (data && data.bag_clubs) ? data.bag_clubs : [];
  renderSvBagClubs();
}

function populateSvBagDropdown() {
  var sel = document.getElementById('svBagClubName');
  if (!sel) return;
  var inBag = {};
  _svBagClubs.forEach(function(c) { inBag[c.name.toLowerCase()] = true; });
  var opts = '<option value="" disabled selected>Select a club...</option>';
  _BAG_ORDER.forEach(function(name) {
    if (!inBag[name.toLowerCase()]) {
      opts += '<option value="' + name + '">' + name + '</option>';
    }
  });
  sel.innerHTML = opts;
}

function renderSvBagClubs() {
  var clubs = _svBagClubs;
  var list = document.getElementById('svBagClubList');
  var emptyMsg = document.getElementById('svBagEmptyMsg');
  var headers = document.getElementById('svBagClubHeaders');
  if (!list) return;
  populateSvBagDropdown();

  if (clubs.length === 0) {
    list.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = 'block';
    if (headers) headers.style.display = 'none';
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';
  if (headers) headers.style.display = 'grid';

  list.innerHTML = clubs.map(function(club, idx) {
    var carry = (club.carry !== null && club.carry !== undefined) ? club.carry : '';
    var total = (club.total !== null && club.total !== undefined) ? club.total : '';
    return '<div style="display:grid;grid-template-columns:1fr 80px 80px 36px;gap:6px;align-items:center;background:#222222;border-radius:10px;padding:8px 10px;">' +
      '<div style="font-size:14px;font-weight:700;color:#9a9a9a;">' + club.name + '</div>' +
      '<input type="number" value="' + carry + '" placeholder="—" min="0" max="400" ' +
        'onchange="updateSvBagClub(' + idx + ',\'carry\',this.value)" ' +
        'style="height:36px;font-size:14px;font-weight:700;text-align:center;background:#282828;border:1px solid #333333;border-radius:8px;color:#ffffff;width:100%;box-sizing:border-box;">' +
      '<input type="number" value="' + total + '" placeholder="—" min="0" max="450" ' +
        'onchange="updateSvBagClub(' + idx + ',\'total\',this.value)" ' +
        'style="height:36px;font-size:14px;font-weight:700;text-align:center;background:#282828;border:1px solid #333333;border-radius:8px;color:#ffffff;width:100%;box-sizing:border-box;">' +
      '<button onclick="removeSvBagClub(' + idx + ')" ' +
        'style="width:32px;height:32px;background:#2a1a1a;border:1px solid #351a1a;border-radius:8px;color:#d4706e;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;">×</button>' +
      '</div>';
  }).join('');
}

async function saveSvBagClubs() {
  if (!S.currentStudentId) return;
  var statusEl = document.getElementById('svBagSaveStatus');
  if (statusEl) { statusEl.style.color = '#606060'; statusEl.textContent = 'Saving...'; }
  try {
    var { data, error } = await _sb.from('profiles').update({ bag_clubs: _svBagClubs }).eq('id', S.currentStudentId).select('bag_clubs');
    if (error) {
      if (statusEl) { statusEl.style.color = '#d4706e'; statusEl.textContent = 'Save failed: ' + error.message; }
      return;
    }
    // Verify the write actually persisted (RLS can silently block updates)
    if (!data || data.length === 0) {
      if (statusEl) { statusEl.style.color = '#d4706e'; statusEl.textContent = 'Save failed — unable to update student profile. Check database permissions.'; }
      return;
    }
    if (statusEl) { statusEl.style.color = '#00b87a'; statusEl.textContent = 'Saved'; setTimeout(function() { if (statusEl.textContent === 'Saved') statusEl.textContent = ''; }, 2000); }
  } catch(e) {
    if (statusEl) { statusEl.style.color = '#d4706e'; statusEl.textContent = 'Save error: ' + e.message; }
  }
}

async function addSvBagClub() {
  var nameEl = document.getElementById('svBagClubName');
  var carryEl = document.getElementById('svBagCarryInput');
  var totalEl = document.getElementById('svBagTotalInput');
  var msg = document.getElementById('svBagAddMsg');
  var name = nameEl ? nameEl.value : '';
  if (!name) { msg.style.color = '#d4706e'; msg.textContent = 'Select a club.'; return; }
  var carry = carryEl.value !== '' ? parseInt(carryEl.value) : null;
  var total = totalEl.value !== '' ? parseInt(totalEl.value) : null;
  if (carry === null && total === null) { msg.style.color = '#d4706e'; msg.textContent = 'Enter at least one distance.'; return; }
  if (_svBagClubs.some(function(c) { return c.name.toLowerCase() === name.toLowerCase(); })) {
    msg.style.color = '#d4706e'; msg.textContent = name + ' is already in the bag.'; return;
  }
  _svBagClubs.push({ name: name, carry: carry, total: total });
  _svBagClubs = sortBagClubs(_svBagClubs);
  await saveSvBagClubs();
  carryEl.value = ''; totalEl.value = '';
  msg.style.color = '#00b87a'; msg.textContent = name + ' added!';
  setTimeout(function() { msg.textContent = ''; }, 2500);
  renderSvBagClubs();
}

async function removeSvBagClub(idx) {
  _svBagClubs.splice(idx, 1);
  await saveSvBagClubs();
  renderSvBagClubs();
}

async function updateSvBagClub(idx, field, value) {
  if (_svBagClubs[idx]) {
    _svBagClubs[idx][field] = value !== '' ? parseInt(value) : null;
    await saveSvBagClubs();
  }
}

async function loadStudentPracticeSessions() {
  if (!S.currentStudentId) return;
  var msg = document.getElementById('svPracticePlanMsg');
  var list = document.getElementById('svPracticePlanList');
  if (!msg || !list) return;
  msg.textContent = 'Loading...'; list.innerHTML = '';

  var { data, error } = await _sb.from('practice_sessions').select('*').eq('user_id', S.currentStudentId).order('session_date', {ascending: false}).order('created_at', {ascending: false});
  if (error) { msg.textContent = 'Error: ' + error.message; return; }
  if (!data || data.length === 0) { msg.textContent = 'No practice sessions found for this student.'; return; }
  msg.textContent = '';

  var combineIds = data.filter(function(s) { return s.combine_score_id; }).map(function(s) { return s.combine_score_id; });
  var combinesMap = {};
  if (combineIds.length > 0) {
    var { data: combines } = await _sb.from('combine_scores').select('id, combine_type, total_sg, is_combine, grade_100').in('id', combineIds);
    if (combines) combines.forEach(function(c) { combinesMap[c.id] = c; });
  }

  var html = '';
  data.forEach(function(s) {
    var notes = [];
    try { notes = JSON.parse(s.notes || '[]'); } catch(e) {}
    var comb = s.combine_score_id ? combinesMap[s.combine_score_id] : null;

    html += '<div style="background:#222222;border-radius:12px;padding:14px;margin-bottom:10px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
    var _dp = (s.session_date || '').split('-'), _mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var _dispDate = _dp.length === 3 ? (_mn[parseInt(_dp[1],10)-1] + ' ' + parseInt(_dp[2],10) + ', ' + _dp[0]) : (s.session_date || '');
    html += '<div style="font-size:14px;font-weight:800;color:#ffffff;">' + _dispDate + '</div>';
    html += '<div style="font-size:13px;font-weight:700;color:#00b87a;">' + (s.total_minutes || 0) + ' min</div>';
    html += '</div>';

    if (comb) {
      var sg = comb.total_sg != null ? (comb.total_sg >= 0 ? '+' : '') + comb.total_sg.toFixed(1) : '';
      var grade = comb.grade_100 != null ? Math.round(comb.grade_100) : '';
      html += '<div style="background:#1a4a8a;border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:12px;">';
      html += '<span style="color:#44b8f0;font-weight:700;">' + comb.combine_type + (comb.is_combine ? ' Combine' : ' Practice') + '</span>';
      if (sg) html += ' <span style="color:' + (comb.total_sg <= 0 ? '#00b87a' : '#d4706e') + ';">' + sg + ' SG</span>';
      if (grade) html += ' <span style="color:#606060;">Grade: ' + grade + '</span>';
      html += '</div>';
    }

    if (notes.length > 0) {
      notes.forEach(function(n) {
        html += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;">';
        html += '<span style="color:#9a9a9a;">' + escHtml(n.text) + '</span>';
        html += '<span style="color:#00b87a;font-weight:700;white-space:nowrap;margin-left:8px;">' + n.minutes + ' min</span>';
        html += '</div>';
      });
    }

    html += '</div>';
  });
  list.innerHTML = html;
}

// Functions called from inline HTML handlers
expose({ showSvPracticeSubTab, showSvMiscSubTab, addSvScheduleEntry, removeSvScheduleEntry, addSvBagClub, removeSvBagClub, updateSvBagClub });

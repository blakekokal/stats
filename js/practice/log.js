import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { renderCombCard } from '../combines/history.js';
import { activeUserId } from '../coaching/core.js';
import { _sb } from '../coaching/core.js';
import { escHtml, formatDateForDisplay, getTodayCentral } from '../coaching/core.js';
import { setPracticeHubTab } from './hub.js';
import { ppShowHistory, ppShowLogSession } from './plans.js';

export async function loadPHCombineHistory() {
  var msg  = document.getElementById('phCombineHistoryMsg');
  var list = document.getElementById('phCombineHistory');
  if (!msg || !list) return;
  if (!S.currentUser) { msg.textContent = 'Log in to see combine history.'; list.innerHTML = ''; return; }
  msg.textContent = 'Loading...'; list.innerHTML = '';

  var typeF = (document.getElementById('phCombFilterType') || {}).value || 'all';
  var modeF = (document.getElementById('phCombFilterMode') || {}).value || 'all';

  var query = _sb.from('combine_scores').select('*').eq('user_id', activeUserId()).order('combine_date', {ascending: false}).order('created_at', {ascending: false});
  if (typeF !== 'all') query = query.eq('combine_type', typeF);
  if (modeF === 'combine') query = query.eq('is_combine', true);
  if (modeF === 'custom')  query = query.eq('is_combine', false);

  var { data, error } = await query;
  if (error) { msg.textContent = 'Error: ' + error.message; return; }
  if (!data || data.length === 0) { msg.textContent = 'No scores saved yet — complete a session and hit Save!'; return; }
  msg.textContent = '';
  list.innerHTML = data.map(function(c) { return renderCombCard(c, true); }).join('');
}

// =============================================
// MY PRACTICE PLAN
// =============================================


function setPracticePlanSubTab(sub) {
  // Legacy compat — now handled by ppShowLogSession / ppShowHistory
  if (sub === 'new') ppShowLogSession();
  else if (sub === 'history') ppShowHistory();
}

export function initPracticeSessionForm() {
  S.editingPracticeSessionId = null;
  var dateInput = document.getElementById('ppSessionDate');
  if (dateInput && !dateInput.value) {
    dateInput.value = getTodayCentral();
  }
  S.practiceNotes = [];
  renderPracticeNotes();
  document.getElementById('ppSaveMsg').textContent = '';
  var saveBtn = document.getElementById('ppSaveBtn');
  if (saveBtn) saveBtn.textContent = 'Save Practice Session';
}

export async function loadPracticePlanCombineOptions() {
  if (!S.currentUser) return;
  var sel = document.getElementById('ppSessionCombine');
  if (!sel) return;
  sel.innerHTML = '<option value="">None</option>';
  var { data } = await _sb.from('combine_scores').select('id, combine_date, combine_type, total_sg, is_combine').eq('user_id', activeUserId()).order('combine_date', {ascending: false}).limit(20);
  if (!data || data.length === 0) return;
  data.forEach(function(c) {
    var label = c.combine_date + ' - ' + c.combine_type + (c.is_combine ? ' (Combine)' : ' (Practice)');
    if (c.total_sg != null) label += ' | SG: ' + (c.total_sg >= 0 ? '+' : '') + c.total_sg.toFixed(1);
    var opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = label;
    sel.appendChild(opt);
  });
}

function addPracticeNote() {
  var noteInput = document.getElementById('ppNoteInput');
  var minsInput = document.getElementById('ppNoteMinutes');
  var text = (noteInput.value || '').trim();
  var mins = parseInt(minsInput.value) || 0;
  if (!text) { noteInput.focus(); return; }
  if (mins < 1) { minsInput.focus(); return; }
  S.practiceNotes.push({ text: text, minutes: mins });
  noteInput.value = '';
  minsInput.value = '';
  noteInput.focus();
  renderPracticeNotes();
}

function removePracticeNote(idx) {
  S.practiceNotes.splice(idx, 1);
  renderPracticeNotes();
}

export function renderPracticeNotes() {
  var list = document.getElementById('ppNotesList');
  var totalEl = document.getElementById('ppTotalTime');
  if (!list) return;
  if (S.practiceNotes.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:12px;padding:8px 0;">No notes yet. Add what you practiced above.</div>';
    if (totalEl) totalEl.textContent = '0 min';
    return;
  }
  var total = 0;
  var html = '';
  S.practiceNotes.forEach(function(n, i) {
    total += n.minutes;
    html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#282828;border-radius:8px;margin-bottom:4px;">';
    html += '<div style="flex:1;font-size:13px;color:#ffffff;">' + escHtml(n.text) + '</div>';
    html += '<div style="font-size:12px;font-weight:700;color:#00b87a;white-space:nowrap;">' + n.minutes + ' min</div>';
    html += '<button onclick="removePracticeNote(' + i + ')" style="background:transparent;border:none;color:#d4706e;font-size:16px;cursor:pointer;padding:0 4px;height:auto;max-width:none;width:auto;">×</button>';
    html += '</div>';
  });
  list.innerHTML = html;
  if (totalEl) totalEl.textContent = total + ' min';
}

async function savePracticeSession() {
  var msg = document.getElementById('ppSaveMsg');
  if (!S.currentUser) { msg.style.color = '#d4706e'; msg.textContent = 'Please log in first.'; return; }

  var dateVal = document.getElementById('ppSessionDate').value;
  if (!dateVal) { msg.style.color = '#d4706e'; msg.textContent = 'Please select a date.'; return; }
  if (S.practiceNotes.length === 0) { msg.style.color = '#d4706e'; msg.textContent = 'Add at least one practice note.'; return; }

  var combineId = document.getElementById('ppSessionCombine').value || null;
  var totalMins = 0;
  S.practiceNotes.forEach(function(n) { totalMins += n.minutes; });

  msg.style.color = '#606060'; msg.textContent = 'Saving...';

  if (S.editingPracticeSessionId) {
    // UPDATE existing session
    var updatePayload = {
      session_date: dateVal,
      combine_score_id: combineId,
      notes: JSON.stringify(S.practiceNotes),
      total_minutes: totalMins
    };
    var { error } = await _sb.from('practice_sessions').update(updatePayload).eq('id', S.editingPracticeSessionId).eq('user_id', activeUserId());
    if (error) { msg.style.color = '#d4706e'; msg.textContent = 'Update failed: ' + error.message; return; }
    msg.style.color = '#00b87a'; msg.textContent = 'Practice session updated!';
    S.editingPracticeSessionId = null;
    S.practiceNotes = [];
    renderPracticeNotes();
    document.getElementById('ppSessionCombine').value = '';
    var saveBtn = document.getElementById('ppSaveBtn');
    if (saveBtn) saveBtn.textContent = 'Save Practice Session';
    return;
  }

  // INSERT new session
  var payload = {
    user_id: activeUserId(),
    session_date: dateVal,
    combine_score_id: combineId,
    notes: JSON.stringify(S.practiceNotes),
    total_minutes: totalMins,
    created_at: new Date().toISOString()
  };

  var { error } = await _sb.from('practice_sessions').insert(payload);
  if (error) { msg.style.color = '#d4706e'; msg.textContent = 'Save failed: ' + error.message; return; }

  msg.style.color = '#00b87a'; msg.textContent = 'Practice session saved!';
  S.practiceNotes = [];
  renderPracticeNotes();
  document.getElementById('ppSessionCombine').value = '';

  // Notify coach if linked
  try {
    var { data: profile } = await _sb.from('profiles').select('coach_id').eq('id', S.currentUser.id).single();
    if (profile && profile.coach_id) {
      var playerName = S.currentUser.user_metadata && S.currentUser.user_metadata.display_name ? S.currentUser.user_metadata.display_name : (S.currentUser.email || 'A student');
      await _sb.from('notifications').insert({
        user_id: profile.coach_id,
        type: 'practice_session',
        title: playerName + ' logged a practice session',
        message: formatDateForDisplay(dateVal) + ' - ' + totalMins + ' min total' + (combineId ? ' (with combine)' : ''),
        read: false,
        created_at: new Date().toISOString()
      });
    }
  } catch(e) {}
}

export async function loadPracticeHistory() {
  var list = document.getElementById('ppHistoryList');
  if (!list) return;
  if (!S.currentUser) { list.textContent = 'Log in to see practice history.'; return; }
  list.textContent = 'Loading...';

  var { data, error } = await _sb.from('practice_sessions').select('*').eq('user_id', activeUserId()).order('session_date', {ascending: false}).order('created_at', {ascending: false});
  if (error) { list.textContent = 'Error: ' + error.message; return; }
  if (!data || data.length === 0) { list.textContent = 'No practice sessions yet. Log your first session!'; return; }

  // Fetch any linked combines
  var combineIds = data.filter(function(s) { return s.combine_score_id; }).map(function(s) { return s.combine_score_id; });
  var combinesMap = {};
  if (combineIds.length > 0) {
    var { data: combines } = await _sb.from('combine_scores').select('id, combine_type, total_sg, is_combine, grade_100').in('id', combineIds);
    if (combines) combines.forEach(function(c) { combinesMap[c.id] = c; });
  }

  _practiceHistoryCache = {};
  var html = '';
  data.forEach(function(s) {
    _practiceHistoryCache[s.id] = s;
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
      notes.forEach(function(n, ni) {
        var done = n.done ? true : false;
        var uid = 'ppHistDrill_' + s.id + '_' + ni;
        html += '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;">';
        html += '<div id="' + uid + '" data-session-id="' + s.id + '" data-note-idx="' + ni + '" data-done="' + (done ? '1' : '0') + '" onclick="ppToggleHistoryDrill(this,event)" style="width:20px;height:20px;min-width:20px;border-radius:50%;border:2px solid ' + (done ? '#00c853' : '#555') + ';background:' + (done ? '#00c853' : 'transparent') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;">' + (done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : '') + '</div>';
        html += '<div style="flex:1;font-size:12px;color:' + (done ? '#666' : '#9a9a9a') + ';' + (done ? 'text-decoration:line-through;opacity:0.5;' : '') + '">' + escHtml(n.text) + '</div>';
        html += '<span style="font-size:12px;color:#00b87a;font-weight:700;white-space:nowrap;margin-left:8px;">' + n.minutes + ' min</span>';
        html += '</div>';
      });
    }

    html += '<div style="display:flex;justify-content:flex-end;gap:12px;margin-top:6px;">';
    html += '<button onclick="editPracticeSession(\'' + s.id + '\')" style="background:transparent;border:none;color:#44b8f0;font-size:11px;font-weight:700;cursor:pointer;padding:0;height:auto;max-width:none;width:auto;">Edit</button>';
    html += '<button onclick="deletePracticeSession(\'' + s.id + '\')" style="background:transparent;border:none;color:#2e2e2e;font-size:11px;cursor:pointer;padding:0;height:auto;max-width:none;width:auto;">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  list.innerHTML = html;
}

var _practiceHistoryCache = {};

function editPracticeSession(id) {
  var s = _practiceHistoryCache[id];
  if (!s) return;

  S.editingPracticeSessionId = id;
  try { S.practiceNotes = JSON.parse(s.notes || '[]'); } catch(e) { S.practiceNotes = []; }

  // Switch to Practice tab and New Session sub-tab
  setPracticeHubTab('plan');
  setPracticePlanSubTab('new');

  // Populate form
  var dateInput = document.getElementById('ppSessionDate');
  if (dateInput) dateInput.value = s.session_date || '';
  var combSel = document.getElementById('ppSessionCombine');
  if (combSel) combSel.value = s.combine_score_id || '';

  renderPracticeNotes();
  document.getElementById('ppSaveMsg').textContent = '';
  var saveBtn = document.getElementById('ppSaveBtn');
  if (saveBtn) saveBtn.textContent = 'Update Practice Session';

  // Scroll to top so the form is visible
  var scroll = document.getElementById('practiceHubScroll');
  if (scroll) scroll.scrollTop = 0;
}

async function deletePracticeSession(id) {
  if (!confirm('Delete this practice session?')) return;
  var { error } = await _sb.from('practice_sessions').delete().eq('id', id).eq('user_id', activeUserId());
  if (error) { alert('Delete failed: ' + error.message); return; }
  loadPracticeHistory();
}

async function ppToggleHistoryDrill(el, e) {
  e.stopPropagation();
  var sessionId = el.getAttribute('data-session-id');
  var idx = parseInt(el.getAttribute('data-note-idx'));
  var s = _practiceHistoryCache[sessionId];
  if (!s) return;

  var notes = [];
  try { notes = JSON.parse(s.notes || '[]'); } catch(ex) { return; }
  if (idx < 0 || idx >= notes.length) return;

  var done = el.getAttribute('data-done') === '1';
  notes[idx].done = !done;

  // Update visual
  if (!done) {
    el.setAttribute('data-done', '1');
    el.style.background = '#00c853';
    el.style.borderColor = '#00c853';
    el.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    var textEl = el.nextElementSibling;
    if (textEl) { textEl.style.opacity = '0.5'; textEl.style.textDecoration = 'line-through'; textEl.style.color = '#666'; }
  } else {
    el.setAttribute('data-done', '0');
    el.style.background = 'transparent';
    el.style.borderColor = '#555';
    el.innerHTML = '';
    var textEl = el.nextElementSibling;
    if (textEl) { textEl.style.opacity = '1'; textEl.style.textDecoration = 'none'; textEl.style.color = '#9a9a9a'; }
  }

  // Save to DB
  s.notes = JSON.stringify(notes);
  _practiceHistoryCache[sessionId] = s;
  await _sb.from('practice_sessions').update({ notes: JSON.stringify(notes) }).eq('id', sessionId).eq('user_id', activeUserId());
}

// Functions called from inline HTML handlers
expose({ loadPHCombineHistory, addPracticeNote, removePracticeNote, savePracticeSession, editPracticeSession, deletePracticeSession, ppToggleHistoryDrill });

import { S } from './core.js';
import { expose } from './core.js';
import { populateCoachDrillList } from './assign.js';
import { loadCoachMessages } from './messages.js';
import { loadCoachRequests } from './roles.js';
import { loadRosterHandicaps } from './student-goals.js';
import { setCoachNoteType, showCoachCoachingTab } from './student-side.js';
import { loadCoachTeams } from './teams.js';
import { _sb } from './core.js';
import { escapeHtml } from './core.js';

export async function loadCoachingPageCoachView() {
  loadCoachRequests(); // Show pending coach requests for admin
  var { data: students, error } = await _sb.from('coach_students')
    .select('student_id, student_name, student_email, team_id')
    .eq('coach_id', S.currentUser.id)
    .order('student_name', { ascending: true });

  var count = (students && !error) ? students.length : 0;
  document.getElementById('coachStatStudents').textContent = count;

  var { data: notifs } = await _sb.from('notifications')
    .select('id').eq('user_id', S.currentUser.id).eq('read', false);
  document.getElementById('coachStatNewRounds').textContent = (notifs ? notifs.length : 0);

  var { data: notes } = await _sb.from('coach_notes').select('id').eq('coach_id', S.currentUser.id);
  document.getElementById('coachStatNotes').textContent = (notes ? notes.length : 0);

  renderCoachingStudentRoster(students || []);
  populateCoachStudentSelects(students || []);
  loadCoachActivityFeed();
  populateCoachDrillList();
  // Load handicap badges for each student
  loadRosterHandicaps(students || []);
  // Load teams for the Students tab
  loadCoachTeams();
}

function renderCoachingStudentRoster(students) {
  S.coachRosterData = students || [];
  // Old flat roster removed — teams view handles display now
  // Just store data for other functions that reference it
}

function filterCoachingRoster() {
  // Old flat roster removed — teams view handles display now
}

function populateCoachStudentSelects(students) {
  S.coachStudentsForSearch = students || [];

  var selIds = ['coachDrillStudentSelect', 'coachCombStudentSelect', 'coachMsgStudentSelect'];
  selIds.forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">Select student...</option>';
    (students || []).forEach(function(s) {
      var opt = document.createElement('option');
      opt.value = s.student_id;
      opt.textContent = s.student_name || 'Student';
      sel.appendChild(opt);
    });
  });
}

function filterCoachNoteStudents() {
  var query = (document.getElementById('coachNoteStudentSearch').value || '').toLowerCase().trim();
  var dropdown = document.getElementById('coachNoteStudentDropdown');
  var students = S.coachStudentsForSearch || [];

  if (!query) { dropdown.style.display = 'none'; return; }

  var filtered = students.filter(function(s) {
    return (s.student_name || '').toLowerCase().indexOf(query) !== -1;
  });

  dropdown.innerHTML = '';
  if (filtered.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText = 'padding:10px;color:#2e2e2e;font-size:13px;text-align:center;';
    empty.textContent = 'No students found';
    dropdown.appendChild(empty);
  } else {
    filtered.forEach(function(s) {
      var item = document.createElement('div');
      item.style.cssText = 'padding:10px 14px;cursor:pointer;font-size:14px;font-weight:600;border-bottom:1px solid #333333;';
      item.textContent = s.student_name || 'Student';
      item.dataset.studentId = s.student_id;
      item.dataset.studentName = s.student_name || 'Student';
      item.addEventListener('mouseover', function(){ this.style.background = '#2d7abc'; });
      item.addEventListener('mouseout',  function(){ this.style.background = ''; });
      item.addEventListener('click', function() {
        selectCoachNoteStudent(this.dataset.studentId, this.dataset.studentName);
      });
      dropdown.appendChild(item);
    });
  }
  dropdown.style.display = 'block';
}

function selectCoachNoteStudent(id, name) {
  document.getElementById('coachNoteStudentSelect').value = id;
  document.getElementById('coachNoteStudentSearch').value = '';
  document.getElementById('coachNoteStudentDropdown').style.display = 'none';
  var pill = document.getElementById('coachNoteSelectedStudent');
  document.getElementById('coachNoteSelectedName').textContent = name;
  pill.style.display = 'flex';
}

function clearCoachNoteStudent() {
  document.getElementById('coachNoteStudentSelect').value = '';
  document.getElementById('coachNoteStudentSearch').value = '';
  document.getElementById('coachNoteSelectedStudent').style.display = 'none';
}

async function loadCoachActivityFeed() {
  var el = document.getElementById('coachActivityList');
  var markBtn = document.getElementById('markReadBtn');

  var { data, error } = await _sb.from('notifications')
    .select('id, title, message, read, created_at, type, student_id, student_name, round_id')
    .eq('user_id', S.currentUser.id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Fallback if round_id column doesn't exist yet
  if (error && error.message && error.message.indexOf('round_id') !== -1) {
    var resp = await _sb.from('notifications')
      .select('id, title, message, read, created_at, type, student_id, student_name')
      .eq('user_id', S.currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    data = resp.data;
    error = resp.error;
  }

  if (error || !data || data.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:10px 0;">No recent activity.</div>';
    if (markBtn) markBtn.style.display = 'none';
    return;
  }

  var hasUnread = data.some(function(n){ return !n.read; });
  if (markBtn) markBtn.style.display = hasUnread ? 'inline-block' : 'none';

  el.innerHTML = data.map(function(n) {
    var d = new Date(n.created_at);
    var dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    var icon = n.type === 'new_round' ? '⛳' : (n.type === 'new_combine' || n.type === 'combine_completed') ? '🎯' : n.type === 'drill_completed' ? '📋' : n.type === 'new_signup' ? '👤' : n.type === 'student_message' ? '💬' : '📌';
    var unreadStyle = !n.read ? 'border-left:3px solid #2d7abc;padding-left:10px;' : 'padding-left:13px;';
    var viewBtn = '';
    if (n.student_id) {
      var safeName = escapeHtml(n.student_name || 'Student').replace(/'/g, "\\'");
      viewBtn = '<button onclick="viewStudent(\'' + n.student_id + '\',\'' + safeName + '\',\'\')" '
        + 'style="margin-top:6px;font-size:11px;font-weight:700;background:#2d7abc;color:#ffffff;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;height:auto;max-width:none;width:auto;">'
        + 'View Profile</button>';
    }
    if (n.type === 'student_message' && n.student_id) {
      viewBtn += ' <button onclick="openChatWithStudent(\'' + n.student_id + '\')" '
        + 'style="margin-top:6px;font-size:11px;font-weight:700;background:#00b87a;color:#ffffff;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;height:auto;max-width:none;width:auto;">'
        + 'Open Chat</button>';
    }
    return '<div style="' + unreadStyle + 'margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #282828;">'
      + '<div style="display:flex;align-items:flex-start;gap:8px;">'
      + '<div style="font-size:16px;flex-shrink:0;margin-top:1px;">' + icon + '</div>'
      + '<div style="flex:1;">'
      + '<div style="font-size:13px;font-weight:700;color:' + (!n.read ? '#44b8f0' : '#9a9a9a') + ';">' + escapeHtml(n.title) + '</div>'
      + '<div style="font-size:12px;color:#606060;margin-top:1px;">' + escapeHtml(n.message) + '</div>'
      + '<div style="font-size:10px;color:#2e2e2e;margin-top:3px;">' + dateStr + '</div>'
      + viewBtn
      + '</div></div></div>';
  }).join('');
}

function openChatWithStudent(studentId) {
  var sel = document.getElementById('coachMsgStudentSelect');
  if (sel) {
    sel.value = studentId;
  }
  showCoachCoachingTab(3);
  loadCoachMessages();
}

async function markCoachNotificationsRead() {
  // Mark all as read
  await _sb.from('notifications').update({ read: true }).eq('user_id', S.currentUser.id).eq('read', false);
  // Verify it worked — if unread still remain (RLS may silently block update), delete them
  var { data: stillUnread } = await _sb.from('notifications').select('id').eq('user_id', S.currentUser.id).eq('read', false);
  if (stillUnread && stillUnread.length > 0) {
    for (var i = 0; i < stillUnread.length; i++) {
      await _sb.from('notifications').delete().eq('id', stillUnread[i].id);
    }
  }
  var dot = document.getElementById('coachingNotifDot');
  if (dot) dot.style.display = 'none';
  var dot2 = document.getElementById('studentsNotifDot');
  if (dot2) dot2.style.display = 'none';
  loadCoachActivityFeed();
  document.getElementById('coachStatNewRounds').textContent = '0';
}

async function coachAddStudentFromCoachingPage() {
  var input = document.getElementById('coachAddStudentCode');
  var msg = document.getElementById('coachAddStudentMsg');
  var code = (input.value || '').trim().toUpperCase();

  if (!code || code.length < 4) { msg.style.color = '#d4706e'; msg.textContent = 'Enter a valid invite code'; return; }
  msg.style.color = '#606060'; msg.textContent = 'Looking up code...';

  var { data: profile, error } = await _sb.from('profiles').select('id, display_name').eq('invite_code', code).single();
  if (error || !profile) { msg.style.color = '#d4706e'; msg.textContent = 'No student found with that code'; return; }
  if (profile.id === S.currentUser.id) { msg.style.color = '#d4706e'; msg.textContent = 'Cannot add yourself'; return; }

  var { data: existing } = await _sb.from('coach_students').select('id').eq('coach_id', S.currentUser.id).eq('student_id', profile.id);
  if (existing && existing.length > 0) { msg.style.color = '#f0c830'; msg.textContent = 'Student already added'; return; }

  var studentName = profile.display_name || 'Student';
  var { error: insertErr } = await _sb.from('coach_students').insert({
    coach_id: S.currentUser.id, student_id: profile.id, student_name: studentName, invite_code: code
  });
  if (insertErr) { msg.style.color = '#d4706e'; msg.textContent = 'Error: ' + insertErr.message; return; }

  await _sb.from('profiles').update({ coach_id: S.currentUser.id }).eq('id', profile.id);

  msg.style.color = '#00b87a'; msg.textContent = '✓ Added ' + studentName;
  input.value = '';
  loadCoachingPageCoachView();
}

async function sendCoachNote() {
  var studentId = document.getElementById('coachNoteStudentSelect').value;
  var text = (document.getElementById('coachNoteText').value || '').trim();
  var lessonDate = (document.getElementById('coachNoteLessonDate').value || '').trim();
  var msg = document.getElementById('coachNoteMsg');

  if (!studentId) { msg.style.color = '#d4706e'; msg.textContent = 'Search and select a student first'; return; }
  if (!text) { msg.style.color = '#d4706e'; msg.textContent = 'Write a note first'; return; }
  msg.style.color = '#606060'; msg.textContent = 'Sending...';

  var { data: coachProfile } = await _sb.from('profiles').select('display_name').eq('id', S.currentUser.id).single();
  var coachName = (coachProfile && coachProfile.display_name) || 'Coach';

  var noteTypeVal = (document.getElementById('coachNoteType') || {}).value || (lessonDate ? 'lesson' : 'general');
  var insertData = { coach_id: S.currentUser.id, student_id: studentId, note_text: text, coach_name: coachName, created_at: new Date().toISOString(), note_type: noteTypeVal };
  if (lessonDate) insertData.lesson_date = lessonDate;

  var { error } = await _sb.from('coach_notes').insert(insertData);
  if (error) { msg.style.color = '#d4706e'; msg.textContent = 'Error: ' + error.message; return; }

  var notifMsg = (lessonDate ? 'Lesson ' + lessonDate + ': ' : '') + (text.length > 70 ? text.slice(0,70) + '…' : text);
  await _sb.from('notifications').insert({
    user_id: studentId, type: 'coach_note', title: 'New feedback from ' + coachName,
    message: notifMsg, read: false, created_at: new Date().toISOString()
  });

  msg.style.color = '#00b87a'; msg.textContent = '✓ Feedback sent!';
  document.getElementById('coachNoteText').value = '';
  document.getElementById('coachNoteLessonDate').value = '';
  clearCoachNoteStudent();
  setCoachNoteType('lesson');

  var { data: notes } = await _sb.from('coach_notes').select('id').eq('coach_id', S.currentUser.id);
  document.getElementById('coachStatNotes').textContent = (notes ? notes.length : 0);
  setTimeout(function(){ msg.textContent = ''; }, 3000);
}

export function init() {

document.addEventListener('click', function(e) {
  var search = document.getElementById('coachNoteStudentSearch');
  var dropdown = document.getElementById('coachNoteStudentDropdown');
  if (search && dropdown && !search.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});
}

// Functions called from inline HTML handlers
expose({ filterCoachNoteStudents, clearCoachNoteStudent, openChatWithStudent, markCoachNotificationsRead, coachAddStudentFromCoachingPage, sendCoachNote });

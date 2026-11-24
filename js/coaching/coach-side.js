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
import { studentRounds, viewRound } from './gps.js';
import { renderDashboard } from '../dashboard.js';
import { ic } from '../icons.js';

export async function loadCoachingPageCoachView() {
  loadCoachRequests(); // Show pending coach requests for admin
  var { data: students, error } = await _sb.from('coach_students')
    .select('student_id, student_name, student_email, team_id')
    .eq('coach_id', S.currentUser.id)
    .order('student_name', { ascending: true });

  var count = (students && !error) ? students.length : 0;
  document.getElementById('coachStatStudents').textContent = count;

  renderCoachingStudentRoster(students || []);
  if (document.getElementById('cctTabContent4')?.style.display === 'block') drawCoachStudentList(true);
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
    empty.style.cssText = 'padding:10px;color:#9a9a9a;font-size:13px;text-align:center;';
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

  data = error ? [] : (data || []);
  // Rounds straight from each student's saved rounds, so a round shows here even
  // when no notification was sent (an older app, or a round that was never ended
  // and submitted). Skipped when a notification for it is already in the list.
  try {
    var seenAt = +(localStorage.getItem('gs:coachSeenAt') || 0);
    var since = Date.now() - 14 * 86400000;
    var lists = await Promise.all((S.coachRosterData || []).map(function(st) {
      return studentRounds(st.student_id).then(function(rs) { return { st: st, rs: rs }; }, function() { return { st: st, rs: [] }; });
    }));
    lists.forEach(function(x) {
      x.rs.forEach(function(r) {
        var g = r._gps || {}, at = g.updated || 0;
        if (at < since) return;
        var dupe = data.some(function(n) {
          return n.type === 'new_round' && n.student_id === x.st.student_id
            && ((n.round_id && n.round_id === g.id) || Math.abs(Date.parse(n.created_at) - at) < 6 * 3600000);
        });
        if (dupe) return;
        var name = x.st.student_name || 'Student', tp = r.to_par === 0 ? 'E' : r.to_par > 0 ? '+' + r.to_par : '\u2212' + -r.to_par;
        data.push({ type: 'new_round', student_id: x.st.student_id, student_name: name, round_id: g.id, read: at <= seenAt, created_at: new Date(at).toISOString(),
          title: (g.submitted ? 'New round from ' : 'Round in progress: ') + name,
          message: (r.course_name || 'A course') + (r.holes ? ' \u00b7 ' + r.score + ' (' + tp + ') over ' + r.holes + ' hole' + (r.holes === 1 ? '' : 's') : '') });
      });
    });
    data.sort(function(a, b) { return Date.parse(b.created_at) - Date.parse(a.created_at); });
    data = data.slice(0, 20);
  } catch (e) { /* notifications only */ }

  if (data.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:#9a9a9a;font-size:13px;padding:10px 0;">No recent activity.</div>';
    if (markBtn) markBtn.style.display = 'none';
    return;
  }

  var hasUnread = data.some(function(n){ return !n.read; });
  if (markBtn) markBtn.style.display = hasUnread ? 'inline-block' : 'none';

  el.innerHTML = data.map(function(n) {
    var d = new Date(n.created_at);
    var dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    var icon = n.type === 'live_round' ? '<span style="color:#d4706e">' + ic('live') + '</span>' : ic(n.type === 'new_round' ? 'flag' : (n.type === 'new_combine' || n.type === 'combine_completed') ? 'target' : n.type === 'drill_completed' ? 'check' : n.type === 'new_signup' ? 'user' : n.type === 'student_message' ? 'chat' : 'pin');
    var unreadStyle = !n.read ? 'border-left:3px solid #2d7abc;padding-left:10px;' : 'padding-left:13px;';
    // Profile, and for a round: View round (the hole screen) and Strokes gained
    // (that round's SG in a pop-up), so the profile isn't needed every time.
    var viewBtn = '';
    if (n.student_id) {
      var safeName = escapeHtml(n.student_name || 'Student').replace(/'/g, "\\'");
      var bs = 'flex:1;min-width:0;height:30px;min-height:0;font-size:11px;font-weight:700;color:#ffffff;border:none;border-radius:6px;padding:0 4px;cursor:pointer;max-width:none;width:auto;white-space:nowrap;margin:0;';
      viewBtn = '<div style="display:flex;gap:6px;margin-top:8px;"><button onclick="viewStudent(\'' + n.student_id + '\',\'' + safeName + '\',\'\')" style="' + bs + 'background:#2d7abc;">Profile</button>';
      if (n.type === 'live_round' && n.round_id) {
        viewBtn += '<button onclick="coachWatchLive(\'' + String(n.round_id).replace(/[^a-z0-9]/gi, '') + '\')" style="' + bs + 'background:#c8102e;">Watch</button>';
      }
      if (n.type === 'new_round') {
        var args = '\'' + n.student_id + '\',\'' + String(n.round_id || '').replace(/[^\w-]/g, '') + '\',' + (Date.parse(n.created_at) || 0)
          + ',\'' + encodeURIComponent(n.message || '').replace(/'/g, '%27') + '\'';
        viewBtn += '<button onclick="coachActRound(' + args + ',\'view\')" style="' + bs + 'background:#007a52;">View round</button>'
          + '<button onclick="coachActRound(' + args + ',\'sg\')" style="' + bs + 'background:#6b4fbb;">Strokes gained</button>';
      }
      viewBtn += '</div>';
    }
    return '<div style="' + unreadStyle + 'margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #282828;">'
      + '<div style="display:flex;align-items:flex-start;gap:8px;">'
      + '<div style="font-size:16px;flex-shrink:0;margin-top:1px;">' + icon + '</div>'
      + '<div style="flex:1;">'
      + '<div style="font-size:13px;font-weight:700;color:' + (!n.read ? '#44b8f0' : '#9a9a9a') + ';">' + escapeHtml(n.title) + '</div>'
      + '<div style="font-size:12px;color:#606060;margin-top:1px;">' + escapeHtml(n.message) + '</div>'
      + '<div style="font-size:10px;color:#9a9a9a;margin-top:3px;">' + dateStr + '</div>'
      + '</div></div>' + viewBtn + '</div>';
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
  try { localStorage.setItem('gs:coachSeenAt', String(Date.now())); } catch (e) { /* ignore */ } // rounds read from students' saved rounds
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

  setTimeout(function(){ msg.textContent = ''; }, 3000);
}

// ---- Students: one list, latest activity first, with a name search ----
// Latest activity per student: the newest notification they sent this coach
// (a round, combine, drill, practice, message...) or the newest round saved in
// this app, whichever is later.
var _studentAct = {}; // student id -> { at (ms), type }
var _actLoading = null;
var ACT_LABEL = { live_round: 'Live round', new_round: 'Round', new_combine: 'Combine', combine_completed: 'Combine', drill_completed: 'Drill', practice_session: 'Practice', student_message: 'Message', new_signup: 'Joined' };
function noteAct(id, at, type) { if (id && at && (!_studentAct[id] || _studentAct[id].at < at)) _studentAct[id] = { at: at, type: type }; }
function ago(ms) {
  var m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  var hr = Math.round(m / 60); if (hr < 24) return hr + 'h ago';
  var d = Math.round(hr / 24); if (d < 7) return d + 'd ago';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
async function loadStudentActivity() {
  var { data } = await _sb.from('notifications').select('student_id, type, created_at')
    .eq('user_id', S.currentUser.id).order('created_at', { ascending: false }).limit(500);
  (data || []).forEach(function(n) { noteAct(n.student_id, Date.parse(n.created_at), n.type); });
  drawCoachStudentList();
  await Promise.all((S.coachRosterData || []).map(async function(s) {
    try {
      var rounds = await studentRounds(s.student_id);
      rounds.forEach(function(r) { noteAct(s.student_id, (r._gps && r._gps.updated) || 0, 'new_round'); });
    } catch (e) { /* their rounds can't be read: notifications only */ }
  }));
  drawCoachStudentList();
}
export function drawCoachStudentList(reload) {
  var el = document.getElementById('coachStudentList');
  if (!el) return;
  if (reload || !_actLoading) _actLoading = loadStudentActivity().catch(function() {});
  var q = ((document.getElementById('coachStudentSearch') || {}).value || '').toLowerCase().trim();
  var students = (S.coachRosterData || []).filter(function(s) { return !q || (s.student_name || '').toLowerCase().indexOf(q) !== -1; });
  students.sort(function(a, b) {
    var x = (_studentAct[a.student_id] || {}).at || 0, y = (_studentAct[b.student_id] || {}).at || 0;
    return y - x || (a.student_name || '').localeCompare(b.student_name || '');
  });
  if (!students.length) {
    el.innerHTML = '<div style="text-align:center;color:#606060;font-size:13px;padding:20px 0;">' + ((S.coachRosterData || []).length ? 'No students match' : 'No students yet. Add one with their invite code below.') + '</div>';
    return;
  }
  el.innerHTML = students.map(function(s) {
    var act = _studentAct[s.student_id];
    var sub = act ? (ACT_LABEL[act.type] || 'Activity') + ' · ' + ago(act.at) : 'No activity yet';
    return '<button onclick="openStudentFromList(\'' + s.student_id + '\')" style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;max-width:none;height:auto;background:#222222;border:none;border-radius:10px;padding:12px 14px;margin:0 0 6px;color:#ffffff;text-align:left;">'
      + '<div style="min-width:0;"><div style="font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(s.student_name || 'Student') + '</div>'
      + '<div style="font-size:12px;color:#9a9a9a;margin-top:2px;">' + escapeHtml(sub) + '</div></div>'
      + '<div style="font-size:22px;color:#606060;line-height:1;flex-shrink:0;">›</div></button>';
  }).join('');
}
function openStudentFromList(id) {
  var s = (S.coachRosterData || []).find(function(x) { return x.student_id === id; });
  if (!s) return;
  S.coachReturnTab = 4; // Back from their page comes back to this list
  window.viewStudent(s.student_id, s.student_name || 'Student', s.student_email || '');
}

// A round from Recent Activity: by its id, or else the student's round saved
// nearest the time of the activity.
async function coachActRound(studentId, roundId, at, msg, mode) {
  if (mode === undefined) { mode = msg; msg = ''; }
  var st = (S.coachRosterData || []).find(function(x) { return x.student_id === studentId; }) || {};
  var name = st.student_name || 'Student';
  var rounds;
  try { rounds = await studentRounds(studentId); } catch (e) { alert('Couldn’t load ' + name + '’s rounds.'); return; }
  var i = rounds.findIndex(function(r) { return roundId && r._gps && r._gps.id === roundId; });
  if (i < 0 && rounds.length) {
    // No round id (the notifications table has no round_id column): the round at
    // the course the notification names, played closest to the day it was sent.
    // Not the last-edited one: a round edited later would pull the match its way.
    try { msg = decodeURIComponent(msg || ''); } catch (e) { msg = ''; }
    var day = function(t) { var d = new Date(t); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
    var sent = day(at);
    var played = function(r) { return r.round_date ? Date.parse(r.round_date + 'T00:00:00Z') : day((r._gps || {}).updated || 0); };
    var pool = rounds.map(function(r, k) { return k; });
    var atCourse = pool.filter(function(k) { return rounds[k].course_name && msg.indexOf(rounds[k].course_name) !== -1; });
    if (atCourse.length) pool = atCourse;
    var cost = function(k) { return Math.abs(played(rounds[k]) - sent) * 1000 + Math.abs(((rounds[k]._gps || {}).updated || 0) - at) / 86400000; };
    i = pool.reduce(function(b, k) { return cost(k) < cost(b) ? k : b; }, pool[0]);
  }
  if (i < 0) { alert('That round couldn’t be found.'); return; }
  if (mode === 'view') { viewRound(rounds[i]._gps, name); return; }
  // Strokes gained: that round's dashboard in a pop-up over this page (All rounds shows the rest).
  var hcp = 'pro';
  try { var { data: prof } = await _sb.from('profiles').select('hcp_preference').eq('id', studentId).single(); if (prof && prof.hcp_preference) hcp = prof.hcp_preference; } catch (e) { /* default */ }
  var sv = document.getElementById('svDashContent'); if (sv) sv.innerHTML = ''; // one dashboard on the page at a time (they share ids); Student View redraws its own
  var box = document.getElementById('coachSgOverlay');
  if (!box) {
    box = document.createElement('div'); box.id = 'coachSgOverlay';
    box.style.cssText = 'position:fixed;inset:0;z-index:200;background:#1e1e1e;overflow-y:auto;padding:12px 16px calc(24px + env(safe-area-inset-bottom));text-align:left;';
    document.body.appendChild(box);
  }
  box.innerHTML = '<div style="max-width:420px;margin:0 auto;"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">'
    + '<div style="font-size:17px;font-weight:800;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(name) + '</div>'
    + '<button onclick="document.getElementById(\'coachSgOverlay\').style.display=\'none\'" aria-label="Close" style="flex-shrink:0;width:36px;height:36px;max-width:none;padding:0;border-radius:50%;background:#282828;border:1px solid #333333;color:#ffffff;font-size:16px;">✕</button></div>'
    + '<div id="coachSgContent"></div></div>';
  box.style.display = 'block';
  var data = rounds.map(function(r) { return Object.assign({}, r, { _name: name }); });
  renderDashboard(data, hcp, 'coachSgContent');
  window.dashOneRound(i);
}
window.coachViewRound = viewRound; // the dashboard's View round, for a round opened here

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
expose({ coachActRound, drawCoachStudentList, openStudentFromList, filterCoachNoteStudents, clearCoachNoteStudent, openChatWithStudent, markCoachNotificationsRead, coachAddStudentFromCoachingPage, sendCoachNote });

import { S } from './core.js';
import { expose } from './core.js';
import { showAuthPage } from './core.js';
import { goToCoaching } from './student-side.js';
import { showStudentTab, svHcpBadgeLabel } from './student-view.js';
import { show } from './core.js';
import { enterStudentView } from './core.js';
import { _sb } from './core.js';

async function goToStudents() {
  if (!S.currentUser) { showAuthPage(); return; }
  // Clear both notification dots when coach visits the page
  var dot = document.getElementById('studentsNotifDot');
  if (dot) dot.style.display = 'none';
  var dot2 = document.getElementById('coachingNotifDot');
  if (dot2) dot2.style.display = 'none';
  // Mark all notifications read (await so it completes before any re-check)
  await _sb.from('notifications').update({ read: true }).eq('user_id', S.currentUser.id).eq('read', false);
  // Verify — if still unread (RLS may silently block), delete them
  var { data: stillUnread } = await _sb.from('notifications').select('id').eq('user_id', S.currentUser.id).eq('read', false);
  if (stillUnread && stillUnread.length > 0) {
    for (var i = 0; i < stillUnread.length; i++) {
      await _sb.from('notifications').delete().eq('id', stillUnread[i].id);
    }
  }
  goToCoaching();
}

export async function checkCoachNotifications() {
  if (!S.currentUser) return;
  // Only relevant for coaches/admins
  var { data: profile } = await _sb.from('profiles').select('role, is_admin').eq('id', S.currentUser.id).single();
  if (!profile || (profile.role !== 'coach' && !profile.is_admin)) return;
  var { data, error } = await _sb.from('notifications').select('id, type').eq('user_id', S.currentUser.id).eq('read', false);
  if (error || !data) return;
  var count = data.length;
  var dot = document.getElementById('studentsNotifDot');
  if (dot) {
    if (count > 0) {
      dot.style.display = 'inline-block';
      dot.textContent = count > 99 ? '99+' : count;
    } else {
      dot.style.display = 'none';
    }
  }
  var dot2 = document.getElementById('coachingNotifDot');
  if (dot2) dot2.style.display = count > 0 ? 'inline-block' : 'none';
}

async function loadStudents() {
  var msg = document.getElementById('studentsListMsg');
  var list = document.getElementById('studentsList');
  if (!msg || !list) return;
  msg.textContent = 'Loading students...';
  list.innerHTML = '';
  
  var { data, error } = await _sb.from('coach_students')
    .select('student_id, student_name, student_email, created_at')
    .eq('coach_id', S.currentUser.id)
    .order('student_name', { ascending: true });
  
  if (error) { msg.textContent = 'Error: ' + error.message; return; }
  if (!data || data.length === 0) { msg.textContent = 'No students yet. Add one using their invite code above.'; return; }
  
  // Store for filtering
  S.allStudentsData = data;
  renderStudentsList(data);
}

function filterStudentsList() {
  var search = (document.getElementById('studentSearchInput').value || '').toLowerCase().trim();
  if (!S.allStudentsData) return;
  
  var filtered = S.allStudentsData.filter(function(s) {
    var name = (s.student_name || '').toLowerCase();
    return name.indexOf(search) !== -1;
  });
  
  renderStudentsList(filtered);
}

function renderStudentsList(data) {
  var msg = document.getElementById('studentsListMsg');
  var list = document.getElementById('studentsList');
  if (!msg || !list) return;
  msg.textContent = data.length + ' student(s)';
  list.innerHTML = '';
  
  data.forEach(function(s) {
    var card = document.createElement('div');
    card.style.cssText = 'background:#282828;border-radius:10px;padding:12px;margin:6px 0;';
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;">'
      + '<div style="text-align:left;flex:1;">'
      + '<div style="font-weight:700;font-size:15px;">' + (s.student_name || 'Student') + '</div>'
      + '<div style="font-size:12px;color:#9a9a9a;">' + (s.student_email || '') + '</div>'
      + '</div>'
      + '<button onclick="editStudentName(\'' + s.student_id + '\',\'' + (s.student_name||'Student').replace(/'/g,"\\'") + '\')" style="width:32px;height:32px;font-size:14px;background:#2e2e2e;border-radius:6px;padding:0;">✏️</button>'
      + '</div>'
      + '<div style="display:flex;gap:6px;margin-top:8px;">'
      + '<button onclick="viewStudent(\'' + s.student_id + '\',\'' + (s.student_name||'Student').replace(/'/g,"\\'") + '\',\'' + (s.student_email||'').replace(/'/g,"\\'") + '\')" style="flex:1;height:36px;font-size:13px;background:#2d7abc;border-radius:6px;">View Profile</button>'
      + '<button onclick="removeStudent(\'' + s.student_id + '\',this)" style="width:70px;height:36px;font-size:12px;background:#e06060;border-radius:6px;">Remove</button>'
      + '</div>';
    list.appendChild(card);
  });
}

async function editStudentName(studentId, currentName) {
  var newName = prompt('Edit student name:', currentName);
  if (!newName || newName.trim() === '' || newName.trim() === currentName) return;
  
  newName = newName.trim();
  
  // First get the row id
  var { data: rows, error: fetchErr } = await _sb.from('coach_students')
    .select('id')
    .eq('coach_id', S.currentUser.id)
    .eq('student_id', studentId)
    .single();
  
  if (fetchErr || !rows) {
    alert('Error finding student record');
    console.error('Fetch error:', fetchErr);
    return;
  }
  
  // Update using the primary key id
  var { error } = await _sb.from('coach_students')
    .update({ student_name: newName })
    .eq('id', rows.id);
  
  if (error) {
    alert('Error updating name: ' + error.message);
    console.error('Update error:', error);
  } else {
    // Update local cache
    if (S.allStudentsData) {
      S.allStudentsData = S.allStudentsData.map(function(s) {
        if (s.student_id === studentId) {
          s.student_name = newName;
        }
        return s;
      });
      filterStudentsList();
    } else {
      loadStudents();
    }
  }
}

async function addStudentByCode() {
  var codeInput = document.getElementById('addStudentCode');
  var msg = document.getElementById('addStudentMsg');
  var code = (codeInput.value || '').trim().toUpperCase();
  
  if (!code || code.length < 4) { msg.style.color = '#d4706e'; msg.textContent = 'Enter a valid invite code'; return; }
  
  msg.style.color = '#606060'; msg.textContent = 'Looking up code...';
  
  // Find student by invite code
  var { data: profile, error } = await _sb.from('profiles')
    .select('id, display_name')
    .eq('invite_code', code)
    .single();
  
  if (error || !profile) { msg.style.color = '#d4706e'; msg.textContent = 'No student found with that code'; return; }
  if (profile.id === S.currentUser.id) { msg.style.color = '#d4706e'; msg.textContent = 'Cannot add yourself'; return; }
  
  // Get email from auth (we'll store the display name)
  var studentName = profile.display_name || 'Student';
  
  // Check if already added
  var { data: existing } = await _sb.from('coach_students')
    .select('id')
    .eq('coach_id', S.currentUser.id)
    .eq('student_id', profile.id);
  
  if (existing && existing.length > 0) { msg.style.color = '#f0c830'; msg.textContent = 'Student already added'; return; }
  
  // Add the link
  var { error: insertErr } = await _sb.from('coach_students').insert({
    coach_id: S.currentUser.id,
    student_id: profile.id,
    student_name: studentName,
    invite_code: code
  });
  
  if (insertErr) { msg.style.color = '#d4706e'; msg.textContent = 'Error: ' + insertErr.message; return; }
  
  // Also write coach_id back to the student's profile so the student can see their coach
  await _sb.from('profiles').update({ coach_id: S.currentUser.id }).eq('id', profile.id);

  msg.style.color = '#00b87a'; msg.textContent = '✓ Added ' + studentName;
  codeInput.value = '';
  loadStudents();
}

async function removeStudent(studentId, btn) {
  if (!confirm('Remove this student?')) return;
  btn.textContent = '...';
  await _sb.from('coach_students').delete().eq('coach_id', S.currentUser.id).eq('student_id', studentId);
  // Clear coach_id from student's profile
  await _sb.from('profiles').update({ coach_id: null }).eq('id', studentId);
  loadStudents();
}

// ===== STUDENT VIEWER =====

async function viewStudent(studentId, name, email) {
  // The coach's Student View: dashboard, rounds, notes, goals, bag and schedule.
  S.currentStudentId  = studentId;
  S.currentStudentHcp = 'pro'; // default while loading
  document.getElementById('studentViewName').textContent = name;
  document.getElementById('studentViewEmail').textContent = email;
  // Hide badge while we fetch
  var badge = document.getElementById('studentViewHcpBadge');
  if (badge) badge.style.display = 'none';
  show('studentViewPage');

  // Fetch student's saved HCP preference BEFORE loading dashboard
  try {
    var { data: prof } = await _sb.from('profiles').select('hcp_preference').eq('id', studentId).single();
    if (prof && prof.hcp_preference) {
      S.currentStudentHcp = prof.hcp_preference;
    }
    if (badge) {
      document.getElementById('studentViewHcpLabel').textContent = svHcpBadgeLabel(S.currentStudentHcp);
      badge.style.display = 'inline-flex';
      badge.style.alignItems = 'center';
    }
  } catch(e) { /* profiles may not have this column yet — safe fallback */ }

  // Set HCP filter dropdown to student's preference
  var hcpF = document.getElementById('svDashHcpFilter');
  if (hcpF) hcpF.value = S.currentStudentHcp;

  // NOW load the dashboard with the correct HCP already set
  showStudentTab('dashboard');
}

// Functions called from inline HTML handlers
expose({ editStudentName, removeStudent, viewStudent });

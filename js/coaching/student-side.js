import { S } from './core.js';
import { expose } from './core.js';
import { loadCoachingPageCoachView } from './coach-side.js';
import { loadCoachMessages, loadStudentMessages } from './messages.js';
import { generateInviteCode } from './roles.js';
import { loadCstGoalsAndHandicap } from './student-goals.js';
import { showCoachTeamList } from './teams.js';
import { show } from './core.js';
import { _viewingAsStudent } from './core.js';
import { _sb } from './core.js';
import { escapeHtml } from './core.js';

/* ── Update showProfileTab to include combines ── */
// =============================================
// COACHING PAGE  v4.2.2
// =============================================

function showStudentCoachingTab(idx) {
  for (var i = 0; i < 5; i++) {
    var btn = document.getElementById('cstTab' + i);
    var pane = document.getElementById('cstTabContent' + i);
    if (btn)  { btn.style.background = i === idx ? '#2d7abc' : '#282828'; btn.style.color = i === idx ? '#ffffff' : '#606060'; btn.style.fontWeight = i === idx ? '700' : '600'; }
    if (pane) pane.style.display = i === idx ? (i === 0 || i === 3 ? 'flex' : 'block') : 'none';
  }
  // sync outer wrapper scroll behavior
  var wrap = document.getElementById('cstTabContentWrap');
  if (wrap) wrap.style.overflowY = (idx === 0 || idx === 3) ? 'hidden' : 'auto';
  // Load goals & handicap when Goals tab is opened
  if (idx === 2) loadCstGoalsAndHandicap();
  // Load messages when Messages tab is opened
  if (idx === 3) loadStudentMessages();
}

export function showCoachCoachingTab(idx) {
  for (var i = 0; i < 5; i++) {
    var btn = document.getElementById('cctTab' + i);
    var pane = document.getElementById('cctTabContent' + i);
    if (btn)  { btn.style.background = i === idx ? '#2d7abc' : '#282828'; btn.style.color = i === idx ? '#ffffff' : '#606060'; btn.style.fontWeight = i === idx ? '700' : '600'; }
    if (pane) pane.style.display = i === idx ? 'block' : 'none';
  }
  if (idx === 3) loadCoachMessages();
  if (idx === 4) showCoachTeamList();
}

export function setCoachNoteType(type) {
  document.getElementById('coachNoteType').value = type;
  var lBtn = document.getElementById('coachNoteTypeLesson');
  var gBtn = document.getElementById('coachNoteTypeGeneral');
  var dateRow = document.getElementById('coachNoteLessonDateRow');
  if (type === 'lesson') {
    lBtn.style.background = '#2d7abc'; lBtn.style.color = '#ffffff'; lBtn.style.fontWeight = '700';
    gBtn.style.background = '#282828'; gBtn.style.color = '#606060'; gBtn.style.fontWeight = '600';
    dateRow.style.display = 'flex';
  } else {
    gBtn.style.background = '#2d7abc'; gBtn.style.color = '#ffffff'; gBtn.style.fontWeight = '700';
    lBtn.style.background = '#282828'; lBtn.style.color = '#606060'; lBtn.style.fontWeight = '600';
    dateRow.style.display = 'none';
    document.getElementById('coachNoteLessonDate').value = '';
  }
}

export async function goToCoaching() {
  if (_viewingAsStudent) { show('homePage'); return; } // No coaching access when viewing as student
  show('coachingCornerPage');
  document.getElementById('coachingLoginGate').style.display = 'none';
  document.getElementById('coachingStudentView').style.display = 'none';
  document.getElementById('coachingCoachView').style.display = 'none';

  if (!S.currentUser) {
    document.getElementById('coachingSubtitle').textContent = 'Sign in to access coaching features';
    document.getElementById('coachingLoginGate').style.display = 'block';
    return;
  }

  var { data: profile } = await _sb.from('profiles').select('role, invite_code, display_name, is_admin').eq('id', S.currentUser.id).single();
  var role = (profile && profile.role) || 'student';
  S.isAdmin = !!(profile && profile.is_admin);
  // A coach connects a student by their invite code, so make sure it is saved on the profile.
  if (!profile || !profile.invite_code) _sb.from('profiles').update({ invite_code: generateInviteCode(S.currentUser.id) }).eq('id', S.currentUser.id).then(function(){}, function(){});

  if (role === 'coach' || (profile && profile.is_admin)) {
    document.getElementById('coachingSubtitle').textContent = 'Manage your students & feedback';
    document.getElementById('coachingCoachView').style.display = 'flex';
    showCoachCoachingTab(0);
    loadCoachingPageCoachView();
  } else {
    document.getElementById('coachingSubtitle').textContent = 'Your connection to your coach';
    document.getElementById('coachingStudentView').style.display = 'flex';
    showStudentCoachingTab(0);
    var code = (profile && profile.invite_code) || generateInviteCode(S.currentUser.id);
    document.getElementById('coachingMyCode').textContent = code;
    loadCoachingPageStudentView();
    // Mark student notifications as read and clear dot
    _sb.from('notifications').update({ read: true }).eq('user_id', S.currentUser.id).eq('read', false);
    var dot = document.getElementById('coachingNotifDot');
    if (dot) dot.style.display = 'none';
  }
}

function copyCoachingCode() {
  var code = document.getElementById('coachingMyCode').textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(function() {
      var el = document.getElementById('coachingCodeCopied');
      el.textContent = '✓ Copied!';
      setTimeout(function(){ el.textContent = ''; }, 2000);
    });
  }
}

async function loadCoachingPageStudentView() {
  var coachContent = document.getElementById('coachingMyCoachContent');
  var { data: profile } = await _sb.from('profiles').select('coach_id').eq('id', S.currentUser.id).single();

  var coachId = profile && profile.coach_id ? profile.coach_id : null;

  // Fallback: check coach_students table if coach_id not on profile
  if (!coachId) {
    var { data: link } = await _sb.from('coach_students').select('coach_id').eq('student_id', S.currentUser.id).limit(1);
    if (link && link.length > 0) {
      coachId = link[0].coach_id;
      // Fix the missing coach_id on profile
      await _sb.from('profiles').update({ coach_id: coachId }).eq('id', S.currentUser.id);
    }
  }

  if (coachId) {
    var coachRes = await _sb.from('profiles').select('display_name, email').eq('id', coachId).single();
    var coach = coachRes.data;
    if (!coach || coachRes.error) {
      // email column might not exist yet — retry without it
      var { data: coach2 } = await _sb.from('profiles').select('display_name').eq('id', coachId).single();
      coach = coach2;
    }
    if (coach) {
      var emailPart = coach.email ? ' <a href="mailto:' + escapeHtml(coach.email) + '" style="font-size:12px;color:#44b8f0;text-decoration:none;margin-left:6px;">' + escapeHtml(coach.email) + '</a>' : '';
      coachContent.innerHTML = '<div style="display:flex;align-items:center;gap:12px;">'
        + '<div style="width:40px;height:40px;background:#1a4a8a;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">👤</div>'
        + '<div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:2px;"><span style="font-weight:700;font-size:15px;">' + escapeHtml(coach.display_name || 'Coach') + '</span>'
        + emailPart + '</div></div>';
    } else {
      coachContent.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:10px 0;">Coach profile unavailable.</div>';
    }
  } else {
    coachContent.innerHTML = '<div style="text-align:center;padding:10px 0;">'
      + '<div style="font-size:28px;margin-bottom:8px;">👤</div>'
      + '<div style="color:#2e2e2e;font-size:13px;">No coach connected yet.<br>Share your invite code on the Info tab!</div></div>';
  }

  loadStudentCoachNotes();
  loadStudentAssignedDrills();
  loadStudentAssignedCombines();
}

async function loadStudentCoachNotes() {
  var list = document.getElementById('coachingNotesList');
  list.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">Loading...</div>';

  var [notesRes, drillsRes, combinesRes] = await Promise.all([
    _sb.from('coach_notes').select('note_text, created_at, coach_name, lesson_date, note_type').eq('student_id', S.currentUser.id).order('created_at', { ascending: false }).limit(100),
    _sb.from('coach_drill_assignments').select('drill_name, coach_name, created_at, completed').eq('student_id', S.currentUser.id).order('created_at', { ascending: false }).limit(20),
    _sb.from('coach_combine_assignments').select('combine_type, coach_name, created_at, completed, due_date').eq('student_id', S.currentUser.id).order('created_at', { ascending: false }).limit(20)
  ]);

  var notes = (notesRes.data || []).map(function(n) { return Object.assign({ _kind: 'note' }, n); });
  var drills = (drillsRes.data || []).map(function(d) { return { _kind: 'drill', note_text: d.drill_name, coach_name: d.coach_name, created_at: d.created_at, completed: d.completed }; });
  var combines = (combinesRes.data || []).map(function(c) { return { _kind: 'combine', note_text: c.combine_type, coach_name: c.coach_name, created_at: c.created_at, completed: c.completed, due_date: c.due_date || null }; });

  var all = notes.concat(drills, combines);
  all.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });

  if (all.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">No feedback from your coach yet.</div>';
    S.allCoachNotes = [];
    return;
  }

  S.allCoachNotes = all;
  renderFeedbackNotes(all);
}

function filterStudentFeedback() {
  var query   = (document.getElementById('feedbackSearch').value || '').toLowerCase().trim();
  var type    = document.getElementById('feedbackFilterType').value;
  var months  = document.getElementById('feedbackFilterDate').value;
  var notes   = S.allCoachNotes || [];

  var cutoff = null;
  if (months !== 'all') {
    cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - parseInt(months, 10));
  }

  var filtered = notes.filter(function(n) {
    // keyword search
    if (query && (n.note_text || '').toLowerCase().indexOf(query) === -1
               && (n.coach_name || '').toLowerCase().indexOf(query) === -1) return false;
    // type filter
    if (type !== 'all') {
      var kind = n._kind || 'note';
      var isLesson = kind === 'note' && (!!n.lesson_date || n.note_type === 'lesson');
      var isAssignment = kind === 'drill' || kind === 'combine';
      if (type === 'lesson'  && !isLesson) return false;
      if (type === 'general' && (isLesson || isAssignment)) return false;
    }
    // date filter
    if (cutoff && new Date(n.created_at) < cutoff) return false;
    return true;
  });

  var countEl = document.getElementById('feedbackFilterCount');
  if (countEl) {
    countEl.textContent = filtered.length === notes.length
      ? notes.length + ' note' + (notes.length !== 1 ? 's' : '')
      : filtered.length + ' of ' + notes.length + ' notes';
  }

  renderFeedbackNotes(filtered);
}

function renderFeedbackNotes(data) {
  var list = document.getElementById('coachingNotesList');
  if (!data || data.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">No notes match your filters.</div>';
    return;
  }

  var query = (document.getElementById('feedbackSearch') || {}).value || '';

  list.innerHTML = data.map(function(n) {
    var sentDate = new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var isLesson = !!n.lesson_date || n.note_type === 'lesson';
    var typeBadge = '<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:6px;background:' 
      + (isLesson ? '#2d7abc' : '#00402c') + ';color:' + (isLesson ? '#44b8f0' : '#00b87a') + ';">'
      + (isLesson ? 'Lesson' : 'General') + '</span>';

    var lessonLine = '';
    if (n.lesson_date) {
      var ld = new Date(n.lesson_date + 'T12:00:00');
      lessonLine = '<div style="font-size:11px;color:#44b8f0;font-weight:700;margin-bottom:4px;">📅 Lesson: '
        + ld.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '</div>';
    }

    // highlight search keyword in note text
    var noteText = escapeHtml(n.note_text);
    if (query.trim()) {
      var re = new RegExp('(' + query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      noteText = noteText.replace(re, '<mark style="background:#1a4a8a;color:#44b8f0;border-radius:3px;padding:0 2px;">$1</mark>');
    }

    if (n._kind === 'drill' || n._kind === 'combine') {
      var assignBadgeLabel = n._kind === 'drill' ? 'Drill' : 'Combine';
      var assignBadge = '<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:6px;background:#2d7abc;color:#44b8f0;">' + assignBadgeLabel + '</span>';
      var doneStyle = n.completed ? 'opacity:0.55;' : '';
      var noun = n._kind === 'combine' ? escapeHtml(n.note_text || '') + ' combine' : escapeHtml(n.note_text || '');
      var article = n._kind === 'drill' ? 'the' : 'a';
      var assignText = 'Your coach assigned you ' + article + ' ' + noun;
      var dueLine = '';
      if (n.due_date) {
        var dd = new Date(n.due_date + 'T12:00:00');
        dueLine = ' <span style="font-size:11px;color:#606060;">· due ' + dd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '</span>';
      }
      return '<div onclick="showStudentCoachingTab(1)" style="' + doneStyle + 'border-bottom:1px solid #282828;padding:12px 0;cursor:pointer;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;flex-wrap:wrap;gap:4px;">'
        + '<div style="display:flex;align-items:center;"><div style="font-size:11px;font-weight:700;color:#44b8f0;">' + escapeHtml(n.coach_name || 'Coach') + '</div>' + assignBadge + '</div>'
        + '<div style="font-size:10px;color:#2e2e2e;">' + sentDate + '</div></div>'
        + '<div style="font-size:13px;color:#44b8f0;line-height:1.6;">' + assignText + dueLine + (n.completed ? ' <span style="font-size:11px;color:#00b87a;">\u2713</span>' : '') + '</div></div>';
    }

    return '<div style="border-bottom:1px solid #282828;padding:12px 0;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;flex-wrap:wrap;gap:4px;">'
      + '<div style="display:flex;align-items:center;"><div style="font-size:11px;font-weight:700;color:#44b8f0;">' + escapeHtml(n.coach_name || 'Coach') + '</div>' + typeBadge + '</div>'
      + '<div style="font-size:10px;color:#2e2e2e;">' + sentDate + '</div></div>'
      + lessonLine
      + '<div style="font-size:13px;color:#9a9a9a;line-height:1.6;">' + noteText + '</div></div>';
  }).join('');
}

async function loadStudentAssignedDrills() {
  var list = document.getElementById('coachingAssignedDrillsList');
  var { data, error } = await _sb.from('coach_drill_assignments')
    .select('drill_name, drill_category, note, created_at, completed, coach_name, coach_id, completion_note')
    .eq('student_id', S.currentUser.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:10px 0;">No drills assigned yet.</div>';
    return;
  }

  S.assignedDrillsData = data;
  list.innerHTML = data.map(function(d, idx) {
    var dateStr = new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var catColor = d.drill_category === 'putting' ? '#3d96ee' : d.drill_category === 'shortgame' ? '#00b87a' : '#f0c830';
    return '<div style="background:#222222;border-radius:10px;padding:12px;margin-bottom:8px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">'
      + '<div onclick="openAssignedDrillDetail(' + idx + ')" style="font-weight:700;font-size:14px;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;">' + escapeHtml(d.drill_name) + '</div>'
      + '<div style="font-size:10px;color:' + catColor + ';font-weight:700;text-transform:uppercase;">' + escapeHtml(d.drill_category || '') + '</div></div>'
      + (d.note ? '<div style="font-size:12px;color:#9a9a9a;font-style:italic;margin-bottom:6px;">"' + escapeHtml(d.note) + '"</div>' : '')
      + '<div style="display:flex;align-items:center;justify-content:space-between;">'
      + '<div style="font-size:10px;color:#2e2e2e;">From ' + escapeHtml(d.coach_name || 'Coach') + ' · ' + dateStr + '</div>'
      + '<button data-idx="' + idx + '" onclick="toggleDrillComplete(this,' + idx + ')" '
      + 'style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;background:' + (d.completed ? '#007a52' : '#007a52') + ';'
      + 'color:' + (d.completed ? '#00b87a' : '#ffffff') + ';border:none;cursor:pointer;height:auto;max-width:none;width:auto;">'
      + (d.completed ? '✓ Done' : 'Mark Done') + '</button></div>'
      + (d.completion_note ? '<div style="font-size:11px;color:#2e2e2e;margin-top:6px;padding-top:6px;border-top:1px solid #282828;">📝 ' + escapeHtml(d.completion_note) + '</div>' : '')
      + '</div>';
  }).join('');
}

async function loadStudentAssignedCombines() {
  var list = document.getElementById('coachingAssignedCombinesList');
  if (!list) return;
  var { data, error } = await _sb.from('coach_combine_assignments')
    .select('combine_type, target_score, due_date, note, created_at, completed, coach_name, coach_id, custom_shots, shot_count')
    .eq('student_id', S.currentUser.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:10px 0;">No combines assigned yet.</div>';
    return;
  }

  S.assignedCombinesData = data;
  list.innerHTML = data.map(function(c, idx) {
    var assignedDate = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var dueStr = '';
    if (c.due_date) {
      var dd = new Date(c.due_date + 'T12:00:00');
      dueStr = ' · Due ' + dd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    var shotInfo = c.shot_count ? '<div style="font-size:10px;color:#44b8f0;font-weight:700;margin-bottom:4px;">' + c.shot_count + ' shots configured</div>' : '';
    var startBtn = c.custom_shots && !c.completed
      ? '<button onclick="startCoachCombine(' + idx + ')" style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;background:#007a52;color:#ffffff;border:none;cursor:pointer;height:auto;max-width:none;width:auto;margin-right:6px;">▶ Start</button>'
      : '';
    return '<div style="background:#222222;border-radius:10px;padding:12px;margin-bottom:8px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">'
      + '<div style="font-weight:700;font-size:14px;">🏌️ ' + escapeHtml(c.combine_type) + '</div>'
      + (c.target_score ? '<div style="font-size:11px;color:#00b87a;font-weight:700;">Target: ' + c.target_score + '</div>' : '') + '</div>'
      + shotInfo
      + (c.note ? '<div style="font-size:12px;color:#9a9a9a;font-style:italic;margin-bottom:6px;">"' + escapeHtml(c.note) + '"</div>' : '')
      + '<div style="display:flex;align-items:center;justify-content:space-between;">'
      + '<div style="font-size:10px;color:#2e2e2e;">From ' + escapeHtml(c.coach_name || 'Coach') + ' · ' + assignedDate + dueStr + '</div>'
      + '<div style="display:flex;align-items:center;">' + startBtn
      + '<button data-idx="' + idx + '" onclick="toggleCombineComplete(this,' + idx + ')" '
      + 'style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;background:' + (c.completed ? '#007a52' : '#333333') + ';'
      + 'color:' + (c.completed ? '#00b87a' : '#606060') + ';border:none;cursor:pointer;height:auto;max-width:none;width:auto;">'
      + (c.completed ? '✓ Done' : 'Mark Done') + '</button></div></div></div>';
  }).join('');
}

export async function checkCoachingStudentNotifications() {
  if (!S.currentUser) return;
  var { data } = await _sb.from('notifications').select('id').eq('user_id', S.currentUser.id).eq('read', false);
  if (!data) return;
  var count = data.length;
  var dot = document.getElementById('coachingNotifDot');
  if (dot) dot.style.display = count > 0 ? 'inline-block' : 'none';
}

// Functions called from inline HTML handlers
expose({ showStudentCoachingTab, showCoachCoachingTab, setCoachNoteType, goToCoaching, copyCoachingCode, filterStudentFeedback });

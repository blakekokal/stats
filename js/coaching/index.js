// Coaching, brought over from the coaching app: a student's connection to
// their coach (feedback, assigned drills, goals, messages, invite code) and a
// coach's side (activity, notes, assignments, messages, students and teams,
// and each student's dashboard, rounds, notes, goals, bag and schedule).
// Both apps share the same accounts and coaching tables, so what is done here
// shows up there and the other way round.
//
// Student stats and rounds come from this app's GPS rounds (gps.js), and a
// coach can watch a student's round live.

import { COACHING_PAGE, STUDENT_VIEW_PAGE, MODALS } from './markup.js';
import { expose, escapeHtml, S, show } from './core.js';
import { goToCoaching, checkCoachingStudentNotifications } from './student-side.js';
import { init as initCoachSide } from './coach-side.js';
import { liveStudents, watchLive } from './gps.js';
// Loaded for the handlers their markup calls.
import './roles.js';
import './students.js';
import './student-view.js';
import './student-notes.js';
import './student-misc.js';
import './student-goals.js';
import './teams.js';
import './messages.js';
import './assign.js';
import './assignments.js';

let started = false, liveTimer = null;

export function closeCoaching() { clearInterval(liveTimer); liveTimer = null; }

export function renderCoaching(view) {
  closeCoaching();
  view.innerHTML = `<div class="cx coachroot">${COACHING_PAGE}${STUDENT_VIEW_PAGE}${MODALS}</div>`;
  if (!started) { started = true; initCoachSide(); }
  S.currentStudentId = null;
  goToCoaching().then(() => {
    drawLive();
    liveTimer = setInterval(() => { if (!document.hidden) drawLive(); }, 30000);
  });
}

// Coach Home: students who are playing right now, each with a Watch button.
async function drawLive() {
  const section = document.getElementById('coachLiveSection'), list = document.getElementById('coachLiveList');
  if (!section || !list || document.getElementById('coachingCoachView')?.style.display === 'none') return;
  let live = [];
  try { live = await liveStudents(); } catch { live = []; }
  if (!document.body.contains(section)) return;
  section.style.display = live.length ? 'block' : 'none';
  const toPar = v => (v === 0 ? 'E' : v > 0 ? '+' + v : '−' + -v);
  list.innerHTML = live.map(l => '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid #282828;text-align:left;">'
    + '<div style="min-width:0;"><div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(l.name) + '</div>'
    + '<div style="font-size:11px;color:#9a9a9a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(l.course)
    + (l.thru ? ' · ' + toPar(l.toPar) + ' thru ' + l.thru : l.hole ? ' · hole ' + l.hole : '') + '</div></div>'
    + '<button onclick="coachWatchLive(\'' + l.id + '\')" style="flex-shrink:0;width:auto;max-width:none;height:34px;padding:0 14px;font-size:12px;font-weight:700;background:#c8102e;border-radius:8px;">Watch</button></div>').join('');
}
expose({ show, coachWatchLive: id => watchLive(String(id).replace(/[^a-z0-9]/gi, '')) });

// Home: a dot on the Coaching button when something new is waiting (a note, a message, an assignment).
export function checkCoachingDot() { checkCoachingStudentNotifications().catch(() => {}); }

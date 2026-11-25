// Coaching, brought over from the coaching app: a student's connection to
// their coach (feedback, assigned drills, goals, messages, invite code) and a
// coach's side (activity, notes, assignments, messages, students and teams,
// and each student's dashboard, rounds, notes, goals, bag and schedule), plus
// My Bag, Performance Analysis and Practice and Learning (combines, drills,
// practice plans and the learning tools).
// Both apps share the same accounts and coaching tables, so what is done here
// shows up there and the other way round.
//
// Student stats and rounds come from this app's GPS rounds (gps.js), and a
// coach can watch a student's round live.

import { root } from './root.js';
import { expose, escapeHtml, S, show, resetTrail } from './core.js';
import { goToCoaching, checkCoachingStudentNotifications } from './student-side.js';
import { init as initCoachSide } from './coach-side.js';
import { liveStudents, watchLive } from './gps.js';
import { init as initProximity } from '../learn/proximity.js';
import { init as initOptimizer } from '../learn/optimizer.js';
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
import '../bag/clubs.js';
import '../bag/find-yardage.js';
import '../bag/gap-visualizer.js';
import '../bag/speed.js';
import '../bag/wedge-gapping.js';
import '../combines/driver-drill.js';
import '../combines/eval-test.js';
import '../combines/history.js';
import '../combines/line-drill.js';
import '../combines/table.js';
import '../learn/distance-guide.js';
import '../learn/library.js';
import '../learn/putting-break.js';
import '../learn/sg-explainer.js';
import '../performance/combines.js';
import '../performance/rounds.js';
import '../practice/custom-plans.js';
import '../practice/drills.js';
import '../practice/generator.js';
import '../practice/hub.js';
import '../practice/log.js';
import '../practice/plans.js';
import '../practice/swing-journal.js';

initCoachSide();
initProximity();
initOptimizer();

let liveTimer = null;

// Leaving for another part of the app: the pages stay in the document, hidden.
export function closeCoaching() {
  clearInterval(liveTimer); liveTimer = null;
  const sgPop = document.getElementById('coachSgOverlay'); if (sgPop) sgPop.style.display = 'none'; // a round's SG from Recent Activity
  root.hidden = true;
  const view = document.getElementById('view');
  if (view) view.hidden = false;
}

// Home's buttons: Coaching, My Bag, Performance Analysis, Practice and Learning.
const START = { coaching: 'coachingCornerPage', bag: 'myBagPage', performance: 'performanceAnalysisPage', practice: 'practiceHubPage' };
export function renderCoaching(view, tab = 'coaching') {
  clearInterval(liveTimer); liveTimer = null;
  // The app's own view steps aside (it keeps one element, so the start-up check sees a drawn page).
  view.replaceChildren(document.createElement('div'));
  view.hidden = true;
  root.hidden = false;
  // Close anything left open over the pages last time.
  root.querySelectorAll(':scope > div:not(.page)').forEach(el => { if (el.style.display && el.style.display !== 'none') el.style.display = 'none'; });
  S.currentStudentId = null;
  resetTrail();
  S.coachReturnTab = 0; // coaching opens on Home
  if (tab === 'coaching') {
    goToCoaching().then(() => {
      drawLive();
      liveTimer = setInterval(() => { if (!document.hidden && !root.hidden) drawLive(); }, 30000);
    });
  } else {
    if (tab === 'practice') S.currentPHTab = 'combines';
    show(START[tab]);
  }
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
expose({ coachWatchLive: id => watchLive(String(id).replace(/[^a-z0-9]/gi, '')) });

// Home: a dot on the Coaching button when something new is waiting (a note, a message, an assignment).
export function checkCoachingDot() { checkCoachingStudentNotifications().catch(() => {}); }

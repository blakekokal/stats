// What the coaching modules (ported from the coaching app) expect from that
// app's core: shared state, the Supabase client, its page router and a few
// helpers, mapped onto this app.

import { sync, supabaseClient, actingAs, onActChange } from '../store.js';
import { toast, goBack } from '../app.js';

export const S = {
  currentStudentId: null, currentStudentHcp: 'pro', combSaveForStudent: null, svAllRounds: null, svDashData: null, svDashAllData: null,
  isAdmin: undefined, activeDashTarget: 'dashContent',
  get currentUser() { return sync.user; },
  // practice/drills
  drillsOnPracticeHub: false,
  // performance/rounds
  perfCachedRounds: null, perfCombineLoaded: false,
  // combines/table
  combPendingType: null, combFromShortGame: false, combFromPracticeHub: false, combReturnToView: null, coachCombineOverride: undefined,
  // coaching/assignments
  drillDetailBackTarget: 'drillsPage', drillDetailBackCategory: null, ppReturningFromDrill: false,
  // practice/hub
  currentPHTab: 'combines', boInited: undefined,
  // practice/log
  practiceNotes: [], editingPracticeSessionId: null,
  // bag
  bagViewingStudentId: null, bagViewingStudentName: null, bagStudentClubs: null, bagStudentWgSessions: null, bagStudentSpeedSessions: null,
};

// The page markup uses inline handlers (onclick="fn()"), which only see globals.
export function expose(handlers) { Object.assign(window, handlers); }

// The same client the rest of this app uses (so the login is shared).
export const _sb = new Proxy({}, { get: (_, k) => (...a) => supabaseClient()[k](...a) });

// ---- pages ----
// Every screen is a <div class="page"> inside #coachroot (index.js); show(id)
// makes one active. Each has one Back button, top left (appBack below).
const enterHooks = {}, backHooks = {};
/** Run fn whenever pageId is shown. Returning false stops the rest of show(). */
export function onEnter(id, fn) { enterHooks[id] = fn; }
/** Custom Back behaviour for pageId. Return false to fall through to the default target. */
export function onBack(id, fn) { backHooks[id] = fn; }
export const COACH_SITE = 'bkgstats.com';
export function activePageId() {
  const page = document.querySelector('.coachroot .page.active');
  return page ? page.id : '';
}
const backTarget = {
  drillsPage: 'practiceHubPage', drillDetailPage: 'drillsPage', studentViewPage: 'coachingCornerPage', gapVisualizerPage: 'myBagPage',
  combinesPage: 'practiceHubPage', lineDrillPage: 'practiceHubPage', driverDrillPage: 'practiceHubPage', evalCombinePage: 'practiceHubPage',
  guideToGolfPage: 'practiceHubPage',
};
// The pages gone through to reach this one, oldest first, for Back. A page is
// never in it twice: showing one that's already there goes back to it.
let pageTrail = [], fresh = true;
/** Coming in from the rest of the app: the first page shown has nothing behind it. */
export function resetTrail() { pageTrail = []; fresh = true; }
export function show(id) {
  if (id === 'homePage') { location.hash = '#/'; return; }
  if (id === 'authPage') { location.hash = '#/account'; return; }
  const page = document.getElementById(id);
  if (!page) { toast(`That part is in the coaching app for now (${COACH_SITE}).`); return; }
  const from = activePageId(), at = pageTrail.indexOf(id);
  if (at >= 0) pageTrail.length = at; else if (!fresh && from && from !== id) pageTrail.push(from);
  fresh = false;
  document.querySelectorAll('.coachroot .page').forEach(p => p.classList.remove('active'));
  page.classList.add('active');
  if (enterHooks[id] && enterHooks[id]() === false) return;
  page.scrollTop = 0;
  const inner = page.querySelector('[id$="Scroll"]');
  if (inner) inner.scrollTop = 0;
  window.scrollTo(0, 0);
}
// The one Back button. It undoes the last step, whatever that was: a stats
// category or single round on a dashboard, a step inside the page (its hidden
// .stepback button), then the page before this one, then the part of the app
// the user came from.
function appBack() {
  const id = activePageId(), page = document.getElementById(id);
  if (window.dashBack && window.dashBack()) return;
  const step = page && [...page.querySelectorAll('.stepback')].filter(b => b.parentElement.offsetParent).pop();
  if (step) { step.click(); return; }
  if (backHooks[id] && backHooks[id]() !== false) return;
  const prev = pageTrail[pageTrail.length - 1] || backTarget[id];
  if (prev === 'coachingCornerPage' && window.goToCoaching) window.goToCoaching(); // reloads it on the tab it was left on
  else if (prev) show(prev);
  else goBack();
}
expose({ show, appBack });
export const showAuthPage = () => show('authPage');

// ---- session ----
// A coach using the app as one of their students (store.js startActing): the
// coaching pages then read and save the student's combines, practice, journal
// and bag, as the student's own app would.
export var _viewingAsStudent = actingAs();
onActChange(() => { _viewingAsStudent = actingAs(); });
export function activeUserId() { return _viewingAsStudent ? _viewingAsStudent.id : sync.user.id; }
// What a row added while using the app as a student carries: who added it (shown as "Added by coach").
export const addedByCoach = () => (_viewingAsStudent ? { added_by: sync.user.id } : {});
export function enterStudentView() { /* see store.js startActing */ }

// ---- helpers ----
export function ordinalSuffix(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
export function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
export var _BAG_ORDER = ['Dr','Dr2','2W','3W','4W','5W','6W','7W','2HY','3HY','4HY','5HY','6HY','7HY','2I','3I','4I','5I','6I','7I','8I','9I','48','PW','GW','AW','SW','50','52','54','56','58','60','62','LW'];
export function sortBagClubs(clubs) {
  return clubs.sort(function (a, b) {
    var ai = _BAG_ORDER.indexOf(a.name), bi = _BAG_ORDER.indexOf(b.name);
    if (ai === -1) ai = 999;
    if (bi === -1) bi = 999;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}

// Load a script once (Chart.js for the gap chart, the Excel reader for bag imports).
const scripts = {};
export function loadScript(src) {
  return scripts[src] || (scripts[src] = new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => { delete scripts[src]; fail(new Error('Could not load ' + src)); };
    document.head.append(s);
  }));
}
// Central time, as YYYY-MM-DD (what the coaching app saves).
export function getTodayCentral() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }); }
export function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
// Set on the profile in the coaching app; practice plans use it.
export function hasLaunchMonitor() {
  const m = sync.user && sync.user.user_metadata;
  if (m && m.has_launch_monitor != null) return m.has_launch_monitor === true;
  try { return localStorage.getItem('hasLaunchMonitor') === 'true'; } catch { return false; }
}

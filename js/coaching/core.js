// What the coaching modules (ported from the coaching app) expect from that
// app's core: shared state, the Supabase client, its page router and a few
// helpers, mapped onto this app. Parts of the coaching app that this app
// doesn't have (combines, practice log, Performance Analysis) are stubs here.

import { sync, supabaseClient } from '../store.js';
import { toast } from '../app.js';

export const S = {
  currentStudentId: null, currentStudentHcp: 'pro', svAllRounds: null, svDashData: null, svDashAllData: null,
  isAdmin: undefined, activeDashTarget: 'dashContent',
  get currentUser() { return sync.user; },
};

// The page markup uses inline handlers (onclick="fn()"), which only see globals.
export function expose(handlers) { Object.assign(window, handlers); }

// The same client the rest of this app uses (so the login is shared).
export const _sb = new Proxy({}, { get: (_, k) => (...a) => supabaseClient()[k](...a) });

// ---- pages ----
const enterHooks = {}, backHooks = {};
export function onEnter(id, fn) { enterHooks[id] = fn; }
export function onBack(id, fn) { backHooks[id] = fn; }
export const COACH_SITE = 'bkgstats.com';
export function show(id) {
  if (id === 'homePage') { location.hash = '#/'; return; }
  if (id === 'authPage') { location.hash = '#/account'; return; }
  const page = document.getElementById(id);
  if (!page) { toast(`That part is in the coaching app for now (${COACH_SITE}).`); return; }
  document.querySelectorAll('.coachroot .page').forEach(p => p.classList.remove('active'));
  page.classList.add('active');
  if (enterHooks[id]) enterHooks[id]();
  page.scrollTop = 0; window.scrollTo(0, 0);
}
export const showAuthPage = () => show('authPage');

// ---- session ----
export var _viewingAsStudent = null;
export function activeUserId() { return sync.user.id; }
export function enterStudentView() { /* viewing the whole app as a student isn't part of this app */ }

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

// ---- not in this app yet ----
const elsewhere = what => () => toast(`${what} in the coaching app for now (${COACH_SITE}).`);
export const combOpen = elsewhere('Combines are run');
export const setDrillCategory = () => {};
export const setPracticeHubTab = () => {};
export const loadStudentCombines = () => {};
export const loadPerfCombineData = async () => {};
export const computePerfAnalysis = () => ({});
export const renderPerfAnalysis = () => {};

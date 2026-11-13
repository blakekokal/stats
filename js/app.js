import { yards, distToLine } from './geo.js';
import { store, sync, init as initSync } from './store.js';
import { renderHole, closeHole, lastHole } from './hole.js';
import { renderCourseEditor } from './editor.js';
import { renderSettings } from './settings.js';
import { renderStats } from './stats.js';
import { renderAccount } from './account.js';
import { renderStatsDashboard } from './dashboard.js';
import { renderHome, renderNewRound, renderHistory, renderSettingsPage, renderLogin, renderWhatsNew, renderEditRound, renderBag } from './coach.js';
import { VERSION } from './version.js';
import { currentRound } from './rounds.js';

const L = window.L;
const view = document.getElementById('view');
export const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const LIE_COLOR = { tee: '#f4f4f0', fairway: '#8fd14f', rough: '#4d7c3a', bunker: '#f2d58a', recovery: '#b98b5e', green: '#3ee08f', water: '#4aa8ff', ob: '#ffffff' };

// ---------- helpers ----------

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

export function satellite(map) {
  const layer = L.tileLayer(TILE_URL, {
    maxNativeZoom: 19, maxZoom: 21, crossOrigin: true,
    attribution: 'Esri, Maxar · © OpenStreetMap',
  }).addTo(map);
  map.attributionControl.setPrefix(false);
  return layer;
}

// ---------- course ----------

// The courses to pick from. `course` is the one in use: the current round's on
// the hole screen, otherwise the last one picked (New Round, Scouting, History).
export const COURSES = [
  { id: 'bridlewood', name: 'Bridlewood Golf Club', file: 'data/bridlewood.json' },
  { id: 'bearcreek-west', name: 'Bear Creek Golf Club – West', file: 'data/bearcreek-west.json' },
  { id: 'bearcreek-east', name: 'Bear Creek Golf Club – East', file: 'data/bearcreek-east.json' },
  { id: 'cowboys', name: 'Cowboys Golf Club', file: 'data/cowboys.json' },
  { id: 'tangleridge', name: 'Tangle Ridge Golf Club', file: 'data/tangleridge.json' },
  { id: 'squawcreek', name: 'Squaw Creek Golf Course', file: 'data/squawcreek.json' },
];
const DEFAULT_COURSE = COURSES[0].id;
const base = {}; // id -> the course file as shipped
export let course = null;

// A course with any outline edits made on this device. Out of bounds (outside
// the course boundary) always comes from the course file, edited or not.
export function courseById(id) {
  const b = base[id] || base[DEFAULT_COURSE];
  const edited = store.get('course:' + b.id);
  if (!edited) return b;
  return { ...b, features: [...edited.features.filter(f => f.t !== 'ob'), ...b.features.filter(f => f.t === 'ob')] };
}
const pickedCourse = () => { try { return localStorage.getItem('gs:course'); } catch { return null; } };
export function setActiveCourse(id) {
  try { localStorage.setItem('gs:course', id); } catch { /* ignore */ }
  course = courseById(id);
}
export async function loadCourse(onHole = false) {
  await Promise.all(COURSES.filter(c => !base[c.id]).map(async c => { base[c.id] = await (await fetch(c.file)).json(); }));
  course = courseById((onHole && currentRound()?.course) || pickedCourse() || DEFAULT_COURSE);
  return course;
}
export const originalFeatures = () => base[course.id].features;

function centroid(ring) {
  let la = 0, lo = 0;
  for (const p of ring) { la += p[0]; lo += p[1]; }
  return [la / ring.length, lo / ring.length];
}

// Each outlined tee box belongs to exactly one hole: the hole whose tee-shot line
// (from 60 yd behind its back tee to 170 yd in front of it) passes closest to
// the box. A box is left unassigned if no line passes within 35 yd (or 50 yd
// when the next-nearest hole is at least twice as far), or if it is more than
// 30 yd farther from the green than the hole's back tee.
const along = (ch, p) => { let d = yards(p, ch.line[1]); for (let i = 1; i < ch.line.length - 1; i++) d += yards(ch.line[i], ch.line[i + 1]); return d; };
function teeLine(ch) {
  const t = ch.tee, a = ch.line[1], len = yards(t, a) || 1;
  const at = k => [t[0] + (a[0] - t[0]) * k, t[1] + (a[1] - t[1]) * k];
  return [at(-60 / len), at(Math.min(170, len) / len)];
}
let teeOwners = null, ownersFor = null;
function teeBoxesOf(ch) {
  if (ownersFor !== course.features) {
    ownersFor = course.features;
    const lines = course.holes.map(teeLine);
    teeOwners = new Map();
    for (const f of course.features) {
      if (f.t !== 'tee') continue;
      const c = centroid(f.p[0]);
      const ranked = course.holes.map((o, i) => [o, distToLine(c, lines[i])]).sort((x, y) => x[1] - y[1]);
      const [[o, d], [, d2]] = ranked;
      if ((d <= 35 || (d <= 50 && d2 >= 2 * d)) && along(o, c) <= along(o, o.tee) + 30) teeOwners.set(f, o);
    }
  }
  return course.features.filter(f => teeOwners.get(f) === ch).map(f => centroid(f.p[0]));
}

// Put the tee on this hole's own tee box whose distance to the green is closest
// to the scorecard yardage for the chosen tees; remembered once the user drags
// the tee marker.
export function teePosition(teeName, ch) {
  const saved = (store.get('settings') || {}).teePos || {};
  const key = `${course.id}:${teeName}:${ch.n}`;
  if (saved[key]) return saved[key];
  const tee = course.tees.find(t => t.name === teeName);
  const target = tee ? tee.yards[ch.n - 1] : null;
  const boxes = teeBoxesOf(ch);
  if (!target || !boxes.length) return ch.tee;
  return boxes.reduce((best, c) => (Math.abs(along(ch, c) - target) < Math.abs(along(ch, best) - target) ? c : best));
}

export function rememberTee(teeName, ch, pos) {
  const s = store.get('settings') || {};
  s.teePos = { ...(s.teePos || {}), [`${course.id}:${teeName}:${ch.n}`]: pos };
  store.set('settings', s);
}

// ---------- router ----------

async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  await loadCourse(parts[0] === 'hole');
  const tab = ['hole', 'course', 'settings', 'stats', 'account', 'new', 'history', 'device', 'whatsnew', 'dashboard', 'round', 'scout', 'bag'].includes(parts[0]) ? parts[0] : 'home';
  // Pages laid out like the coaching app hide this app's top bar.
  document.body.classList.toggle('coach', ['home', 'new', 'history', 'settings', 'account', 'whatsnew', 'dashboard', 'round', 'bag', 'scout'].includes(tab));
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  document.body.classList.toggle('playing', tab === 'hole');
  if (tab !== 'hole') closeHole();
  if (tab === 'hole') renderHole(view, Math.min(18, Math.max(1, parseInt(parts[1], 10) || lastHole())));
  else if (tab === 'course') renderCourseEditor(view);
  else if (tab === 'settings') renderSettingsPage(view);
  else if (tab === 'device') renderSettings(view);
  else if (tab === 'stats') renderStats(view);
  else if (tab === 'account') { if (sync.recovering) renderAccount(view); else if (sync.user) location.hash = '#/settings'; else renderLogin(view); }
  else if (tab === 'new') renderNewRound(view);
  else if (tab === 'history') renderHistory(view);
  else if (tab === 'whatsnew') renderWhatsNew(view);
  else if (tab === 'dashboard') renderStatsDashboard(view, renderLogin, parts[1]);
  else if (tab === 'round') renderEditRound(view, parts[1]);
  else if (tab === 'bag') renderBag(view);
  else if (tab === 'scout') renderNewRound(view, { scout: true });
  else renderHome(view);
}

window.addEventListener('hashchange', route);
// Re-render when another device's changes arrive, but not while looking at a hole
// (that would reset the crosshair).
store.onChange(() => { if (document.body.classList.contains('playing')) return; route(); });
let lastUser;
sync.onStatus(() => {
  const dot = document.getElementById('sync-dot');
  dot.className = sync.status;
  dot.title = { off: 'Accounts unavailable', 'signed-out': 'Not logged in', syncing: 'Syncing…', ok: 'Synced', error: 'Sync error: ' + sync.error }[sync.status];
  document.getElementById('account-name').textContent = sync.user ? sync.name : 'Log in';
  // Logging in or out changes what most pages show.
  const user = sync.user?.id || null;
  if (user !== lastUser) { lastUser = user; if (!document.body.classList.contains('playing')) route(); }
});

// Load the stylesheets for this exact version, so a phone never pairs new code
// with an old cached stylesheet (new buttons would land in the wrong place).
document.querySelectorAll('link[rel="stylesheet"][href^="css/"]').forEach(l => {
  const href = l.getAttribute('href').split('?')[0];
  if (l.getAttribute('href') !== `${href}?v=${VERSION}`) l.setAttribute('href', `${href}?v=${VERSION}`);
});
route();
initSync();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');

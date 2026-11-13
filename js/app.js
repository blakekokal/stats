import { yards } from './geo.js';
import { ADMIN_EMAIL_SHA256 } from '../config.js';
import { store, sync, init as initSync, fetchPublishedCourses, publishCourse, unpublishCourse } from './store.js';
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

// A course with any outline edits made on this device. Edits saved with
// `ob: true` (the hole boundary editor) include out of bounds; older edits
// don't, so their OB comes from the course file.
// A course file can list OB cut-outs an earlier version of it had by mistake
// (`dropObRings`): they're removed from saved edits too, which would otherwise
// keep them, since saved edits replace the file's outlines.
const sameRing = (a, b) => a.length === b.length && a.every(p => b.some(q => Math.abs(p[0] - q[0]) < 2e-6 && Math.abs(p[1] - q[1]) < 2e-6));
function dropOldCutouts(features, drops) {
  if (!drops?.length) return features;
  return features.map(f => (f.t === 'ob' && f.p.length > 1 && f.p.slice(1).some(r => drops.some(d => sameRing(r, d)))
    ? { ...f, p: [f.p[0], ...f.p.slice(1).filter(r => !drops.some(d => sameRing(r, d)))] } : f));
}
// Published outlines (an admin's edits, live for everyone), cached on the
// device so they're there offline too: { [courseId]: { features, ob, updated } }.
let published = {};
try { published = JSON.parse(localStorage.getItem('gs:published') || '{}'); } catch { published = {}; }
const cachePublished = () => { try { localStorage.setItem('gs:published', JSON.stringify(published)); } catch { /* full: still in memory */ } };
let publishedLoad = null;
function refreshPublished() {
  return (publishedLoad = fetchPublishedCourses().then(p => {
    if (!p) return false;
    const changed = JSON.stringify(p) !== JSON.stringify(published);
    published = p; cachePublished();
    return changed;
  }).catch(() => false));
}

// The outlines in use: the published ones, or for an admin, this device's own
// edits when they're newer (saved but not yet published, say).
export function courseById(id) {
  const b = base[id] || base[DEFAULT_COURSE];
  const pub = published[b.id];
  const mine = isAdmin ? store.get('course:' + b.id) : null;
  const edited = mine && (!pub || (mine.savedAt || 0) > pub.updated) ? mine : pub;
  if (!edited) return b;
  if (edited.ob) return { ...b, features: dropOldCutouts(edited.features, b.dropObRings) };
  return { ...b, features: [...edited.features.filter(f => f.t !== 'ob'), ...b.features.filter(f => f.t === 'ob')] };
}
const pickedCourse = () => { try { return localStorage.getItem('gs:course'); } catch { return null; } };
export function setActiveCourse(id) {
  try { localStorage.setItem('gs:course', id); } catch { /* ignore */ }
  course = courseById(id);
}
export async function loadCourse(onHole = false) {
  // The first time, wait (briefly) for the published outlines; after that use
  // what's cached and check again in the background, redrawing if they changed.
  if (!publishedLoad) {
    const first = refreshPublished();
    first.then(changed => { if (changed && course) { loadCourse(onHole).then(() => { if (!document.body.classList.contains('playing')) route(); }); } });
    await Promise.race([first, new Promise(r => setTimeout(r, 2500))]);
  }
  await Promise.all(COURSES.filter(c => !base[c.id]).map(async c => { base[c.id] = await (await fetch(c.file)).json(); }));
  course = courseById((onHole && currentRound()?.course) || pickedCourse() || DEFAULT_COURSE);
  return course;
}
export const originalFeatures = () => base[course.id].features;

// An admin saving outline edits: kept on this device and published for
// everyone. Returns what happened, to show the admin.
export async function saveCourseEdits(features) {
  const savedAt = Date.now(), doc = { features, ob: true };
  store.set('course:' + course.id, { ...doc, savedAt });
  let msg;
  try {
    await publishCourse(course.id, doc, savedAt);
    published = { ...published, [course.id]: { ...doc, updated: savedAt } }; cachePublished();
    msg = 'Saved and published: everyone now sees these outlines.';
  } catch (e) {
    msg = `Saved on this device only: publishing for everyone failed (${e.message}).`;
  }
  await loadCourse(true);
  return msg;
}
// Back to the course file, for everyone.
export async function resetCourseEdits() {
  store.remove('course:' + course.id);
  let msg = 'Outlines reset to the original map for everyone.';
  try { await unpublishCourse(course.id); const { [course.id]: _, ...rest } = published; published = rest; cachePublished(); }
  catch (e) { msg = `Reset on this device only: unpublishing failed (${e.message}).`; }
  await loadCourse(true);
  return msg;
}

// How far a spot plays to the green: to the hole's first turn, then along its line.
export const along = (ch, p) => { let d = yards(p, ch.line[1]); for (let i = 1; i < ch.line.length - 1; i++) d += yards(ch.line[i], ch.line[i + 1]); return d; };
// The middle of a tee box.
export function boxCentre(f) {
  const r = f.p[0].length > 1 && f.p[0][0][0] === f.p[0].at(-1)[0] && f.p[0][0][1] === f.p[0].at(-1)[1] ? f.p[0].slice(0, -1) : f.p[0];
  return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length];
}
// The tee box (of `boxes`, the hole's own) a set of tees plays from: the one
// whose yardage is closest to the scorecard's for this hole. No box is tied to
// a colour; it's worked out from the yardage every time.
export function teeBoxFor(teeName, ch, boxes) {
  const want = course.tees.find(t => t.name === teeName)?.yards[ch.n - 1];
  if (!want || !boxes.length) return null;
  return boxes.reduce((best, f) => (Math.abs(along(ch, boxCentre(f)) - want) < Math.abs(along(ch, boxCentre(best)) - want) ? f : best));
}
// Where the tee goes for a set of tees: the middle of its box (the hole's own
// tee line start if the hole has no tee boxes).
export function teePosition(teeName, ch, boxes) {
  const box = teeBoxFor(teeName, ch, boxes);
  return box ? boxCentre(box) : ch.tee;
}

// ---------- router ----------

async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  await loadCourse(parts[0] === 'hole');
  if (parts[0] === 'course' && !isAdmin) { location.hash = '#/'; return; } // course editing is for admins
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
// Admins (config.js) can edit course outlines; nobody else sees the tools.
export let isAdmin = false;
async function checkAdmin() {
  const email = (sync.user?.email || '').trim().toLowerCase();
  if (!email || !window.crypto?.subtle) return false;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  return ADMIN_EMAIL_SHA256.includes([...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join(''));
}
sync.onStatus(() => {
  const dot = document.getElementById('sync-dot');
  dot.className = sync.status;
  dot.title = { off: 'Accounts unavailable', 'signed-out': 'Not logged in', syncing: 'Syncing…', ok: 'Synced', error: 'Sync error: ' + sync.error }[sync.status];
  document.getElementById('account-name').textContent = sync.user ? sync.name : 'Log in';
  // Logging in or out changes what most pages show.
  const user = sync.user?.id || null;
  if (user !== lastUser) {
    lastUser = user;
    checkAdmin().then(a => {
      const changed = a !== isAdmin;
      isAdmin = a; document.body.classList.toggle('admin', a);
      // Becoming (or no longer being) an admin changes the outlines and tools, even on a hole.
      if (changed || !document.body.classList.contains('playing')) route();
    });
  }
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

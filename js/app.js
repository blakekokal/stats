import { yards } from './geo.js';
import { store, sync, init as initSync } from './store.js';
import { renderHole, closeHole, lastHole } from './hole.js';
import { renderCourseEditor } from './editor.js';
import { renderSettings } from './settings.js';
import { renderStats } from './stats.js';
import { renderAccount, levelName } from './account.js';
import { VERSION } from './version.js';

const L = window.L;
const view = document.getElementById('view');
export const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const LIE_COLOR = { tee: '#f4f4f0', fairway: '#8fd14f', rough: '#4d7c3a', bunker: '#f2d58a', recovery: '#b98b5e', green: '#3ee08f', water: '#4aa8ff' };

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

let baseCourse = null;
export let course = null;

export async function loadCourse() {
  if (!baseCourse) baseCourse = await (await fetch('data/bridlewood.json')).json();
  const edited = store.get('course:' + baseCourse.id);
  course = { ...baseCourse, features: edited ? edited.features : baseCourse.features };
  return course;
}
export const originalFeatures = () => baseCourse.features;

function centroid(ring) {
  let la = 0, lo = 0;
  for (const p of ring) { la += p[0]; lo += p[1]; }
  return [la / ring.length, lo / ring.length];
}

// Pick the outlined tee box whose distance to the green is closest to the
// scorecard yardage for the chosen tees; remembered once the user drags the
// tee marker.
export function teePosition(teeName, ch) {
  const saved = (store.get('settings') || {}).teePos || {};
  const key = `${course.id}:${teeName}:${ch.n}`;
  if (saved[key]) return saved[key];
  const tee = course.tees.find(t => t.name === teeName);
  const target = tee ? tee.yards[ch.n - 1] : null;
  if (!target) return ch.tee;
  const pathFrom = p => {
    let d = yards(p, ch.line[1]);
    for (let i = 1; i < ch.line.length - 1; i++) d += yards(ch.line[i], ch.line[i + 1]);
    return d;
  };
  let best = null, bestErr = Infinity;
  for (const f of course.features) {
    if (f.t !== 'tee') continue;
    const c = centroid(f.p[0]);
    if (yards(c, ch.tee) > 130) continue;
    if (course.holes.some(o => o !== ch && yards(c, o.tee) < yards(c, ch.tee))) continue;
    const err = Math.abs(pathFrom(c) - target);
    if (err < bestErr) { best = c; bestErr = err; }
  }
  return best || ch.tee;
}

export function rememberTee(teeName, ch, pos) {
  const s = store.get('settings') || {};
  s.teePos = { ...(s.teePos || {}), [`${course.id}:${teeName}:${ch.n}`]: pos };
  store.set('settings', s);
}

// ---------- start page ----------

function renderHome() {
  const teeName = (store.get('settings') || {}).tee || 'Blue';
  const teeSet = course.tees.find(t => t.name === teeName) || course.tees[0];
  const teeSel = h('select', { 'aria-label': 'Tees', onchange: e => { store.set('settings', { ...(store.get('settings') || {}), tee: e.target.value }); renderHome(); } },
    course.tees.map(t => h('option', { value: t.name, selected: t.name === teeName }, `${t.name} · ${t.yards.reduce((a, b) => a + b, 0)} yd`)));
  const resume = lastHole();
  view.replaceChildren(h('div', { class: 'page home' },
    h('p', { class: 'muted version' }, `Shot Tracker v${VERSION}`),
    h('h1', {}, course.name),
    h('p', { class: 'muted' }, `${course.location} · Par ${course.holes.reduce((a, c) => a + c.par, 0)}`),
    sync.user ? h('p', { class: 'muted' }, `Logged in as ${sync.name} · strokes gained vs ${levelName(sync.level || 'Scratch')}`)
      : h('div', { class: 'card row between' }, h('span', {}, 'Log in to save your rounds and see your strokes gained.'), h('a', { class: 'btn primary', href: '#/account' }, 'Log in')),
    h('div', { class: 'card row' }, h('label', {}, 'Tees ', teeSel),
      h('a', { class: 'btn primary', href: `#/hole/${resume}` }, resume > 1 ? `Continue at hole ${resume}` : 'Start at hole 1')),
    h('h2', {}, 'Holes'),
    h('div', { class: 'holegrid' }, course.holes.map(c =>
      h('a', { class: 'card', href: `#/hole/${c.n}` }, h('strong', {}, c.n), h('small', { class: 'muted' }, `Par ${c.par} · ${teeSet.yards[c.n - 1]}`)))),
  ));
}

// ---------- router ----------

async function route() {
  await loadCourse();
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const tab = ['hole', 'course', 'settings', 'stats', 'account'].includes(parts[0]) ? parts[0] : 'home';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  document.body.classList.toggle('playing', tab === 'hole');
  if (tab !== 'hole') closeHole();
  if (tab === 'hole') renderHole(view, Math.min(18, Math.max(1, parseInt(parts[1], 10) || lastHole())));
  else if (tab === 'course') renderCourseEditor(view);
  else if (tab === 'settings') renderSettings(view);
  else if (tab === 'stats') renderStats(view);
  else if (tab === 'account') renderAccount(view);
  else renderHome();
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

route();
initSync();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');

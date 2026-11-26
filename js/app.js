import { yards, inPolygon } from './geo.js';
import { ADMIN_EMAIL_SHA256 } from '../config.js';
import { store, sync, init as initSync, fetchPublishedCourses, publishCourse, unpublishCourse } from './store.js';
import { renderHole, closeHole, lastHole } from './hole.js';
import { renderCourseEditor } from './editor.js';
import { renderSettings } from './settings.js';
import { renderStats } from './stats.js';
import { renderAccount } from './account.js';
import { renderStatsDashboard } from './dashboard.js';
import { askResume, renderHome, renderNewRound, renderHistory, renderSettingsPage, renderLogin, renderWhatsNew, renderEditRound, renderHelp, renderSearch } from './coach.js';
import { VERSION } from './version.js';
import { currentRound, isWatching, endWatching, watchInfo, watchingId } from './rounds.js';
import { loadWatch, watchHole } from './live.js';
import { renderCoaching, closeCoaching } from './coaching/index.js';

const L = window.L;
const view = document.getElementById('view');
export const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const LIE_COLOR = { tee: '#f4f4f0', fairway: '#8fd14f', rough: '#4d7c3a', bunker: '#f2d58a', recovery: '#b98b5e', green: '#3ee08f', water: '#4aa8ff', ob: '#ffffff', trees: '#00c2a8' };

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
  { id: 'bearcreek-west', name: 'Bear Creek Golf Club – West', file: 'data/bearcreek-west.json', shares: 'bearcreek-east' },
  { id: 'bearcreek-east', name: 'Bear Creek Golf Club – East', file: 'data/bearcreek-east.json', shares: 'bearcreek-west' },
  { id: 'cowboys', name: 'Cowboys Golf Club', file: 'data/cowboys.json' },
  { id: 'tangleridge', name: 'Tangle Ridge Golf Club', file: 'data/tangleridge.json' },
  { id: 'squawcreek', name: 'Squaw Creek Golf Course', file: 'data/squawcreek.json' },
  { id: 'crosstimbers', name: 'Cross Timbers Golf Course', file: 'data/crosstimbers.json' },
  { id: 'sherrillpark1', name: 'Sherrill Park Golf Course #1', file: 'data/sherrillpark1.json' },
  { id: 'sherrillpark2', name: 'Sherrill Park Golf Course #2', file: 'data/sherrillpark2.json' },
  { id: 'grapevine-bluebonnet', name: 'Grapevine Golf Course – Bluebonnet', file: 'data/grapevine-bluebonnet.json', nines: 'grapevine' },
  { id: 'grapevine-mockingbird', name: 'Grapevine Golf Course – Mockingbird', file: 'data/grapevine-mockingbird.json', nines: 'grapevine' },
  { id: 'grapevine-pecan', name: 'Grapevine Golf Course – Pecan', file: 'data/grapevine-pecan.json', nines: 'grapevine' },
  { id: 'tour18dallas', name: 'Tour 18 Golf Course Dallas', file: 'data/tour18dallas.json' },
  { id: 'lantana', name: 'Lantana Golf Club', file: 'data/lantana.json' },
  { id: 'lakepark', name: 'Lake Park Golf Course – Championship', file: 'data/lakepark.json' },
  { id: 'lakepark-exec', name: 'Lake Park Golf Course – Executive', file: 'data/lakepark-exec.json' },
  { id: 'coyoteridge', name: 'Coyote Ridge Golf Club', file: 'data/coyoteridge.json' },
  { id: 'firewheel-lakes', name: 'Firewheel Golf Park – Lakes', file: 'data/firewheel-lakes.json' },
  { id: 'texasstar', name: 'Texas Star Golf Course', file: 'data/texasstar.json' },
  { id: 'indiancreek-creek', name: 'Indian Creek Golf Club – Creek', file: 'data/indiancreek-creek.json', shares: 'indiancreek-lakes' },
  { id: 'indiancreek-lakes', name: 'Indian Creek Golf Club – Lakes', file: 'data/indiancreek-lakes.json', shares: 'indiancreek-creek' },
  { id: 'ironhorse', name: 'Iron Horse Golf Course', file: 'data/ironhorse.json' },
  { id: 'fieldsranch-east', name: 'Fields Ranch – East', file: 'data/fieldsranch-east.json', shares: 'fieldsranch-west' },
  { id: 'fieldsranch-west', name: 'Fields Ranch – West', file: 'data/fieldsranch-west.json', shares: 'fieldsranch-east' },
  { id: 'cedarcrest', name: 'Cedar Crest Golf Course', file: 'data/cedarcrest.json' },
  { id: 'stevenspark', name: 'Stevens Park Golf Course', file: 'data/stevenspark.json' },
  { id: 'tierraverde', name: 'Tierra Verde Golf Club', file: 'data/tierraverde.json' },
  { id: 'riverside', name: 'Riverside Golf Club', file: 'data/riverside.json' },
  { id: 'prairielakes-red', name: 'Prairie Lakes Golf Course – Red', file: 'data/prairielakes-red.json', nines: 'prairielakes' },
  { id: 'prairielakes-white', name: 'Prairie Lakes Golf Course – White', file: 'data/prairielakes-white.json', nines: 'prairielakes' },
  { id: 'prairielakes-blue', name: 'Prairie Lakes Golf Course – Blue', file: 'data/prairielakes-blue.json', nines: 'prairielakes' },
  { id: 'cottonwood', name: 'Cottonwood Valley Golf Course', file: 'data/cottonwood.json' },
  { id: 'trailsfrisco', name: 'The Trails of Frisco Golf Club', file: 'data/trailsfrisco.json' },
  { id: 'twincreeks', name: 'The Golf Club at Twin Creeks', file: 'data/twincreeks.json' },
  { id: 'woodbridge', name: 'Woodbridge Golf Club', file: 'data/woodbridge.json' },
  { id: 'buffalocreek', name: 'Buffalo Creek Golf Club', file: 'data/buffalocreek.json' },
  { id: 'tribute', name: 'The Tribute Golf Club', file: 'data/tribute.json' },
  { id: 'oldamerican', name: 'Old American Golf Club', file: 'data/oldamerican.json' },
  { id: 'skycreek', name: 'Sky Creek Ranch Golf Club', file: 'data/skycreek.json' },
  { id: 'rockwall', name: 'Rockwall Golf & Athletic Club', file: 'data/rockwall.json' },
  { id: 'fossilcreek', name: 'The Golf Club at Fossil Creek', file: 'data/fossilcreek.json' },
  { id: 'whitestone', name: 'Whitestone Golf Club', file: 'data/whitestone.json' },
  { id: 'hawkscreek', name: 'Hawks Creek Golf Club', file: 'data/hawkscreek.json' },
  { id: 'oakhollow', name: 'Oak Hollow Golf Course', file: 'data/oakhollow.json' },
  { id: 'tenison-highlands', name: 'Tenison Park Golf Course – Highlands', file: 'data/tenison-highlands.json', shares: 'tenison-glen' },
  { id: 'tenison-glen', name: 'Tenison Park Golf Course – Glen', file: 'data/tenison-glen.json', shares: 'tenison-highlands' },
  { id: 'resort', name: 'The Resort Golf Club', file: 'data/resort.json' },
  { id: 'pecanvalley-hills', name: 'Pecan Valley Golf Course – Hills', file: 'data/pecanvalley-hills.json' },
  { id: 'rangers', name: 'Texas Rangers Golf Club', file: 'data/rangers.json' },
  { id: 'isabella-nina', name: 'Isabella Golf Course – Nina', file: 'data/isabella-nina.json', nines: 'isabella' },
  { id: 'isabella-pinta', name: 'Isabella Golf Course – Pinta', file: 'data/isabella-pinta.json', nines: 'isabella' },
  { id: 'isabella-santamaria', name: 'Isabella Golf Course – Santa Maria', file: 'data/isabella-santamaria.json', nines: 'isabella' },
];
const DEFAULT_COURSE = COURSES[0].id;
// Nine-hole courses at one club (the same `nines` tag) can be played together
// as 18: the course id is the two joined by '+', front nine first (e.g.
// 'grapevine-bluebonnet+grapevine-mockingbird'). ninesWith(id) lists the other
// nines a nine can be joined to.
export const ninesWith = id => {
  const c = COURSES.find(x => x.id === id);
  return c?.nines ? COURSES.filter(x => x.nines === c.nines && x.id !== id) : [];
};
export const comboId = (front, back) => `${front}+${back}`;
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
    published = p; cachePublished(); dropPublishedCopies();
    return changed;
  }).catch(() => false));
}
// This device's own copy of a course's edits, once the same (or newer) ones are
// published, is only taking up room: phones allow a few MB in all, and a few
// courses' outlines fill that, after which nothing more can be saved.
function dropPublishedCopies() {
  for (const [id, pub] of Object.entries(published)) {
    const mine = store.get('course:' + id);
    if (mine && (mine.savedAt || 0) <= (pub.updated || 0)) { try { store.remove('course:' + id); } catch { /* left as it is */ } }
  }
}
try { dropPublishedCopies(); } catch { /* not yet */ }

// The outlines in use: the published ones, or for an admin, this device's own
// edits when they're newer (saved but not yet published, say).
export function courseById(id) {
  if (typeof id === 'string' && id.includes('+')) return joinedNines(id);
  const b = base[id] || base[DEFAULT_COURSE];
  const pub = published[b.id];
  const mine = isAdmin ? store.get('course:' + b.id) : null;
  let edited = mine && (!pub || (mine.savedAt || 0) > pub.updated) ? mine : pub;
  // A course file rebuilt from scratch (`builtAt`) wins over outlines edited
  // before it: those were drawn on the old map. Edits made since still apply.
  if (edited && b.builtAt && (edited.savedAt || edited.updated || 0) < b.builtAt) edited = null;
  if (!edited) return b;
  // v0.68.1 turned every recovery area into trees. Outlines published or saved
  // before then still say recovery, so they're read as trees; recovery areas
  // drawn since are kept.
  if ((edited.savedAt || edited.updated || 0) < 1794796407039) edited = { ...edited, features: edited.features.map(f => (f.t === 'recovery' ? { ...f, t: 'trees' } : f)) };
  if (edited.ob) return { ...b, features: dropOldCutouts(edited.features, b.dropObRings) };
  return { ...b, features: [...edited.features.filter(f => f.t !== 'ob'), ...b.features.filter(f => f.t === 'ob')] };
}
// Two nines as one 18-hole course: the back nine's holes become 10-18 (and the
// shapes tied to its holes move with them), each tee box gets both nines'
// yardages (only tee boxes both nines have), and the 18-hole rating is the two
// nines' ratings added up, the slope their average. `parts` says which nine a
// hole is on (for elevation and anything else kept per nine). Shapes are edited
// on each nine, not here. Only one nine's course-wide OB is kept: two would each
// put the other nine out of bounds.
function joinedNines(id) {
  const [a, b] = id.split('+');
  if (!base[a] || !base[b]) return courseById(base[a] ? a : b);
  const f = courseById(a), k = courseById(b);
  const nameOf = c => COURSES.find(x => x.id === c.id)?.name || c.name;
  const [fa, ...fr] = nameOf(f).split(' – '), [ka, ...kr] = nameOf(k).split(' – ');
  const name = fa === ka && fr.length && kr.length ? `${fa} – ${fr.join(' – ')} / ${kr.join(' – ')}` : `${nameOf(f)} / ${nameOf(k)}`;
  const tees = f.tees.flatMap(t => {
    const u = k.tees.find(x => x.name === t.name);
    if (!u) return [];
    const both = t.rating && u.rating && t.slope && u.slope;
    return [{ ...t, yards: [...t.yards, ...u.yards], rating: both ? Math.round((t.rating + u.rating) * 10) / 10 : undefined, slope: both ? Math.round((t.slope + u.slope) / 2) : undefined }];
  });
  const fOb = f.features.filter(x => x.t === 'ob');
  const features = [...f.features, ...k.features.filter(x => x.t !== 'ob' || !fOb.length).map(x => (x.h != null ? { ...x, h: x.h + 9 } : x))];
  return { ...f, id, name, tees, holes: [...f.holes, ...k.holes.map(x => ({ ...x, n: x.n + 9 }))], features, parts: [a, b], builtAt: undefined, dropObRings: undefined };
}
// The real course (a nine) hole n of the course in use is on.
export const partOf = (c, n) => (c.parts ? c.parts[n > 9 ? 1 : 0] : c.id);
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
// Every hole a tee box, fairway or green could belong to: this course's, plus
// those of a course sharing its outlines (Bear Creek West and East, and Indian Creek Creek and Lakes, are one map each),
// so a box is never given to this course when it's nearer the other one's hole.
export function complexHoles() {
  const other = COURSES.find(c => c.id === course.id)?.shares;
  return other && base[other] ? [...course.holes, ...base[other].holes] : course.holes;
}

// An admin saving outline edits: kept on this device, and published for
// everyone unless `publish` is false (Save in the hole editor keeps editing;
// Save & finish publishes). Returns what happened, to show the admin.
// Never throws: what happened comes back as the message to show.
export async function saveCourseEdits(features, { publish = true } = {}) {
  const savedAt = Date.now(), doc = { features, ob: true }, key = 'course:' + course.id;
  // Kept on this device: false if its storage is full.
  const keepHere = () => { try { store.set(key, { ...doc, savedAt }); return true; } catch { try { dropPublishedCopies(); store.set(key, { ...doc, savedAt }); return true; } catch { return false; } } };
  let msg;
  if (!publish) {
    msg = keepHere() ? 'Saved on this device. Save & finish publishes it for everyone.'
      : 'Couldn’t save on this device: its storage is full. Save & finish publishes it for everyone instead.';
  } else {
    // Published first; then this device needs no copy of its own.
    try {
      await Promise.race([publishCourse(course.id, doc, savedAt), new Promise((_, no) => setTimeout(() => no(new Error('no answer after 30 s')), 30000))]);
      published = { ...published, [course.id]: { ...doc, updated: savedAt } }; cachePublished();
      try { if (store.get(key)) store.remove(key); } catch { /* left as it is */ }
      msg = 'Saved and published: everyone now sees these outlines.';
    } catch (e) {
      msg = keepHere() ? `Saved on this device only: publishing for everyone failed (${e.message}).`
        : `Not saved: publishing failed (${e.message}) and this device’s storage is full. Your changes are still on screen; try again.`;
    }
  }
  try { await loadCourse(true); } catch (e) { console.error('reload course', e); }
  return msg;
}
// Outline edits saved on this device but not yet published.
export function unpublishedEdits() {
  const mine = store.get('course:' + course.id), pub = published[course.id];
  return mine && (!pub || (mine.savedAt || 0) > pub.updated) ? mine : null;
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
  // The course file can say where each set plays from (tools/assign_tees.py):
  // the box at that spot, if it's still there (it may have been redrawn).
  const at = ch.teeAt?.[teeName];
  if (at) {
    const all = boxes.length ? [...boxes, ...course.features.filter(f => f.t === 'tee' && !boxes.includes(f))] : course.features.filter(f => f.t === 'tee');
    const hit = all.find(f => inPolygon(at, f.p)) || all.find(f => yards(boxCentre(f), at) < 12);
    if (hit) return hit;
  }
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

// ---------- back ----------

// Every page has one Back button, top left, that returns to the page the user
// was on before. The trail of pages is kept here instead of using the browser's
// history: holes played along the way are skipped, a page is never in it twice,
// and Home clears it.
let trail = [];
try { trail = JSON.parse(sessionStorage.getItem('gs:trail') || '[]'); } catch { trail = []; }
function track() {
  const here = location.hash || '#/';
  if (/^#\/(hole|live)/.test(here)) return;
  if (/^#\/?$/.test(here)) trail = [];
  else { const i = trail.indexOf(here); if (i >= 0) trail.length = i; trail.push(here); }
  try { sessionStorage.setItem('gs:trail', JSON.stringify(trail)); } catch { /* ignore */ }
}
export function goBack() {
  const i = trail.lastIndexOf(location.hash || '#/');
  location.hash = (i < 0 ? trail[trail.length - 1] : trail[i - 1]) || '#/';
}

// ---------- router ----------

async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'course' && !isAdmin) { location.hash = '#/'; return; } // course editing is for admins
  // A live view link: fetch the shared round, then open it (read-only) on the hole being played.
  if (parts[0] === 'live') {
    document.body.classList.add('coach'); document.body.classList.remove('playing');
    closeHole();
    const id = (parts[1] || '').replace(/[^a-z0-9]/gi, '');
    const res = id ? await loadWatch(id) : 'missing';
    if (!location.hash.startsWith('#/live')) return; // moved on while it loaded
    if (res !== 'ok') { endWatching(); renderLiveError(res, route); return; }
    location.replace(`${location.pathname}${location.search}#/hole/${watchHole()}`);
    return;
  }
  track();
  if (parts[0] !== 'hole' && isWatching()) endWatching(); // leaving the holes leaves the live view
  // The page was reloaded while watching: fetch the round again first.
  if (parts[0] === 'hole' && isWatching() && !watchInfo()) {
    const id = watchingId();
    if (id.startsWith('sv-')) { endWatching(); location.hash = '#/coaching'; return; }
    const res = await loadWatch(id);
    if (res !== 'ok') { document.body.classList.add('coach'); document.body.classList.remove('playing'); closeHole(); renderLiveError(res, route); return; }
  }
  const tab = ['hole', 'course', 'settings', 'stats', 'account', 'new', 'history', 'device', 'whatsnew', 'dashboard', 'round', 'scout', 'bag', 'coaching', 'performance', 'practice', 'help', 'search'].includes(parts[0]) ? parts[0] : 'home';
  // Pages laid out like the coaching app hide this app's top bar. Set before
  // waiting for the course, so the old top bar never shows while it loads.
  document.body.classList.toggle('coach', ['device', 'home', 'new', 'history', 'settings', 'account', 'whatsnew', 'dashboard', 'round', 'bag', 'scout', 'coaching', 'performance', 'practice', 'help', 'search'].includes(tab));
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  document.body.classList.toggle('playing', tab === 'hole');
  await loadCourse(parts[0] === 'hole');
  if (tab !== 'hole') closeHole();
  // Coaching, My Bag, Performance Analysis and Practice are the coaching app's pages (js/coaching).
  const coachTab = ['coaching', 'bag', 'performance', 'practice'].includes(tab);
  if (!coachTab) closeCoaching();
  if (tab === 'hole') renderHole(view, Math.min(course.holes.length, Math.max(1, parseInt(parts[1], 10) || lastHole())));
  else if (tab === 'course') renderCourseEditor(view);
  else if (tab === 'settings') renderSettingsPage(view);
  else if (tab === 'device') renderSettings(view);
  else if (tab === 'stats') renderStats(view);
  else if (tab === 'account') { if (sync.recovering) renderAccount(view); else if (sync.user) { trail.pop(); location.hash = '#/settings'; } /* handed on to Settings: not a page to come back to */ else renderLogin(view); }
  else if (tab === 'new') renderNewRound(view);
  else if (tab === 'history') renderHistory(view);
  else if (tab === 'whatsnew') renderWhatsNew(view);
  else if (tab === 'dashboard') renderStatsDashboard(view, renderLogin, parts[1]);
  else if (tab === 'round') renderEditRound(view, parts[1]);
  else if (tab === 'scout') renderNewRound(view, { scout: true });
  else if (tab === 'help') renderHelp(view);
  else if (tab === 'search') renderSearch(view);
  else if (coachTab) renderCoaching(view, tab);
  else renderHome(view);
  // A round left going is settled before anything else (see askResume).
  if (tab === 'home' || tab === 'new') askResume(); else document.getElementById('resumeask')?.remove();
}

// A live view link that can't be opened.
function renderLiveError(res, retry) {
  view.replaceChildren(h('div', { class: 'liveerr' },
    h('strong', {}, res === 'missing' ? 'This round isn\u2019t available' : 'Couldn\u2019t load the round'),
    h('p', {}, res === 'missing' ? 'The link may be wrong, or the round was deleted.' : 'Check your connection and try again.'),
    res === 'missing' ? null : h('button', { class: 'btn', onclick: retry }, '\u21bb Try again'),
    h('a', { class: 'btn', href: '#/' }, 'Home')));
}

window.addEventListener('hashchange', route);
// Re-render when another device's changes arrive, but not while looking at a hole
// (that would reset the crosshair).
store.onChange(() => { if (document.body.classList.contains('playing') || /^#\/(coaching|bag|performance|practice)/.test(location.hash)) return; route(); });
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
// The new copy goes in beside the old one, which stays until it has loaded, so
// the page is never drawn unstyled in between.
document.querySelectorAll('link[rel="stylesheet"][href^="css/"]').forEach(l => {
  const href = l.getAttribute('href').split('?')[0];
  if (l.getAttribute('href') === `${href}?v=${VERSION}`) return;
  const fresh = l.cloneNode();
  fresh.setAttribute('href', `${href}?v=${VERSION}`);
  fresh.onload = fresh.onerror = () => l.remove();
  l.after(fresh);
});
route();
initSync();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');

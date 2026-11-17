// Hole viewer: the hole drawn tee-at-bottom, green-at-top. A crosshair dot is
// fixed a third of the way down the screen; panning, zooming or rotating the map
// moves the course underneath it, and the distances from the tee and to the pin
// follow, along with the strokes gained by a tee shot finishing there for the
// chosen handicap level. The course outlines can be switched off. Two optional arcs, both centred on the tee and passing through the
// crosshair: the fairway width, and a dispersion arc of adjustable width.
// The + button records the crosshair as where the ball finished; after that the
// distances, line and arcs are measured from the last recorded shot. Once a
// shot reaches the green the map zooms onto it, the player places the pin,
// distances switch to feet for putts, and a Holed button finishes the hole.

import { h, course, TILE_URL, LIE_COLOR, teePosition, isAdmin, toast, complexHoles, partOf } from './app.js';
import { store, sync, fetchCoachStudents, fetchBagOf, fetchStudentActivity } from './store.js';
import { lieAt, yards, inPolygon, boundsOf, distToLine, drawnRing, YD_PER_M } from './geo.js';
import { VERSION } from './version.js';
import { expected, LEVELS } from './sg.js';
import { newRound, analyzeHole, analyzeRound, CAT_LABEL, CATS } from './model.js';
import { currentRound, setCurrentRound, pauseRound, holeCountOf, roundKeyOf, submitRound, isScouting, isTourneyScout, endScouting, isWatching, watchInfo, startHoleOf, playOrder } from './rounds.js';
import { liveLink, isLiveOn, setLiveOn, liveStatus, onLiveStatus, loadWatch, watchHole, shareCurrent } from './live.js';
import { openBoundaryEditor, resumeEditAt, editFeatures } from './holeedit.js';
import { elevIndex, elevPrefs, drawElevation, styleElevation, resetContourLook, heightAt, CONTOUR_YD } from './elev.js';

const maplibregl = window.maplibregl;
const LIE_TAG = { tee: 'TEE', fairway: 'FWY', rough: 'RGH', bunker: 'BNK', green: 'GRN', water: 'WTR', ob: 'OB', recovery: 'REC' };
const levelName = l => (l === 'Pro' || l === 'Scratch' ? l : `${l} hcp`);
const ll = p => [p[1], p[0]]; // [lat, lng] -> MapLibre's [lng, lat]
const M_PER_DEG = 111320;
const CROSSHAIR_Y = 1 / 3; // fraction of the screen height, from the top

let map = null;

// Club names as the coaching app's My Bag stores them ('Dr', '3W', '4HY', '7I', 'PW', '52', ...).
export function clubName(n) {
  if (!n) return '';
  if (n === 'Dr') return 'Driver';
  if (n === 'Dr2') return 'Driver 2';
  let m;
  if ((m = /^(\d)W$/.exec(n))) return `${m[1]} Wood`;
  if ((m = /^(\d)HY$/.exec(n))) return `${m[1]} Hybrid`;
  if ((m = /^(\d)I$/.exec(n))) return `${m[1]} Iron`;
  if (/^\d\d$/.test(n)) return `${n}°`;
  return n;
}
const clubShort = n => (n === 'Putter' ? 'Putt' : /^(\d)I$/.test(n) ? n[0] + 'i' : /^(\d)HY$/.test(n) ? n[0] + 'H' : /^\d\d$/.test(n) ? n + '°' : n);
// The stroke number of the shot at index i: earlier penalty strokes count too
// (a re-tee after OB is shot 3). Old rounds mark water with a 'water' lie.
const strokeNo = (shots, i) => { let n = i + 1; for (let k = 0; k < i; k++) n += shots[k].pen || 0; for (let k = 1; k <= i; k++) if (shots[k].lie === 'water') n++; return n; };
const SWING_NAME = { '3/4': '¾', '1/2': '½', punch: 'punch', recovery: 'recovery' };

let watchTimer = null, liveUnsub = null;
// Replay state, kept as the hole screen moves from hole to hole: { playing, speed, hole, step, done }.
let replay = null;
// GPS: the phone's position while the hole screen is open (only while the GPS
// button is on). The last fix is kept between holes so the dot shows at once.
let gpsWatch = null, gpsFix = null; // gpsFix = { pos: [lat, lng], acc (metres), at (ms) }
function stopGps() { if (gpsWatch != null) { navigator.geolocation.clearWatch(gpsWatch); gpsWatch = null; } }
// Wind: the current wind at the course, from Open-Meteo (no key needed). Kept per
// course for 10 minutes so moving between holes doesn't refetch it.
const windCache = {}; // course id -> { at, speed (mph), dir (degrees the wind comes from) }
let windTimer = null;
async function fetchWind(id, at) {
  const c = windCache[id];
  if (c && Date.now() - c.at < 600000) return c;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${at[0].toFixed(4)}&longitude=${at[1].toFixed(4)}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=mph`);
    if (!r.ok) return c || null;
    const cur = (await r.json()).current;
    if (cur?.wind_speed_10m == null || cur.wind_direction_10m == null) return c || null;
    return (windCache[id] = { at: Date.now(), speed: cur.wind_speed_10m, dir: cur.wind_direction_10m });
  } catch { return c || null; }
}
export function closeHole() { clearInterval(windTimer); windTimer = null; stopGps(); clearInterval(watchTimer); watchTimer = null; liveUnsub?.(); liveUnsub = null; if (map) { map.remove(); map = null; } }
export const lastHole = () => +sessionStorage.getItem('hole') || 1;

// Compass direction from a to b, in degrees clockwise from north.
function bearing(a, b) {
  const k = Math.cos((a[0] * Math.PI) / 180);
  return (Math.atan2((b[1] - a[1]) * k, b[0] - a[0]) * 180) / Math.PI;
}

// The arc through `target` centred on `tee`: every point on it is the same
// distance from the tee. Returns a function giving the point `s` metres along
// the arc, right of the target (+) or left of it (-).
export function arcThrough(tee, target) {
  const k = Math.cos((tee[0] * Math.PI) / 180);
  const e = (target[1] - tee[1]) * M_PER_DEG * k, n = (target[0] - tee[0]) * M_PER_DEG;
  const r = Math.hypot(e, n), theta0 = Math.atan2(e, n);
  if (r < 1) return null;
  return s => {
    const th = theta0 + s / r;
    return [tee[0] + (r * Math.cos(th)) / M_PER_DEG, tee[1] + (r * Math.sin(th)) / (M_PER_DEG * k)];
  };
}

function arcPoints(arc, from, to) {
  const pts = [];
  const steps = Math.max(2, Math.ceil((to - from) / 1.5));
  for (let i = 0; i <= steps; i++) pts.push(arc(from + ((to - from) * i) / steps));
  return pts;
}

// Fairway width at `target`, measured along the arc through it. Returns the
// arc's extent in metres left (l) and right (r) of the target and the width in
// yards, or null when there is no fairway on the arc within reach. If the
// target is just off the fairway, the nearest stretch of fairway is measured.
export function fairwayWidth(tee, target, fairways, reachYd = 80) {
  const arc = arcThrough(tee, target);
  if (!arc) return null;
  const STEP = 0.5, reach = reachYd / YD_PER_M, limit = 200 / YD_PER_M;
  const near = fairways.filter(f => target[0] > f.box[0][0] && target[0] < f.box[1][0] && target[1] > f.box[0][1] && target[1] < f.box[1][1]);
  const on = s => { const p = arc(s); return near.some(f => inPolygon(p, f.p)); };
  let start = null;
  if (on(0)) start = 0;
  else for (let s = STEP; s <= reach && start == null; s += STEP) { if (on(s)) start = s; else if (on(-s)) start = -s; }
  if (start == null) return null;
  let l = start, r = start;
  while (l > -limit && on(l - STEP)) l -= STEP;
  while (r < limit && on(r + STEP)) r += STEP;
  return { arc, l, r, yards: (r - l) * YD_PER_M };
}

// The outlines worth drawing for one hole: its own fairways, green and tee
// boxes (each belongs to the hole whose centre line it is nearest), plus any
// bunker or water within 70 m of the hole's line, since those can be shared.
const centre = ring => [ring.reduce((a, p) => a + p[0], 0) / ring.length, ring.reduce((a, p) => a + p[1], 0) / ring.length];
// The hole's own green: the one the pin is on, or failing that the nearest.
function ownGreen(ch, features = course.features) {
  const greens = features.filter(f => f.t === 'green' && (f.h == null || f.h === ch.n));
  return greens.find(g => g.h === ch.n) || greens.find(g => inPolygon(ch.pin, g.p))
    || greens.reduce((best, g) => (!best || yards(centre(g.p[0]), ch.pin) < yards(centre(best.p[0]), ch.pin) ? g : best), null);
}
// Two boxes [[s, w], [n, e]] overlap (with `pad` degrees of slack).
const overlaps = (a, b, pad) => a[0][0] <= b[1][0] + pad && a[1][0] >= b[0][0] - pad && a[0][1] <= b[1][1] + pad && a[1][1] >= b[0][1] - pad;
// The OB area is a big box with the course cut out of it: only the cut-out —
// the course boundary — is drawn, as a single line.
const obLines = f => (f.p.length > 1 ? f.p.slice(1) : f.p);
function holeFeatures(ch, features = course.features) {
  const green = ownGreen(ch, features), holes = complexHoles();
  return features.filter(f => {
    if (f.t === 'ob') return obLines(f).some(r => r.some(p => distToLine(p, ch.line) <= 150));
    if (f.t === 'bunker' || f.t === 'water' || f.t === 'recovery' || f.t === 'trees') return f.p[0].some(p => distToLine(p, ch.line) <= 70);
    if (f.h != null) return f.h === ch.n; // tied to a hole in the boundary editor
    if (f.t === 'green') return f === green; // not a neighbour's or a practice green
    const c = centre(f.p[0]);
    const own = distToLine(c, ch.line);
    return own <= 120 && holes.every(o => o === ch || distToLine(c, o.line) >= own);
  });
}

// Leave a past round that was opened from Round History.
function leaveView() { localStorage.removeItem('gs:viewOnly'); localStorage.removeItem('gs:editingPast'); setCurrentRound(null); }

export function renderHole(view, n) {
  // A finished (submitted) round always reopens in view mode, unless it's being edited.
  // Live view: someone else's round from a share link, read-only and never saved here.
  const watching = isWatching();
  if (!watching) { const r0 = currentRound(); if (r0?.submitted && localStorage.getItem('gs:editingPast') !== '1') localStorage.setItem('gs:viewOnly', '1'); }
  // A view to keep when the hole is re-rendered for Edit / Save / Cancel.
  let keepCam = null;
  try { const c = sessionStorage.getItem('gs:cam'); if (c) keepCam = JSON.parse(c); } catch { /* none */ }
  sessionStorage.removeItem('gs:cam');
  closeHole();
  sessionStorage.setItem('hole', n);
  const ch = course.holes[n - 1];
  const settings = store.get('settings') || {};
  const round0 = currentRound();
  const teeName = round0?.tee || settings.tee || 'Blue';
  // ‹ › go round the holes of the round; a 9-hole round on the back nine goes 10 to 18.
  const holeCount = Math.min(course.holes.length, Math.max(holeCountOf(round0), n, ...Object.keys(round0?.holes || {}).map(Number).filter(k => k > 0)));
  const prevHole = n === 1 ? holeCount : n - 1, nextHole = n >= holeCount ? 1 : n + 1;
  const teeSet = course.tees.find(t => t.name === teeName) || course.tees[0];
  const fairways = course.features.filter(f => f.t === 'fairway').map(f => ({ p: f.p, box: boundsOf(f.p[0], 200) }));
  // Aiming (the opening crosshair and Auto) only uses this hole's own fairways
  // and tee boxes: another hole's, however close, counts as rough here.
  const ownFeats = new Set(holeFeatures(ch));
  const aimFeatures = course.features.filter(f => !(f.t === 'fairway' || f.t === 'tee') || ownFeats.has(f));
  const ownFairways = course.features.filter(f => f.t === 'fairway' && ownFeats.has(f)).map(f => ({ p: f.p, box: boundsOf(f.p[0], 200) }));

  let tee = teePosition(teeName, ch, holeFeatures(ch).filter(f => f.t === 'tee'));
  let pin = ch.pin; // replaced by the round's pin for this hole once it is placed
  let target = tee;
  const flag = (key, def) => (localStorage.getItem(key) ?? def) === '1';
  let showWidth = flag('gs:fairwayWidth', '0');
  let showArc = flag('gs:arc', '0');
  let arcYd = Math.min(80, Math.max(10, +localStorage.getItem('gs:arcYd') || 40));
  let showOutlines = !watching && flag('gs:lines', '0'); // off until switched on; never when watching a live round (a new key: everyone started off again in 0.73.6)
  // Strokes-gained baseline: the round's "compare to" choice (which defaults to
  // the profile's handicap), unless it was changed on this screen this visit.
  const pick = l => (LEVELS.includes(l) ? l : null);
  let level = pick(sessionStorage.getItem('gs:level')) || pick(round0?.level) || pick(sync.level) || 'Scratch';

  // Shots go in the current round (set up on the New Round page): hole.shots is
  // a list of where each stroke was played from, starting at the tee. Recording
  // a shot with no round under way starts one for today.
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const roundKey = () => { const r = currentRound(); return r ? roundKeyOf(r.id) : null; };
  const scouting = isScouting(); // GPS Scouting: a round held in memory only, never saved
  // Tournament mode (picked on New Round / GPS Overview): only what the Rules of
  // Golf (4.3a) allow while playing: plain distances, compass, scorecard, shot
  // tracking. No plays-like (height or wind), wind, contours and slope, club or
  // line advice (Auto, Comp, the Club box's Auto pick) and no strokes gained
  // (crosshair SG, Disp, Appr SG, SG map, Expected), and no course lines. A finished round viewed
  // afterwards shows everything again.
  const tourney = !watching && (scouting ? isTourneyScout()
    : round0?.type === 'Tournament' && !round0.submitted && localStorage.getItem('gs:viewOnly') !== '1');
  if (tourney) showOutlines = false; // no course lines in a tournament either
  if (tourney) showWidth = showArc = false; // and no Tools at all (Width, Arc, Disp, Appr): the Tools button is gone
  // Replay (a client's past round, played back shot by shot): this hole shows
  // only the strokes played so far.
  const rp = watching && sessionStorage.getItem('gs:replay') === '1' ? (replay ||= { playing: true, speed: 1 }) : null;
  if (!rp) replay = null;
  else if (rp.hole !== n) { rp.hole = n; rp.step = 0; rp.done = false; }
  const strokesIn = hl => Math.max(0, (hl.shots || []).length - (hl.done ? 0 : 1));
  const holeNow = () => {
    if (scouting || watching) {
      const hl = currentRound().holes[n] || { pin: null, done: false, shots: [] };
      if (!rp || rp.step >= strokesIn(hl)) return hl;
      return { ...hl, done: false, shots: hl.shots.slice(0, rp.step + 1) };
    }
    const k = roundKey(); return (k && store.get(k).holes[n]) || { pin: null, done: false, shots: [] };
  };
  const shotsNow = () => holeNow().shots || [];
  // The shots to plan from: none once the hole is finished, so the tools work from the tee again.
  const planShots = () => (holeNow().done ? [] : shotsNow());
  function saveHole(patch) {
    if (watching) return;
    if (scouting) {
      const r = currentRound();
      r.holes = { ...r.holes, [n]: { pin: null, done: false, shots: [], ...r.holes[n], ...patch } }; r.updated = Date.now();
      syncPin(); drawShots(); update();
      return;
    }
    let k = roundKey();
    if (!k) {
      const r = { ...newRound(course, teeName, today), courseName: course.name, player: sync.user ? sync.name : '', level, type: 'Casual', holeCount: Math.min(18, course.holes.length) };
      k = roundKeyOf(r.id); store.set(k, r); setCurrentRound(r.id);
    }
    const r = store.get(k);
    store.set(k, { ...r, updated: Date.now(), holes: { ...r.holes, [n]: { pin: null, done: false, shots: [], ...r.holes[n], ...patch } } });
    syncPin();
    drawShots();
    update();
  }
  const saveShots = shots => saveHole({ shots });
  if (holeNow().pin) pin = holeNow().pin;

  // Where the player is on this hole: playing up to the green, on the green
  // waiting for the pin to be placed, putting, or holed out.
  const stage = () => {
    const hl = holeNow(), shots = hl.shots || [], last = shots[shots.length - 1];
    if (hl.done) return 'done';
    if (!last || last.lie !== 'green') return 'play';
    return hl.pin ? 'putt' : 'pin';
  };
  const FT_PER_YD = 3;

  const mapEl = h('div', { id: 'gmap' });
  const toPinEl = h('div', { class: 'readout to' });
  const fromTeeEl = h('div', { class: 'readout from' });

  const toggle = (cls, text, icon, title, get, set) => {
    const btn = h('button', { class: `fab ${cls}` + (get() ? ' on' : ''), 'aria-pressed': String(get()), title,
      onclick: () => { set(!get()); btn.classList.toggle('on', get()); btn.setAttribute('aria-pressed', String(get())); update(); } },
      h('span', {}, icon), h('small', {}, text));
    return btn;
  };
  // Arc width: a preset / slider value, or Auto — the club's arc from My Bag if
  // set, otherwise 15% of the ball-to-crosshair distance (10 to 80 yd).
  let arcAuto = localStorage.getItem('gs:arcAuto') === '1';
  const arcValue = h('b', {}, arcAuto ? 'Auto' : `${arcYd} yd`);
  const setArc = v => {
    arcAuto = v === 'auto'; localStorage.setItem('gs:arcAuto', arcAuto ? '1' : '0');
    if (!arcAuto) { arcYd = v; arcRange.value = v; arcValue.textContent = `${v} yd`; localStorage.setItem('gs:arcYd', v); }
    presets.forEach(b => b.classList.toggle('on', arcAuto ? b.value === 'auto' : +b.value === arcYd && b.value !== 'auto'));
    update();
  };
  const arcRange = h('input', { type: 'range', min: 10, max: 80, step: 1, value: arcYd, 'aria-label': 'Arc width in yards', oninput: e => setArc(+e.target.value) });
  const presets = [h('button', { class: 'preset' + (arcAuto ? ' on' : ''), value: 'auto', onclick: () => setArc('auto') }, 'Auto'),
    ...[20, 30, 40, 50, 60].map(v => h('button', { class: 'preset' + (!arcAuto && v === arcYd ? ' on' : ''), value: v, onclick: () => setArc(v) }, String(v)))];
  const arcSlider = h('div', { class: 'arcslider', hidden: !showArc },
    h('div', { class: 'presets' }, presets),
    h('div', { class: 'slide' }, h('span', {}, 'Arc'), arcRange, arcValue));
  const widthBtn = toggle('width', 'Width', '↔', 'Fairway width at the crosshair', () => showWidth, v => { showWidth = v; localStorage.setItem('gs:fairwayWidth', v ? '1' : '0'); });
  // Course lines (bunker, fairway, water and green outlines): a switch in the View box.
  const setOutlines = v => {
    showOutlines = v; localStorage.setItem('gs:lines', v ? '1' : '0'); localStorage.removeItem('gs:outlines');
    if (m.getLayer('outlines')) m.setLayoutProperty('outlines', 'visibility', v ? 'visible' : 'none');
  };
  // Arc turns the arc on or off; while it's on, a small Adj button beside it
  // opens the width slider.
  let arcAdjOpen = false;
  // Arc and Appr are never on together: turning one on turns the other off.
  const setArcOn = v => { showArc = v; localStorage.setItem('gs:arc', v ? '1' : '0'); if (!v) arcAdjOpen = false; arcBtn?.classList.toggle('on', v); arcBtn?.setAttribute('aria-pressed', String(v)); };
  const setApprOn = v => { showAppr = v; localStorage.setItem('gs:appr', v ? '1' : '0'); if (!v) apprAdjOpen = false; apprBtn?.classList.toggle('on', v); apprBtn?.setAttribute('aria-pressed', String(v)); };
  // Disp: a dispersion oval at the crosshair (as wide as the arc) with 20 evenly
  // spread shots in it, scored for SG. Arc, Disp and Appr are never on together.
  let showDisp = !tourney && flag('gs:disp', '0');
  const setDispOn = v => { showDisp = v; localStorage.setItem('gs:disp', v ? '1' : '0'); if (!v) arcAdjOpen = false; dispBtn?.classList.toggle('on', v); dispBtn?.setAttribute('aria-pressed', String(v)); };
  const onlyOne = keep => { if (keep !== 'arc' && showArc) setArcOn(false); if (keep !== 'disp' && showDisp) setDispOn(false); if (keep !== 'appr' && showAppr) setApprOn(false); };
  const arcBtn = toggle('arc', 'Arc', '◠', 'Dispersion arc at the crosshair', () => showArc, v => { setArcOn(v); if (v) onlyOne('arc'); });
  const dispBtn = toggle('disp', 'Disp', '⬭', 'Dispersion oval with 15 shots, scored for SG', () => showDisp, v => { setDispOn(v); if (v) onlyOne('disp'); });
  const dispAdjBtn = h('button', { class: 'fab arcadj dispadj', 'aria-label': 'Adjust dispersion width', title: 'Adjust dispersion width', hidden: true,
    onclick: () => { arcAdjOpen = !arcAdjOpen; update(); } }, h('span', {}, '⇔'), h('small', {}, 'Adj'));
  const arcAdjBtn = h('button', { class: 'fab arcadj', 'aria-label': 'Adjust arc width', title: 'Adjust arc width', hidden: true,
    onclick: () => { arcAdjOpen = !arcAdjOpen; update(); } }, h('span', {}, '⇔'), h('small', {}, 'Adj'));

  // Approach circle, with a Distance | SG toggle at the top of its pill:
  //  Distance — a ring of a set size in feet around the crosshair (where you're aiming)
  //  SG       — a ring around the pin where landing on the green gains this much
  //             (-1 to +1, default 0) for an approach from where the ball is now
  let showAppr = !tourney && flag('gs:appr', '0');
  let apprFt = Math.min(80, Math.max(10, +localStorage.getItem('gs:apprFt') || 40));
  let apprMode = !tourney && localStorage.getItem('gs:apprMode') === 'sg' ? 'sg' : 'ft';
  const apprSlider = h('div', { class: 'arcslider appr', hidden: true });
  function drawApprSlider() {
    const isSg = apprMode === 'sg';
    const cur = () => (isSg ? sgCfg.rings.value : apprFt);
    const fmtVal = v => (isSg ? `${fmtSg(v) || '0'} SG` : `${v} ft`);
    const value = h('b', {}, fmtVal(cur()));
    const setVal = v => {
      if (isSg) { sgCfg.rings.value = clampSg(v); try { localStorage.setItem('gs:sgCfg', JSON.stringify(sgCfg)); } catch { /* ignore */ } }
      else { apprFt = Math.round(Math.max(10, Math.min(80, +v || 40))); localStorage.setItem('gs:apprFt', apprFt); }
      value.textContent = fmtVal(cur()); range.value = cur();
      presets.forEach(b => b.classList.toggle('on', +b.value === cur()));
      update();
    };
    const range = isSg
      ? h('input', { type: 'range', min: -1, max: 1, step: 0.05, value: cur(), 'aria-label': 'Approach ring SG', oninput: e => setVal(e.target.value) })
      : h('input', { type: 'range', min: 10, max: 80, step: 1, value: cur(), 'aria-label': 'Approach circle radius in feet', oninput: e => setVal(+e.target.value) });
    const presets = (isSg ? [-0.5, -0.25, 0, 0.25, 0.5] : [20, 30, 40, 50, 60]).map(v =>
      h('button', { class: 'preset' + (v === cur() ? ' on' : ''), value: v, onclick: () => setVal(v) }, isSg ? fmtSg(v) || '0' : String(v)));
    const mode = (m, label) => h('button', { class: apprMode === m ? 'on' : '', onclick: () => { apprMode = m; localStorage.setItem('gs:apprMode', m); drawApprSlider(); update(); } }, label);
    apprSlider.classList.toggle('sgmode', isSg);
    apprSlider.replaceChildren(
      tourney ? null : h('div', { class: 'modes' }, mode('ft', 'Distance'), mode('sg', 'SG')),
      h('div', { class: 'presets' }, presets),
      h('div', { class: 'slide' }, h('span', {}, 'Appr'), range, value));
  }
  const apprBtn = toggle('appr', 'Appr', '◎', 'Approach circle around the crosshair', () => showAppr, v => { setApprOn(v); if (v) onlyOne('appr'); });
  // Like Arc: Appr turns the circle on or off; a small Adj button beside it opens its slider.
  let apprAdjOpen = false;
  const apprAdjBtn = h('button', { class: 'fab arcadj appradj', 'aria-label': 'Adjust approach circle', title: 'Adjust approach circle', hidden: true,
    onclick: () => { apprAdjOpen = !apprAdjOpen; update(); } }, h('span', {}, '⇔'), h('small', {}, 'Adj'));
  if (showArc) { if (showDisp) setDispOn(false); if (showAppr) setApprOn(false); } else if (showDisp && showAppr) setApprOn(false);
  const slidersEl = h('div', { class: 'sliders' }, apprSlider, arcSlider);

  // SG target: a ring around the pin at the distance from which a ball on the
  // green gains 0 strokes for the selected handicap, for an approach from where
  // the ball is now (the last recorded shot, or the tee). Labelled on the map.
  let showSgt = !tourney && flag('gs:sgTarget', '0');
  // SG map view (a switch in the View box): the strokes-gained heat map for the drive.
  const setSgt = v => { showSgt = v; localStorage.setItem('gs:sgTarget', v ? '1' : '0'); update(); };
  // The Appr pill's SG value (kept on this device).
  const SG_DEFAULT = { zones: { n: 3, min: 0, max: 0.5 }, rings: { value: 0 } };
  let sgCfg = SG_DEFAULT;
  try { const c = JSON.parse(localStorage.getItem('gs:sgCfg') || '{}'); sgCfg = { zones: { ...SG_DEFAULT.zones, ...c.zones }, rings: { ...SG_DEFAULT.rings, ...c.rings } }; } catch { /* defaults */ }
  const clampSg = v => Math.max(-1, Math.min(1, Math.round((+v || 0) * 100) / 100));
  const fmtSg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + String(Math.abs(Math.round(v * 100) / 100)).replace(/^0\./, '.');
  // Colour for an SG value: red below 0, pale at 0, deeper green above.
  function sgColor(v) {
    const t = Math.sqrt(Math.min(1, Math.abs(v))), pale = [254, 243, 160];
    const end = v < 0 ? [220, 38, 38] : [21, 128, 61];
    return pale.map((p0, i) => Math.round(p0 + (end[i] - p0) * t));
  }
  const zoneLegend = h('div', { class: 'zonelegend heat', hidden: true });
  // A slim colour bar in the top-left corner, labelled at the band edges, so it
  // stays clear of the readouts around the crosshair on narrow screens.
  function drawLegend() {
    const blocks = HEAT_BANDS.map(([, c]) => c);
    const edges = ['+.75', '+.5', '+.25', '0', '−.25', '−.5', '−.75'];
    zoneLegend.replaceChildren(h('small', {}, 'SG'),
      h('div', { class: 'heatbar' }, blocks.map((c, i) => h('div', { class: 'blk', style: `background:rgb(${c.join(',')})` },
        edges[i] ? h('em', {}, edges[i]) : null))));
  }
  const ringLegend = h('div', { class: 'zonelegend ringkey', hidden: true });
  drawApprSlider();
  // Feet from the hole at which a ball on the green gains `sg` strokes for an
  // approach from `from` (expected putts there = expected strokes from `from` - 1 - sg).
  // null when that much can't be gained; Infinity when anywhere on the green gains it.
  function sgFeet(fromLie, fromYd, sg) {
    const goal = expectedFrom(fromLie, fromYd) - 1 - sg;
    if (goal <= expected('green', 1, level)) return null;
    let lo = 1, hi = 200;
    if (expected('green', hi, level) < goal) return Infinity; // anywhere on the green gains
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (expected('green', mid, level) < goal) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  // Tee-shot SG zones: every spot near the hole's route where a drive would
  // gain 0 to 0.5 strokes for the selected handicap, scored with the actual lie
  // there (fairway or rough, so the zones follow the fairway's edges), split
  // into three bands. Bunkers and water are left out. Drawn as an image laid
  // over the map and only recomputed when the tee, pin or handicap changes.
  let zoneKey = null, zoneImg = null;
  // Drive SG heat map: every spot within ~70 yd of the hole's route, from 60 yd
  // off the tee to past the green, coloured by the strokes a drive landing there
  // gains for the selected handicap, from its actual lie (fairway, rough, bunker
  // or water — water counting the penalty stroke and a drop), in 0.25 bands:
  // reds below 0, greens above. Water is always shown in the reds.
  const HEAT_BANDS = [ // [lowest SG in the band, colour], highest first
    [0.75, [20, 83, 45]], [0.5, [22, 163, 74]], [0.25, [74, 222, 128]], [0, [187, 247, 208]],
    [-0.25, [252, 165, 165]], [-0.5, [248, 113, 113]], [-0.75, [220, 38, 38]], [-Infinity, [153, 27, 27]]];
  const heatColor = sg => HEAT_BANDS.find(([lo]) => sg >= lo)[1];
  drawLegend();
  function sgZoneImage() {
    const key = [tee, pin, level].join('|');
    if (key === zoneKey) return zoneImg;
    zoneKey = key; zoneImg = null;
    const teeExp = expected('tee', yards(tee, pin), level);
    const total = yards(tee, pin);
    const back = [...route()].reverse();
    const span = [];
    for (let d = 0; d <= Math.max(0, total - 60); d += 5) span.push(pointAlong(back, d));
    if (span.length < 2) return null;
    const box = boundsOf(span, 70);
    const routeLine = route();
    const feats = course.features
      .map(f => ({ ...f, box: boundsOf(f.p[0]) }))
      .filter(f => overlaps(f.box, box, 0.001));
    const lieHere = q => lieOn(q, feats.filter(f => q[0] >= f.box[0][0] && q[0] <= f.box[1][0] && q[1] >= f.box[0][1] && q[1] <= f.box[1][1]));
    const CELL = 2; // metres
    const [[s0, w0], [n0, e0]] = box;
    const rows = Math.ceil(((n0 - s0) * M_PER_DEG) / CELL), cols = Math.ceil(((e0 - w0) * M_PER_DEG * Math.cos((s0 * Math.PI) / 180)) / CELL);
    const canvas = document.createElement('canvas'); canvas.width = cols; canvas.height = rows;
    const ctx = canvas.getContext('2d'), img = ctx.createImageData(cols, rows);
    for (let r = 0; r < rows; r++) {
      const lat = n0 - ((r + 0.5) / rows) * (n0 - s0);
      for (let c = 0; c < cols; c++) {
        const q = [lat, w0 + ((c + 0.5) / cols) * (e0 - w0)];
        if (distToLine(q, routeLine) * YD_PER_M > 70) continue; // stay on this hole
        if (yards(q, tee) < 60) continue; // not a drive
        const lie = lieHere(q);
        const sg = sgFinish(teeExp, lie, yards(q, pin));
        const z = heatColor(lie === 'water' ? Math.min(sg, -0.01) : sg), i = (r * cols + c) * 4;
        img.data[i] = z[0]; img.data[i + 1] = z[1]; img.data[i + 2] = z[2]; img.data[i + 3] = lie === 'water' || lie === 'ob' ? 190 : 130;
      }
    }
    ctx.putImageData(img, 0, 0);
    zoneImg = { url: canvas.toDataURL(), coordinates: [[w0, n0], [e0, n0], [e0, s0], [w0, s0]] };
    return zoneImg;
  }
  function showZones(on) {
    zoneLegend.hidden = !on;
    if (!m.getLayer('outlines')) return;
    const z = on ? sgZoneImage() : null;
    if (z && !m.getSource('sgzones')) {
      m.addSource('sgzones', { type: 'image', url: z.url, coordinates: z.coordinates });
      m.addLayer({ id: 'sgzones', type: 'raster', source: 'sgzones', paint: { 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, 'outlines');
    } else if (z && m.getSource('sgzones')._shownKey !== zoneKey) m.getSource('sgzones').updateImage(z);
    if (m.getSource('sgzones')) m.getSource('sgzones')._shownKey = zoneKey;
    if (m.getLayer('sgzones')) m.setLayoutProperty('sgzones', 'visibility', z ? 'visible' : 'none');
  }
  // Live view: everything away from this hole is dimmed with a soft edge, so the
  // hole being played stands out from the ones beside it. Drawn once as a picture
  // laid over the map: dark all over, cleared along the hole's line, its own
  // fairways, greens, tee boxes and nearby bunkers, and wherever shots were played.
  const DIM = 'rgba(5, 12, 6, 0.56)';
  function holeSpotlight() {
    const line = route(), own = holeFeatures(ch), shots = shotsNow().filter(x => x.pos).map(x => x.pos);
    const lats = line.map(p => p[0]), lngs = line.map(p => p[1]);
    const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2, lng0 = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const HALF = 900, N = 1400; // metres from the middle of the hole to the picture's edge; pixels across
    const dLat = HALF / M_PER_DEG, dLng = dLat / Math.cos((lat0 * Math.PI) / 180);
    const west = lng0 - dLng, east = lng0 + dLng, north = lat0 + dLat, south = lat0 - dLat;
    const px = p => [((p[1] - west) / (east - west)) * N, ((north - p[0]) / (north - south)) * N];
    const yd = N / (2 * HALF) / YD_PER_M; // pixels per yard
    const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
    // `mask` is how much of the tint to take away at each spot.
    const mask = canvas(), mx = mask.getContext('2d');
    mx.lineJoin = mx.lineCap = 'round'; mx.strokeStyle = mx.fillStyle = '#fff';
    const trace = (pts, close) => { mx.beginPath(); pts.forEach((p, i) => { const [x, y] = px(p); i ? mx.lineTo(x, y) : mx.moveTo(x, y); }); if (close) mx.closePath(); };
    // Paint each shape out to `r` yards around it, fading over the next `feather` yards.
    const paint = (shapes, feather) => {
      const STEPS = 9;
      for (let i = 0; i <= STEPS; i++) {
        mx.globalAlpha = i === STEPS ? 1 : 0.28;
        for (const sh of shapes) {
          trace(sh.pts, sh.fill);
          if (sh.fill) mx.fill();
          mx.lineWidth = 2 * (sh.r + feather * (1 - i / STEPS)) * yd; mx.stroke();
        }
      }
    };
    // Clear: the hole's line, its own fairways, green, tee boxes and bunkers, and the shots played.
    const clear = [{ pts: line, r: 26 }];
    if (shots.length > 1) clear.push({ pts: shots, r: 14 });
    own.forEach(f => {
      if (f.t === 'fairway' || f.t === 'green' || f.t === 'tee') clear.push({ pts: f.p[0], r: 18, fill: true });
      // Only bunkers close to this hole's line: ones further out usually guard a neighbour's green.
      else if (f.t === 'bunker' && f.p[0].some(p => distToLine(p, ch.line) <= 40)) clear.push({ pts: f.p[0], r: 6, fill: true });
    });
    paint(clear, 18);
    // Tinted again: other holes' greens, fairways and tee boxes that fall inside that area.
    const ownSet = new Set(own);
    const others = course.features.filter(f => (f.t === 'green' || f.t === 'fairway' || f.t === 'tee') && !ownSet.has(f))
      .filter(f => f.p[0].some(p => p[0] > south && p[0] < north && p[1] > west && p[1] < east))
      .map(f => ({ pts: f.p[0], r: f.t === 'green' ? 5 : 1, fill: true }));
    mx.globalCompositeOperation = 'destination-out';
    paint(others, 7);
    // The tint, with the mask taken out of it.
    const cv = canvas(), ctx = cv.getContext('2d');
    ctx.fillStyle = DIM; ctx.fillRect(0, 0, N, N);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mask, 0, 0);
    // The picture, plus the same tint over the rest of the world beyond it.
    m.addSource('spot', { type: 'image', url: cv.toDataURL('image/png'), coordinates: [[west, north], [east, north], [east, south], [west, south]] });
    m.addLayer({ id: 'spot', type: 'raster', source: 'spot', paint: { 'raster-fade-duration': 0, 'raster-resampling': 'linear' } });
    m.addSource('spotfar', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [
      [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], [[west, south], [west, north], [east, north], [east, south], [west, south]]] } } });
    m.addLayer({ id: 'spotfar', type: 'fill', source: 'spotfar', paint: { 'fill-color': DIM, 'fill-antialias': false } });
  }
  function ring(c, rM) {
    const k = Math.cos((c[0] * Math.PI) / 180), pts = [];
    for (let i = 0; i <= 72; i++) { const t = (i / 72) * 2 * Math.PI; pts.push([c[0] + (rM * Math.cos(t)) / M_PER_DEG, c[1] + (rM * Math.sin(t)) / (M_PER_DEG * k)]); }
    return pts;
  }

  // Undo steps back one stage at a time: un-hole, then un-place the pin (if the
  // ball is still on its first spot on the green), then remove the last shot.
  // Move pin: tap Pin, move the crosshair onto the hole, tap Set beside it.
  // Move tee: tap Tee and the aim spot stays put on the map (shown as a ring)
  // while the view jumps to the tee; the screen crosshair now drags the tee
  // around. Set keeps the new tee and brings the crosshair back to the aim spot.
  // Tapping Tee or Pin again cancels.
  let moving = null; // 'tee' | 'pin' | null
  let aim = null, aimMark = null, teeBefore = null;
  const holeEl = () => mapEl.parentElement;
  let savedCam = null; // the view before Tee / Pin was tapped, restored afterwards
  function endMove(keep) {
    const was = moving;
    if (was === 'tee' && !keep) { tee = teeBefore; teeMark.setLngLat(ll(tee)); }
    moving = null;
    teeBtn.classList.remove('on'); pinBtn.classList.remove('on');
    setTeeBtn.hidden = setPinHereBtn.hidden = true;
    holeEl()?.classList.remove('movingtee');
    if (was === 'tee') { aimMark?.remove(); aimMark = null; }
    if (savedCam) m.easeTo({ center: was === 'tee' ? ll(aim) : savedCam.center, zoom: savedCam.zoom, duration: 450 });
    savedCam = null;
    update();
  }
  function startMove(kind) {
    if (moving === kind) return endMove(false);
    if (moving) endMove(false);
    moving = kind;
    (kind === 'tee' ? teeBtn : pinBtn).classList.add('on');
    (kind === 'tee' ? setTeeBtn : setPinHereBtn).hidden = false;
    savedCam = { center: m.getCenter(), zoom: m.getZoom() };
    if (kind === 'tee') {
      aim = target; teeBefore = tee;
      aimMark = new maplibregl.Marker({ element: h('div', { class: 'aimmark', title: 'Aim spot' }) }).setLngLat(ll(aim)).addTo(m);
      holeEl()?.classList.add('movingtee');
      zoomAround(tee, teeArea(tee)); // zoom in on the tee box, like the putting view
    } else {
      const g = ownGreen(ch);
      zoomAround(pin, g ? g.p[0] : ring(pin, 15)); // zoom in on the green
    }
  }
  const setTeeBtn = h('button', { class: 'setnext tee', hidden: true, onclick: () => {
    const shots = shotsNow();
    if (shots.length && shots[0].lie === 'tee') saveShots([{ ...shots[0], pos: tee }, ...shots.slice(1)]);
    endMove(true);
  } }, 'Set tee');
  const setPinHereBtn = h('button', { class: 'setnext pin', hidden: true, onclick: () => {
    pin = target;
    if (roundKey()) saveHole({ pin, shots: shotsNow().map(x => (x.lie === 'green' ? { ...x, ft: Math.max(1, Math.round(yards(x.pos, pin) * FT_PER_YD)) } : x)) });
    else syncPin();
    endMove(true);
  } }, 'Set pin');
  const teeBtn = h('button', { class: 'fab movetee', 'aria-label': 'Move tee', title: 'Move the tee', onclick: () => startMove('tee') }, h('span', {}, '▲'), h('small', {}, 'Tee'));
  const pinBtn = h('button', { class: 'fab movepin', 'aria-label': 'Move pin', title: 'Move the pin', onclick: () => startMove('pin') }, h('span', {}, '⚑'), h('small', {}, 'Pin'));

  // Viewing a past round from Round History: holes open on the normal tee view
  // with the shots drawn and no recording controls, until Edit is tapped.
  const viewing = () => watching || localStorage.getItem('gs:viewOnly') === '1';
  // Re-render this hole keeping the current view (zoom, position, rotation).
  const rerenderHere = () => {
    const c = m.getCenter();
    sessionStorage.setItem('gs:cam', JSON.stringify({ center: [c.lng, c.lat], zoom: m.getZoom(), bearing: m.getBearing() }));
    renderHole(view, n);
  };
  const editBtn = h('button', { class: 'fab viewedit', hidden: !viewing() || watching, onclick: () => {
    const r = currentRound();
    if (r) localStorage.setItem('gs:editSnap', JSON.stringify(r.holes || {})); // for Cancel
    localStorage.removeItem('gs:viewOnly'); localStorage.setItem('gs:editingPast', '1'); rerenderHere();
  } }, '✎ Edit');
  // Editing a past round: Save (beside Undo) goes back to view mode. Changes are
  // already stored as they're made; Save just finishes editing.
  const editingPast = () => !watching && localStorage.getItem('gs:editingPast') === '1' && !viewing();
  const finishEdit = () => { localStorage.removeItem('gs:editingPast'); localStorage.removeItem('gs:editSnap'); localStorage.setItem('gs:viewOnly', '1'); rerenderHere(); };
  const saveBtn = h('button', { class: 'fab savehole', hidden: !editingPast(), onclick: finishEdit }, '✓ Save');
  // Cancel puts every hole back the way it was when Edit was tapped.
  const cancelBtn = h('button', { class: 'fab cancelhole', hidden: !editingPast(), onclick: () => {
    const r = currentRound(), snap = localStorage.getItem('gs:editSnap');
    if (r && snap) { try { store.set(roundKeyOf(r.id), { ...r, holes: JSON.parse(snap), updated: Date.now() }); } catch { /* keep as is */ } }
    finishEdit();
  } }, 'Cancel');

  // Shot list (editing a past round): each shot with its length and where it
  // finished. Tap one to move where it finished: the view jumps there, the
  // crosshair moves it, then Set (or Cancel).
  const shotList = h('div', { class: 'shotlist', hidden: true });
  let movingShot = null; // index into the hole's shots of the spot being moved
  function drawShotList() {
    shotList.hidden = !editingPast();
    if (shotList.hidden) return;
    const shots = shotsNow(), done = holeNow().done, rows = [];
    let putt = 0;
    for (let i = 1; i <= shots.length; i++) {
      const a = shots[i - 1], b = shots[i], isPutt = a.lie === 'green';
      if (!b && !done) break;
      if (isPutt) putt++;
      const len = isPutt ? `${a.ft ?? Math.round(yards(a.pos, pin) * FT_PER_YD)} ft` : `${Math.round(yards(a.pos, b ? b.pos : pin))} yd`;
      const to = !b ? 'holed' : b.lie === 'green' ? (isPutt ? `${b.ft ?? Math.round(yards(b.pos, pin) * FT_PER_YD)} ft` : 'GRN') : LIE_TAG[b.lie] || b.lie;
      const label = `${isPutt ? `Putt ${putt}` : `Shot ${strokeNo(shots, i - 1)}`} · ${len} → ${to}`;
      rows.push(b
        ? h('button', { class: 'shotrow' + (movingShot === i ? ' on' : ''), onclick: () => (movingShot === i ? endShotMove() : startShotMove(i)) }, label)
        : h('div', { class: 'shotrow last' }, label));
    }
    if (!rows.length) rows.push(h('div', { class: 'shotrow last' }, 'No shots yet'));
    if (movingShot != null) rows.push(h('div', { class: 'shotmove' },
      h('button', { class: 'go', onclick: setShotMove }, `Set shot ${movingShot}`), h('button', { onclick: endShotMove }, 'Cancel')));
    // Redo hole: clear it and play it again from the tee.
    rows.push(h('button', { class: 'shotrow redo', onclick: () => {
      if (!confirm(`Redo hole ${n}? Its shots are cleared and you start again from the tee.`)) return;
      movingShot = null; shotCam = null;
      saveHole({ shots: [], pin: null, done: false });
      pin = ch.pin; syncPin(); place();
    } }, '↺ Redo hole'));
    shotList.replaceChildren(...rows);
  }
  let shotCam = null;
  function startShotMove(i) {
    if (moving) endMove(false);
    movingShot = i;
    const c = m.getCenter(); shotCam = { center: c, zoom: m.getZoom() };
    m.easeTo({ center: ll(shotsNow()[i].pos), duration: 400 });
    drawShotList();
  }
  function endShotMove() {
    movingShot = null;
    if (shotCam) m.easeTo({ center: shotCam.center, zoom: shotCam.zoom, duration: 400 });
    shotCam = null;
    drawShotList();
  }
  function setShotMove() {
    const i = movingShot, shots = [...shotsNow()];
    const lie = lieOn(target, course.features);
    const moved = { ...shots[i], pos: target, lie };
    if (lie === 'green') moved.ft = Math.max(1, Math.round(yards(target, pin) * FT_PER_YD)); else delete moved.ft;
    shots[i] = moved;
    movingShot = null; shotCam = null;
    saveShots(shots);
    drawShotList();
  }
  const undoBtn = h('button', { class: 'fab undo', 'aria-label': 'Undo', title: 'Undo',
    onclick: () => {
      const hl = holeNow(), shots = hl.shots || [];
      if (hl.done) return saveHole({ done: false });
      const onGreen = shots.filter(x => x.lie === 'green').length;
      if (hl.pin && onGreen === 1) return saveHole({ pin: null });
      const rest = shots.slice(0, -1);
      const back = shots.at(-1).penalty || (shots.at(-1).replay ? 1 : 0); // a penalty re-hit or drop: take the penalty back too
      if ((back || shots.at(-1).drop) && rest.length) { const { pen, obAt, penKind, ...p } = rest.at(-1); rest[rest.length - 1] = { ...p, ...(pen > back ? { pen: pen - back } : {}) }; }
      saveHole({ shots: rest.length > 1 ? rest : [], pin: rest.some(x => x.lie === 'green') ? hl.pin : null });
      if (stage() === 'play') place();
    } }, '↶');
  // Clubs: My Bag (shared with the coaching app) or a standard set. The club for
  // the next shot is chosen automatically — driver off the tee on par 4s and 5s,
  // otherwise the bag club whose yardage is closest to the ball-to-crosshair
  // distance — unless one was picked with the Club button.
  const DEFAULT_BAG = ['Dr', '3W', '5W', '4HY', '5I', '6I', '7I', '8I', '9I', 'PW', 'GW', 'SW', 'LW'].map(name => ({ name }));
  // GPS Overview can use a student's bag instead (picked at the top of the Club
  // box): { id, name, clubs }, kept until GPS Overview is left.
  let bagFor = null;
  if (scouting) { try { bagFor = JSON.parse(sessionStorage.getItem('gs:scoutBag') || 'null'); } catch { bagFor = null; } }
  const bag = () => { const b = ((bagFor ? bagFor.clubs : sync.bag) || []).filter(c => c && c.name); return b.length ? b : DEFAULT_BAG; };
  const SWINGS = [['full', 'Full'], ['3/4', '¾'], ['1/2', '½'], ['punch', 'Punch'], ['recovery', 'Recovery']];
  let pickedClub = null;
  function autoClub() {
    const shots = planShots(), from = shots.length ? shots[shots.length - 1].pos : tee;
    if (!shots.length && ch.par >= 4) return (bag().find(c => /^Dr/.test(c.name)) || bag()[0]).name;
    const d = yards(from, target);
    let best = null;
    for (const c of bag()) { const y = clubYd(c); if (y && (!best || Math.abs(y - d) < Math.abs(best.y - d))) best = { name: c.name, y }; }
    return best ? best.name : null;
  }
  const currentClub = () => pickedClub || (tourney ? null : autoClub()); // no club advice in a tournament
  // A club's yardage from My Bag (total, else carry), or null.
  // Club yardages: carry by default (where the ball lands, which is what the arcs,
  // dispersion, Comp and Auto plot), or total with roll; either falls back to the other.
  let ydMode = localStorage.getItem('gs:ydMode') === 'total' ? 'total' : 'carry';
  const clubYd = c => { const y = c && +(ydMode === 'total' ? c.total || c.carry : c.carry || c.total); return y > 0 ? y : null; };
  function bagYards(name) { return clubYd(bag().find(x => x.name === name || (name === 'Dr' && /^Dr/.test(x.name)))); }
  // A Carry | Total switch, shown in the Arc/Disp slider and the Comp picker.
  const ydToggle = after => h('div', { class: 'modes ydmode' }, ['carry', 'total'].map(v => h('button', { class: ydMode === v ? 'on' : '', onclick: e => {
    ydMode = v; localStorage.setItem('gs:ydMode', v);
    document.querySelectorAll('.ydmode button').forEach(b => b.classList.toggle('on', b.textContent.toLowerCase() === v));
    e.stopPropagation(); update(); after?.();
  } }, v === 'carry' ? 'Carry' : 'Total')));
  arcSlider.prepend(ydToggle());
  // Typical yardages, for Comp when My Bag has none for a club.
  const TYPICAL_YDS = { Dr: 230, '3W': 210, '5W': 195, '4HY': 185, '4I': 175, '5I': 165, '6I': 155, '7I': 145, '8I': 135, '9I': 125, PW: 115, GW: 100, SW: 85, LW: 70 };
  const compYards = name => bagYards(name) || TYPICAL_YDS[name] || TYPICAL_YDS[name.replace(/\d$/, '')] || null;
  // A club's arc width: its own from My Bag, else 15% of its yardage (10 to 80 yd).
  function clubArcW(name) {
    const own = bagFor ? 0 : (store.get('clubArcs') || {})[name], yd = compYards(name); // arc widths set in My Bag are this device's own
    return own > 0 ? own : yd ? Math.max(10, Math.min(80, Math.round(yd * 0.15))) : arcYd;
  }

  // Comp: 2-3 clubs on the one target line (ball to crosshair), each drawn as
  // an arc at its bag yardage and its own arc width, with the average strokes
  // gained over the spots the arc covers (scored from the lie at each spot).
  const COMP_COLORS = ['#f472b6', '#4dd0ff', '#a3e635'];
  let compClubs = [];
  try { compClubs = JSON.parse(localStorage.getItem('gs:compClubs') || '[]').filter(x => typeof x === 'string').slice(0, 3); } catch { /* none */ }
  let showComp = !tourney && flag('gs:comp', '0') && compClubs.length >= 2;
  const compSheet = h('div', { class: 'clubsheet', hidden: true, onclick: e => { if (e.target === compSheet) compSheet.hidden = true; } });
  const saveComp = () => { localStorage.setItem('gs:comp', showComp ? '1' : '0'); localStorage.setItem('gs:compClubs', JSON.stringify(compClubs)); };
  // Comp's settings (the ⚙ above Comp, or Comp itself the first time, before
  // any clubs are picked): the 2-3 clubs, and arcs or dispersion dots. Done
  // keeps Comp on with these.
  let compMode = localStorage.getItem('gs:compMode') === 'disp' ? 'disp' : 'arc';
  function openCompPicker() {
    let sel = compClubs.filter(c => compYards(c)), mode = compMode;
    const draw = () => compSheet.replaceChildren(h('div', { class: 'clubbox' },
      h('div', { class: 'clubhead' }, h('strong', {}, 'Compare · pick 2–3 clubs'), h('button', { class: 'x', onclick: () => { compSheet.hidden = true; } }, '✕')),
      ydToggle(draw),
      h('div', { class: 'clubgrid' }, bag().map(c => {
        const i = sel.indexOf(c.name), yd = compYards(c.name);
        return h('button', { class: i >= 0 ? 'on comp' : '', style: i >= 0 ? `background:${COMP_COLORS[i]}` : '', disabled: !yd,
          onclick: () => { sel = i >= 0 ? sel.filter(x => x !== c.name) : [...sel, c.name].slice(-3); draw(); } },
          h('b', {}, clubShort(c.name)), h('small', {}, yd ? `${yd} yds` : 'no yds'));
      })),
      h('div', { class: 'compmodes' }, ...[['arc', '◠ Arc'], ['disp', '⁘ Disp']].map(([k, label]) =>
        h('button', { class: mode === k ? 'on' : '', onclick: () => { mode = k; draw(); } }, label))),
      h('div', { class: 'compactions' },
        h('button', { class: 'record', disabled: sel.length < 2, onclick: () => {
          compClubs = sel; compMode = mode; localStorage.setItem('gs:compMode', compMode);
          compSheet.hidden = true; setComp(true);
        } }, 'Done'))));
    draw();
    compSheet.hidden = false;
  }
  // Comp on or off. On: only the compared clubs' arcs or dots show (Arc and Disp
  // go off); with Auto on, each compared club goes onto its own best line.
  // Off: with Auto on, Auto picks the club and line again.
  function setComp(on) {
    if (autoPick) { if (autoPick.comp) compAim = {}; else { pickedClub = null; if (showDisp) setDispOn(false); } autoPick = null; autoBtn.classList.remove('on'); autoKey.hidden = true; }
    showComp = on; compAim = {}; saveComp();
    if (on) { if (showArc) setArcOn(false); if (showDisp) setDispOn(false); }
    update();
    if (autoWanted() && !tourney) runAuto();
  }
  const compBtn = h('button', { class: 'fab comp', 'aria-label': 'Compare clubs', title: 'Compare 2-3 clubs on one line (on / off)', onclick: () => {
    if (!showComp && compClubs.filter(c => compYards(c)).length < 2) { openCompPicker(); return; } // first time: pick the clubs
    setComp(!showComp);
  } }, h('span', {}, '⫶'), h('small', {}, 'Comp'));
  const compSetBtn = h('button', { class: 'fab compset', 'aria-label': 'Compare settings', title: 'Pick the compared clubs, and arcs or dispersion', hidden: true, onclick: openCompPicker }, '⚙');
  const compLegend = h('div', { class: 'zonelegend compkey', hidden: true });
  // View: a clean look at the hole — no crosshair or its yardages, no aiming
  // line, arc, width or approach circle, no shot tracer or shot dots. Comp arcs
  // and their dots stay, to compare the clubs.
  let cleanView = false;
  // Auto: picks the club (from My Bag) and the line for the next shot. Every
  // club with a yardage is tried on every line, 1° apart, up to 35° either side
  // of the pin, and scored by the average SG of the 20 shots in its dispersion.
  // For that score a shot within 5 yd of water or OB counts as in it, and one
  // within 3 yd of a bunker as in the bunker, so the pick keeps that far clear.
  // Shots in trees or recovery areas score as recovery shots, and a line aimed
  // at a hazard, bunker or trees is never picked while another is open. A club's
  // line is its highest-scoring one, except that a line within 0.05 of it with
  // fewer shots in trouble (hazards, bunkers, trees) or, level on those, more on
  // the fairway (or green) is preferred. The club is then simply the one with
  // the highest SG on its line. Trees in the way of the shot aren't
  // looked at. The crosshair moves to the pick and Disp shows its spread. Clubs
  // that would fly well past the pin are skipped. While Comp is on, Auto instead
  // swings each compared club onto its own best line (the crosshair stays put).
  let autoPick = null; // { club, sg, from } while on; { comp: true, from } when it set Comp's lines
  const autoKey = h('div', { class: 'zonelegend autokey', hidden: true });
  // With `only` (Comp's clubs), just those clubs are tried, even ones that would fly past the pin.
  function findBest(only) {
    const shots = planShots(), last = shots[shots.length - 1], from = last ? last.pos : tee;
    const toPinYd = yards(from, pin);
    const fromExp = last ? expectedFrom(last.lie, toPinYd) : expected('tee', toPinYd, level);
    const box = boundsOf([from, pin], 350);
    const feats = aimFeatures.map(f => ({ ...f, box: boundsOf(f.p[0]) })).filter(f => overlaps(f.box, box, 0));
    const lieHere = q => lieOn(q, feats.filter(f => q[0] >= f.box[0][0] && q[0] <= f.box[1][0] && q[1] >= f.box[0][1] && q[1] <= f.box[1][1]));
    const main = bearing(from, pin), k = Math.cos((from[0] * Math.PI) / 180);
    // The lie a shot is scored from: its own, or the hazard it's too close to.
    const BUFFER = { ob: 5 / YD_PER_M, water: 5 / YD_PER_M, bunker: 3 / YD_PER_M }; // metres
    const hz = feats.filter(f => BUFFER[f.t]);
    const segDist = (q, a, b) => {
      const ax = (a[1] - q[1]) * k * M_PER_DEG, ay = (a[0] - q[0]) * M_PER_DEG, bx = (b[1] - q[1]) * k * M_PER_DEG, by = (b[0] - q[0]) * M_PER_DEG;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      return Math.hypot(ax + t * dx, ay + t * dy);
    };
    const near = (q, f) => {
      const pad = BUFFER[f.t] / M_PER_DEG;
      if (q[0] < f.box[0][0] - pad || q[0] > f.box[1][0] + pad || q[1] < f.box[0][1] - pad / k || q[1] > f.box[1][1] + pad / k) return false;
      return f.p.some(r => r.some((a, i) => segDist(q, r[i ? i - 1 : r.length - 1], a) < BUFFER[f.t]));
    };
    const playLie = (q, lie = lieHere(q)) => {
      for (const t of ['ob', 'water', 'bunker']) if (lie === t || hz.some(f => f.t === t && near(q, f))) return t;
      return lie;
    };
    const AVOID = ['ob', 'water', 'bunker', 'recovery']; // never aimed at while another line is open
    const FAIRWAY_SLACK = 0.05; // the SG given up for more shots on the fairway
    // The best of some options: the highest score, or one within FAIRWAY_SLACK of it with fewer shots in
    // trouble (hazards, bunkers, trees, buffers included) or, level on those, more shots on the fairway.
    const choose = list => {
      const pool = list.some(l => !l.bad) ? list.filter(l => !l.bad) : list;
      const top = Math.max(...pool.map(l => l.score));
      return pool.filter(l => l.score >= top - FAIRWAY_SLACK).reduce((a, b) => (b.tr < a.tr || (b.tr === a.tr && (b.fw > a.fw || (b.fw === a.fw && b.score > a.score))) ? b : a));
    };
    const results = [];
    for (const c of only ? only.map(name => ({ name })) : bag()) {
      const yd = compYards(c.name);
      if (!yd || /putt/i.test(c.name) || (!only && yd > toPinYd + 15)) continue;
      const w = clubArcW(c.name), dm = yd / YD_PER_M, lines = [];
      for (let off = -35; off <= 35; off++) {
        const brg = ((main + off) * Math.PI) / 180;
        const aim = [from[0] + (dm * Math.cos(brg)) / M_PER_DEG, from[1] + (dm * Math.sin(brg)) / (M_PER_DEG * k)];
        const d = dispersion(from, aim, w, fromExp, lieHere);
        let score = 0, fw = 0, tr = 0;
        for (const x of d.dots) {
          const lie = playLie(x.q, x.lie);
          score += sgFinish(fromExp, lie, yards(x.q, pin));
          if (lie === 'fairway' || lie === 'green') fw++; else if (AVOID.includes(lie)) tr++;
        }
        lines.push({ club: c.name, yd, aim, off, brg: main + off, sg: d.sg, score: score / d.dots.length, fw, tr, bad: AVOID.includes(playLie(aim)) });
      }
      results.push(choose(lines));
    }
    // Each club is on its best line; the club with the highest SG there is the pick.
    return { from, results: results.sort((a, b) => b.sg - a.sg) };
  }
  // Auto stays on from hole to hole (for this visit): each new hole opens with
  // its pick made, or with Comp on, each compared club on its own best line.
  const autoWanted = () => { try { return sessionStorage.getItem('gs:autoOn') === '1'; } catch { return false; } };
  const setAutoWanted = v => { try { if (v) sessionStorage.setItem('gs:autoOn', '1'); else sessionStorage.removeItem('gs:autoOn'); } catch { /* not kept */ } };
  // Picks the best club and line (or, with Comp on, each compared club's line). False if there's none.
  function runAuto() {
    if (showComp) {
      // Comparing: each compared club gets its own best line (the crosshair stays put).
      const { from, results } = findBest(compClubs);
      if (!results.length) return false;
      compAim = {}; compAimFrom = from.join(',');
      for (const r of results) compAim[r.club] = r.brg;
      autoPick = { comp: true, from: from.join(',') };
      autoBtn.classList.add('on');
      autoKey.hidden = true; // the Compare key lists each club's SG
      update();
      return true;
    }
    const { from, results } = findBest();
    if (!results.length) return false;
    const b = results[0];
    autoPick = { ...b, from: from.join(',') };
    autoBtn.classList.add('on');
    pickedClub = b.club;
    if (!showDisp) { setDispOn(true); onlyOne('disp'); }
    autoKey.replaceChildren(h('small', {}, 'Auto · best clubs (avg SG)'), ...results.slice(0, 4).map((r, i) => h('span', { class: i ? '' : 'best' },
      `${clubShort(r.club)} ${r.yd}y · ${Math.abs(r.off) < 1 ? 'at pin' : `${Math.round(Math.abs(r.off))}° ${r.off < 0 ? 'L' : 'R'}`} · `,
      h('b', { class: r.sg >= 0 ? 'pos' : 'neg' }, `${r.sg >= 0 ? '+' : '−'}${Math.abs(r.sg).toFixed(2)}`))));
    autoKey.hidden = false;
    m.easeTo({ center: ll(b.aim), duration: 500 });
    update();
    return true;
  }
  const autoBtn = h('button', { class: 'fab autotarget', 'aria-label': 'Auto target', title: 'Pick the best club and aiming point (stays on from hole to hole)', onclick: () => {
    if (autoPick) {
      if (autoPick.comp) compAim = {}; // the compared clubs go back on the one line
      else { pickedClub = null; if (showDisp) setDispOn(false); }
      autoPick = null; autoBtn.classList.remove('on'); autoKey.hidden = true; setAutoWanted(false); update(); return;
    }
    if (runAuto()) setAutoWanted(true);
  } }, h('span', {}, '✦'), h('small', {}, 'Auto'));
  // Clean view, for screenshots: just the map, the hole pill and the View and
  // menu buttons. View drops to just above the menu, but not while its box is
  // open: the box stays put under the finger until it's closed (placeView).
  const placeView = () => { if (viewBox.hidden) holeEl()?.classList.toggle('viewlow', cleanView); };
  const closeView = () => { viewBox.hidden = true; placeView(); };
  const setClean = v => {
    cleanView = v; placeView();
    for (const id of ['shots', 'shots-shadow', 'shotspen', 'shotspen-shadow']) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', v ? 'none' : 'visible');
    holeEl()?.classList.toggle('clean', v);
    viewBtn.classList.toggle('on', v);
    update();
  };
  // View: opens a box (like the menu) with switches for SG map view, course
  // lines view and clean view.
  const viewSwitch = (label, get, set, note) => {
    const input = h('input', { type: 'checkbox', onchange: e => set(e.target.checked) });
    const noteEl = note ? h('small', { class: 'muted' }, note) : null;
    const row = h('label', { class: 'liveswitch viewswitch' }, h('span', {}, label, noteEl), input, h('i', {}));
    row.sync = (enabled = true) => { input.checked = get(); input.disabled = !enabled; row.classList.toggle('off', !enabled); if (noteEl) noteEl.hidden = enabled; };
    return row;
  };
  const sgtRow = viewSwitch('SG map view', () => showSgt, setSgt, 'From the tee only');
  const linesRow = viewSwitch('Course lines view', () => showOutlines, setOutlines);
  const cleanRow = viewSwitch('Clean view', () => cleanView, setClean);
  // Elevation (courses built with tools/elevation.py): contour lines with a
  // row of intervals, and plays-like yardages by the crosshair.
  let styleReady = false; // the map's load event has run (sources can be added)
  const elevId = partOf(course, n); // two nines played as 18: the elevation of the nine this hole is on
  const redrawElev = () => { if (styleReady && !tourney) drawElevation(m, elevId, { line: route(), own: holeFeatures(ch) }); };
  let elevInfo = null; // this course's entry in data/elev/index.json, once fetched
  const elevChips = (opts, get, set) => {
    const row = h('div', { class: 'viewchips' });
    row.sync = () => row.replaceChildren(...opts.map(([label, v]) => h('button', { class: get() === v ? 'on' : '',
      onclick: () => { set(v); redrawElev(); row.sync(); } }, label)));
    return row;
  };
  const contourChips = elevChips(CONTOUR_YD.map(y => [`${y} yd`, y]), () => elevPrefs.contourYd, v => { elevPrefs.contourYd = v; });
  // The intervals stay in place whether contours are on or off, so the box doesn't jump.
  const contourRow = viewSwitch('Contours & slope', () => elevPrefs.contours, v => { elevPrefs.contours = v; redrawElev(); drawViewBox(); });
  // Plays like: a switch at the top right, under Expected.
  // Plays like: a button left of Expected. On, it shows two round switches
  // under it: Elv (the height change, on to start) and Wnd (the wind, off to start).
  let playsWindNow = null; // the latest wind ({ speed mph, dir it comes from }), for plays like
  const playsCircle = (label, get, set) => {
    const b = h('button', { class: 'playscircle', title: label === 'Elv' ? 'Count the height change' : 'Count the wind', onclick: () => { set(!get()); sync(); update(); } }, label);
    const sync = () => { b.classList.toggle('on', get()); b.setAttribute('aria-pressed', String(get())); };
    b.sync = sync; sync();
    return b;
  };
  const elvCircle = playsCircle('Elv', () => elevPrefs.playsElev, v => { elevPrefs.playsElev = v; });
  const wndCircle = playsCircle('Wnd', () => elevPrefs.playsWind, v => { elevPrefs.playsWind = v; });
  const playsOpts = h('div', { class: 'playsopts', hidden: !elevPrefs.playsLike }, elvCircle, wndCircle);
  const playsBtn = h('button', { class: 'playsbtn' + (elevPrefs.playsLike ? ' on' : ''), 'aria-pressed': String(elevPrefs.playsLike),
    title: 'Plays-like yardages (height change and wind)', onclick: () => {
      elevPrefs.playsLike = !elevPrefs.playsLike;
      playsBtn.classList.toggle('on', elevPrefs.playsLike); playsBtn.setAttribute('aria-pressed', String(elevPrefs.playsLike));
      playsOpts.hidden = !elevPrefs.playsLike;
      update();
    } }, 'Plays', h('br'), 'like');
  const playsWrap = h('div', { class: 'playswrap', hidden: true }, playsBtn, playsOpts);
  const elevBox = h('div', { class: 'viewelev', hidden: true }, contourRow, contourChips);
  elevIndex().then(ix => { elevInfo = ix[elevId] || null; elevBox.hidden = playsWrap.hidden = tourney || !elevInfo; if (elevInfo && elevPrefs.playsLike && map === m) update(); });
  const viewBox = h('div', { class: 'sheet viewbox', hidden: true }, h('strong', {}, 'View'), tourney ? null : sgtRow, tourney ? null : linesRow, cleanRow, elevBox);
  const drawViewBox = () => {
    sgtRow.sync(stage() !== 'pin' && stage() !== 'putt' && !planShots().length); linesRow.sync(); cleanRow.sync();
    contourRow.sync(); contourChips.sync();
    contourChips.classList.toggle('off', !elevPrefs.contours);
  };
  const viewBtn = h('button', { class: 'fab cleanview', 'aria-label': 'View', title: 'SG map, course lines, clean view and contours',
    onclick: () => { menu.hidden = true; viewBox.hidden = !viewBox.hidden; placeView(); drawViewBox(); } }, h('span', {}, '◉'), h('small', {}, 'View'));
  // A tap anywhere else (the map or another button) closes the View box; the tap still does its own job.
  const viewAway = e => {
    if (!viewBtn.isConnected) { document.removeEventListener('pointerdown', viewAway, true); return; }
    if (!viewBox.hidden && !viewBox.contains(e.target) && !viewBtn.contains(e.target)) closeView();
  };
  document.addEventListener('pointerdown', viewAway, true);
  // Two buttons that open up a column of tools when tapped (each remembered on
  // this device): SG on the left (Auto and Comp), Tools on the right above Club
  // (Width, Arc, Disp and Appr).
  const groupBtn = (cls, key, label, title) => {
    const btn = h('button', { class: `fab ${cls}`, 'aria-label': label, title, onclick: () => {
      btn.open = !btn.open; localStorage.setItem(key, btn.open ? '1' : '0'); update();
    } }, h('span', {}, ''), h('small', {}, ''));
    btn.open = localStorage.getItem(key) === '1';
    btn.label = label;
    return btn;
  };
  const toolsBtn = groupBtn('tools', 'gs:toolsOpen', 'Tools', 'Width, Arc, Disp and Appr');
  if (tourney) toolsBtn.open = false; // never open (or shown) in a tournament
  const sgBtn = groupBtn('sgtools', 'gs:sgOpen', 'SG', 'Auto target and Compare clubs');
  const drawGroup = (btn, members, onCount, icon, openCls) => {
    btn.hidden = members.every(b => b.hidden);
    btn.setAttribute('aria-expanded', String(btn.open));
    btn.classList.toggle('on', !btn.open && onCount > 0);
    btn.firstChild.textContent = btn.open ? '✕' : onCount ? String(onCount) : icon;
    btn.lastChild.textContent = btn.open ? 'Close' : btn.label;
    holeEl()?.classList.toggle(openCls, btn.open);
  };
  const compDots = h('div', { class: 'compdots' });
  // Dragging a dot swings that club onto its own line (its distance stays the
  // club's yardage); the others keep following the crosshair. Tapping a moved
  // dot without dragging puts it back on the main line. Reset for each new shot.
  let compAim = {}, compAimFrom = null, compDrag = null;
  function dragComp(club, e) {
    e.preventDefault(); e.stopPropagation();
    compDrag = { club, x: e.clientX, y: e.clientY, moved: false };
    update(); // highlight it straight away
    const move = ev => {
      if (!compDrag) return;
      if (Math.hypot(ev.clientX - compDrag.x, ev.clientY - compDrag.y) > 4) compDrag.moved = true;
      if (!compDrag.moved) return;
      const r = mapEl.getBoundingClientRect(), q = m.unproject([ev.clientX - r.left, ev.clientY - r.top]);
      const shots = planShots(), from = shots.length ? shots[shots.length - 1].pos : tee;
      compAim[club] = bearing(from, [q.lat, q.lng]);
      update();
    };
    const up = () => {
      if (compDrag && !compDrag.moved && compAim[club] != null) { delete compAim[club]; update(); }
      compDrag = null; update();
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  // Features near a point, with their boxes, for fast lie lookups along the arcs.
  let compFeatKey = null, compFeats = [];
  function compArcs(from, toward, fromExp) {
    const key = from.join(',');
    if (key !== compFeatKey) {
      compFeatKey = key;
      const box = boundsOf([from, pin], 300);
      compFeats = course.features
        .map(f => ({ ...f, box: boundsOf(f.p[0]) }))
        .filter(f => overlaps(f.box, box, 0));
    }
    const lieHere = q => lieOn(q, compFeats.filter(f => q[0] >= f.box[0][0] && q[0] <= f.box[1][0] && q[1] >= f.box[0][1] && q[1] <= f.box[1][1]));
    const fk = from.join(',');
    if (fk !== compAimFrom) { compAimFrom = fk; compAim = {}; } // a new shot: every club back on the main line
    const main = bearing(from, toward), k = Math.cos((from[0] * Math.PI) / 180);
    return compClubs.map((club, i) => {
      const own = compAim[club] != null, brg = ((own ? compAim[club] : main) * Math.PI) / 180;
      const yd = compYards(club);
      if (!yd) return null;
      const dm = yd / YD_PER_M;
      const mid = [from[0] + (dm * Math.cos(brg)) / M_PER_DEG, from[1] + (dm * Math.sin(brg)) / (M_PER_DEG * k)];
      const arc = arcThrough(from, mid);
      if (!arc) return null;
      if (compMode === 'disp') { // 20 shots in the club's dispersion, scored from where each lands
        const d = dispersion(from, mid, clubArcW(club), fromExp, lieHere);
        return { club, yd, mid, own, toPin: yards(mid, pin), color: COMP_COLORS[i], sg: d.sg, pts: [], dots: d.dots };
      }
      const half = clubArcW(club) / 2 / YD_PER_M, N = 24;
      let tot = 0;
      for (let j = 0; j <= N; j++) {
        const q = arc(-half + (2 * half * j) / N), lie = lieHere(q);
        tot += sgFinish(fromExp, lie, yards(q, pin));
      }
      return { club, yd, mid, own, toPin: yards(mid, pin), color: COMP_COLORS[i], sg: tot / (N + 1), pts: arcPoints(arc, -half, half) };
    }).filter(Boolean);
  }
  // Slide the crosshair out to `yd` from the ball, along the line being aimed
  // (towards the pin if the crosshair is on the ball).
  function snapTo(yd) {
    const shots = planShots(), from = shots.length ? shots[shots.length - 1].pos : tee;
    const brg = (bearing(from, yards(from, target) > 5 ? target : pin) * Math.PI) / 180, k = Math.cos((from[0] * Math.PI) / 180), dm = yd / YD_PER_M;
    m.easeTo({ center: ll([from[0] + (dm * Math.cos(brg)) / M_PER_DEG, from[1] + (dm * Math.sin(brg)) / (M_PER_DEG * k)]), duration: 450 });
  }
  const clubPicker = h('div', { class: 'clubsheet', hidden: true, onclick: e => { if (e.target === clubPicker) clubPicker.hidden = true; } });
  // GPS Overview: whose bag the clubs come from, at the top of the Club box.
  // Tap it to search your students (a coach) and load one's bag; My bag goes back.
  let coachStudents = null, studentLast = {}; // loaded once per hole screen; the list puts the most recently active first
  const agoTxt = ms => { const m = Math.round((Date.now() - ms) / 60000); return m < 60 ? `${Math.max(1, m)}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
  function openBagSearch() {
    const input = h('input', { type: 'search', placeholder: '🔍 Search students', autocomplete: 'off', class: 'bagsearch', oninput: () => drawList() });
    const list = h('div', { class: 'baglist' });
    const choose = async (who) => {
      if (!who) { bagFor = null; sessionStorage.removeItem('gs:scoutBag'); }
      else {
        list.replaceChildren(h('small', { class: 'muted' }, `Loading ${who.student_name}’s bag…`));
        let clubs;
        try { clubs = await fetchBagOf(who.student_id); } catch { list.replaceChildren(h('small', { class: 'muted' }, 'Couldn’t load that bag. Check your connection.')); return; }
        if (!clubs.length) { toast(`${who.student_name} has no clubs in My Bag yet.`); drawList(); return; }
        bagFor = { id: who.student_id, name: who.student_name || 'Student', clubs };
        try { sessionStorage.setItem('gs:scoutBag', JSON.stringify(bagFor)); } catch { /* this hole only */ }
      }
      pickedClub = null; autoPick = null; update(); openClubPicker();
    };
    const row = (label, sub, on, fn) => h('button', { class: 'bagrow' + (on ? ' on' : ''), onclick: fn }, h('b', {}, label), sub ? h('small', {}, sub) : null);
    function drawList() {
      const q = input.value.trim().toLowerCase();
      const studs = (coachStudents || []).filter(x => !q || (x.student_name || '').toLowerCase().includes(q))
        .sort((a, b) => (studentLast[b.student_id] || 0) - (studentLast[a.student_id] || 0) || (a.student_name || '').localeCompare(b.student_name || ''));
      list.replaceChildren(...[
        !q ? row(sync.name || 'My bag', 'My bag', !bagFor, () => choose(null)) : null,
        ...studs.map(x => row(x.student_name || 'Student', studentLast[x.student_id] ? agoTxt(studentLast[x.student_id]) : null, bagFor?.id === x.student_id, () => choose(x))),
        coachStudents === null ? h('small', { class: 'muted' }, 'Loading students…')
          : !coachStudents.length ? h('small', { class: 'muted' }, 'No students yet. A coach’s students show here.')
          : q && !studs.length ? h('small', { class: 'muted' }, 'No students match') : null].filter(Boolean));
    }
    // Searching: the box sits near the top with a fixed-height list, so it doesn't
    // jump about as the keyboard opens and the list narrows.
    clubPicker.classList.add('bagmode');
    clubPicker.replaceChildren(h('div', { class: 'clubbox' },
      h('div', { class: 'clubhead' }, h('button', { class: 'x', 'aria-label': 'Back', onclick: () => openClubPicker() }, '‹'), h('strong', { style: 'margin-left:8px;' }, 'Whose bag?'), h('button', { class: 'x', onclick: () => { clubPicker.hidden = true; } }, '✕')),
      input, list));
    drawList();
    if (coachStudents === null) {
      fetchCoachStudents().then(r => { coachStudents = r; }, () => { coachStudents = []; }).then(() => {
        drawList();
        if (coachStudents.length) fetchStudentActivity(coachStudents).then(last => { studentLast = last; if (list.isConnected) drawList(); });
      });
    }
    input.focus({ preventScroll: true });
  }
  function openClubPicker() {
    const cur = currentClub();
    clubPicker.classList.remove('bagmode');
    clubPicker.replaceChildren(h('div', { class: 'clubbox' },
      // Club, a Carry | Total switch for the yardages shown (and used for the arcs), and close.
      h('div', { class: 'clubhead' }, h('strong', {}, 'Club'), ydToggle(() => openClubPicker()), h('button', { class: 'x', style: 'margin-left:10px;', onclick: () => { clubPicker.hidden = true; } }, '✕')),
      scouting && sync.user ? h('button', { class: 'bagwho', onclick: openBagSearch }, h('span', {}, '👤'), h('b', {}, bagFor ? `${bagFor.name}’s bag` : sync.name ? `${sync.name}’s bag` : 'My bag'), h('small', {}, 'Change ›')) : null,
      h('div', { class: 'clubgrid' },
        h('button', { class: pickedClub ? '' : 'on', onclick: () => { pickedClub = null; clubPicker.hidden = true; update(); } }, h('b', {}, tourney ? 'None' : 'Auto'), h('small', {}, tourney ? '–' : autoClub() ? clubName(autoClub()) : '–')),
        bag().map(c => h('button', { class: pickedClub === c.name ? 'on' : '', onclick: () => {
          pickedClub = c.name; clubPicker.hidden = true;
          const y = bagYards(c.name); if (y) snapTo(y); // the crosshair jumps to that club's distance
          update();
        } },
          h('b', {}, clubShort(c.name)), h('small', {}, clubYd(c) ? `${clubYd(c)} yds` : ''))))));
    clubPicker.hidden = false;
    void cur;
  }
  const clubBtn = h('button', { class: 'fab club', 'aria-label': 'Club', title: 'Club for the next shot', onclick: openClubPicker }, h('span', {}, ''), h('small', {}, 'Club'));

  // Recording a shot: + asks which club and swing was used (putts use the putter).
  // `at` is where the shot finished: the crosshair, or the phone's position for a GPS shot.
  function recordShot(club, swing, at = target, gps = false, lost = false) {
    const s = shotsNow();
    const shots = s.length ? [...s] : [{ pos: tee, lie: 'tee' }];
    shots[shots.length - 1] = { ...shots[shots.length - 1], ...(club ? { club } : {}), ...(swing && swing !== 'full' ? { swing } : {}) };
    // A recovery swing (punching out) means the last shot finished in a recovery
    // spot, whatever the map says there: score and describe it that way.
    const here = shots[shots.length - 1];
    if (swing === 'recovery' && here.lie !== 'tee' && here.lie !== 'green') shots[shots.length - 1] = { ...here, lie: 'recovery', mapLie: here.mapLie || here.lie };
    const lie = stage() === 'putt' ? 'green' : lieOn(at, course.features);
    if (lost) { pickedClub = null; return openPenalty(shots, 'penalty', at); }
    if (lie === 'ob' || lie === 'water') { pickedClub = null; return openPenalty(shots, lie, at); }
    const shot = { pos: at, lie, ...(gps ? { gps: true } : {}) };
    if (lie === 'green' && holeNow().pin) shot.ft = Math.max(1, Math.round(yards(at, pin) * FT_PER_YD));
    shots.push(shot);
    const wasPlaying = stage() === 'play';
    pickedClub = null;
    saveShots(shots);
    if (wasPlaying && lie === 'green') zoomToGreen();
  }
  // Penalty: a shot into water or out of bounds, or Penalty / drop on the shot
  // sheet (with the crosshair where the ball finished: lost, unplayable, on a
  // cart path...), asks how the player carried on.
  //  Re-hit from where it was played (stroke and distance): 1 penalty stroke.
  //  Drop: 1 penalty stroke for water, 2 for out of bounds (the local rule); from
  //  Penalty / drop, a drop with 1 or 2, or free relief (no penalty). Then the
  //  crosshair is moved to where the ball was dropped (a dotted line follows it
  //  from where the ball finished) and Set drop records it.
  // The penalty is charged to the shot that went in; the next shot carries
  // `penalty` so Undo can take it back off.
  let dropping = null; // { shots, n } while placing a drop
  const penaltySheet = h('div', { class: 'clubsheet', hidden: true, onclick: e => { if (e.target === penaltySheet) penaltySheet.hidden = true; } });
  const setDropBtn = h('button', { class: 'setnext drop', hidden: true, onclick: () => {
    if (!dropping) return;
    const { shots, n } = dropping;
    dropping = null; setDropBtn.hidden = true; holeEl()?.classList.remove('dropping');
    saveShots([...shots, { pos: target, lie: lieOn(target, course.features), drop: true, penalty: n }]);
  } }, 'Set drop');
  function openPenalty(shots, kind, at) {
    const prev = shots[shots.length - 1], water = kind === 'water';
    const charge = (n, k = kind) => [...shots.slice(0, -1), { ...prev, ...(prev.pen || n ? { pen: (prev.pen || 0) + n } : {}), obAt: at, penKind: k }];
    const startDrop = (n, k) => {
      dropping = { shots: charge(n, k), n };
      setDropBtn.textContent = n ? `Set drop (+${n})` : 'Set drop (free)'; setDropBtn.hidden = false; holeEl()?.classList.add('dropping');
      update();
    };
    const opt = (label, sub, fn) => h('button', { class: 'penopt', onclick: () => { penaltySheet.hidden = true; fn(); } }, h('b', {}, label), h('small', {}, sub));
    penaltySheet.replaceChildren(h('div', { class: 'clubbox' },
      h('div', { class: 'clubhead' }, h('strong', {}, water ? 'In the water' : kind === 'penalty' ? 'Penalty / drop' : 'Out of bounds'), h('button', { class: 'x', onclick: () => { penaltySheet.hidden = true; } }, '✕')),
      h('div', { class: 'penopts' },
        opt(prev.lie === 'tee' ? 'Re-tee' : 'Replay', '+1 stroke · hit again from the same spot', () => saveShots([...charge(1), { pos: prev.pos, lie: prev.lie, replay: true, penalty: 1 }])),
        kind === 'penalty'
          ? [opt('Drop +1', '+1 stroke · lost, unplayable or a penalty area · move the crosshair to the drop, then Set drop', () => startDrop(1, 'penalty')),
            opt('Drop +2', '+2 strokes · out of bounds or lost, by the local rule · move the crosshair to the drop, then Set drop', () => startDrop(2, 'penalty')),
            opt('Free relief', 'No penalty · cart path, ground under repair, a sprinkler head · move the crosshair to the drop, then Set drop', () => startDrop(0, 'relief'))]
          : opt('Drop', `+${kind === 'ob' ? '2 strokes' : '1 stroke'} · move the crosshair to the drop, then Set drop`, () => startDrop(kind === 'ob' ? 2 : 1, kind)))));
    penaltySheet.hidden = false;
  }
  const shotConfirm = h('div', { class: 'clubsheet', hidden: true, onclick: e => { if (e.target === shotConfirm) shotConfirm.hidden = true; } });
  function openShotConfirm(at = target, gps = false) {
    const shots = shotsNow(), from = shots.length ? shots[shots.length - 1].pos : tee;
    let club = currentClub(), swing = 'full';
    const draw = () => shotConfirm.replaceChildren(h('div', { class: 'clubbox' },
      h('div', { class: 'clubhead' }, h('strong', {}, `${gps ? '📍 ' : ''}Shot ${shots.length ? strokeNo(shots, shots.length - 1) : 1} · ${Math.round(yards(from, at))} yds`), h('button', { class: 'x', onclick: () => { shotConfirm.hidden = true; } }, '✕')),
      gps ? h('small', { class: 'muted' }, `Finishing where you are standing (${LIE_TAG[lieOn(at, course.features)] || ''}, GPS ±${Math.round(gpsFix.acc * YD_PER_M)} yd)`) : null,
      h('small', { class: 'muted' }, club ? `Club: ${clubName(club)}` : 'Which club did you hit?'),
      h('div', { class: 'clubgrid' }, bag().map(c => h('button', { class: club === c.name ? 'on' : '', onclick: () => { club = c.name; draw(); } },
        h('b', {}, clubShort(c.name)), h('small', {}, clubYd(c) ? `${clubYd(c)}` : '')))),
      h('div', { class: 'swings' }, SWINGS.map(([k, label]) => h('button', { class: swing === k ? 'on' : '', onclick: () => { swing = k; draw(); } }, label))),
      h('div', { class: 'recordrow' },
        h('button', { class: 'lostball', title: 'The ball finished where the crosshair is and was re-teed, dropped (with a penalty) or given free relief', onclick: () => { shotConfirm.hidden = true; recordShot(club, swing, at, gps, true); } }, 'Penalty / drop'),
        h('button', { class: 'record', onclick: () => { shotConfirm.hidden = true; recordShot(club, swing, at, gps); } }, 'Record shot'))));
    draw();
    shotConfirm.hidden = false;
  }
  const addBtn = h('button', { class: 'fab add', 'aria-label': 'Record shot here', title: 'Record shot at the crosshair',
    onclick: () => { if (stage() === 'putt') recordShot('Putter'); else openShotConfirm(); } }, '+');
  // ---- GPS ----
  // The GPS button shows where the phone is (a blue dot) and how far that is
  // from the pin. "Shot here" records a shot finishing at that spot, as + does
  // for the crosshair. Putts are still entered with the crosshair: GPS is only
  // good to a few yards.
  let gpsOn = !watching && localStorage.getItem('gs:gps') === '1', gpsMark = null;
  const gpsBtn = h('button', { class: 'fab gps' + (gpsOn ? ' on' : ''), 'aria-pressed': String(gpsOn), 'aria-label': 'GPS', title: 'Show where you are and the distance to the pin',
    onclick: () => setGps(!gpsOn) }, h('span', {}, '⌖'), h('small', {}, 'GPS'));
  const gpsDist = h('button', { class: 'gpsdist', title: 'Centre the map on where you are', onclick: () => {
    if (gpsFresh() && yards(gpsFix.pos, pin) < 1500) m.easeTo({ center: ll(gpsFix.pos) });
  } });
  const gpsShotBtn = h('button', { class: 'fab gpsshot', hidden: true, 'aria-label': 'Record a shot where you are standing', title: 'Record a shot where you are standing', onclick: () => {
    if (!gpsFresh()) return toast('Waiting for GPS…');
    const far = yards(gpsFix.pos, pin);
    if (far > 1200) return toast(`GPS puts you ${(far / 1760).toFixed(1)} miles from this hole, so no shot was recorded.`);
    if (gpsFix.acc * YD_PER_M > 25) toast(`GPS is only good to ±${Math.round(gpsFix.acc * YD_PER_M)} yd right now.`);
    openShotConfirm([...gpsFix.pos], true);
  } }, h('span', {}, '📍'), h('small', {}, 'Shot'));
  // Under Expected: the GPS button at the right edge, Undo and the Shot pin to its left, and the distance in the top middle.
  const gpsFresh = () => !!gpsFix && Date.now() - gpsFix.at < 30000;
  function drawGps() {
    const show = gpsOn && !viewing();
    gpsBtn.hidden = viewing();
    gpsDist.hidden = !show;
    if (!show) gpsShotBtn.hidden = true;
    if (!show) { gpsMark?.remove(); gpsMark = null; return; }
    if (!gpsFresh()) {
      gpsMark?.remove(); gpsMark = null;
      gpsDist.replaceChildren(h('small', {}, 'Finding GPS…'));
      gpsShotBtn.hidden = true;
      return;
    }
    if (!gpsMark) gpsMark = new maplibregl.Marker({ element: h('div', { class: 'gpsdot', title: 'You are here' }) }).setLngLat(ll(gpsFix.pos)).addTo(m);
    else gpsMark.setLngLat(ll(gpsFix.pos));
    const d = yards(gpsFix.pos, pin), st = stage();
    gpsDist.replaceChildren(h('b', {}, d > 1500 ? `${(d / 1760).toFixed(d > 17600 ? 0 : 1)} mi` : `${Math.round(d)} yd`), h('small', {}, `to pin · ±${Math.round(gpsFix.acc * YD_PER_M)}`));
    // A GPS shot can be recorded whenever + can, except putts.
    gpsShotBtn.hidden = st !== 'play' || !!dropping || !!moving;
  }
  function startGps() {
    stopGps();
    if (!gpsOn || viewing()) return;
    if (!navigator.geolocation) { toast('This browser has no GPS.'); gpsOn = false; gpsBtn.classList.remove('on'); return; }
    gpsWatch = navigator.geolocation.watchPosition(p => {
      gpsFix = { pos: [p.coords.latitude, p.coords.longitude], acc: p.coords.accuracy || 0, at: Date.now() };
      if (map === m) drawGps();
    }, err => {
      if (map !== m) return;
      if (err.code === 1) { toast('Location is blocked for this site. Allow it in your browser settings, then tap GPS again.'); setGps(false); }
      else drawGps(); // no fix yet: keeps trying
    }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  }
  function setGps(v) {
    gpsOn = v; localStorage.setItem('gs:gps', v ? '1' : '0');
    gpsBtn.classList.toggle('on', v); gpsBtn.setAttribute('aria-pressed', String(v));
    if (v) startGps(); else stopGps();
    drawGps();
  }

  const holedBtn = h('button', { class: 'holed', onclick: () => saveHole({ done: true }) }, 'Holed');
  const setPinBtn = h('button', { class: 'setpin', hidden: true, onclick: () => {
    pin = target;
    const shots = shotsNow().map(x => (x.lie === 'green' ? { ...x, ft: Math.max(1, Math.round(yards(x.pos, pin) * FT_PER_YD)) } : x));
    saveHole({ pin, shots });
    zoomToGreen();
  } }, 'Set pin');
  const pillSmall = h('small', {}), pillStrong = h('strong', {});
  const bannerText = h('div', {});
  const banner = h('div', { class: 'greenbar', hidden: true }, bannerText);

  const expValue = h('strong', {});
  // Tapping the expected strokes opens the scorecard filled in with what the
  // chosen handicap level is expected to shoot on each hole (opened below).
  const expPill = h('div', { class: 'exppill', hidden: tourney },
    h('div', { class: 'expopen', role: 'button', title: 'Expected scores and handicap level', onclick: openExpected }, h('small', {}, 'Expected'), expValue));

  const credit = h('small', { class: 'muted credit' }, 'Imagery © Esri, Maxar · Outlines © OpenStreetMap contributors');
  // The course being played or viewed, at the top of the menu, by the tees.
  const courseLabel = () => h('div', { class: 'menucourse' }, h('small', {}, 'Course'), h('strong', {}, round0?.courseName || course.name));
  // Viewing a past round: just Back to Round History and Home.
  // Settings (in the menu): how the contour lines look — colour, opacity and
  // width — kept on this device. Changes show on the map straight away.
  const setSheet = h('div', { class: 'clubsheet setsheet', hidden: true, onclick: e => { if (e.target === setSheet) setSheet.hidden = true; } });
  function openSettings() {
    const apply = () => styleElevation(m);
    const slider = (label, key, min, max, step, show) => h('label', { class: 'setrow' }, h('span', {}, label), h('input', { type: 'range', min, max, step, value: elevPrefs[key], oninput: e => { elevPrefs[key] = +e.target.value; e.target.nextSibling.textContent = show(elevPrefs[key]); apply(); } }), h('b', {}, show(elevPrefs[key])));
    const draw = () => setSheet.replaceChildren(h('div', { class: 'clubbox setbox' },
      h('div', { class: 'clubhead' }, h('strong', {}, 'Settings · contour lines'), h('button', { class: 'x', onclick: () => { setSheet.hidden = true; } }, '✕')),
      h('label', { class: 'setrow' }, h('span', {}, 'Colour'), h('input', { type: 'color', value: elevPrefs.contourColor, oninput: e => { elevPrefs.contourColor = e.target.value; e.target.nextSibling.textContent = elevPrefs.contourColor; apply(); } }), h('b', {}, elevPrefs.contourColor)),
      slider('Opacity', 'contourOpacity', 0.05, 1, 0.05, v => `${Math.round(v * 100)}%`),
      slider('Width', 'contourWidth', 0.5, 4, 0.1, v => `${v.toFixed(1)}×`),
      h('small', { class: 'muted' }, elevPrefs.contours ? 'Kept on this device.' : 'Kept on this device. Turn on Contours & slope in View to see the lines.'),
      h('div', { class: 'compactions' }, h('button', { class: 'lostball', onclick: () => { resetContourLook(); apply(); draw(); } }, 'Reset to default'))));
    draw();
    setSheet.hidden = false;
  }
  const menu = scouting
    ? h('div', { class: 'sheet', hidden: true },
      courseLabel(),
      h('label', {}, 'Tees ', h('select', { onchange: e => { const r = currentRound(); if (r) r.tee = e.target.value; store.set('settings', { ...(store.get('settings') || {}), tee: e.target.value }); renderHole(view, n); } },
        course.tees.map(t => h('option', { value: t.name, selected: t.name === teeName }, `${t.name} · ${t.yards.reduce((a, b) => a + b, 0)} yd`)))),
      isAdmin && !course.parts ? h('button', { class: 'btn', onclick: () => { menu.hidden = true; editBoundaries(); } }, '✏️ Edit boundaries') : null, // two nines as 18: edit each nine on its own
      h('button', { class: 'btn', onclick: () => { endScouting(); location.hash = '#/'; } }, 'Home'),
      h('small', { class: 'muted' }, 'GPS Overview · shots are not saved'),
      credit)
    : watching
    ? h('div', { class: 'sheet', hidden: true },
      courseLabel(),
      isWatching() && !watchInfo()?.id.startsWith('sv-') ? h('button', { class: 'btn', onclick: () => { menu.hidden = true; refreshLive(true); } }, '↻ Refresh') : null,
      h('button', { class: 'btn', onclick: () => { menu.hidden = true; openScorecard(); } }, 'Scorecard'),
      h('a', { class: 'btn', href: sessionStorage.getItem('gs:watchBack') || '#/' }, sessionStorage.getItem('gs:watchBack') ? 'Back to Coaching' : 'Leave live view'),
      h('small', { class: 'muted' }, 'Tap a numbered shot to see its distance, club and strokes gained.'),
      credit)
    : viewing()
    ? h('div', { class: 'sheet', hidden: true },
      courseLabel(),
      h('button', { class: 'btn', onclick: () => { leaveView(); location.hash = '#/history'; } }, 'Back to Round History'),
      h('button', { class: 'btn', onclick: () => { leaveView(); location.hash = '#/'; } }, 'Home'),
      credit)
    : h('div', { class: 'sheet', hidden: true },
      courseLabel(),
      h('label', {}, 'Tees ', h('select', { onchange: e => { store.set('settings', { ...(store.get('settings') || {}), tee: e.target.value }); const r = currentRound(); if (r) store.set(roundKeyOf(r.id), { ...r, tee: e.target.value, updated: Date.now() }); renderHole(view, n); } },
        course.tees.map(t => h('option', { value: t.name, selected: t.name === teeName }, `${t.name} · ${t.yards.reduce((a, b) => a + b, 0)} yd`)))),
      h('button', { class: 'btn', onclick: () => { menu.hidden = true; if (currentRound()) leave.hidden = false; else location.hash = '#/'; } }, 'Home'),
      currentRound() ? h('a', { class: 'btn', href: `#/round/${currentRound().id}/edit` }, 'Round info') : null,
      isAdmin ? h('a', { class: 'btn', href: '#/course' }, 'Edit course outlines') : null,
      h('a', { class: 'btn', href: '#/settings' }, 'Settings'),
      credit);
  menu.insertBefore(h('button', { class: 'btn', onclick: () => { menu.hidden = true; openSettings(); } }, '⚙ Settings'), credit);

  // Strokes Gained panel while viewing a past round (filled in by drawSgView).
  const sgView = h('div', { class: 'sgview', hidden: true });
  const sgViewBtn = h('button', { class: 'fab sgviewbtn', hidden: true, 'aria-label': 'Strokes gained', title: 'Strokes gained',
    onclick: () => { sgView.hidden = !sgView.hidden; sgViewBtn.classList.toggle('on', !sgView.hidden); drawSgView(); } }, h('span', {}, 'Strokes'), h('span', {}, 'Gained'));
  // Score box and scorecard (filled in by drawScoreChips / openScorecard below):
  // one long box, as wide as the hole pill under it, with this hole's score and
  // where the round stands ("+2 thru 5"). Tap it for the scorecard and total.
  const holeChip = h('button', { class: 'scorechip hole', 'aria-label': 'Score: tap for the scorecard', onclick: () => openScorecard() });
  const chips = h('div', { class: 'chips', hidden: true }, holeChip);
  const scorecard = h('div', { class: 'scorecard', hidden: true, onclick: e => { if (e.target === scorecard) scorecard.hidden = true; } });
  const compass = h('button', { class: 'compass', 'aria-label': 'Compass: tap to straighten the view', title: 'Tap to straighten the view' });
  compass.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><polygon points="16,3 20,16 12,16" fill="#ff4d4d"/><polygon points="16,29 20,16 12,16" fill="#fff"/><text x="16" y="11.5" text-anchor="middle" font-size="6.5" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">N</text></svg>';
  // Wind, under the compass: an arrow showing which way the wind is blowing on
  // this view of the map (it turns with the map), and the speed in mph.
  const wind = h('button', { class: 'wind', hidden: true, 'aria-label': 'Wind' });
  wind.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><polygon points="16,1.5 21,8.5 11,8.5" fill="#4dd0ff"/><rect x="14.6" y="24" width="2.8" height="6" rx="1.4" fill="#4dd0ff"/></svg><b></b>';

  // Leaving a round from the menu's Home button.
  const leaveTo = (hash, fn) => () => { const r = currentRound(); if (r) fn(r); setCurrentRound(null); localStorage.removeItem('gs:viewOnly'); localStorage.removeItem('gs:editingPast'); location.hash = hash; };
  const leave = h('div', { class: 'leave', hidden: true, onclick: e => { if (e.target === leave) leave.hidden = true; } },
    h('div', { class: 'leavebox' },
      h('strong', {}, 'Leave this round?'),
      h('button', { class: 'pause', onclick: leaveTo('#/', r => pauseRound(r.id)) }, 'Pause and save round'),
      h('button', { class: 'submit', onclick: leaveTo('#/history', r => submitRound(r.id, course)) }, 'End and submit round'),
      h('button', { class: 'delete', onclick: () => {
        if (!confirm('Delete this round? This cannot be undone.')) return;
        leaveTo('#/', r => store.remove(roundKeyOf(r.id)))();
      } }, 'Home and delete round'),
      // Editing a past round: put every hole back as it was when Edit was tapped.
      localStorage.getItem('gs:editingPast') === '1' && localStorage.getItem('gs:editSnap')
        ? h('button', { class: 'nosave', onclick: leaveTo('#/', r => {
          try { store.set(roundKeyOf(r.id), { ...r, holes: JSON.parse(localStorage.getItem('gs:editSnap')), updated: Date.now() }); } catch { /* keep as is */ }
          localStorage.removeItem('gs:editSnap');
        }) }, 'Leave without saving')
        : null,
      h('button', { class: 'cancel', onclick: () => { leave.hidden = true; } }, 'Cancel')));

  let holePill;
  // ---- Live view ----
  // Watching: a badge saying whose round it is and whether it's live, and a
  // Refresh button. The round also refreshes by itself while it's live.
  const wi = watching ? watchInfo() : null;
  const liveTag = wi ? h('div', { class: 'livetag' + (wi.live ? ' on' : '') },
    h('b', {}, wi.live ? '● LIVE' : wi.round.submitted ? 'FINAL' : 'NOT LIVE'), wi.name ? ` ${wi.name}` : '',
    // then the date and course: "FINAL Sam · 11/12/2026 · Bear Creek"
    ...[wi.round.date ? (([y, mo, d]) => `${+mo}/${+d}/${y}`)(wi.round.date.split('-')) : '', wi.round.courseName || course.name].filter(Boolean).map(t => h('span', {}, ` · ${t}`))) : null;
  let refreshing = false;
  async function refreshLive(manual) {
    if (!wi || refreshing) return;
    refreshing = true; refreshBtn.classList.add('busy');
    const res = await loadWatch(wi.id);
    refreshing = false;
    if (map !== m) return; // left this hole meanwhile
    refreshBtn.classList.remove('busy');
    if (res !== 'ok') { if (manual) toast(res === 'missing' ? 'This round is no longer shared.' : 'Couldn’t refresh. Check your connection.'); return; }
    const now = watchInfo();
    if (now.sent === wi.sent && now.live === wi.live) { if (manual) toast(now.live ? 'Up to date' : 'Up to date · not live right now'); return; }
    // New shots: follow the player to the next hole if we were on the one being played.
    const was = wi.at || n, to = watchHole();
    if (now.live && was === n && to !== n) location.hash = `#/hole/${to}`;
    else rerenderHere();
    if (manual) toast('Updated');
  }
  const refreshBtn = h('button', { class: 'fab liverefresh', hidden: !watching || wi.id.startsWith('sv-'), 'aria-label': 'Refresh', title: 'Refresh', onclick: () => refreshLive(true) }, '↻');
  // Watching: a thin strip across the top with the latest shot on this hole,
  // e.g. "Shot 1 · Driver 290 yds to fwy · 148 yds to hole". Tap it to see that shot.
  const lastShotBar = watching ? h('button', { class: 'lastshot', hidden: true, 'aria-label': 'Latest shot' }) : null;
  function drawLastShot() {
    if (!lastShotBar) return;
    const hl = holeNow(), shots = hl.shots || [];
    const i = hl.done ? shots.length - 1 : shots.length - 2;
    const lines = i >= 0 ? shotLines(hl, i) : null;
    lastShotBar.hidden = !lines || !wi?.live; // a finished or past round doesn't need it
    if (!lines) return;
    let putt = 0; for (let k = 0; k <= i; k++) if (shots[k].lie === 'green') putt++;
    const label = shots[i].lie === 'green' ? `Putt ${putt}` : `Shot ${strokeNo(shots, i)}`;
    const at = shots[i].obAt || shots[i + 1]?.pos || hl.pin || pin;
    lastShotBar.onclick = () => showShotInfo(i, at);
    lastShotBar.replaceChildren(h('b', {}, label), h('span', {}, `\u00a0· ${lines[0]} · ${lines[1]}`));
  }
  if (wi?.live) watchTimer = setInterval(() => { if (!document.hidden && scorecard.hidden && sgView.hidden && !shotPopup?.isOpen()) refreshLive(false); }, 20000);

  // Scoring: the Live button opens a box with the on/off switch and the link to share.
  const liveBtn = h('button', { class: 'fab livebtn', hidden: true, 'aria-label': 'Live view', onclick: () => openLiveBox() }, h('i', {}), 'Live');
  const liveBox = h('div', { class: 'leave livebox', hidden: true, onclick: e => { if (e.target === liveBox) liveBox.hidden = true; } });
  function drawLiveBtn() {
    const r = scouting || watching || viewing() ? null : currentRound();
    liveBtn.hidden = !r;
    liveBtn.classList.toggle('on', isLiveOn(r));
  }
  function openLiveBox() {
    const r = currentRound();
    if (!r) return;
    const on = isLiveOn(r);
    const link = sync.user ? liveLink(r.id) : '';
    const linkEl = h('input', { class: 'livelink', readonly: true, value: link, 'aria-label': 'Share link', onclick: e => e.target.select() });
    const copied = h('small', { class: 'livenote' });
    const copy = async () => {
      try { await navigator.clipboard.writeText(link); } catch { linkEl.select(); try { document.execCommand('copy'); } catch { /* select it for a manual copy */ } }
      copied.textContent = 'Link copied. Paste it in a message to share.';
    };
    const share = navigator.share ? () => navigator.share({ title: 'Watch my round', text: `Follow ${r.player || 'my'} round live`, url: link }).catch(() => {}) : null;
    const st = liveStatus.state;
    const statusText = st === 'error' ? `Couldn’t update the live view yet (${liveStatus.error}). It will keep trying.`
      : st === 'sending' ? 'Updating…' : st === 'ok' && on ? 'Live view is up to date.' : '';
    liveBox.replaceChildren(h('div', { class: 'leavebox' },
      h('strong', {}, 'Live view'),
      !sync.user
        ? [h('p', {}, 'Log in to share this round live. Your shots are still saved on this phone.'), h('a', { class: 'btn', href: '#/account' }, 'Log in')]
        : [
          h('label', { class: 'liveswitch' }, h('span', {}, 'Live'), h('input', { type: 'checkbox', checked: on, onchange: e => { setLiveOn(r.id, e.target.checked); drawLiveBtn(); openLiveBox(); } }), h('i', {})),
          h('p', {}, on ? 'People with the link can watch this round. Every shot you record or edit shows up for them.'
            : 'Paused: people with the link see the round as it was when you turned this off. The finished round is still posted when you end it.'),
          h('small', { class: 'livehead' }, 'Share link (view only, works after the round too)'),
          linkEl,
          h('div', { class: 'liverow' }, h('button', { class: 'pause', onclick: copy }, 'Copy link'), share ? h('button', { class: 'pause', onclick: share }, 'Share…') : null),
          copied,
          statusText ? h('small', { class: 'livenote' + (st === 'error' ? ' err' : '') }, statusText) : null,
        ],
      h('button', { class: 'cancel', onclick: () => { liveBox.hidden = true; } }, 'Close')));
    liveBox.hidden = false;
  }
  liveUnsub = onLiveStatus(() => { if (!liveBox.hidden) openLiveBox(); });
  if (!scouting && !watching && !viewing()) shareCurrent();

  view.replaceChildren(h('div', { class: 'holeview' + (watching ? ' watching' : '') + (wi && !wi.id.startsWith('sv-') ? ' watchlive' : '') + (toolsBtn.open ? ' toolsopen' : '') + (sgBtn.open ? ' sgopen' : '') }, mapEl,
    watching ? liveTag : h('div', { class: 'vertag' + (scouting ? ' scouting' : '') + (tourney ? ' tourney' : '') }, scouting ? `GPS Overview${tourney ? ' · Tournament' : ''}` : `v${VERSION}`), liveBtn, liveBox, refreshBtn, lastShotBar, compass, wind, chips, sgViewBtn, h('div', { class: 'topright' }, playsWrap, expPill), scorecard,
    h('div', { class: 'crosshair' }), toPinEl, fromTeeEl,
    h('button', { class: 'fab menu', 'aria-label': 'Menu', onclick: () => { closeView(); menu.hidden = !menu.hidden; } }, '☰'),
    addBtn, gpsBtn, h('div', { class: 'gpstop' }, gpsDist), gpsShotBtn, holedBtn, setPinBtn, undoBtn, editBtn, saveBtn, cancelBtn, shotList, sgView, teeBtn, pinBtn, setTeeBtn, setPinHereBtn, setDropBtn, penaltySheet, clubBtn, compBtn, autoBtn, viewBtn, viewBox, toolsBtn, sgBtn, compSetBtn, apprBtn, apprAdjBtn, dispBtn, dispAdjBtn, arcBtn, arcAdjBtn, widthBtn, clubPicker, shotConfirm, compSheet, setSheet, slidersEl, banner, menu, leave, compDots, h('div', { class: 'keys' }, zoneLegend, ringLegend, compLegend, autoKey),
    holePill = h('div', { class: 'holepill' },
      h('a', { href: `#/hole/${prevHole}`, 'aria-label': 'Previous hole' }, '‹'),
      h('div', {}, pillSmall, pillStrong),
      h('a', { href: `#/hole/${nextHole}`, 'aria-label': 'Next hole' }, '›'))));

  // The score box is as wide as the hole pill, whatever the pill says.
  if (window.ResizeObserver) new ResizeObserver(() => { if (holePill.offsetWidth) chips.style.width = `${holePill.offsetWidth}px`; }).observe(holePill);
  const m = map = new maplibregl.Map({
    container: mapEl,
    style: {
      version: 8,
      sources: { sat: { type: 'raster', tiles: [TILE_URL], tileSize: 256, maxzoom: 19, attribution: 'Esri, Maxar · © OpenStreetMap' } },
      layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
    },
    center: ll(pin), zoom: 16, bearing: bearing(tee, pin),
    maxZoom: 21, pitchWithRotate: false, touchPitch: false,
    attributionControl: false,
  });
  // Compass: the needle points north as the map turns; tapping it goes back to
  // the straight-down-the-hole view.
  const needle = compass.querySelector('svg');
  const turnNeedle = () => { needle.style.transform = `rotate(${-m.getBearing()}deg)`; };
  m.on('rotate', turnNeedle); turnNeedle();
  // Wind arrow: points where the wind is going (it comes from w.dir).
  let windNow = null;
  const windArrow = wind.querySelector('svg');
  const turnWind = () => { if (windNow) windArrow.style.transform = `rotate(${windNow.dir + 180 - m.getBearing()}deg)`; };
  m.on('rotate', turnWind);
  // The wind shown and used: the live wind, or one set by hand in the Wind box
  // (tap the wind arrow) to try out different conditions. A hand-set wind is
  // kept for this visit (across holes) until "Use live wind".
  let liveWind = null;
  const manualWind = () => { try { return JSON.parse(sessionStorage.getItem('gs:windManual') || 'null'); } catch { return null; } };
  const showWind = () => {
    if (map !== m) return;
    const man = manualWind(), w = man || liveWind;
    wind.hidden = false;
    wind.classList.toggle('manual', !!man);
    windNow = w; playsWindNow = w;
    if (elevPrefs.playsLike && elevPrefs.playsWind) update();
    if (!w) { wind.querySelector('b').textContent = '–'; wind.title = 'Wind: tap to set'; turnWind(); return; }
    wind.querySelector('b').textContent = Math.round(w.speed);
    const from = compassName(w.dir);
    wind.setAttribute('aria-label', `Wind ${Math.round(w.speed)} mph from the ${from}${man ? ' (set by hand)' : ''}`);
    wind.title = `Wind ${Math.round(w.speed)} mph from the ${from}${man ? ' (set by hand)' : ''}`;
    turnWind();
    if (!windBox.hidden) drawWindBox();
  };
  const compassName = d => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round((((d % 360) + 360) % 360) / 22.5) % 16];
  const setManual = w => { try { if (w) sessionStorage.setItem('gs:windManual', JSON.stringify(w)); else sessionStorage.removeItem('gs:windManual'); } catch { /* not kept */ } showWind(); };
  // The Wind box: a direction and a speed slider, and back to the live wind.
  const windDirIn = h('input', { type: 'range', min: 0, max: 355, step: 5, oninput: e => setManual({ speed: (manualWind() || liveWind || { speed: 10 }).speed, dir: +e.target.value }) });
  const windSpeedIn = h('input', { type: 'range', min: 0, max: 40, step: 1, oninput: e => setManual({ dir: (manualWind() || liveWind || { dir: m.getBearing() }).dir, speed: +e.target.value }) });
  const windDirLabel = h('b'), windSpeedLabel = h('b');
  const liveBtnW = h('button', { class: 'windlive', title: 'Go back to the live wind', onclick: () => setManual(null) }, 'Use live wind');
  const windBox = h('div', { class: 'sheet windbox', hidden: true }, h('strong', {}, 'Wind'),
    h('label', { class: 'windrow' }, h('span', {}, 'From ', windDirLabel), windDirIn),
    h('label', { class: 'windrow' }, h('span', {}, 'Speed ', windSpeedLabel), windSpeedIn),
    liveBtnW);
  function drawWindBox() {
    const man = manualWind(), w = man || liveWind;
    windDirIn.value = w ? Math.round(w.dir / 5) * 5 % 360 : 0;
    windSpeedIn.value = w ? Math.round(w.speed) : 0;
    windDirLabel.textContent = w ? `${compassName(w.dir)} (${Math.round(w.dir)}°)` : '–';
    windSpeedLabel.textContent = w ? `${Math.round(w.speed)} mph` : '–';
    liveBtnW.textContent = liveWind ? `Live: ${Math.round(liveWind.speed)} mph ${compassName(liveWind.dir)}` : 'Use live wind';
    liveBtnW.hidden = !man;
  }
  wind.onclick = () => { windBox.hidden = !windBox.hidden; if (!windBox.hidden) drawWindBox(); };
  const windAway = e => {
    if (!wind.isConnected) { document.removeEventListener('pointerdown', windAway, true); return; }
    if (!windBox.hidden && !windBox.contains(e.target) && !wind.contains(e.target)) windBox.hidden = true;
  };
  document.addEventListener('pointerdown', windAway, true);
  holeEl().append(windBox);
  const gotWind = w => { if (w) liveWind = w; showWind(); };
  const windAt = pin || tee;
  if (tourney) { /* no wind in a tournament: it stays hidden */ } else if (windAt) {
    fetchWind(course.id, windAt).then(gotWind);
    clearInterval(windTimer);
    windTimer = setInterval(() => { if (!document.hidden) fetchWind(course.id, windAt).then(gotWind); }, 600000);
  } else showWind();
  compass.onclick = () => { if (stage() === 'play') place(); else zoomToGreen(); };
  window.holeMap = m; // handy for debugging from the console

  // Opening view. Par 3s show the whole hole with the crosshair on the pin.
  // Par 4s and 5s zoom in on the drive: the crosshair sits the player's average
  // drive from the tee along the hole's route (or, with no average drive set,
  // where a drive down the middle gains 0 strokes), with the tee just above the
  // hole pill. Bottom padding makes the map's centre, and so its rotation and
  // zoom pivot, the crosshair.
  const route = () => [tee, ...ch.line.slice(1, -1), pin];
  function pointAlong(pts, yd) {
    for (let i = 0; i < pts.length - 1; i++) {
      const seg = yards(pts[i], pts[i + 1]);
      if (yd <= seg || i === pts.length - 2) {
        const f = seg ? Math.min(1, yd / seg) : 0;
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
      }
      yd -= seg;
    }
    return pts[pts.length - 1];
  }
  // How far down the route a drive in the fairway gains exactly 0 strokes.
  function evenDrive() {
    const pts = route(), len = pts.slice(1).reduce((a, p, i) => a + yards(pts[i], p), 0);
    const teeExp = expected('tee', yards(tee, pin), level);
    const sgAt = x => { const p = pointAlong(pts, x); return teeExp - expected('fairway', yards(p, pin), level) - 1; };
    let lo = 30, hi = Math.max(lo, len - 20);
    if (sgAt(hi) < 0) return hi;
    if (sgAt(lo) > 0) return lo;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (sgAt(mid) < 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  const place = () => {
    const hgt = mapEl.clientHeight, wid = mapEl.clientWidth;
    const BOTTOM = 150, SIDE = 30; // pixels kept clear below the tee and at the sides
    // Where the crosshair opens: the pin on a par 3; otherwise the middle of the
    // fairway at driving distance (measured across the fairway along the arc
    // centred on the tee), falling back to the route if there is no fairway there.
    let focus = pin;
    if (ch.par !== 3) {
      // The middle of this hole's fairway at driving distance, as near the drive
      // as possible: if there's no fairway there, 5 yd shorter, then longer, and
      // so on up to 60 yd either way, then shorter still (a lay-up). A spot in a
      // bunker, water or OB on the fairway doesn't count.
      const pts = route(), len = pts.slice(1).reduce((a, q, i) => a + yards(pts[i], q), 0);
      const drive = Math.min(bagYards('Dr') || sync.avgDrive || evenDrive(), len - 30);
      const spotAt = d => {
        const w = fairwayWidth(tee, pointAlong(pts, d), ownFairways, 60);
        if (!w) return null;
        const mid = (w.l + w.r) / 2;
        for (let o = 0; o <= (w.r - w.l) / 2; o += 1) {
          for (const x of o ? [mid - o, mid + o] : [mid]) { const q = w.arc(x); if (lieAt(q, course.features) === 'fairway') return q; }
        }
        return null;
      };
      let spot = null;
      for (let k = 0; k <= 12 && !spot; k++) {
        for (const d of k ? [drive - 5 * k, drive + 5 * k] : [drive]) {
          if (d >= 100 && d <= len - 20 && (spot = spotAt(d))) break;
        }
      }
      // Still none (a short hole whose fairway stops well short of a drive):
      // lay up to the fairway, as far down it as there is one.
      for (let d = drive - 65; !spot && d >= 100; d -= 5) spot = spotAt(d);
      focus = spot || pointAlong(pts, drive);
    }
    // Looking straight down the line from the tee to that point, as if standing on the tee.
    const brgDeg = bearing(tee, focus);
    const brg = (brgDeg * Math.PI) / 180, k = Math.cos((tee[0] * Math.PI) / 180);
    const local = p => { // metres along the tee-to-focus axis, and to the right of it
      const e = (p[1] - tee[1]) * M_PER_DEG * k, n = (p[0] - tee[0]) * M_PER_DEG;
      return [e * Math.sin(brg) + n * Math.cos(brg), e * Math.cos(brg) - n * Math.sin(brg)];
    };
    const below = hgt * (1 - CROSSHAIR_Y) - BOTTOM; // pixels from the crosshair down to the tee
    let mPerPx = local(focus)[0] / below;
    if (ch.par === 3) { // the whole hole fits across the screen too
      const offLine = Math.max(...route().map(p => Math.abs(local(p)[1]))) + 25;
      mPerPx = Math.max(mPerPx, offLine / (wid / 2 - SIDE));
    }
    mPerPx = Math.max(mPerPx, 0.05);
    const zoom = Math.min(20, Math.log2((78271.517 * Math.cos((focus[0] * Math.PI) / 180)) / mPerPx));
    m.jumpTo({ center: ll(focus), zoom, bearing: brgDeg, padding: { top: 0, left: 0, right: 0, bottom: hgt * (1 - 2 * CROSSHAIR_Y) } });
  };
  place();

  // Expected strokes to hole out from a lie `yd` yards from the pin. The tee box
  // counts as fairway; water costs a penalty stroke and a drop in the rough.
  const expectedFrom = (lie, yd) => (lie === 'green' ? expected('green', yd * 3, level)
    : lie === 'water' ? expected('rough', yd, level) + 1
    : expected(lie === 'tee' || lie === 'ob' ? 'fairway' : lie, yd, level));
  // Strokes gained by a shot from a spot worth `fromExp` that finishes at `lie`, `yd` from the pin.
  // Out of bounds is stroke and distance: a penalty, then the same shot again, so -2.
  const sgFinish = (fromExp, lie, yd) => (lie === 'ob' ? -2 : fromExp - expectedFrom(lie, yd) - 1);

  // The lie at a point, for scoring this hole: another hole's green (or a
  // practice green) is just short grass here, so it counts as fairway.
  const green = ownGreen(ch);
  function lieOn(p, features) {
    const lie = lieAt(p, features);
    return lie === 'green' && !(green && inPolygon(p, green.p)) ? 'fairway' : lie;
  }

  const line = pts => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts.map(ll) } });
  // The recorded shots, joined up; once holed, the last putt runs into the hole.
  // The shot lines, solid, and the penalty jumps (from where a ball went in to the
  // drop or back to where it was replayed), dotted.
  function traceLines(shots) {
    const solid = [], dotted = [], done = holeNow().done;
    shots.forEach((x, i) => {
      const next = shots[i + 1] ? shots[i + 1].pos : done ? pin : null;
      if (x.obAt) { solid.push([x.pos, x.obAt]); if (next) dotted.push([x.obAt, next]); }
      else if (next) solid.push([x.pos, next]);
    });
    const ml = segs => ({ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: segs.map(sg => sg.map(ll)) } });
    return { solid: ml(solid), dotted: ml(dotted) };
  }
  // While placing a drop, the dotted line runs from where the ball finished to the crosshair.
  const setTrace = (set, shots) => { const t = traceLines(dropping ? [...dropping.shots, { pos: target }] : shots); set('shots', t.solid); set('shotspen', t.dotted); };

  // Strokes Gained panel (viewing a past round): round total and this hole, each
  // opening to Off the tee / Approach / Around green / Putting, then this hole's
  // shots, each opening to its distance, lies, SG and club.
  const sgOpen = new Set(); // everything starts collapsed
  // Club for a shot: anything played from the green is a putter; other clubs
  // come once the bag is set up.
  const clubOf = s => (s.lie === 'green' ? h('b', {}, 'Putter') : h('b', { class: 'muted' }, '— (coming soon)'));
  // Shot wording. Title: "Shot 1 from tee", "Shot 2 from left rough", "Putt 1 from 14 ft".
  // Detail: club (or "Hit") with how far and where it finished, then what was left —
  //   "Hit 257 yds to left rough" / "148 yds to hole";  "Putter 12 ft" / "2 ft to hole".
  const SHORT_LIE = { tee: 'tee', fairway: 'fwy', rough: 'rough', bunker: 'bunker', green: 'green', water: 'water', recovery: 'recovery area' };
  // Rough is called left or right of the line from where the shot was hit to the pin.
  function lieName(p, from, hp) {
    const base = SHORT_LIE[p.lie] || p.lie;
    if (p.lie !== 'rough' || !from) return base;
    const k = Math.cos((from[0] * Math.PI) / 180);
    const bx = (hp[1] - from[1]) * k, by = hp[0] - from[0], px = (p.pos[1] - from[1]) * k, py = p.pos[0] - from[0];
    return `${bx * py - by * px > 0 ? 'left' : 'right'} rough`;
  }
  function shotTitle(hl, i) {
    const shots = hl.shots || [], s = shots[i], hp = hl.pin || pin;
    if (s.lie === 'green') {
      let no = 0; for (let k = 0; k <= i; k++) if (shots[k].lie === 'green') no++;
      return `Putt ${no} from ${s.ft ?? Math.round(yards(s.pos, hp) * FT_PER_YD)} ft`;
    }
    return `Shot ${strokeNo(shots, i)} from ${i === 0 || s.replay ? (s.lie === 'tee' ? 'tee' : 'the same spot') : s.drop ? 'drop' : lieName(s, shots[i - 1].pos, hp)}`;
  }
  function shotLines(hl, i) {
    const shots = hl.shots || [], s = shots[i], next = shots[i + 1];
    if (!s || (!next && !hl.done)) return null;
    const hp = hl.pin || pin, isPutt = s.lie === 'green', travel = yards(s.pos, s.obAt || (next ? next.pos : hp));
    const went = isPutt ? `${Math.round(travel * FT_PER_YD)} ft` : `${Math.round(travel)} yds`;
    const club = s.club ? clubName(s.club) + (s.swing ? ` (${SWING_NAME[s.swing] || s.swing})` : '') : isPutt ? 'Putter' : 'Hit';
    if (s.obAt && next) { // into water or OB, then a drop or a re-hit
      const into = s.penKind === 'water' ? 'into the water' : s.penKind === 'lost' ? 'lost' : s.penKind === 'penalty' ? '(penalty)' : s.penKind === 'relief' ? '(free relief)' : 'out of bounds', pen = s.pen ? `+${s.pen} penalty` : 'no penalty';
      return [`${club} ${went} ${into}`, next.drop ? `Dropped in ${lieName(next, s.obAt, hp)} (${pen}) · ${Math.round(yards(next.pos, hp))} yds to hole` : `Re-hit from the same spot (${pen})`];
    }
    const first = isPutt ? `${club} ${went}` : `${club} ${went} to ${next ? lieName(next, s.pos, hp) : 'the hole'}`;
    const second = !next ? 'In the hole' : `${next.lie === 'green' ? `${next.ft ?? Math.round(yards(next.pos, hp) * FT_PER_YD)} ft` : `${Math.round(yards(next.pos, hp))} yds`} to hole`;
    return [first, second];
  }
  const shotLineEls = (hl, i, fallback) => {
    const l = shotLines(hl, i);
    return l ? [h('div', { class: 'line' }, h('b', {}, l[0])), h('div', { class: 'line sub' }, h('span', {}, l[1]))] : [h('div', { class: 'line' }, h('b', {}, fallback))];
  };
  let sgViewKey = null;
  const fmtSgV = v => (v == null ? '–' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
  const sgCls = v => (v == null ? '' : v >= 0 ? 'pos' : 'neg');
  const LIE_NAME = { tee: 'Tee', fairway: 'Fairway', rough: 'Rough', bunker: 'Bunker', green: 'Green', water: 'Water', recovery: 'Recovery', ob: 'Out of bounds' };
  function drawSgView() {
    if (sgView.hidden) return;
    const r = currentRound();
    if (!r) { sgView.replaceChildren(h('small', {}, 'No round')); return; }
    const toggleRow = (key, label, value, extra) => h('button', { class: 'sgrow' + (sgOpen.has(key) ? ' open' : ''), onclick: () => { sgOpen.has(key) ? sgOpen.delete(key) : sgOpen.add(key); drawSgView(); } },
      h('span', { class: 'caret' }, sgOpen.has(key) ? '▾' : '▸'), h('span', { class: 'lab' }, label), extra ? h('small', {}, extra) : null, h('b', { class: sgCls(value) }, fmtSgV(value)));
    const cats = (sg, counts) => h('div', { class: 'sgcats' }, CATS.map(c => h('div', {}, h('span', {}, CAT_LABEL[c]), counts ? h('small', {}, `${counts[c] || 0} shot${counts[c] === 1 ? '' : 's'}`) : null, h('b', { class: sgCls(sg[c]) }, fmtSgV(sg[c])))));
    // Whole round
    const ra = analyzeRound(r, course, level);
    const rCounts = {}; ra.shots.forEach(x => { if (x.sg != null) rCounts[x.cat] = (rCounts[x.cat] || 0) + 1; });
    // This hole
    const hl = r.holes?.[n], ha = hl ? analyzeHole(hl, ch, level) : { rows: [] };
    const hSg = { ott: 0, app: 0, arg: 0, putt: 0, total: 0 }, hCounts = {};
    let hasHole = false;
    ha.rows.forEach(x => { if (x.sg != null) { hSg[x.cat] += x.sg; hSg.total += x.sg; hCounts[x.cat] = (hCounts[x.cat] || 0) + 1; hasHole = true; } });
    const shots = (hl && hl.shots) || [];
    let puttNo = 0;
    const shotRows = ha.rows.map((x, i) => {
      const s = x.shot, next = shots[i + 1], isPutt = s.lie === 'green';
      const end = next ? (LIE_NAME[next.lie] || next.lie) : hl.done ? 'Holed' : '—';
      const travel = next ? yards(s.pos, next.pos) : hl.done ? yards(s.pos, hl.pin || ch.pin) : null;
      const dist = travel == null ? '—' : isPutt ? `${Math.round(travel * 3)} ft` : `${Math.round(travel)} yd`;
      if (isPutt) puttNo++;
      const key = 'shot' + i, label = shotTitle(hl, i);
      return [toggleRow(key, label, x.sg), sgOpen.has(key) ? h('div', { class: 'shotinfo' },
        ...shotLineEls(hl, i, dist),
        h('div', {}, h('span', {}, 'Strokes gained'), h('b', { class: sgCls(x.sg) }, fmtSgV(x.sg)))) : null];
    }).flat().filter(Boolean);
    sgView.replaceChildren(...[
      h('div', { class: 'sghead' }, h('strong', {}, 'Strokes Gained'), h('small', {}, `vs ${level === 'Pro' ? 'Tour Pro' : level === 'Scratch' ? 'Scratch' : level + ' HCP'}`),
        h('button', { class: 'sgclose', 'aria-label': 'Close', onclick: () => { sgView.hidden = true; sgViewBtn.classList.remove('on'); } }, '✕')),
      toggleRow('round', 'Round total', ra.holes ? ra.sg.total : null, `${ra.holes} hole${ra.holes === 1 ? '' : 's'}`),
      sgOpen.has('round') ? cats(ra.sg, rCounts) : null,
      toggleRow('hole', `Hole ${n}`, hasHole ? hSg.total : null, hl?.done ? `${strokesOf(hl)} strokes` : 'not finished'),
      sgOpen.has('hole') ? cats(hSg, hCounts) : null,
      h('div', { class: 'sgsub' }, `Shots on hole ${n}`),
      ...(shotRows.length ? shotRows : [h('small', { class: 'muted' }, 'No shots recorded on this hole.')]),
    ].filter(Boolean));
  }

  // Score chips at the top (total, and this hole with the round to par) and a
  // scorecard overlay when either is tapped. Only while a round is under way.
  const toPar = v => (v === 0 ? 'E' : v > 0 ? `+${v}` : `−${-v}`);
  const strokesOf = hh => (hh.shots || []).reduce((t, x) => t + 1 + (x.lie === 'water' ? 1 : 0) + (x.pen || 0), 0);
  // The hole a round started on. Not stored, so it is worked out from the
  // holes played: the first one after the longest run of unplayed holes
  // (going round from 18 back to 1), e.g. 10 for a round started on the back.
  // Totals for the whole round, and to par through this hole (the holes played
  // from the starting hole up to this one), so stepping through a round shows
  // the running score hole by hole, also for a round started on 10.
  function roundTotals() {
    const r = currentRound();
    const count = Math.max(holeCountOf(r), course.holes.length);
    const start = startHoleOf(r, count), pos = k => (k - start + count) % count;
    let strokes = 0, par = 0, thruPar = 0, thruStrokes = 0, thru = 0;
    for (const o of course.holes) {
      const hh = o.n === n ? holeNow() : r?.holes?.[o.n]; // this hole as shown (part played, in a replay)
      if (!hh?.done) continue;
      strokes += strokesOf(hh); par += o.par;
      if (pos(o.n) <= pos(n)) { thruStrokes += strokesOf(hh); thruPar += o.par; thru++; }
    }
    return { r, strokes, toPar: strokes - par, thru, thruToPar: thruStrokes - thruPar };
  }
  // The score tiles are as wide as the hole pill below them.
  if (window.ResizeObserver) new ResizeObserver(() => { if (holePill.offsetWidth) chips.style.width = `${holePill.offsetWidth}px`; }).observe(holePill);
  let chipKey = null;
  function drawScoreChips() {
    const { r, strokes, toPar: tp, thru, thruToPar } = roundTotals();
    const show = !!r && !scouting; // GPS Overview keeps no score
    const key = show ? [strokes, tp, thru, thruToPar, holeNow().done ? strokesOf(holeNow()) : '-'].join('|') : 'none';
    if (key === chipKey) return;
    chipKey = key;
    chips.hidden = !show;
    holeEl()?.classList.toggle('haschips', show);
    if (!show) return;
    void strokes; void tp; // the total is on the scorecard
    const hh = holeNow();
    holeChip.replaceChildren(
      h('div', { class: 'sc' }, h('small', {}, 'Score'), // the hole number is already on the hole pill
        h('strong', {}, hh?.done ? String(strokesOf(hh)) : '–', h('em', {}, hh?.done ? ` (${toPar(strokesOf(hh) - ch.par)})` : ''))),
      h('div', { class: 'thru' }, thru ? h('strong', {}, toPar(thruToPar)) : null, h('small', {}, thru ? `thru ${thru}` : 'not started')));
  }
  function openScorecard() {
    const { r, strokes, toPar: tp } = roundTotals();
    if (!r) return;
    const count = Math.min(holeCountOf(r), course.holes.length), nines = count > 9 ? [[1, 9], [10, count]] : [[1, count]];
    const cls = (sc, par) => (sc == null ? '' : sc <= par - 2 ? 'eagle' : sc === par - 1 ? 'birdie' : sc === par ? 'par' : sc === par + 1 ? 'bogey' : 'dbl');
    const tees = course.tees.find(t => t.name === teeName) || course.tees[0];
    const table = ([a, b], label) => {
      const ns = Array.from({ length: b - a + 1 }, (_, i) => a + i);
      const sc = k => { const hh = r.holes?.[k]; return hh?.done ? strokesOf(hh) : null; };
      const sum = f => ns.reduce((t, k) => t + (f(k) || 0), 0);
      const go = k => () => { scorecard.hidden = true; location.hash = `#/hole/${k}`; };
      return h('table', {},
        h('tr', {}, h('th', {}, 'Hole'), ns.map(k => h('th', { class: k === n ? 'cur' : '', onclick: go(k) }, String(k))), h('th', {}, label)),
        h('tr', { class: 'yds' }, h('td', {}, 'Yds'), ns.map(k => h('td', {}, String(tees.yards[k - 1]))), h('td', {}, String(sum(k => tees.yards[k - 1])))),
        h('tr', {}, h('td', {}, 'Par'), ns.map(k => h('td', {}, String(course.holes[k - 1].par))), h('td', {}, String(sum(k => course.holes[k - 1].par)))),
        h('tr', { class: 'score' }, h('td', {}, 'Score'), ns.map(k => h('td', { onclick: go(k) }, h('span', { class: cls(sc(k), course.holes[k - 1].par) }, sc(k) ?? ''))), h('td', {}, sum(sc) ? String(sum(sc)) : '')));
    };
    scorecard.replaceChildren(h('div', { class: 'scbox' },
      h('div', { class: 'schead' }, h('strong', {}, 'Scorecard'), h('span', {}, strokes ? `${strokes} (${toPar(tp)})` : ''), h('button', { 'aria-label': 'Close', onclick: () => { scorecard.hidden = true; } }, '✕')),
      h('div', { class: 'scscroll' }, nines.map((nn, i) => table(nn, nines.length > 1 ? (i ? 'In' : 'Out') : 'Tot'))),
      h('small', { class: 'muted' }, 'Tap a hole to go to it.')));
    scorecard.hidden = false;
  }

  // The same scorecard, filled in with the expected score for the chosen
  // handicap level on each hole (from the scorecard yardage for these tees).
  function openExpected() {
    const count = holeCount, nines = count > 9 ? [[1, 9], [10, count]] : [[1, count]];
    const cls = (sc, par) => (sc == null ? '' : sc <= par - 2 ? 'eagle' : sc === par - 1 ? 'birdie' : sc === par ? 'par' : sc === par + 1 ? 'bogey' : 'dbl');
    const tees = teeSet;
    const ex = k => (tees.yards[k - 1] ? expected('tee', tees.yards[k - 1], level) : null);
    const all = Array.from({ length: count }, (_, i) => i + 1);
    const total = all.reduce((t, k) => t + (ex(k) || 0), 0), par = all.reduce((t, k) => t + course.holes[k - 1].par, 0);
    const toParX = d => (Math.abs(d) < 0.05 ? 'E' : (d > 0 ? '+' : '\u2212') + Math.abs(d).toFixed(1));
    const table = ([a, b], label) => {
      const ns = Array.from({ length: b - a + 1 }, (_, i) => a + i);
      const sum = f => ns.reduce((t, k) => t + (f(k) || 0), 0);
      const go = k => () => { scorecard.hidden = true; location.hash = `#/hole/${k}`; };
      return h('table', {},
        h('tr', {}, h('th', {}, 'Hole'), ns.map(k => h('th', { class: k === n ? 'cur' : '', onclick: go(k) }, String(k))), h('th', {}, label)),
        h('tr', { class: 'yds' }, h('td', {}, 'Yds'), ns.map(k => h('td', {}, String(tees.yards[k - 1]))), h('td', {}, String(sum(k => tees.yards[k - 1])))),
        h('tr', {}, h('td', {}, 'Par'), ns.map(k => h('td', {}, String(course.holes[k - 1].par))), h('td', {}, String(sum(k => course.holes[k - 1].par)))),
        h('tr', { class: 'score' }, h('td', {}, 'Exp'), ns.map(k => h('td', { onclick: go(k) }, h('span', { class: cls(ex(k) == null ? null : Math.round(ex(k)), course.holes[k - 1].par) }, ex(k) == null ? '' : ex(k).toFixed(1)))), h('td', {}, sum(ex).toFixed(1))));
    };
    scorecard.replaceChildren(h('div', { class: 'scbox expected' },
      h('div', { class: 'schead' }, h('strong', {}, `Expected \u00b7 ${levelName(level)}`), h('span', {}, `${total.toFixed(1)} (${toParX(total - par)})`), h('button', { 'aria-label': 'Close', onclick: () => { scorecard.hidden = true; } }, '\u2715')),
      // The handicap level everything is compared to: tap one to switch.
      h('div', { class: 'explevels' }, LEVELS.map(l => h('button', { class: l === level ? 'on' : '', 'aria-pressed': String(l === level),
        onclick: () => { level = l; sessionStorage.setItem('gs:level', level); update(); openExpected(); } }, levelName(l)))),
      h('div', { class: 'scscroll' }, nines.map((nn, i) => table(nn, nines.length > 1 ? (i ? 'In' : 'Out') : 'Tot'))),
      h('small', { class: 'muted' }, `What a ${levelName(level)} is expected to shoot from the ${tees.name} tees. Tap a handicap above to compare to it. Tap a hole to go to it.`)));
    scorecard.hidden = false;
  }

  // Rings around the pin for SG values, listed in a key beside the SG button.
  function setRings(rings) {
    const feats = [];
    for (const { v, ft } of rings) {
      if (ft && ft !== Infinity) feats.push({ type: 'Feature', properties: { color: `rgb(${sgColor(v).join(',')})` }, geometry: { type: 'LineString', coordinates: ring(pin, ft * 0.3048).map(ll) } });
    }
    ringLegend.hidden = !rings.length;
    ringLegend.replaceChildren(h('small', {}, 'Approach SG'), ...rings.map(({ v, ft, byDistance }) => h('span', {},
      h('i', { style: `background:rgb(${sgColor(v).join(',')})` }),
      byDistance ? `${ft} ft · ${fmtSg(Math.round(v * 100) / 100) || '0'} SG`
        : `${fmtSg(v) || '0'} · ${ft == null ? 'not possible' : ft === Infinity ? 'any green' : Math.round(ft) + ' ft'}`)));
    const src = m.getSource('sgt');
    if (src) src.setData({ type: 'FeatureCollection', features: feats });
  }

  // Lines that follow the crosshair (tee to crosshair to pin, the arc, the
  // fairway width and the approach circle) are drawn in an SVG laid over the
  // map and re-projected on every move, so they stay locked to the crosshair.
  // (Map layers update a frame or two late while panning.) It sits under the
  // markers so the tee, pin and shot dots stay on top.
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'liveoverlay');
  const STYLES = {
    path: [{ stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 4 }, { stroke: '#fff', 'stroke-width': 2 }],
    arc: [{ stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 5, 'stroke-linecap': 'round' }, { stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round' }],
    appr: [{ stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 4.5, 'stroke-linecap': 'round' }, { stroke: '#4dd0ff', 'stroke-width': 2.5, 'stroke-linecap': 'round' }],
    comp0: [{ stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 5, 'stroke-linecap': 'round' }, { stroke: '#f472b6', 'stroke-width': 2.5, 'stroke-linecap': 'round' }],
    comp1: [{ stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 5, 'stroke-linecap': 'round' }, { stroke: '#4dd0ff', 'stroke-width': 2.5, 'stroke-linecap': 'round' }],
    comp2: [{ stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 5, 'stroke-linecap': 'round' }, { stroke: '#a3e635', 'stroke-width': 2.5, 'stroke-linecap': 'round' }],
    ...Object.fromEntries(['#f472b6', '#4dd0ff', '#a3e635'].map((c, i) => ['compL' + i, [{ stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 3.5 }, { stroke: c, 'stroke-width': 1.75 }]])),
    width: [{ stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': '0.1 6' }, { stroke: '#ffe14d', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-dasharray': '0.1 6' }],
  };
  const svgPaths = {};
  for (const [name, layers] of Object.entries(STYLES)) {
    svgPaths[name] = layers.map(attrs => {
      const el = document.createElementNS(SVGNS, 'path');
      el.setAttribute('fill', 'none');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      svg.appendChild(el);
      return el;
    });
  }
  const dispLayer = document.createElementNS(SVGNS, 'g');
  svg.appendChild(dispLayer);
  const labelLayer = document.createElementNS(SVGNS, 'g');
  svg.appendChild(labelLayer);
  m.getCanvasContainer().insertBefore(svg, m.getCanvas().nextSibling);
  // How far each recorded shot went, at the middle of its line, when the line is
  // long enough on screen to fit the label (zoom in on the green to see putts).
  function trailLabels() {
    const hl = holeNow(), shots = hl.shots || [], hp = hl.pin || pin, out = [];
    for (let i = 0; i < shots.length; i++) {
      const a = shots[i], b = shots[i + 1];
      if (!b && !hl.done) break;
      const A = m.project(ll(a.pos)), B = m.project(ll(b ? b.pos : hp));
      if (Math.hypot(B.x - A.x, B.y - A.y) < 70) continue;
      const travel = yards(a.pos, b ? b.pos : hp);
      out.push({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, text: a.lie === 'green' ? `${Math.round(travel * FT_PER_YD)} ft` : `${Math.round(travel)} yd` });
    }
    while (labelLayer.childNodes.length > out.length) labelLayer.lastChild.remove();
    out.forEach((l, i) => {
      let g = labelLayer.childNodes[i];
      if (!g) {
        g = document.createElementNS(SVGNS, 'g');
        const bg = document.createElementNS(SVGNS, 'rect'), t = document.createElementNS(SVGNS, 'text');
        bg.setAttribute('rx', 8); bg.setAttribute('fill', '#111c'); bg.setAttribute('height', 18);
        t.setAttribute('fill', '#ffb020'); t.setAttribute('font-size', 12); t.setAttribute('font-weight', 700); t.setAttribute('font-family', 'system-ui, sans-serif'); t.setAttribute('text-anchor', 'middle');
        g.append(bg, t); labelLayer.appendChild(g);
      }
      const [bg, t] = g.childNodes, w = l.text.length * 7 + 10;
      t.textContent = l.text; t.setAttribute('x', l.x.toFixed(1)); t.setAttribute('y', (l.y + 4).toFixed(1));
      bg.setAttribute('x', (l.x - w / 2).toFixed(1)); bg.setAttribute('y', (l.y - 9).toFixed(1)); bg.setAttribute('width', w);
    });
  }
  // 20 shots spread evenly (a sunflower pattern) over a dispersion oval centred on
  // `target`: `widthYd` across the line of play and 60% of that deep, sheared so
  // shots to the right finish a little shorter and shots to the left a little
  // longer. Each is scored for SG from its own lie. Only the dots are drawn.
  function dispersion(from, target, widthYd, fromExp, lieHere = q => lieOn(q, course.features)) {
    const th = (bearing(from, target) * Math.PI) / 180, k = Math.cos((target[0] * Math.PI) / 180);
    const a = widthYd / 2 / YD_PER_M, b = a * 0.6, SHEAR = 0.15;
    // x metres right of the line, y metres along it -> [lat, lng]
    const at = (x, y) => { y -= SHEAR * x; return [target[0] + (y * Math.cos(th) - x * Math.sin(th)) / M_PER_DEG, target[1] + (y * Math.sin(th) + x * Math.cos(th)) / (M_PER_DEG * k)]; };
    const N = 20, GOLD = Math.PI * (3 - Math.sqrt(5)), dots = [];
    let tot = 0;
    for (let i = 0; i < N; i++) {
      const r = Math.sqrt((i + 0.5) / N) * 0.92, t = i * GOLD, q = at(a * r * Math.cos(t), b * r * Math.sin(t));
      const lie = lieHere(q), sg = sgFinish(fromExp, lie, yards(q, pin));
      tot += sg; dots.push({ q, sg, lie });
    }
    return { dots, sg: tot / N };
  }
  function drawDispDots(dots) {
    while (dispLayer.childNodes.length > dots.length) dispLayer.lastChild.remove();
    dots.forEach((d, i) => {
      let c = dispLayer.childNodes[i];
      if (!c) { c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('r', 3.5); c.setAttribute('stroke', '#111'); c.setAttribute('stroke-width', 1.25); dispLayer.appendChild(c); }
      const p = m.project(ll(d.q));
      c.setAttribute('cx', p.x.toFixed(1)); c.setAttribute('cy', p.y.toFixed(1)); c.setAttribute('fill', d.color || `rgb(${heatColor(d.sg).join(',')})`); // a compared club's dots in its colour
    });
  }
  function overlay(lines) {
    // View: only the Comp arcs and their lines are left.
    if (cleanView) { lines = Object.fromEntries(Object.entries(lines).filter(([k]) => k.startsWith('comp'))); labelLayer.replaceChildren(); } else trailLabels();
    for (const [name, els] of Object.entries(svgPaths)) {
      const pts = lines[name] || [];
      const d = pts.length > 1 ? pts.map((q, i) => { const p = m.project(ll(q)); return `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join('') : '';
      els.forEach(el => el.setAttribute('d', d));
    }
  }

  function update() {
    // Read what is under the crosshair from its actual screen position, so the
    // line always meets the dot even if the screen size changed since the last layout.
    const c = m.unproject([mapEl.clientWidth / 2, mapEl.clientHeight * CROSSHAIR_Y]);
    if (moving === 'tee') { tee = [c.lat, c.lng]; teeMark.setLngLat(ll(tee)); target = aim; } // the crosshair is dragging the tee
    else target = [c.lat, c.lng];
    const lie = lieOn(target, course.features);
    const shots = shotsNow(), st = stage(), plan = planShots(), last = plan[plan.length - 1];
    const from = last ? last.pos : tee;
    // On the green (placing the pin, putting) the aiming tools go; once the hole is
    // finished they come back, working from the tee.
    const onGreen = st === 'pin' || st === 'putt';
    const w = showWidth && !onGreen ? fairwayWidth(from, target, fairways) : null;
    const fromTee = yards(from, target), toPin = yards(target, pin);
    undoBtn.hidden = !shots.length && !holeNow().done;
    addBtn.hidden = st === 'pin' || st === 'done' || !!dropping;
    holedBtn.hidden = st !== 'putt';
    widthBtn.hidden = arcBtn.hidden = apprBtn.hidden = onGreen;
    clubBtn.hidden = onGreen || viewing();
    if (!clubBtn.hidden) { const c = currentClub(); clubBtn.firstChild.textContent = c ? clubShort(c) : '–'; clubBtn.classList.toggle('on', !!pickedClub); }
    compBtn.hidden = onGreen || viewing() || tourney;
    autoBtn.hidden = onGreen || viewing() || tourney;
    if (autoBtn.hidden) autoKey.hidden = true;
    compBtn.classList.toggle('on', showComp);
    compSetBtn.hidden = compBtn.hidden || !showComp;
    if (compBtn.hidden) compLegend.hidden = true;
    arcSlider.hidden = !(showArc || showDisp) || onGreen || !arcAdjOpen;
    dispBtn.hidden = onGreen || tourney;
    dispAdjBtn.hidden = !showDisp || onGreen;
    dispAdjBtn.classList.toggle('on', arcAdjOpen);
    arcAdjBtn.hidden = !showArc || onGreen;
    arcAdjBtn.classList.toggle('on', arcAdjOpen);
    apprSlider.hidden = !showAppr || onGreen || !apprAdjOpen;
    apprAdjBtn.hidden = !showAppr || onGreen;
    apprAdjBtn.classList.toggle('on', apprAdjOpen);
    setPinBtn.hidden = st !== 'pin';
    banner.hidden = true; // replaced by the score chips at the top
    teeBtn.hidden = onGreen;
    pinBtn.hidden = st === 'pin' || st === 'done';
    sgViewBtn.hidden = !viewing();
    // Tools and SG: hidden when there's nothing to open; closed, they show how many of their tools are on.
    drawGroup(toolsBtn, [widthBtn, arcBtn, dispBtn, apprBtn], [showWidth, showArc, showDisp, showAppr].filter(Boolean).length, '⋯', 'toolsopen');
    if (viewing()) { toolsBtn.hidden = true; holeEl()?.classList.remove('toolsopen'); } // no aiming tools on a past round
    if (tourney) { toolsBtn.hidden = widthBtn.hidden = arcBtn.hidden = dispBtn.hidden = apprBtn.hidden = true; toolsBtn.open = false; holeEl()?.classList.remove('toolsopen'); } // no Tools button at all in a tournament
    drawGroup(sgBtn, [compBtn, autoBtn], [showComp, !!autoPick].filter(Boolean).length, '⊙', 'sgopen');
    if (!toolsBtn.open) arcSlider.hidden = apprSlider.hidden = true;
    if (!viewBox.hidden) drawViewBox();
    drawLiveBtn();
    drawGps();
    holeEl()?.classList.toggle('viewing', viewing()); // hides the crosshair and its readouts
    // Holed out: just the hole and the shots played, with no crosshair or aiming lines
    // (they come back while the tee is being moved).
    const holedOut = st === 'done' && !moving;
    holeEl()?.classList.toggle('holedout', holedOut);
    { const k = `${level}|${currentRound()?.updated}`; if (k !== sgViewKey) { sgViewKey = k; drawSgView(); } }
    if (!viewing()) sgView.hidden = true;
    drawShotList();
    if (viewing()) addBtn.hidden = holedBtn.hidden = setPinBtn.hidden = undoBtn.hidden = teeBtn.hidden = pinBtn.hidden = true;
    if ((moving === 'tee' && teeBtn.hidden) || (moving === 'pin' && pinBtn.hidden)) endMove(false);
    // The hole pill: the hole's yardage, or on the green the putt to come.
    const putts = shots.filter(x => x.lie === 'green').length - 1;
    if (st === 'putt') {
      pillSmall.textContent = `Hole ${n} · Putt ${putts + 1}`;
      pillStrong.textContent = `${Math.round(yards(from, pin) * FT_PER_YD)} ft to hole`;
    } else {
      pillSmall.textContent = `Hole ${n} · Par ${ch.par}`;
      pillStrong.textContent = `${teeSet.yards[n - 1]} Yards`;
    }
    drawScoreChips();

    // Strokes gained by a shot from the tee (or the last recorded shot) that
    // finishes on the crosshair: expected strokes from there, minus expected
    // strokes from here, minus the stroke played.
    const teeExp = expected('tee', yards(tee, pin), level);
    const fromExp = last ? expectedFrom(last.lie, yards(from, pin)) : teeExp;
    const sg = sgFinish(fromExp, lie, toPin);
    expValue.textContent = teeExp.toFixed(2);

    if (onGreen) {
      // Feet on the green. Before the pin is placed, the crosshair is the hole.
      const ballToHole = yards(from, st === 'pin' ? target : pin) * FT_PER_YD;
      if (st === 'pin') {
        toPinEl.replaceChildren(h('span', { class: 'note' }, 'Move the crosshair onto the hole'));
        fromTeeEl.replaceChildren(h('b', {}, `${Math.round(ballToHole)} ft`), h('span', { class: 'note' }, 'from your ball'));
      } else if (st === 'putt') {
        toPinEl.replaceChildren(h('b', {}, `${Math.round(toPin * FT_PER_YD)} ft`));
        fromTeeEl.replaceChildren(h('b', {}, `${Math.round(fromTee * FT_PER_YD)} ft`));
      } else { toPinEl.replaceChildren(); fromTeeEl.replaceChildren(); }
      expValue.textContent = teeExp.toFixed(2);
      const set = (id, data) => { const src = m.getSource(id); if (src) src.setData(data); };
      overlay(viewing() ? {} : { path: st === 'pin' ? [from, target] : st === 'done' ? [] : [from, target, pin] });
      setTrace(set, shots);
      setRings([]); showZones(false); compDots.replaceChildren(); compLegend.hidden = true; drawDispDots([]);
      return;
    }
    if (moving === 'tee') { // the crosshair is the tee: show how far it is to the aim spot
      toPinEl.replaceChildren(h('b', {}, `${Math.round(yards(tee, aim))} yd`), h('span', { class: 'note' }, 'to aim spot'));
      fromTeeEl.replaceChildren(h('span', { class: 'note' }, 'Move the tee, then Set tee'));
    } else {
    // Plays like: the yardage, how many yards the ground rises (+) or drops (−)
    // from where the shot starts to where it ends, and what it plays, at a yard
    // for a yard: "250(−5) 245".
    // Plays like: the yardage, and what it plays counting the height change
    // (a yard for a yard) and, if Wnd is on, the wind: into it adds 1% a mph,
    // downwind takes off 0.5% a mph (crosswind not counted). The number stays
    // centred, the rise/drop right by it (small, red uphill, green downhill),
    // "161(+1) yd", and the plays-like number under it.
    const yardage = (a, b, d) => {
      const yd = Math.round(d);
      const plain = [h('b', {}, `${yd} yd`)];
      if (tourney || !elevPrefs.playsLike || !elevInfo) return plain;
      let dz = null;
      if (elevPrefs.playsElev) {
        const ha = heightAt(elevId, elevInfo, a, () => { if (map === m) update(); });
        const hb = heightAt(elevId, elevInfo, b, () => { if (map === m) update(); });
        if (ha != null && hb != null) dz = Math.round((hb - ha) * YD_PER_M);
      }
      let wind = null;
      if (elevPrefs.playsWind && playsWindNow && yd > 5) {
        const into = playsWindNow.speed * Math.cos(((playsWindNow.dir - bearing(a, b)) * Math.PI) / 180); // + into the wind
        wind = Math.round(yd * (into > 0 ? 0.01 : 0.005) * into);
      }
      if (dz == null && wind == null) return plain;
      const sign = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`;
      // The number stays centred; the rise/drop and "yd" hang off its right.
      return [h('b', { class: 'playslike' }, h('span', { class: 'num' }, `${yd}`, h('span', { class: 'tail' },
          dz != null ? h('small', { class: 'dz' + (dz > 0 ? ' up' : dz < 0 ? ' down' : '') }, `(${sign(dz)})`) : null, 'yd')),
        // The plays-like number lines up under the yardage: both numbers centred, "yd" and the wind to the right.
        h('span', { class: 'pl' }, h('span', { class: 'num' }, `${yd + (dz || 0) + (wind || 0)}`, h('span', { class: 'tail' }, 'yd',
          wind != null ? h('small', { class: 'wnd' + (wind > 0 ? ' up' : wind < 0 ? ' down' : '') }, `wind ${sign(wind)}`) : null))))];
    };
    toPinEl.replaceChildren(...yardage(target, pin, toPin));
    fromTeeEl.replaceChildren(...yardage(from, target, fromTee),
      tourney ? h('span', { class: 'sg' }, LIE_TAG[lie]) : h('span', { class: 'sg ' + (sg >= 0 ? 'gain' : 'loss') }, `${sg >= 0 ? '+' : '−'}${Math.abs(sg).toFixed(2)} (${LIE_TAG[lie]})`),
      h('span', { class: 'wide', hidden: !showWidth }, w ? `${Math.round(w.yards)} yd wide` : 'No fairway here'));
    }

    const arc = showArc ? arcThrough(from, target) : null;
    let arcW = arcYd;
    if (autoPick && (autoPick.from !== from.join(',') || (autoPick.comp && !showComp))) { autoPick = null; autoBtn.classList.remove('on'); autoKey.hidden = true; } // a new shot, or Comp turned off
    if (autoPick && !autoPick.comp) arcW = clubArcW(autoPick.club); // Disp shows the picked club's spread
    if (arcAuto) {
      // Sized by club only, so it changes when a club is tapped, not as the
      // crosshair moves: the tapped club (or the driver off a par 4/5 tee), with
      // its arc from My Bag, else 15% of its bag yardage; otherwise the slider width.
      const club = (autoPick && autoPick.club) || pickedClub || (!plan.length && ch.par >= 4 ? (bag().find(c => /^Dr/.test(c.name)) || {}).name : null);
      if (club && ((store.get('clubArcs') || {})[club] > 0 || bagYards(club))) arcW = clubArcW(club);
      arcValue.textContent = `Auto · ${arcW} yd`; arcRange.value = arcW;
    }
    const half = arcW / 2 / YD_PER_M;
    const set = (id, data) => { const src = m.getSource(id); if (src) src.setData(data); };
    const lines = { path: [from, target, pin] };
    setTrace(set, shots);
    if (w) lines.width = arcPoints(w.arc, w.l, w.r);
    if (arc) lines.arc = arcPoints(arc, -half, half);
    if (showAppr && apprMode === 'ft') lines.appr = ring(target, apprFt * 0.3048);
    // Disp: 20 shots in the dispersion oval, each scored from where it lands.
    const disp = showDisp && !viewing() && yards(from, target) > 5 ? dispersion(from, target, arcW, fromExp) : null;
    if (disp && moving !== 'tee') fromTeeEl.append(h('span', { class: 'sg disp ' + (disp.sg >= 0 ? 'gain' : 'loss') }, `Disp ${disp.sg >= 0 ? '+' : '−'}${Math.abs(disp.sg).toFixed(2)} avg`));
    const comps = showComp && !viewing() ? compArcs(from, yards(from, target) > 5 ? target : pin, fromExp) : [];
    // Comparing: each club has its own coloured line from the ball, and the white
    // aiming line goes.
    comps.forEach((c, i) => { lines['comp' + i] = c.pts; lines['compL' + i] = [from, c.mid]; });
    if (comps.length) delete lines.path;
    drawDispDots([...(disp && !cleanView && !comps.length ? disp.dots : []), ...comps.flatMap(c => (c.dots || []).map(d => ({ ...d, color: c.color })))]);
    compLegend.hidden = !comps.length;
    holeEl()?.classList.toggle('comparing', comps.length > 0); // the dots replace the crosshair readout
    // A dot at the middle of each arc, read like the crosshair: yards left to the
    // pin just above it, distance from the ball just below (SG is in the key).
    // The dot elements are kept (not rebuilt) so a drag in progress keeps its touch.
    while (compDots.childNodes.length > comps.length) compDots.lastChild.remove();
    comps.forEach((c, i) => {
      let el = compDots.childNodes[i];
      if (!el) {
        el = h('div', { class: 'compdot' }, h('b', { class: 'up' }), h('i', { onpointerdown: e => dragComp(el._club, e) }), h('b', { class: 'down' }));
        compDots.appendChild(el);
      }
      const pt = m.project(ll(c.mid));
      el._club = c.club;
      // The dot being held: bigger, with a glow, and its arc drawn bolder.
      const active = compDrag?.club === c.club;
      el.classList.toggle('active', active);
      const [shadow, stroke] = svgPaths['comp' + i];
      shadow.setAttribute('stroke-width', active ? 9 : 5); stroke.setAttribute('stroke-width', active ? 5 : 2.5);
      el.style.cssText = `left:${pt.x.toFixed(1)}px;top:${pt.y.toFixed(1)}px;--c:${c.color}`;
      el.firstChild.textContent = `${Math.round(c.toPin)} yd`; // left to the pin
      el.lastChild.textContent = `${c.yd} yd`; // from the ball
    });
    compLegend.replaceChildren(h('small', {}, 'Compare · avg SG'), ...comps.map(c => h('span', {},
      h('i', { style: `background:${c.color}` }), `${clubShort(c.club)} ${c.yd}y · `,
      h('b', { class: c.sg >= 0 ? 'pos' : 'neg' }, `${c.sg >= 0 ? '+' : '−'}${Math.abs(c.sg).toFixed(2)}`))));
    overlay(viewing() || holedOut ? {} : lines); // no aiming lines while just viewing, or once holed out
    // SG: the drive heat map, from the tee only.
    showZones(showSgt && !plan.length && !watching);
    // Appr in SG mode: the ring around the pin for the chosen SG value.
    const rings = [];
    if (showAppr && apprMode === 'sg') rings.push({ v: sgCfg.rings.value, ft: sgFeet(last ? last.lie : 'tee', yards(from, pin), sgCfg.rings.value) });
    setRings(cleanView || watching ? [] : rings);
  }

  const dragMarker = (el, pos, onMove) => {
    // Locked while viewing a past round; draggable again after Edit.
    const mk = new maplibregl.Marker({ element: el, draggable: !viewing() }).setLngLat(ll(pos)).addTo(m);
    mk.on('drag', () => { const p = mk.getLngLat(); onMove([p.lat, p.lng], false); });
    mk.on('dragend', () => { const p = mk.getLngLat(); onMove([p.lat, p.lng], true); });
    return mk;
  };
  const teeMark = dragMarker(h('div', { class: 'teemark', title: 'Tee (drag to move)' }), tee, p => { tee = p; update(); });
  const pinMark = dragMarker(h('div', { class: 'pinmark', title: 'Pin (drag to move)' }), pin, (p, done) => {
    pin = p;
    if (done && holeNow().pin) saveHole({ pin, shots: shotsNow().map(x => (x.lie === 'green' ? { ...x, ft: Math.max(1, Math.round(yards(x.pos, pin) * FT_PER_YD)) } : x)) });
    update();
  });
  // Until the pin is placed on the green it is hidden: the crosshair stands in for it.
  function syncPin() {
    pinMark.setLngLat(ll(pin));
    pinMark.getElement().style.visibility = stage() === 'pin' ? 'hidden' : '';
  }

  // Zoom onto the green: the green and the ball both in view, the crosshair on the
  // pin once it is placed (or the green's centre before then).
  // Zoom onto the green so it fills the screen around the crosshair: the
  // crosshair on the pin once it is placed (on the green's centre before then),
  // with the whole green and the ball in view.
  function zoomToGreen() {
    const g = ownGreen(ch), ball = shotsNow().at(-1)?.pos;
    const focus = holeNow().pin || !g ? pin : centre(g.p[0]);
    zoomAround(focus, [...(g ? g.p[0] : [pin]), ...(ball ? [ball] : [])]);
  }
  // Ease the map so `focus` sits on the crosshair and all of `pts` fit on
  // screen around it: above the crosshair (below the top buttons), below it
  // (above the hole pill) and to either side.
  function zoomAround(focus, pts) {
    const hgt = mapEl.clientHeight, wid = mapEl.clientWidth;
    const brg = (m.getBearing() * Math.PI) / 180, k = Math.cos((focus[0] * Math.PI) / 180);
    let up = 0, down = 0, side = 0;
    for (const p of pts) {
      const e = (p[1] - focus[1]) * M_PER_DEG * k, nn = (p[0] - focus[0]) * M_PER_DEG;
      const a = e * Math.sin(brg) + nn * Math.cos(brg), c = e * Math.cos(brg) - nn * Math.sin(brg);
      up = Math.max(up, a); down = Math.max(down, -a); side = Math.max(side, Math.abs(c));
    }
    const mPerPx = 1.08 * Math.max(up / (hgt * CROSSHAIR_Y - 60), down / (hgt * (1 - CROSSHAIR_Y) - 90), side / (wid / 2 - 10), 0.02);
    const zoom = Math.min(21, Math.log2((78271.517 * k) / mPerPx));
    m.easeTo({ center: ll(focus), zoom, duration: 500 });
  }
  // The tee box the tee sits on (or the nearest one), plus some room around it.
  function teeArea(at) {
    const boxes = course.features.filter(f => f.t === 'tee');
    const box = boxes.find(f => inPolygon(at, f.p)) || boxes.reduce((b, f) => (!b || yards(centre(f.p[0]), at) < yards(centre(b.p[0]), at) ? f : b), null);
    const pts = box && yards(centre(box.p[0]), at) < 40 ? [...box.p[0]] : [];
    return [...pts, ...ring(at, 18)]; // at least ~36 m across
  }
  syncPin();

  // Numbered dots where each recorded shot finished. Tapping one shows that
  // shot: how far it went, its lies, strokes gained and club.
  let shotMarks = [], shotPopup = null;
  function showShotInfo(i, at) {
    const hl = holeNow(), shots = hl.shots || [], s = shots[i], next = shots[i + 1];
    if (!s) return;
    const row = analyzeHole(hl, ch, level).rows[i] || {};
    const isPutt = s.lie === 'green', end = next || (hl.done ? null : undefined);
    if (end === undefined) return;
    const travel = yards(s.pos, end ? end.pos : (hl.pin || pin));
    const name = l => ({ tee: 'Tee', fairway: 'Fairway', rough: 'Rough', bunker: 'Bunker', green: 'Green', water: 'Water', recovery: 'Recovery', ob: 'Out of bounds' }[l] || l);
    const sgTxt = row.sg == null ? '–' : (row.sg >= 0 ? '+' : '−') + Math.abs(row.sg).toFixed(2);
    let puttNo = 0; for (let k = 0; k <= i; k++) if (shots[k].lie === 'green') puttNo++;
    // "Shot 1 · 7 Iron" / "155 yds from tee to fairway" / "282 yds to hole" / Strokes gained.
    // Putts: "Putt 1 · Putter" / "14 ft putt" / "2 ft to hole".
    const hp = hl.pin || pin;
    const club = s.club ? clubName(s.club) + (s.swing ? ` (${SWING_NAME[s.swing] || s.swing})` : '') : isPutt ? 'Putter' : '';
    const lieLong = (p, from) => (p.lie === 'fairway' ? 'fairway' : p.lie === 'recovery' ? 'recovery area' : lieName(p, from, hp));
    const fromTxt = i === 0 ? 'tee' : s.drop ? 'drop' : s.replay ? (s.lie === 'tee' ? 'tee' : 'the same spot') : lieLong(s, shots[i - 1].pos);
    const went = isPutt ? `${Math.round(travel * FT_PER_YD)} ft` : `${Math.round(travel)} yds`;
    const into = s.penKind === 'water' ? 'into the water' : s.penKind === 'lost' ? '(lost ball)' : s.penKind === 'penalty' ? '(penalty)' : s.penKind === 'relief' ? '(free relief)' : 'out of bounds';
    const line2 = isPutt ? `${went} putt`
      : s.obAt ? `${Math.round(yards(s.pos, s.obAt))} yds from ${fromTxt} ${into} (${s.pen ? `+${s.pen} penalty` : 'no penalty'})`
      : `${went} from ${fromTxt} to ${next ? lieLong(next, s.pos) : 'the hole'}`;
    const line3 = !next ? 'In the hole'
      : s.obAt && !next.drop ? 'Re-hit from the same spot'
      : `${next.lie === 'green' ? `${next.ft ?? Math.round(yards(next.pos, hp) * FT_PER_YD)} ft` : `${Math.round(yards(next.pos, hp))} yds`} to hole`;
    const el = h('div', { class: 'shotpop' },
      h('strong', {}, `${isPutt ? `Putt ${puttNo}` : `Shot ${strokeNo(shots, i)}`}${club ? ` · ${club}` : ''}`),
      h('div', { class: 'line' }, h('b', {}, line2)),
      h('div', { class: 'line sub' }, h('span', {}, line3)),
      h('div', {}, h('span', {}, 'Strokes gained'), h('b', { class: row.sg == null ? '' : row.sg >= 0 ? 'pos' : 'neg' }, sgTxt)));
    shotPopup?.remove();
    shotPopup = new maplibregl.Popup({ offset: 14, closeButton: true, className: 'shotpopup', maxWidth: '240px' }).setLngLat(ll(at)).setDOMContent(el).addTo(m);
  }
  const tappable = (el, i, at) => { el.addEventListener('click', e => { e.stopPropagation(); showShotInfo(i, at); }); return el; };
  function drawShots() {
    shotMarks.forEach(mk => mk.remove());
    shotPopup?.remove(); shotPopup = null;
    const shots = shotsNow();
    // The dot numbered k marks where shot k finished (shot index k-1).
    shotMarks = shots.slice(1).map((s, i) => {
      // Where shot k finished. A ball into water or OB: the number sits where it went
      // in, and a drop shows the stroke count after the penalty (water: in at 1,
      // drop 2, next shot 3; OB drop: 3, next shot 4).
      const went = shots[i].obAt, at = went || s.pos;
      return new maplibregl.Marker({ element: tappable(h('div', { class: 'shotmark' + (went ? ' pen' : '') }, String(strokeNo(shots, i))), i, at) }).setLngLat(ll(at)).addTo(m);
    });
    shots.forEach((x, i) => { if (x.obAt && shots[i + 1]?.drop) shotMarks.push(new maplibregl.Marker({ element: tappable(h('div', { class: 'shotmark drop', title: 'Drop' }, String(strokeNo(shots, i) + (x.pen || 0))), i, shots[i + 1].pos) }).setLngLat(ll(shots[i + 1].pos)).addTo(m)); });
    // Once holed, the number of the stroke that went in sits just above the hole.
    if (holeNow().done && shots.length) {
      shotMarks.push(new maplibregl.Marker({ element: tappable(h('div', { class: 'shotmark holedmark', title: 'Holed' }, String(strokeNo(shots, shots.length - 1))), shots.length - 1, pin), anchor: 'bottom', offset: [0, -9] }).setLngLat(ll(pin)).addTo(m));
    }
  }
  drawShots();
  drawLastShot();

  m.on('move', update);
  // The browser's toolbars showing or hiding changes the screen height: keep the
  // map's pivot on the crosshair and refresh the readout.
  m.on('resize', () => { m.setPadding({ top: 0, left: 0, right: 0, bottom: mapEl.clientHeight * (1 - 2 * CROSSHAIR_Y) }); update(); });
  m.on('click', () => { menu.hidden = true; });

  // GPS Scouting: edit this hole's boundaries (fairway, rough, bunker, water,
  // recovery, tee box, green, OB) on the map. Saving reloads the hole with them.
  function editBoundaries() {
    if (!m.isStyleLoaded()) { m.once('idle', editBoundaries); return; }
    openBoundaryEditor({ m, root: holeEl(), ch, own: holeFeatures(ch, editFeatures()), prev: prevHole, next: nextHole,
      go: k => { location.hash = `#/hole/${k}`; }, onClose: saved => { if (saved) rerenderHere(); } });
  }

  // ---- Replay ----
  // Plays a past round back one shot at a time: the camera turns to look down
  // each shot, a tracer flies from where it was hit to where it finished, then
  // the view closes in on where it landed. Then on to the next hole played.
  // Pause / play, 2x speed, and ✕ to leave the replay (the round stays open).
  const rpBar = rp ? h('div', { class: 'replaybar' }) : null;
  const rpAlive = () => map === m && replay === rp;
  // The club for a shot ("7 Iron", "Putter"), if one was recorded.
  const rpClub = x => (!x ? '' : x.club ? clubName(x.club) + (x.swing ? ` (${SWING_NAME[x.swing] || x.swing})` : '') : x.lie === 'green' ? 'Putter' : '');
  // A tag on the map at the ball with the club being hit, shown while the shot flies.
  let rpTag = null;
  const rpTagOff = () => { rpTag?.remove(); rpTag = null; };
  const rpOrder = () => playOrder(currentRound(), course);
  function drawRpBar() {
    if (!rpBar) return;
    const order = rpOrder(), finished = rp.done && order[order.length - 1] === n;
    const hl = currentRound().holes[n] || { shots: [] }, total = strokesIn(hl);
    const sh = hl.shots || [], putt = sh.slice(0, rp.step + 1).filter(x => x.lie === 'green').length;
    const label = finished ? 'Replay finished' : rp.step >= total ? `Hole ${n} done`
      : `Hole ${n} · ${sh[rp.step]?.lie === 'green' ? `Putt ${putt}` : `Shot ${strokeNo(sh, rp.step)}`}${rpClub(sh[rp.step]) ? ` · ${rpClub(sh[rp.step])}` : ''}`;
    rpBar.replaceChildren(
      h('button', { class: 'rpplay', 'aria-label': finished ? 'Replay again' : rp.playing ? 'Pause' : 'Play', onclick: () => {
        if (finished) { replay = { playing: true, speed: rp.speed }; if (order[0] === n) renderHole(view, n); else location.hash = `#/hole/${order[0]}`; return; }
        rp.playing = !rp.playing; drawRpBar();
      } }, finished ? '↺' : rp.playing ? '❚❚' : '▶'),
      h('span', { class: 'rplabel' }, label),
      h('button', { class: 'rpspeed' + (rp.speed === 2 ? ' on' : ''), 'aria-pressed': String(rp.speed === 2), onclick: () => { rp.speed = rp.speed === 2 ? 1 : 2; drawRpBar(); } }, '2x'),
      h('button', { class: 'rpexit', 'aria-label': 'End replay', title: 'End replay', onclick: () => { sessionStorage.removeItem('gs:replay'); replay = null; renderHole(view, n); } }, '✕'));
  }
  // Waits `ms` of replay time: stopped while paused, twice as fast at 2x. False if the replay ended meanwhile.
  const rpWait = ms => new Promise(res => {
    let left = ms, t0 = performance.now();
    const tick = () => {
      if (!rpAlive()) return res(false);
      const now = performance.now();
      if (rp.playing) left -= (now - t0) * rp.speed;
      t0 = now;
      if (left <= 0) return res(true);
      setTimeout(tick, 40);
    };
    tick();
  });
  const rpClear = () => m.getSource('replay')?.setData({ type: 'FeatureCollection', features: [] });
  // The tracer: a line growing from `from` to `to`, with the ball at its head.
  const rpTrace = (from, to, ms) => new Promise(res => {
    let f = 0, t0 = performance.now();
    const frame = () => {
      if (!rpAlive()) return res(false);
      const now = performance.now();
      if (rp.playing) f = Math.min(1, f + ((now - t0) * rp.speed) / ms);
      t0 = now;
      const e = 1 - (1 - f) * (1 - f); // fast off the club, slowing as it lands
      const p = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e];
      m.getSource('replay')?.setData({ type: 'FeatureCollection', features: [line([from, p]), { type: 'Feature', geometry: { type: 'Point', coordinates: ll(p) } }] });
      if (f >= 1) return res(true);
      requestAnimationFrame(frame);
    };
    frame();
  });
  // Look down the shot: the landing spot on the crosshair, where it was hit from below it.
  // Putts: right in close on the green, the putt filling about a third of the screen.
  function rpCamera(from, to, ms, putt) {
    const dm = yards(from, to) / YD_PER_M, k = Math.cos((to[0] * Math.PI) / 180), hgt = mapEl.clientHeight;
    const mPerPx = putt ? Math.max((dm * 1.2) / (hgt * 0.32), 0.008) : Math.max((dm * 1.15) / (hgt * (1 - CROSSHAIR_Y) - 150), 0.03);
    const zoom = Math.log2((78271.517 * k) / mPerPx);
    m.easeTo({ center: ll(to), zoom: putt ? Math.max(19.5, Math.min(21, zoom)) : Math.min(20, zoom), bearing: bearing(from, to), duration: ms });
  }
  async function runReplay() {
    const hl = currentRound().holes[n] || { shots: [] }, shots = hl.shots || [], total = strokesIn(hl);
    drawRpBar();
    if (!(await rpWait(900))) return;
    while (rp.step < total) {
      const j = rp.step, sh = shots[j], to = sh.obAt || (shots[j + 1] ? shots[j + 1].pos : hl.pin || pin);
      const putt = sh.lie === 'green';
      rpCamera(sh.pos, to, 900 / rp.speed, putt);
      drawRpBar();
      if (rpClub(sh)) rpTag = new maplibregl.Marker({ element: h('div', { class: 'rpclub' }, rpClub(sh)), anchor: 'top', offset: [0, 10] }).setLngLat(ll(sh.pos)).addTo(m);
      if (!(await rpWait(1000))) return rpTagOff();
      if (!(await rpTrace(sh.pos, to, putt ? 1100 : 1700))) return rpTagOff();
      rp.step++;
      rpTagOff(); rpClear(); drawShots(); update(); drawRpBar();
      if (!(await rpWait(1400))) return;
    }
    rp.done = true; drawRpBar();
    const order = rpOrder(), next = order[order.indexOf(n) + 1];
    if (!next) { rp.playing = false; drawRpBar(); return; }
    if (!(await rpWait(1500))) return;
    location.hash = `#/hole/${next}`;
  }

  m.on('load', () => {
    if (map !== m) return;
    m.resize(); place();
    m.addSource('outlines', { type: 'geojson', data: { type: 'FeatureCollection', features: holeFeatures(ch).map(f => ({
      type: 'Feature', properties: { color: LIE_COLOR[f.t] }, geometry: { type: 'MultiLineString', coordinates: (f.t === 'ob' ? obLines(f) : f.p).map(r => drawnRing(r, f.t).map(ll)) } })) } });
    m.addLayer({ id: 'outlines', type: 'line', source: 'outlines', layout: { visibility: showOutlines ? 'visible' : 'none', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 1.25, 'line-opacity': 0.7 } });
    if (watching) { try { holeSpotlight(); } catch { /* the hole still shows, just without the tint */ } }
    const addLine = (id, shadow, paint, layout = {}) => {
      m.addSource(id, { type: 'geojson', data: line([]) });
      m.addLayer({ id: id + '-shadow', type: 'line', source: id, paint: { 'line-color': '#000', 'line-width': shadow, 'line-opacity': 0.35 } });
      m.addLayer({ id, type: 'line', source: id, layout, paint });
    };
    addLine('shots', 5, { 'line-color': '#ffb020', 'line-width': 2.5 }, { 'line-cap': 'round' });
    addLine('shotspen', 4, { 'line-color': '#ffb020', 'line-width': 2.5, 'line-dasharray': [0.1, 2] }, { 'line-cap': 'round' });
    m.setPaintProperty('shotspen-shadow', 'line-dasharray', [0.1, 1.25]); m.setLayoutProperty('shotspen-shadow', 'line-cap', 'round'); // dotted shadow too
    m.addSource('sgt', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    m.addLayer({ id: 'sgt-shadow', type: 'line', source: 'sgt', paint: { 'line-color': '#000', 'line-width': 4.5, 'line-opacity': 0.35 } });
    m.addLayer({ id: 'sgt', type: 'line', source: 'sgt', paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-dasharray': [2, 1.2] } });
    styleReady = true; redrawElev();
    if (keepCam) m.jumpTo(keepCam);
    else if (stage() !== 'play' && !viewing()) zoomToGreen();
    update();
    // Auto on: this hole opens with its pick made (and shown).
    if (autoWanted() && !tourney && stage() === 'play' && !viewing() && !watching && !rp) runAuto();
    if (scouting && isAdmin && resumeEditAt(n)) editBoundaries(); // moved here with ‹ › while editing boundaries
    if (rp) {
      m.addSource('replay', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'replay-shadow', type: 'line', source: 'replay', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#000', 'line-width': 6, 'line-opacity': 0.35 }, layout: { 'line-cap': 'round' } });
      m.addLayer({ id: 'replay-line', type: 'line', source: 'replay', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#fff', 'line-width': 3 }, layout: { 'line-cap': 'round' } });
      m.addLayer({ id: 'replay-ball', type: 'circle', source: 'replay', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#111', 'circle-stroke-width': 1.5 } });
      holeEl().append(rpBar); holeEl().classList.add('replaying');
      runReplay();
    }
  });
  update();
  startGps();
}

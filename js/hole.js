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

import { h, course, TILE_URL, LIE_COLOR, teePosition, rememberTee } from './app.js';
import { store, sync } from './store.js';
import { lieAt, yards, inPolygon, boundsOf, distToLine, YD_PER_M } from './geo.js';
import { VERSION } from './version.js';
import { expected, LEVELS } from './sg.js';
import { newRound, analyzeHole, analyzeRound, CAT_LABEL, CATS } from './model.js';
import { currentRound, setCurrentRound, holeCountOf, roundKeyOf, submitRound, isScouting, endScouting } from './rounds.js';

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

export function closeHole() { if (map) { map.remove(); map = null; } }
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
function ownGreen(ch) {
  const greens = course.features.filter(f => f.t === 'green');
  return greens.find(g => inPolygon(ch.pin, g.p))
    || greens.reduce((best, g) => (!best || yards(centre(g.p[0]), ch.pin) < yards(centre(best.p[0]), ch.pin) ? g : best), null);
}
// Two boxes [[s, w], [n, e]] overlap (with `pad` degrees of slack).
const overlaps = (a, b, pad) => a[0][0] <= b[1][0] + pad && a[1][0] >= b[0][0] - pad && a[0][1] <= b[1][1] + pad && a[1][1] >= b[0][1] - pad;
// The OB area is a big box with the course cut out of it: only the cut-out —
// the course boundary — is drawn, as a single line.
const obLines = f => (f.p.length > 1 ? f.p.slice(1) : f.p);
function holeFeatures(ch) {
  const green = ownGreen(ch);
  return course.features.filter(f => {
    if (f.t === 'ob') return obLines(f).some(r => r.some(p => distToLine(p, ch.line) <= 150));
    if (f.t === 'bunker' || f.t === 'water' || f.t === 'recovery') return f.p[0].some(p => distToLine(p, ch.line) <= 70);
    if (f.t === 'green') return f === green; // not a neighbour's or a practice green
    const c = centre(f.p[0]);
    const own = distToLine(c, ch.line);
    return own <= 120 && course.holes.every(o => o === ch || distToLine(c, o.line) >= own);
  });
}

// Leave a past round that was opened from Round History.
function leaveView() { localStorage.removeItem('gs:viewOnly'); localStorage.removeItem('gs:editingPast'); setCurrentRound(null); }

export function renderHole(view, n) {
  // A finished (submitted) round always reopens in view mode, unless it's being edited.
  { const r0 = currentRound(); if (r0?.submitted && localStorage.getItem('gs:editingPast') !== '1') localStorage.setItem('gs:viewOnly', '1'); }
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
  const holeCount = holeCountOf(round0);
  const prevHole = n === 1 ? holeCount : n - 1, nextHole = n >= holeCount ? 1 : n + 1;
  const teeSet = course.tees.find(t => t.name === teeName) || course.tees[0];
  const fairways = course.features.filter(f => f.t === 'fairway').map(f => ({ p: f.p, box: boundsOf(f.p[0], 200) }));

  let tee = teePosition(teeName, ch);
  let pin = ch.pin; // replaced by the round's pin for this hole once it is placed
  let target = tee;
  const flag = (key, def) => (localStorage.getItem(key) ?? def) === '1';
  let showWidth = flag('gs:fairwayWidth', '0');
  let showArc = flag('gs:arc', '0');
  let arcYd = Math.min(80, Math.max(10, +localStorage.getItem('gs:arcYd') || 40));
  let showOutlines = flag('gs:outlines', '1');
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
  const holeNow = () => {
    if (scouting) return currentRound().holes[n] || { pin: null, done: false, shots: [] };
    const k = roundKey(); return (k && store.get(k).holes[n]) || { pin: null, done: false, shots: [] };
  };
  const shotsNow = () => holeNow().shots || [];
  function saveHole(patch) {
    if (scouting) {
      const r = currentRound();
      r.holes = { ...r.holes, [n]: { pin: null, done: false, shots: [], ...r.holes[n], ...patch } }; r.updated = Date.now();
      syncPin(); drawShots(); update();
      return;
    }
    let k = roundKey();
    if (!k) {
      const r = { ...newRound(course, teeName, today), courseName: course.name, player: sync.user ? sync.name : '', level, type: 'Casual', holeCount: 18 };
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
  const outlineBtn = toggle('outline', 'Lines', '⬭', 'Show bunker, fairway, water and green outlines', () => showOutlines, v => {
    showOutlines = v; localStorage.setItem('gs:outlines', v ? '1' : '0');
    if (m.getLayer('outlines')) m.setLayoutProperty('outlines', 'visibility', v ? 'visible' : 'none');
  });
  // Arc turns the arc on or off; while it's on, a small Adj button beside it
  // opens the width slider.
  let arcAdjOpen = false;
  // Arc and Appr are never on together: turning one on turns the other off.
  const setArcOn = v => { showArc = v; localStorage.setItem('gs:arc', v ? '1' : '0'); if (!v) arcAdjOpen = false; arcBtn?.classList.toggle('on', v); arcBtn?.setAttribute('aria-pressed', String(v)); };
  const setApprOn = v => { showAppr = v; localStorage.setItem('gs:appr', v ? '1' : '0'); if (!v) apprAdjOpen = false; apprBtn?.classList.toggle('on', v); apprBtn?.setAttribute('aria-pressed', String(v)); };
  // Disp: a dispersion oval at the crosshair (as wide as the arc) with 20 evenly
  // spread shots in it, scored for SG. Arc, Disp and Appr are never on together.
  let showDisp = flag('gs:disp', '0');
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
  let showAppr = flag('gs:appr', '0');
  let apprFt = Math.min(80, Math.max(10, +localStorage.getItem('gs:apprFt') || 40));
  let apprMode = localStorage.getItem('gs:apprMode') === 'sg' ? 'sg' : 'ft';
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
      h('div', { class: 'modes' }, mode('ft', 'Distance'), mode('sg', 'SG')),
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
  let showSgt = flag('gs:sgTarget', '0');
  const sgtBtn = toggle('sgt', 'SG', '⊙', 'Strokes-gained heat map for the drive', () => showSgt, v => { showSgt = v; localStorage.setItem('gs:sgTarget', v ? '1' : '0'); });
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
    if (!scouting) rememberTee(teeName, ch, tee);
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
  const viewing = () => localStorage.getItem('gs:viewOnly') === '1';
  // Re-render this hole keeping the current view (zoom, position, rotation).
  const rerenderHere = () => {
    const c = m.getCenter();
    sessionStorage.setItem('gs:cam', JSON.stringify({ center: [c.lng, c.lat], zoom: m.getZoom(), bearing: m.getBearing() }));
    renderHole(view, n);
  };
  const editBtn = h('button', { class: 'fab viewedit', hidden: !viewing(), onclick: () => {
    const r = currentRound();
    if (r) localStorage.setItem('gs:editSnap', JSON.stringify(r.holes || {})); // for Cancel
    localStorage.removeItem('gs:viewOnly'); localStorage.setItem('gs:editingPast', '1'); rerenderHere();
  } }, '✎ Edit');
  // Editing a past round: Save (beside Undo) goes back to view mode. Changes are
  // already stored as they're made; Save just finishes editing.
  const editingPast = () => localStorage.getItem('gs:editingPast') === '1' && !viewing();
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
      if (back && rest.length) { const { pen, obAt, penKind, ...p } = rest.at(-1); rest[rest.length - 1] = { ...p, ...(pen > back ? { pen: pen - back } : {}) }; }
      saveHole({ shots: rest.length > 1 ? rest : [], pin: rest.some(x => x.lie === 'green') ? hl.pin : null });
      if (stage() === 'play') place();
    } }, '↶');
  // Clubs: My Bag (shared with the coaching app) or a standard set. The club for
  // the next shot is chosen automatically — driver off the tee on par 4s and 5s,
  // otherwise the bag club whose yardage is closest to the ball-to-crosshair
  // distance — unless one was picked with the Club button.
  const DEFAULT_BAG = ['Dr', '3W', '5W', '4HY', '5I', '6I', '7I', '8I', '9I', 'PW', 'GW', 'SW', 'LW'].map(name => ({ name }));
  const bag = () => { const b = (sync.bag || []).filter(c => c && c.name); return b.length ? b : DEFAULT_BAG; };
  const SWINGS = [['full', 'Full'], ['3/4', '¾'], ['1/2', '½'], ['punch', 'Punch'], ['recovery', 'Recovery']];
  let pickedClub = null;
  function autoClub() {
    const shots = shotsNow(), from = shots.length ? shots[shots.length - 1].pos : tee;
    if (!shots.length && ch.par >= 4) return (bag().find(c => /^Dr/.test(c.name)) || bag()[0]).name;
    const d = yards(from, target);
    let best = null;
    for (const c of bag()) { const y = +(c.total || c.carry); if (y > 0 && (!best || Math.abs(y - d) < Math.abs(best.y - d))) best = { name: c.name, y }; }
    return best ? best.name : null;
  }
  const currentClub = () => pickedClub || autoClub();
  // A club's yardage from My Bag (total, else carry), or null.
  function bagYards(name) { const c = bag().find(x => x.name === name || (name === 'Dr' && /^Dr/.test(x.name))); const y = c && +(c.total || c.carry); return y > 0 ? y : null; }
  // Typical yardages, for Comp when My Bag has none for a club.
  const TYPICAL_YDS = { Dr: 230, '3W': 210, '5W': 195, '4HY': 185, '4I': 175, '5I': 165, '6I': 155, '7I': 145, '8I': 135, '9I': 125, PW: 115, GW: 100, SW: 85, LW: 70 };
  const compYards = name => bagYards(name) || TYPICAL_YDS[name] || TYPICAL_YDS[name.replace(/\d$/, '')] || null;
  // A club's arc width: its own from My Bag, else 15% of its yardage (10 to 80 yd).
  function clubArcW(name) {
    const own = (store.get('clubArcs') || {})[name], yd = compYards(name);
    return own > 0 ? own : yd ? Math.max(10, Math.min(80, Math.round(yd * 0.15))) : arcYd;
  }

  // Comp: 2-3 clubs on the one target line (ball to crosshair), each drawn as
  // an arc at its bag yardage and its own arc width, with the average strokes
  // gained over the spots the arc covers (scored from the lie at each spot).
  const COMP_COLORS = ['#f472b6', '#4dd0ff', '#a3e635'];
  let compClubs = [];
  try { compClubs = JSON.parse(localStorage.getItem('gs:compClubs') || '[]').filter(x => typeof x === 'string').slice(0, 3); } catch { /* none */ }
  let showComp = flag('gs:comp', '0') && compClubs.length >= 2;
  const compSheet = h('div', { class: 'clubsheet', hidden: true, onclick: e => { if (e.target === compSheet) compSheet.hidden = true; } });
  const saveComp = () => { localStorage.setItem('gs:comp', showComp ? '1' : '0'); localStorage.setItem('gs:compClubs', JSON.stringify(compClubs)); };
  function openCompPicker() {
    let sel = compClubs.filter(c => compYards(c));
    const draw = () => compSheet.replaceChildren(h('div', { class: 'clubbox' },
      h('div', { class: 'clubhead' }, h('strong', {}, 'Compare · pick 2–3 clubs'), h('button', { class: 'x', onclick: () => { compSheet.hidden = true; } }, '✕')),
      h('div', { class: 'clubgrid' }, bag().map(c => {
        const i = sel.indexOf(c.name), yd = compYards(c.name);
        return h('button', { class: i >= 0 ? 'on comp' : '', style: i >= 0 ? `background:${COMP_COLORS[i]}` : '', disabled: !yd,
          onclick: () => { sel = i >= 0 ? sel.filter(x => x !== c.name) : [...sel, c.name].slice(-3); draw(); } },
          h('b', {}, clubShort(c.name)), h('small', {}, yd ? `${yd} yds` : 'no yds'));
      })),
      h('div', { class: 'compactions' },
        h('button', { class: 'off', onclick: () => { showComp = false; saveComp(); compSheet.hidden = true; update(); } }, 'Off'),
        h('button', { class: 'record', disabled: sel.length < 2, onclick: () => { compClubs = sel; showComp = true; compAim = {}; saveComp();
          if (showArc) setArcOn(false); if (showDisp) setDispOn(false); /* only the Comp arcs */ compSheet.hidden = true; update(); } }, 'Compare'))));
    draw();
    compSheet.hidden = false;
  }
  // Next to Comp while it's on: show the clubs as arcs or as dispersion dots.
  let compMode = localStorage.getItem('gs:compMode') === 'disp' ? 'disp' : 'arc';
  const compModeBtn = h('button', { class: 'fab arcadj compmode', 'aria-label': 'Arcs or dispersion', title: 'Show the compared clubs as arcs or dispersion dots', hidden: true,
    onclick: () => { compMode = compMode === 'arc' ? 'disp' : 'arc'; localStorage.setItem('gs:compMode', compMode); update(); } }, h('span', {}, ''), h('small', {}, ''));
  const compBtn = h('button', { class: 'fab comp', 'aria-label': 'Compare clubs', title: 'Compare 2-3 clubs on one line', onclick: openCompPicker }, h('span', {}, '⫶'), h('small', {}, 'Comp'));
  const compLegend = h('div', { class: 'zonelegend compkey', hidden: true });
  // View: a clean look at the hole — no crosshair or its yardages, no aiming
  // line, arc, width or approach circle, no shot tracer or shot dots. Comp arcs
  // and their dots stay, to compare the clubs.
  let cleanView = false;
  // Auto: finds the best club and aiming point for the next shot. Every club
  // (with a yardage) is tried along lines up to 35° either side of the pin, each
  // scored by the average SG of 20 shots in its dispersion, keeping the dots clear
  // of hazards where it can (15 yd from OB, 10 from water, 5 from bunkers); the best is picked,
  // the crosshair moves to it and Disp shows its spread. Clubs that would fly
  // well past the pin are skipped.
  let autoPick = null; // { club, sg, from } while on
  const autoKey = h('div', { class: 'zonelegend autokey', hidden: true });
  function findBest() {
    const shots = shotsNow(), last = shots[shots.length - 1], from = last ? last.pos : tee;
    const toPinYd = yards(from, pin);
    const fromExp = last ? expectedFrom(last.lie, toPinYd) : expected('tee', toPinYd, level);
    const box = boundsOf([from, pin], 350);
    const feats = course.features.map(f => ({ ...f, box: boundsOf(f.p[0]) })).filter(f => overlaps(f.box, box, 0));
    const lieHere = q => lieOn(q, feats.filter(f => q[0] >= f.box[0][0] && q[0] <= f.box[1][0] && q[1] >= f.box[0][1] && q[1] <= f.box[1][1]));
    const main = bearing(from, pin), k = Math.cos((from[0] * Math.PI) / 180);
    // Hazards (water, OB, bunkers) and how close a dot is to one, in metres.
    // Clearance wanted from each kind of hazard (yd -> m), and what a dot inside it costs.
    const CUSHION = { ob: 15 / YD_PER_M, water: 10 / YD_PER_M, bunker: 5 / YD_PER_M };
    const COST = { ob: 1.2, water: 0.8, bunker: 0.4 };
    const padDeg = CUSHION.ob / M_PER_DEG * 1.5;
    const hz = feats.filter(f => f.t === 'water' || f.t === 'ob' || f.t === 'bunker');
    const segDist = (q, a, b) => {
      const ax = (a[1] - q[1]) * k * M_PER_DEG, ay = (a[0] - q[0]) * M_PER_DEG, bx = (b[1] - q[1]) * k * M_PER_DEG, by = (b[0] - q[0]) * M_PER_DEG;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      return Math.hypot(ax + t * dx, ay + t * dy);
    };
    // The cost of the worst hazard a dot is in or too close to (0 when clear).
    const hazardCost = q => hz.reduce((worst, f) => {
      if (COST[f.t] <= worst) return worst;
      if (q[0] < f.box[0][0] - padDeg || q[0] > f.box[1][0] + padDeg || q[1] < f.box[0][1] - padDeg / k || q[1] > f.box[1][1] + padDeg / k) return worst;
      const near = inPolygon(q, f.p) || f.p.some(r => r.some((a, i) => i && segDist(q, r[i - 1], a) < CUSHION[f.t]));
      return near ? COST[f.t] : worst;
    }, 0);
    const results = [];
    for (const c of bag()) {
      const yd = compYards(c.name);
      if (!yd || /putt/i.test(c.name) || yd > toPinYd + 15) continue;
      const w = clubArcW(c.name);
      let best = null;
      for (let off = -35; off <= 35; off += 2.5) {
        const brg = ((main + off) * Math.PI) / 180, dm = yd / YD_PER_M;
        const aim = [from[0] + (dm * Math.cos(brg)) / M_PER_DEG, from[1] + (dm * Math.sin(brg)) / (M_PER_DEG * k)];
        const d = dispersion(from, aim, w, fromExp, lieHere);
        // Keep every dot 5 yd clear of hazards: each one closer costs the line, so
        // the pick skews away from them. A tiny nudge favours straighter lines on ties.
        const close = d.dots.reduce((t, x) => t + hazardCost(x.q), 0);
        const score = d.sg - close / d.dots.length - Math.abs(off) * 0.0005;
        if (!best || score > best.score) best = { club: c.name, yd, aim, off, sg: d.sg, score, close };
      }
      if (best) results.push(best);
    }
    return { from, results: results.sort((a, b) => b.score - a.score) };
  }
  const autoBtn = h('button', { class: 'fab autotarget', 'aria-label': 'Auto target', title: 'Pick the best club and aiming point', onclick: () => {
    if (autoPick) { autoPick = null; autoBtn.classList.remove('on'); autoKey.hidden = true; pickedClub = null; if (showDisp) setDispOn(false); update(); return; }
    const { from, results } = findBest();
    if (!results.length) return;
    const b = results[0];
    autoPick = { ...b, from: from.join(',') };
    autoBtn.classList.add('on');
    pickedClub = b.club;
    if (showComp) { showComp = false; saveComp(); }
    if (!showDisp) { setDispOn(true); onlyOne('disp'); }
    autoKey.replaceChildren(h('small', {}, 'Auto · best clubs (avg SG)'), ...results.slice(0, 4).map((r, i) => h('span', { class: i ? '' : 'best' },
      `${clubShort(r.club)} ${r.yd}y · ${Math.abs(r.off) < 1 ? 'at pin' : `${Math.round(Math.abs(r.off))}° ${r.off < 0 ? 'L' : 'R'}`} · `,
      h('b', { class: r.sg >= 0 ? 'pos' : 'neg' }, `${r.sg >= 0 ? '+' : '−'}${Math.abs(r.sg).toFixed(2)}`))));
    autoKey.hidden = false;
    m.easeTo({ center: ll(b.aim), duration: 500 });
    update();
  } }, h('span', {}, '✦'), h('small', {}, 'Auto'));
  const viewBtn = toggle('cleanview', 'View', '◉', 'Hide the aiming line and shot tracer', () => cleanView, v => {
    cleanView = v;
    for (const id of ['shots', 'shots-shadow']) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', v ? 'none' : 'visible');
    holeEl()?.classList.toggle('clean', v);
  });
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
      const shots = shotsNow(), from = shots.length ? shots[shots.length - 1].pos : tee;
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
    const shots = shotsNow(), from = shots.length ? shots[shots.length - 1].pos : tee;
    const brg = (bearing(from, yards(from, target) > 5 ? target : pin) * Math.PI) / 180, k = Math.cos((from[0] * Math.PI) / 180), dm = yd / YD_PER_M;
    m.easeTo({ center: ll([from[0] + (dm * Math.cos(brg)) / M_PER_DEG, from[1] + (dm * Math.sin(brg)) / (M_PER_DEG * k)]), duration: 450 });
  }
  const clubPicker = h('div', { class: 'clubsheet', hidden: true, onclick: e => { if (e.target === clubPicker) clubPicker.hidden = true; } });
  function openClubPicker() {
    const cur = currentClub();
    clubPicker.replaceChildren(h('div', { class: 'clubbox' },
      h('div', { class: 'clubhead' }, h('strong', {}, 'Club'), h('button', { class: 'x', onclick: () => { clubPicker.hidden = true; } }, '✕')),
      h('div', { class: 'clubgrid' },
        h('button', { class: pickedClub ? '' : 'on', onclick: () => { pickedClub = null; clubPicker.hidden = true; update(); } }, h('b', {}, 'Auto'), h('small', {}, autoClub() ? clubName(autoClub()) : '–')),
        bag().map(c => h('button', { class: pickedClub === c.name ? 'on' : '', onclick: () => {
          pickedClub = c.name; clubPicker.hidden = true;
          const y = bagYards(c.name); if (y) snapTo(y); // the crosshair jumps to that club's distance
          update();
        } },
          h('b', {}, clubShort(c.name)), h('small', {}, c.total || c.carry ? `${c.total || c.carry} yds` : ''))))));
    clubPicker.hidden = false;
    void cur;
  }
  const clubBtn = h('button', { class: 'fab club', 'aria-label': 'Club', title: 'Club for the next shot', onclick: openClubPicker }, h('span', {}, ''), h('small', {}, 'Club'));

  // Recording a shot: + asks which club and swing was used (putts use the putter).
  function recordShot(club, swing) {
    const s = shotsNow();
    const shots = s.length ? [...s] : [{ pos: tee, lie: 'tee' }];
    shots[shots.length - 1] = { ...shots[shots.length - 1], ...(club ? { club } : {}), ...(swing && swing !== 'full' ? { swing } : {}) };
    const lie = stage() === 'putt' ? 'green' : lieOn(target, course.features);
    if (lie === 'ob' || lie === 'water') { pickedClub = null; return openPenalty(shots, lie, target); }
    const shot = { pos: target, lie };
    if (lie === 'green' && holeNow().pin) shot.ft = Math.max(1, Math.round(yards(target, pin) * FT_PER_YD));
    shots.push(shot);
    const wasPlaying = stage() === 'play';
    pickedClub = null;
    saveShots(shots);
    if (wasPlaying && lie === 'green') zoomToGreen();
  }
  // Penalty: a shot into water or out of bounds asks how the player carried on.
  //  Re-hit from where it was played (stroke and distance): 1 penalty stroke.
  //  Drop: 1 penalty stroke for water, 2 for out of bounds (the local rule), then
  //  the crosshair is moved to where the ball was dropped and Set drop records it.
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
    const charge = n => [...shots.slice(0, -1), { ...prev, pen: (prev.pen || 0) + n, obAt: at, penKind: kind }];
    const opt = (label, sub, fn) => h('button', { class: 'penopt', onclick: () => { penaltySheet.hidden = true; fn(); } }, h('b', {}, label), h('small', {}, sub));
    penaltySheet.replaceChildren(h('div', { class: 'clubbox' },
      h('div', { class: 'clubhead' }, h('strong', {}, water ? 'In the water' : 'Out of bounds'), h('button', { class: 'x', onclick: () => { penaltySheet.hidden = true; } }, '✕')),
      h('div', { class: 'penopts' },
        opt(prev.lie === 'tee' ? 'Re-tee' : 'Replay', '+1 stroke · hit again from the same spot', () => saveShots([...charge(1), { pos: prev.pos, lie: prev.lie, replay: true, penalty: 1 }])),
        opt('Drop', `+${water ? 1 : 2} stroke${water ? '' : 's'} · move the crosshair to the drop, then Set drop`, () => {
          const n = water ? 1 : 2;
          dropping = { shots: charge(n), n };
          setDropBtn.textContent = `Set drop (+${n})`; setDropBtn.hidden = false; holeEl()?.classList.add('dropping');
          update();
        }))));
    penaltySheet.hidden = false;
  }
  const shotConfirm = h('div', { class: 'clubsheet', hidden: true, onclick: e => { if (e.target === shotConfirm) shotConfirm.hidden = true; } });
  function openShotConfirm() {
    const shots = shotsNow(), from = shots.length ? shots[shots.length - 1].pos : tee;
    let club = currentClub(), swing = 'full';
    const draw = () => shotConfirm.replaceChildren(h('div', { class: 'clubbox' },
      h('div', { class: 'clubhead' }, h('strong', {}, `Shot ${shots.length ? strokeNo(shots, shots.length - 1) : 1} · ${Math.round(yards(from, target))} yds`), h('button', { class: 'x', onclick: () => { shotConfirm.hidden = true; } }, '✕')),
      h('small', { class: 'muted' }, club ? `Club: ${clubName(club)}` : 'Which club did you hit?'),
      h('div', { class: 'clubgrid' }, bag().map(c => h('button', { class: club === c.name ? 'on' : '', onclick: () => { club = c.name; draw(); } },
        h('b', {}, clubShort(c.name)), h('small', {}, c.total || c.carry ? `${c.total || c.carry}` : '')))),
      h('div', { class: 'swings' }, SWINGS.map(([k, label]) => h('button', { class: swing === k ? 'on' : '', onclick: () => { swing = k; draw(); } }, label))),
      h('button', { class: 'record', onclick: () => { shotConfirm.hidden = true; recordShot(club, swing); } }, 'Record shot')));
    draw();
    shotConfirm.hidden = false;
  }
  const addBtn = h('button', { class: 'fab add', 'aria-label': 'Record shot here', title: 'Record shot at the crosshair',
    onclick: () => { if (stage() === 'putt') recordShot('Putter'); else openShotConfirm(); } }, '+');
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
  const expPill = h('div', { class: 'exppill' },
    h('div', {}, h('small', {}, 'Expected'), expValue),
    h('select', { 'aria-label': 'Handicap level', onchange: e => { level = e.target.value; sessionStorage.setItem('gs:level', level); update(); } },
      LEVELS.map(l => h('option', { value: l, selected: l === level }, levelName(l)))));

  const credit = h('small', { class: 'muted credit' }, 'Imagery © Esri, Maxar · Outlines © OpenStreetMap contributors');
  // Viewing a past round: just Back to Round History and Home.
  const menu = scouting
    ? h('div', { class: 'sheet', hidden: true },
      h('label', {}, 'Tees ', h('select', { onchange: e => { store.set('settings', { ...(store.get('settings') || {}), tee: e.target.value }); renderHole(view, n); } },
        course.tees.map(t => h('option', { value: t.name, selected: t.name === teeName }, `${t.name} · ${t.yards.reduce((a, b) => a + b, 0)} yd`)))),
      h('button', { class: 'btn', onclick: () => { endScouting(); location.hash = '#/'; } }, 'Home'),
      h('small', { class: 'muted' }, 'GPS Scouting · nothing is saved'),
      credit)
    : viewing()
    ? h('div', { class: 'sheet', hidden: true },
      h('button', { class: 'btn', onclick: () => { leaveView(); location.hash = '#/history'; } }, 'Back to Round History'),
      h('button', { class: 'btn', onclick: () => { leaveView(); location.hash = '#/'; } }, 'Home'),
      credit)
    : h('div', { class: 'sheet', hidden: true },
      h('label', {}, 'Tees ', h('select', { onchange: e => { store.set('settings', { ...(store.get('settings') || {}), tee: e.target.value }); const r = currentRound(); if (r) store.set(roundKeyOf(r.id), { ...r, tee: e.target.value, updated: Date.now() }); renderHole(view, n); } },
        course.tees.map(t => h('option', { value: t.name, selected: t.name === teeName }, `${t.name} · ${t.yards.reduce((a, b) => a + b, 0)} yd`)))),
      h('button', { class: 'btn', onclick: () => { menu.hidden = true; if (currentRound()) leave.hidden = false; else location.hash = '#/'; } }, 'Home'),
      currentRound() ? h('a', { class: 'btn', href: `#/round/${currentRound().id}/edit` }, 'Round info') : null,
      h('a', { class: 'btn', href: '#/course' }, 'Edit course outlines'),
      h('a', { class: 'btn', href: '#/settings' }, 'Settings'),
      credit);

  // Strokes Gained panel while viewing a past round (filled in by drawSgView).
  const sgView = h('div', { class: 'sgview', hidden: true });
  const sgViewBtn = h('button', { class: 'fab sgviewbtn', hidden: true, 'aria-label': 'Strokes gained', title: 'Strokes gained',
    onclick: () => { sgView.hidden = !sgView.hidden; sgViewBtn.classList.toggle('on', !sgView.hidden); drawSgView(); } }, h('span', {}, 'Strokes'), h('span', {}, 'Gained'));
  // Score chips and scorecard (filled in by drawScoreChips / openScorecard below).
  const totalChip = h('button', { class: 'scorechip total', onclick: () => openScorecard() });
  const holeChip = h('button', { class: 'scorechip hole', onclick: () => openScorecard() });
  const chips = h('div', { class: 'chips', hidden: true }, totalChip, holeChip);
  const scorecard = h('div', { class: 'scorecard', hidden: true, onclick: e => { if (e.target === scorecard) scorecard.hidden = true; } });
  const compass = h('button', { class: 'compass', 'aria-label': 'Compass: tap to straighten the view', title: 'Tap to straighten the view' });
  compass.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><polygon points="16,3 20,16 12,16" fill="#ff4d4d"/><polygon points="16,29 20,16 12,16" fill="#fff"/><text x="16" y="11.5" text-anchor="middle" font-size="6.5" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">N</text></svg>';

  // Leaving a round from the menu's Home button.
  const leaveTo = (hash, fn) => () => { const r = currentRound(); if (r) fn(r); setCurrentRound(null); localStorage.removeItem('gs:viewOnly'); localStorage.removeItem('gs:editingPast'); location.hash = hash; };
  const leave = h('div', { class: 'leave', hidden: true, onclick: e => { if (e.target === leave) leave.hidden = true; } },
    h('div', { class: 'leavebox' },
      h('strong', {}, 'Leave this round?'),
      h('button', { class: 'pause', onclick: leaveTo('#/', () => {}) }, 'Pause and save round'),
      h('button', { class: 'submit', onclick: leaveTo('#/history', r => submitRound(r.id)) }, 'End and submit round'),
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

  view.replaceChildren(h('div', { class: 'holeview' }, mapEl,
    h('div', { class: 'vertag' + (scouting ? ' scouting' : '') }, scouting ? 'GPS Scouting' : `v${VERSION}`), compass, chips, h('div', { class: 'topright' }, sgViewBtn, expPill), scorecard,
    h('div', { class: 'crosshair' }), toPinEl, fromTeeEl,
    h('button', { class: 'fab menu', 'aria-label': 'Menu', onclick: () => { menu.hidden = !menu.hidden; } }, '☰'),
    addBtn, holedBtn, setPinBtn, undoBtn, editBtn, saveBtn, cancelBtn, shotList, sgView, outlineBtn, teeBtn, pinBtn, setTeeBtn, setPinHereBtn, setDropBtn, penaltySheet, clubBtn, compBtn, autoBtn, viewBtn, sgtBtn, compModeBtn, apprBtn, apprAdjBtn, dispBtn, dispAdjBtn, arcBtn, arcAdjBtn, widthBtn, clubPicker, shotConfirm, compSheet, slidersEl, banner, menu, leave, compDots, h('div', { class: 'keys' }, zoneLegend, ringLegend, compLegend, autoKey),
    h('div', { class: 'holepill' },
      h('a', { href: `#/hole/${prevHole}`, 'aria-label': 'Previous hole' }, '‹'),
      h('div', {}, pillSmall, pillStrong),
      h('a', { href: `#/hole/${nextHole}`, 'aria-label': 'Next hole' }, '›'))));

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
      const onRoute = pointAlong(route(), bagYards('Dr') || sync.avgDrive || evenDrive());
      const w = fairwayWidth(tee, onRoute, fairways, 40);
      focus = w ? w.arc((w.l + w.r) / 2) : onRoute;
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
  const trace = shots => [...shots.flatMap(x => (x.obAt ? [x.pos, x.obAt] : [x.pos])), ...(holeNow().done && shots.length ? [pin] : [])];

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
  const SHORT_LIE = { tee: 'tee', fairway: 'fwy', rough: 'rough', bunker: 'bunker', green: 'green', water: 'water', recovery: 'trees' };
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
    const hp = hl.pin || pin, isPutt = s.lie === 'green', travel = yards(s.pos, next ? next.pos : hp);
    const went = isPutt ? `${Math.round(travel * FT_PER_YD)} ft` : `${Math.round(travel)} yds`;
    const club = s.club ? clubName(s.club) + (s.swing ? ` (${SWING_NAME[s.swing] || s.swing})` : '') : isPutt ? 'Putter' : 'Hit';
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
  // Totals for the whole round, and to par through this hole (holes 1..n), so
  // stepping through a round shows the running score hole by hole.
  function roundTotals() {
    const r = currentRound();
    let strokes = 0, par = 0, thruPar = 0, thruStrokes = 0, thru = 0;
    for (const o of course.holes) {
      const hh = r?.holes?.[o.n];
      if (!hh?.done) continue;
      strokes += strokesOf(hh); par += o.par;
      if (o.n <= n) { thruStrokes += strokesOf(hh); thruPar += o.par; thru++; }
    }
    return { r, strokes, toPar: strokes - par, thru, thruToPar: thruStrokes - thruPar };
  }
  let chipKey = null;
  function drawScoreChips() {
    const { r, strokes, toPar: tp, thru, thruToPar } = roundTotals();
    const show = !!r;
    const key = show ? [strokes, tp, thru, thruToPar, r.holes?.[n]?.done ? strokesOf(r.holes[n]) : '-'].join('|') : 'none';
    if (key === chipKey) return;
    chipKey = key;
    chips.hidden = !show;
    holeEl()?.classList.toggle('haschips', show);
    if (!show) return;
    totalChip.replaceChildren(h('small', {}, 'Total'), h('strong', {}, strokes ? `${strokes}` : '–', h('em', {}, strokes ? ` (${toPar(tp)})` : '')));
    const hh = r.holes?.[n];
    holeChip.replaceChildren(h('small', {}, `Hole ${n}`),
      h('strong', {}, hh?.done ? String(strokesOf(hh)) : '–', h('em', {}, hh?.done ? ` (${toPar(strokesOf(hh) - ch.par)})` : '')),
      h('em', {}, thru ? `${toPar(thruToPar)} thru ${thru}` : 'not started'));
  }
  function openScorecard() {
    const { r, strokes, toPar: tp } = roundTotals();
    if (!r) return;
    const count = holeCountOf(r), nines = count > 9 ? [[1, 9], [10, count]] : [[1, count]];
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
      const sg = sgFinish(fromExp, lieHere(q), yards(q, pin));
      tot += sg; dots.push({ q, sg });
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
    const shots = shotsNow(), last = shots[shots.length - 1], st = stage();
    const from = last ? last.pos : tee;
    const onGreen = st !== 'play';
    const w = showWidth && !onGreen ? fairwayWidth(from, target, fairways) : null;
    const fromTee = yards(from, target), toPin = yards(target, pin);
    undoBtn.hidden = !shots.length && !holeNow().done;
    addBtn.hidden = st === 'pin' || st === 'done' || !!dropping;
    holedBtn.hidden = st !== 'putt';
    widthBtn.hidden = arcBtn.hidden = apprBtn.hidden = onGreen;
    clubBtn.hidden = onGreen || viewing();
    if (!clubBtn.hidden) { const c = currentClub(); clubBtn.firstChild.textContent = c ? clubShort(c) : '–'; clubBtn.classList.toggle('on', !!pickedClub); }
    compBtn.hidden = onGreen || viewing();
    autoBtn.hidden = onGreen || viewing();
    if (autoBtn.hidden) autoKey.hidden = true;
    compBtn.classList.toggle('on', showComp);
    compModeBtn.hidden = compBtn.hidden || !showComp;
    compModeBtn.firstChild.textContent = compMode === 'arc' ? '◠' : '⁘'; compModeBtn.lastChild.textContent = compMode === 'arc' ? 'Arc' : 'Disp';
    if (compBtn.hidden) compLegend.hidden = true;
    sgtBtn.hidden = onGreen || shots.length > 0; // SG is the drive heat map, from the tee only
    arcSlider.hidden = !(showArc || showDisp) || onGreen || !arcAdjOpen;
    dispBtn.hidden = onGreen;
    dispAdjBtn.hidden = !showDisp || onGreen;
    dispAdjBtn.classList.toggle('on', arcAdjOpen);
    arcAdjBtn.hidden = !showArc || onGreen;
    arcAdjBtn.classList.toggle('on', arcAdjOpen);
    apprSlider.hidden = !showAppr || onGreen || !apprAdjOpen;
    apprAdjBtn.hidden = !showAppr || onGreen;
    apprAdjBtn.classList.toggle('on', apprAdjOpen);
    slidersEl.classList.toggle('high', !apprSlider.hidden); // clear of the Appr Adj button
    setPinBtn.hidden = st !== 'pin';
    banner.hidden = true; // replaced by the score chips at the top
    teeBtn.hidden = onGreen;
    pinBtn.hidden = st === 'pin' || st === 'done';
    sgViewBtn.hidden = !viewing();
    holeEl()?.classList.toggle('viewing', viewing()); // hides the crosshair and its readouts
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
      set('shots', line(trace(shots)));
      setRings([]); showZones(false); compDots.replaceChildren(); compLegend.hidden = true; drawDispDots([]);
      return;
    }
    if (moving === 'tee') { // the crosshair is the tee: show how far it is to the aim spot
      toPinEl.replaceChildren(h('b', {}, `${Math.round(yards(tee, aim))} yd`), h('span', { class: 'note' }, 'to aim spot'));
      fromTeeEl.replaceChildren(h('span', { class: 'note' }, 'Move the tee, then Set tee'));
    } else {
    toPinEl.replaceChildren(h('b', {}, `${Math.round(toPin)} yd`));
    fromTeeEl.replaceChildren(h('b', {}, `${Math.round(fromTee)} yd`),
      h('span', { class: 'sg ' + (sg >= 0 ? 'gain' : 'loss') }, `${sg >= 0 ? '+' : '−'}${Math.abs(sg).toFixed(2)} (${LIE_TAG[lie]})`),
      h('span', { class: 'wide', hidden: !showWidth }, w ? `${Math.round(w.yards)} yd wide` : 'No fairway here'));
    }

    const arc = showArc ? arcThrough(from, target) : null;
    let arcW = arcYd;
    if (autoPick && autoPick.from !== from.join(',')) { autoPick = null; autoBtn.classList.remove('on'); autoKey.hidden = true; } // a new shot
    if (autoPick) arcW = clubArcW(autoPick.club); // Disp shows the picked club's spread
    if (arcAuto) {
      // Sized by club only, so it changes when a club is tapped, not as the
      // crosshair moves: the tapped club (or the driver off a par 4/5 tee), with
      // its arc from My Bag, else 15% of its bag yardage; otherwise the slider width.
      const club = (autoPick && autoPick.club) || pickedClub || (!shots.length && ch.par >= 4 ? (bag().find(c => /^Dr/.test(c.name)) || {}).name : null);
      if (club && ((store.get('clubArcs') || {})[club] > 0 || bagYards(club))) arcW = clubArcW(club);
      arcValue.textContent = `Auto · ${arcW} yd`; arcRange.value = arcW;
    }
    const half = arcW / 2 / YD_PER_M;
    const set = (id, data) => { const src = m.getSource(id); if (src) src.setData(data); };
    const lines = { path: [from, target, pin] };
    set('shots', line(trace(shots)));
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
    overlay(viewing() ? {} : lines); // no aiming lines while just viewing
    // SG: the drive heat map, from the tee only.
    showZones(showSgt && !shots.length);
    // Appr in SG mode: the ring around the pin for the chosen SG value.
    const rings = [];
    if (showAppr && apprMode === 'sg') rings.push({ v: sgCfg.rings.value, ft: sgFeet(last ? last.lie : 'tee', yards(from, pin), sgCfg.rings.value) });
    setRings(cleanView ? [] : rings);
  }

  const dragMarker = (el, pos, onMove) => {
    // Locked while viewing a past round; draggable again after Edit.
    const mk = new maplibregl.Marker({ element: el, draggable: !viewing() }).setLngLat(ll(pos)).addTo(m);
    mk.on('drag', () => { const p = mk.getLngLat(); onMove([p.lat, p.lng], false); });
    mk.on('dragend', () => { const p = mk.getLngLat(); onMove([p.lat, p.lng], true); });
    return mk;
  };
  const teeMark = dragMarker(h('div', { class: 'teemark', title: 'Tee (drag to move)' }), tee, (p, done) => { tee = p; if (done && !scouting) rememberTee(teeName, ch, p); update(); });
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
    const el = h('div', { class: 'shotpop' },
      h('strong', {}, shotTitle(hl, i)),
      ...shotLineEls(hl, i, isPutt ? `${Math.round(travel * 3)} ft` : `${Math.round(travel)} yd`),
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
    shotMarks = shots.slice(1).map((s, i) => { const at = shots[i].obAt || s.pos; return new maplibregl.Marker({ element: tappable(h('div', { class: 'shotmark' }, String(strokeNo(shots, i))), i, at) }).setLngLat(ll(at)).addTo(m); }); // a penalty shot's dot is where it went in
    // Once holed, the number of the stroke that went in sits just above the hole.
    if (holeNow().done && shots.length) {
      shotMarks.push(new maplibregl.Marker({ element: tappable(h('div', { class: 'shotmark holedmark', title: 'Holed' }, String(strokeNo(shots, shots.length - 1))), shots.length - 1, pin), anchor: 'bottom', offset: [0, -9] }).setLngLat(ll(pin)).addTo(m));
    }
  }
  drawShots();

  m.on('move', update);
  // The browser's toolbars showing or hiding changes the screen height: keep the
  // map's pivot on the crosshair and refresh the readout.
  m.on('resize', () => { m.setPadding({ top: 0, left: 0, right: 0, bottom: mapEl.clientHeight * (1 - 2 * CROSSHAIR_Y) }); update(); });
  m.on('click', () => { menu.hidden = true; });

  m.on('load', () => {
    if (map !== m) return;
    m.resize(); place();
    m.addSource('outlines', { type: 'geojson', data: { type: 'FeatureCollection', features: holeFeatures(ch).map(f => ({
      type: 'Feature', properties: { color: LIE_COLOR[f.t] }, geometry: { type: 'MultiLineString', coordinates: (f.t === 'ob' ? obLines(f) : f.p).map(r => r.map(ll)) } })) } });
    m.addLayer({ id: 'outlines', type: 'line', source: 'outlines', layout: { visibility: showOutlines ? 'visible' : 'none' }, paint: { 'line-color': ['get', 'color'], 'line-width': 1.25, 'line-opacity': 0.7 } });
    const addLine = (id, shadow, paint, layout = {}) => {
      m.addSource(id, { type: 'geojson', data: line([]) });
      m.addLayer({ id: id + '-shadow', type: 'line', source: id, paint: { 'line-color': '#000', 'line-width': shadow, 'line-opacity': 0.35 } });
      m.addLayer({ id, type: 'line', source: id, layout, paint });
    };
    addLine('shots', 5, { 'line-color': '#ffb020', 'line-width': 2.5 }, { 'line-cap': 'round' });
    m.addSource('sgt', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    m.addLayer({ id: 'sgt-shadow', type: 'line', source: 'sgt', paint: { 'line-color': '#000', 'line-width': 4.5, 'line-opacity': 0.35 } });
    m.addLayer({ id: 'sgt', type: 'line', source: 'sgt', paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-dasharray': [2, 1.2] } });
    if (keepCam) m.jumpTo(keepCam);
    else if (stage() !== 'play' && !viewing()) zoomToGreen();
    update();
  });
  update();
}

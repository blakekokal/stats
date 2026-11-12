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
import { store } from './store.js';
import { lieAt, yards, inPolygon, boundsOf, distToLine, YD_PER_M } from './geo.js';
import { VERSION } from './version.js';
import { expected, LEVELS } from './sg.js';
import { newRound } from './model.js';

const maplibregl = window.maplibregl;
const LIE_TAG = { tee: 'TEE', fairway: 'FWY', rough: 'RGH', bunker: 'BNK', green: 'GRN', water: 'WTR' };
const levelName = l => (l === 'Pro' || l === 'Scratch' ? l : `${l} hcp`);
const ll = p => [p[1], p[0]]; // [lat, lng] -> MapLibre's [lng, lat]
const M_PER_DEG = 111320;
const CROSSHAIR_Y = 1 / 3; // fraction of the screen height, from the top

let map = null;

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
function holeFeatures(ch) {
  const green = ownGreen(ch);
  return course.features.filter(f => {
    if (f.t === 'bunker' || f.t === 'water') return f.p[0].some(p => distToLine(p, ch.line) <= 70);
    if (f.t === 'green') return f === green; // not a neighbour's or a practice green
    const c = centre(f.p[0]);
    const own = distToLine(c, ch.line);
    return own <= 120 && course.holes.every(o => o === ch || distToLine(c, o.line) >= own);
  });
}

export function renderHole(view, n) {
  closeHole();
  sessionStorage.setItem('hole', n);
  const ch = course.holes[n - 1];
  const settings = store.get('settings') || {};
  const teeName = settings.tee || 'Blue';
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
  let level = LEVELS.includes(localStorage.getItem('gs:level')) ? localStorage.getItem('gs:level') : 'Scratch';

  // Shots go in today's round: hole.shots is a list of where each stroke was
  // played from, starting at the tee.
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const roundKey = () => {
    const r = store.list('round:').find(x => x.date === today && x.course === course.id);
    return r ? 'round:' + r.id : null;
  };
  const holeNow = () => { const k = roundKey(); return (k && store.get(k).holes[n]) || { pin: null, done: false, shots: [] }; };
  const shotsNow = () => holeNow().shots || [];
  function saveHole(patch) {
    let k = roundKey();
    if (!k) { const r = newRound(course, teeName, today); k = 'round:' + r.id; store.set(k, r); }
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
  const arcValue = h('b', {}, `${arcYd} yd`);
  const arcSlider = h('div', { class: 'arcslider', hidden: !showArc },
    h('span', {}, 'Arc'),
    h('input', { type: 'range', min: 10, max: 80, step: 1, value: arcYd, 'aria-label': 'Arc width in yards',
      oninput: e => { arcYd = +e.target.value; arcValue.textContent = `${arcYd} yd`; localStorage.setItem('gs:arcYd', arcYd); update(); } }),
    arcValue);
  const widthBtn = toggle('width', 'Width', '↔', 'Fairway width at the crosshair', () => showWidth, v => { showWidth = v; localStorage.setItem('gs:fairwayWidth', v ? '1' : '0'); });
  const outlineBtn = toggle('outline', 'Lines', '⬭', 'Show bunker, fairway, water and green outlines', () => showOutlines, v => {
    showOutlines = v; localStorage.setItem('gs:outlines', v ? '1' : '0');
    if (m.getLayer('outlines')) m.setLayoutProperty('outlines', 'visibility', v ? 'visible' : 'none');
  });
  const arcBtn = toggle('arc', 'Arc', '◠', 'Dispersion arc at the crosshair', () => showArc, v => { showArc = v; localStorage.setItem('gs:arc', v ? '1' : '0'); arcSlider.hidden = !v; });

  // Undo steps back one stage at a time: un-hole, then un-place the pin (if the
  // ball is still on its first spot on the green), then remove the last shot.
  const undoBtn = h('button', { class: 'fab undo', 'aria-label': 'Undo', title: 'Undo',
    onclick: () => {
      const hl = holeNow(), shots = hl.shots || [];
      if (hl.done) return saveHole({ done: false });
      const onGreen = shots.filter(x => x.lie === 'green').length;
      if (hl.pin && onGreen === 1) return saveHole({ pin: null });
      const rest = shots.slice(0, -1);
      saveHole({ shots: rest.length > 1 ? rest : [], pin: rest.some(x => x.lie === 'green') ? hl.pin : null });
      if (stage() === 'play') place();
    } }, '↶');
  const addBtn = h('button', { class: 'fab add', 'aria-label': 'Record shot here', title: 'Record shot at the crosshair',
    onclick: () => {
      const s = shotsNow();
      const shots = s.length ? [...s] : [{ pos: tee, lie: 'tee' }];
      const lie = stage() === 'putt' ? 'green' : lieOn(target, course.features);
      const shot = { pos: target, lie };
      if (lie === 'green' && holeNow().pin) shot.ft = Math.max(1, Math.round(yards(target, pin) * FT_PER_YD));
      shots.push(shot);
      const wasPlaying = stage() === 'play';
      saveShots(shots);
      if (wasPlaying && lie === 'green') zoomToGreen();
    } }, '+');
  const holedBtn = h('button', { class: 'holed', onclick: () => saveHole({ done: true }) }, 'Holed');
  const setPinBtn = h('button', { class: 'btn primary', onclick: () => {
    pin = target;
    const shots = shotsNow().map(x => (x.lie === 'green' ? { ...x, ft: Math.max(1, Math.round(yards(x.pos, pin) * FT_PER_YD)) } : x));
    saveHole({ pin, shots });
    zoomToGreen();
  } }, 'Set pin');
  const bannerText = h('div', {});
  const banner = h('div', { class: 'greenbar', hidden: true }, bannerText);

  const expValue = h('strong', {});
  const expPill = h('div', { class: 'exppill' },
    h('div', {}, h('small', {}, 'Expected'), expValue),
    h('select', { 'aria-label': 'Handicap level', onchange: e => { level = e.target.value; localStorage.setItem('gs:level', level); update(); } },
      LEVELS.map(l => h('option', { value: l, selected: l === level }, levelName(l)))));

  const menu = h('div', { class: 'sheet', hidden: true },
    h('label', {}, 'Tees ', h('select', { onchange: e => { store.set('settings', { ...(store.get('settings') || {}), tee: e.target.value }); renderHole(view, n); } },
      course.tees.map(t => h('option', { value: t.name, selected: t.name === teeName }, `${t.name} · ${t.yards.reduce((a, b) => a + b, 0)} yd`)))),
    h('a', { class: 'btn', href: '#/' }, 'Home'),
    h('a', { class: 'btn', href: '#/course' }, 'Edit course outlines'),
    h('a', { class: 'btn', href: '#/settings' }, 'Settings'));

  view.replaceChildren(h('div', { class: 'holeview' }, mapEl,
    h('div', { class: 'vertag' }, `v${VERSION}`), expPill,
    h('div', { class: 'crosshair' }), toPinEl, fromTeeEl,
    h('button', { class: 'fab menu', 'aria-label': 'Menu', onclick: () => { menu.hidden = !menu.hidden; } }, '☰'),
    addBtn, holedBtn, undoBtn, outlineBtn, arcBtn, widthBtn, arcSlider, banner, menu,
    h('div', { class: 'holepill' },
      h('a', { href: `#/hole/${n === 1 ? 18 : n - 1}`, 'aria-label': 'Previous hole' }, '‹'),
      h('div', {}, h('small', {}, `Hole ${n} · Par ${ch.par}`), h('strong', {}, `${teeSet.yards[n - 1]} Yards`)),
      h('a', { href: `#/hole/${n === 18 ? 1 : n + 1}`, 'aria-label': 'Next hole' }, '›'))));

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
  m.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-left');
  window.holeMap = m; // handy for debugging from the console

  // Opening view, the same for every hole: the tee just above the hole pill, the
  // pin just below the readouts at the top, and the hole centred left to right,
  // zoomed out further only if a dogleg would not fit the width. Bottom padding
  // makes the map's centre, and so its rotation and zoom pivot, the crosshair.
  const place = () => {
    const hgt = mapEl.clientHeight, wid = mapEl.clientWidth;
    const TOP = 125, BOTTOM = 150, SIDE = 30; // pixels kept clear of the hole
    const brg = (bearing(tee, pin) * Math.PI) / 180, k = Math.cos((tee[0] * Math.PI) / 180);
    const local = p => { // metres along the tee-to-pin axis, and to the right of it
      const e = (p[1] - tee[1]) * M_PER_DEG * k, n = (p[0] - tee[0]) * M_PER_DEG;
      return [e * Math.sin(brg) + n * Math.cos(brg), e * Math.cos(brg) - n * Math.sin(brg)];
    };
    const length = local(pin)[0];
    const offLine = Math.max(...ch.line.slice(1, -1).map(p => Math.abs(local(p)[1])), 0) + 30; // widest point of the route, plus half a fairway
    const mPerPx = Math.max(length / (hgt - TOP - BOTTOM), (2 * offLine) / (wid - 2 * SIDE), 0.05);
    const teeY = (TOP + hgt - BOTTOM) / 2 + length / mPerPx / 2; // screen position of the tee
    const along = (teeY - hgt * CROSSHAIR_Y) * mPerPx; // how far up the axis the crosshair sits
    const start = [tee[0] + (along * Math.cos(brg)) / M_PER_DEG, tee[1] + (along * Math.sin(brg)) / (M_PER_DEG * k)];
    const zoom = Math.log2((78271.517 * Math.cos((start[0] * Math.PI) / 180)) / mPerPx);
    m.jumpTo({ center: ll(start), zoom, bearing: bearing(tee, pin), padding: { top: 0, left: 0, right: 0, bottom: hgt * (1 - 2 * CROSSHAIR_Y) } });
  };
  place();

  // Expected strokes to hole out from a lie `yd` yards from the pin. The tee box
  // counts as fairway; water costs a penalty stroke and a drop in the rough.
  const expectedFrom = (lie, yd) => (lie === 'green' ? expected('green', yd * 3, level)
    : lie === 'water' ? expected('rough', yd, level) + 1
    : expected(lie === 'tee' ? 'fairway' : lie, yd, level));

  // The lie at a point, for scoring this hole: another hole's green (or a
  // practice green) is just short grass here, so it counts as fairway.
  const green = ownGreen(ch);
  function lieOn(p, features) {
    const lie = lieAt(p, features);
    return lie === 'green' && !(green && inPolygon(p, green.p)) ? 'fairway' : lie;
  }

  const line = pts => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts.map(ll) } });

  function update() {
    // Read what is under the crosshair from its actual screen position, so the
    // line always meets the dot even if the screen size changed since the last layout.
    const c = m.unproject([mapEl.clientWidth / 2, mapEl.clientHeight * CROSSHAIR_Y]);
    target = [c.lat, c.lng];
    const lie = lieOn(target, course.features);
    const shots = shotsNow(), last = shots[shots.length - 1], st = stage();
    const from = last ? last.pos : tee;
    const onGreen = st !== 'play';
    const w = showWidth && !onGreen ? fairwayWidth(from, target, fairways) : null;
    const fromTee = yards(from, target), toPin = yards(target, pin);
    undoBtn.hidden = !shots.length && !holeNow().done;
    addBtn.hidden = st === 'pin' || st === 'done';
    holedBtn.hidden = st !== 'putt';
    widthBtn.hidden = arcBtn.hidden = onGreen;
    arcSlider.hidden = !showArc || onGreen;
    banner.hidden = st === 'play';
    if (st === 'pin') {
      bannerText.replaceChildren(h('strong', {}, 'On the green'), h('span', {}, 'Move the crosshair onto the hole, then set the pin.'));
      banner.replaceChildren(bannerText, setPinBtn);
    } else if (st === 'putt') {
      const putts = shots.filter(x => x.lie === 'green').length - 1;
      bannerText.replaceChildren(h('strong', {}, `${Math.round(yards(from, pin) * FT_PER_YD)} ft to the hole`),
        h('span', {}, putts ? `${putts} putt${putts > 1 ? 's' : ''} so far · + to record where the putt stopped` : '+ to record where the putt stopped'));
      banner.replaceChildren(bannerText);
    } else if (st === 'done') {
      const strokes = shots.length, diff = strokes - ch.par;
      const word = { '-3': 'Albatross', '-2': 'Eagle', '-1': 'Birdie', 0: 'Par', 1: 'Bogey', 2: 'Double bogey' }[diff] || `${diff > 0 ? '+' : ''}${diff}`;
      bannerText.replaceChildren(h('strong', {}, `Holed in ${strokes}`), h('span', {}, `${word} on a par ${ch.par}`));
      banner.replaceChildren(bannerText, h('a', { class: 'btn primary', href: `#/hole/${n === 18 ? 1 : n + 1}` }, 'Next hole ›'));
    }

    // Strokes gained by a shot from the tee (or the last recorded shot) that
    // finishes on the crosshair: expected strokes from there, minus expected
    // strokes from here, minus the stroke played.
    const teeExp = expected('tee', yards(tee, pin), level);
    const fromExp = last ? expectedFrom(last.lie, yards(from, pin)) : teeExp;
    const sg = fromExp - expectedFrom(lie, toPin) - 1;
    expValue.textContent = teeExp.toFixed(2);

    if (onGreen) {
      // Feet on the green. Before the pin is placed, the crosshair is the hole.
      const ballToHole = yards(from, st === 'pin' ? target : pin) * FT_PER_YD;
      toPinEl.replaceChildren(st === 'pin' ? h('b', {}, `${Math.round(ballToHole)} ft`) : h('b', {}, `${Math.round(toPin * FT_PER_YD)} ft`));
      fromTeeEl.replaceChildren(st === 'pin' ? h('span', { class: 'note' }, 'from your ball') : h('b', {}, `${Math.round(fromTee * FT_PER_YD)} ft`));
      expValue.textContent = teeExp.toFixed(2);
      const set = (id, data) => { const src = m.getSource(id); if (src) src.setData(data); };
      set('path', line(st === 'pin' ? [from, target] : st === 'done' ? [] : [from, target, pin]));
      set('shots', line(shots.map(x => x.pos)));
      set('width', line([])); set('arc', line([]));
      return;
    }
    toPinEl.replaceChildren(h('b', {}, `${Math.round(toPin)} yd`));
    fromTeeEl.replaceChildren(h('b', {}, `${Math.round(fromTee)} yd`),
      h('span', { class: 'sg ' + (sg >= 0 ? 'gain' : 'loss') }, `${sg >= 0 ? '+' : '−'}${Math.abs(sg).toFixed(2)} (${LIE_TAG[lie]})`),
      h('span', { class: 'wide', hidden: !showWidth }, w ? `${Math.round(w.yards)} yd wide` : 'No fairway here'));

    const arc = showArc ? arcThrough(from, target) : null;
    const half = arcYd / 2 / YD_PER_M;
    const set = (id, data) => { const src = m.getSource(id); if (src) src.setData(data); };
    set('path', line([from, target, pin]));
    set('shots', line(shots.map(s => s.pos)));
    set('width', line(w ? arcPoints(w.arc, w.l, w.r) : []));
    set('arc', line(arc ? arcPoints(arc, -half, half) : []));
  }

  const dragMarker = (el, pos, onMove) => {
    const mk = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(ll(pos)).addTo(m);
    mk.on('drag', () => { const p = mk.getLngLat(); onMove([p.lat, p.lng], false); });
    mk.on('dragend', () => { const p = mk.getLngLat(); onMove([p.lat, p.lng], true); });
    return mk;
  };
  dragMarker(h('div', { class: 'teemark', title: 'Tee (drag to move)' }), tee, (p, done) => { tee = p; if (done) rememberTee(teeName, ch, p); update(); });
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
  function zoomToGreen() {
    const g = ownGreen(ch), ball = shotsNow().at(-1)?.pos;
    const pts = [...(g ? g.p[0] : [pin]), ...(ball ? [ball] : [])];
    const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
    const k = Math.cos((lats[0] * Math.PI) / 180);
    const extent = Math.max((Math.max(...lats) - Math.min(...lats)) * M_PER_DEG, (Math.max(...lngs) - Math.min(...lngs)) * M_PER_DEG * k, 20);
    const mPerPx = (extent * 1.3) / Math.min(mapEl.clientWidth, mapEl.clientHeight * 0.6);
    const zoom = Math.min(21, Math.log2((78271.517 * k) / mPerPx));
    m.easeTo({ center: ll(holeNow().pin || !g ? pin : centre(g.p[0])), zoom, duration: 600 });
  }
  syncPin();

  // Numbered dots where each recorded shot finished.
  let shotMarks = [];
  function drawShots() {
    shotMarks.forEach(mk => mk.remove());
    shotMarks = shotsNow().slice(1).map((s, i) => new maplibregl.Marker({ element: h('div', { class: 'shotmark' }, String(i + 1)) }).setLngLat(ll(s.pos)).addTo(m));
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
    const credit = mapEl.querySelector('.maplibregl-ctrl-attrib'); // start collapsed to the (i) button
    if (credit) credit.classList.remove('maplibregl-compact-show');
    m.addSource('outlines', { type: 'geojson', data: { type: 'FeatureCollection', features: holeFeatures(ch).map(f => ({
      type: 'Feature', properties: { color: LIE_COLOR[f.t] }, geometry: { type: 'Polygon', coordinates: f.p.map(r => r.map(ll)) } })) } });
    m.addLayer({ id: 'outlines', type: 'line', source: 'outlines', layout: { visibility: showOutlines ? 'visible' : 'none' }, paint: { 'line-color': ['get', 'color'], 'line-width': 1.25, 'line-opacity': 0.7 } });
    const addLine = (id, shadow, paint, layout = {}) => {
      m.addSource(id, { type: 'geojson', data: line([]) });
      m.addLayer({ id: id + '-shadow', type: 'line', source: id, paint: { 'line-color': '#000', 'line-width': shadow, 'line-opacity': 0.35 } });
      m.addLayer({ id, type: 'line', source: id, layout, paint });
    };
    addLine('shots', 5, { 'line-color': '#ffb020', 'line-width': 2.5 }, { 'line-cap': 'round' });
    addLine('path', 4, { 'line-color': '#fff', 'line-width': 2 });
    addLine('arc', 5, { 'line-color': '#fff', 'line-width': 2.5 }, { 'line-cap': 'round' });
    addLine('width', 5, { 'line-color': '#ffe14d', 'line-width': 3, 'line-dasharray': [0.1, 2] }, { 'line-cap': 'round' });
    if (stage() !== 'play') zoomToGreen();
    update();
  });
  update();
}

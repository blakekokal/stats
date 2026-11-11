// Hole viewer: the hole drawn tee-at-bottom, green-at-top. A crosshair dot is
// fixed a third of the way down the screen; panning, zooming or rotating the map
// moves the course underneath it, and the distances from the tee and to the pin
// follow, along with the strokes gained by a tee shot finishing there for the
// chosen handicap level. Two optional arcs, both centred on the tee and passing through the
// crosshair: the fairway width, and a dispersion arc of adjustable width.

import { h, course, TILE_URL, LIE_COLOR, teePosition, rememberTee } from './app.js';
import { store } from './store.js';
import { lieAt, yards, inPolygon, boundsOf, YD_PER_M } from './geo.js';
import { VERSION } from './version.js';
import { expected, LEVELS } from './sg.js';

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

// A point `yd` yards along a line of [lat, lng] points.
function alongLine(line, yd) {
  for (let i = 0; i < line.length - 1; i++) {
    const seg = yards(line[i], line[i + 1]);
    if (yd <= seg) { const t = yd / seg; return [line[i][0] + t * (line[i + 1][0] - line[i][0]), line[i][1] + t * (line[i + 1][1] - line[i][1])]; }
    yd -= seg;
  }
  return line[line.length - 1];
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

export function renderHole(view, n) {
  closeHole();
  sessionStorage.setItem('hole', n);
  const ch = course.holes[n - 1];
  const settings = store.get('settings') || {};
  const teeName = settings.tee || 'Blue';
  const teeSet = course.tees.find(t => t.name === teeName) || course.tees[0];
  const fairways = course.features.filter(f => f.t === 'fairway').map(f => ({ p: f.p, box: boundsOf(f.p[0], 200) }));

  let tee = teePosition(teeName, ch);
  let pin = ch.pin;
  let target = tee;
  const flag = (key, def) => (localStorage.getItem(key) ?? def) === '1';
  let showWidth = flag('gs:fairwayWidth', '0');
  let showArc = flag('gs:arc', '0');
  let arcYd = Math.min(80, Math.max(10, +localStorage.getItem('gs:arcYd') || 40));
  let level = LEVELS.includes(localStorage.getItem('gs:level')) ? localStorage.getItem('gs:level') : 'Scratch';

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
  const arcBtn = toggle('arc', 'Arc', '◠', 'Dispersion arc at the crosshair', () => showArc, v => { showArc = v; localStorage.setItem('gs:arc', v ? '1' : '0'); arcSlider.hidden = !v; });

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
    arcBtn, widthBtn, arcSlider, menu,
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

  // Opening view: the crosshair on a typical drive (par 4s and 5s) or on the pin
  // (par 3s), zoomed so the tee sits just above the hole pill and the green is
  // on screen above the crosshair. Bottom padding makes the map's centre, and so
  // its rotation and zoom pivot, the crosshair itself.
  const place = () => {
    const hgt = mapEl.clientHeight;
    const line = [tee, ...ch.line.slice(1, -1), pin];
    const holeYd = line.slice(1).reduce((a, p, i) => a + yards(line[i], p), 0);
    const start = ch.par === 3 ? pin : alongLine(line, Math.min(250, holeYd * 0.7));
    const below = hgt * (1 - CROSSHAIR_Y) - 150, above = hgt * CROSSHAIR_Y - 110; // pixels free below and above the crosshair
    const mPerPx = Math.max(yards(tee, start) / YD_PER_M / below, yards(start, pin) / YD_PER_M / above, 0.05);
    const zoom = Math.log2((78271.517 * Math.cos((start[0] * Math.PI) / 180)) / mPerPx);
    m.jumpTo({ center: ll(start), zoom, bearing: bearing(tee, pin), padding: { top: 0, left: 0, right: 0, bottom: hgt * (1 - 2 * CROSSHAIR_Y) } });
  };
  place();

  const line = pts => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts.map(ll) } });

  function update() {
    // Read what is under the crosshair from its actual screen position, so the
    // line always meets the dot even if the screen size changed since the last layout.
    const c = m.unproject([mapEl.clientWidth / 2, mapEl.clientHeight * CROSSHAIR_Y]);
    target = [c.lat, c.lng];
    const lie = lieAt(target, course.features);
    const w = showWidth ? fairwayWidth(tee, target, fairways) : null;
    const fromTee = yards(tee, target), toPin = yards(target, pin);

    // Strokes gained by a tee shot that finishes on the crosshair: expected strokes
    // from the tee, minus expected strokes from here, minus the stroke played.
    // The tee box counts as fairway; water costs a penalty stroke and a drop in the rough.
    const teeExp = expected('tee', yards(tee, pin), level);
    const hereExp = lie === 'green' ? expected('green', toPin * 3, level)
      : lie === 'water' ? expected('rough', toPin, level) + 1
      : expected(lie === 'tee' ? 'fairway' : lie, toPin, level);
    const sg = teeExp - hereExp - 1;
    expValue.textContent = teeExp.toFixed(2);

    toPinEl.replaceChildren(h('b', {}, `${Math.round(toPin)} yd`));
    fromTeeEl.replaceChildren(h('b', {}, `${Math.round(fromTee)} yd`),
      h('span', { class: 'sg ' + (sg >= 0 ? 'gain' : 'loss') }, `${sg >= 0 ? '+' : '−'}${Math.abs(sg).toFixed(2)} (${LIE_TAG[lie]})`),
      h('span', { class: 'wide', hidden: !showWidth }, w ? `${Math.round(w.yards)} yd wide` : 'No fairway here'));

    const arc = showArc ? arcThrough(tee, target) : null;
    const half = arcYd / 2 / YD_PER_M;
    const set = (id, data) => { const src = m.getSource(id); if (src) src.setData(data); };
    set('path', line([tee, target, pin]));
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
  dragMarker(h('div', { class: 'pinmark', title: 'Pin (drag to move)' }), pin, p => { pin = p; update(); });

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
    m.addSource('outlines', { type: 'geojson', data: { type: 'FeatureCollection', features: course.features.map(f => ({
      type: 'Feature', properties: { color: LIE_COLOR[f.t] }, geometry: { type: 'Polygon', coordinates: f.p.map(r => r.map(ll)) } })) } });
    m.addLayer({ id: 'outlines', type: 'line', source: 'outlines', paint: { 'line-color': ['get', 'color'], 'line-width': 1.25, 'line-opacity': 0.7 } });
    const addLine = (id, shadow, paint, layout = {}) => {
      m.addSource(id, { type: 'geojson', data: line([]) });
      m.addLayer({ id: id + '-shadow', type: 'line', source: id, paint: { 'line-color': '#000', 'line-width': shadow, 'line-opacity': 0.35 } });
      m.addLayer({ id, type: 'line', source: id, layout, paint });
    };
    addLine('path', 4, { 'line-color': '#fff', 'line-width': 2 });
    addLine('arc', 5, { 'line-color': '#fff', 'line-width': 2.5 }, { 'line-cap': 'round' });
    addLine('width', 5, { 'line-color': '#ffe14d', 'line-width': 3, 'line-dasharray': [0.1, 2] }, { 'line-cap': 'round' });
    update();
  });
  update();
}

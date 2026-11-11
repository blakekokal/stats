// Hole viewer: the hole drawn tee-at-bottom, green-at-top. A crosshair dot is
// fixed at the centre of the screen; panning, zooming or rotating the map moves
// the course underneath it, and the distances from the tee and to the pin
// follow. An optional overlay measures the fairway width at the crosshair.

import { h, course, TILE_URL, LIE_COLOR, teePosition, rememberTee } from './app.js';
import { store } from './store.js';
import { lieAt, yards, YD_PER_M } from './geo.js';

const maplibregl = window.maplibregl;
const LIE_NAME = { tee: 'Tee box', fairway: 'Fairway', rough: 'Rough', bunker: 'Bunker', green: 'Green', water: 'Water' };
const ll = p => [p[1], p[0]]; // [lat, lng] -> MapLibre's [lng, lat]
const M_PER_DEG = 111320;

let map = null;

export function closeHole() { if (map) { map.remove(); map = null; } }
export const lastHole = () => +sessionStorage.getItem('hole') || 1;

// Compass direction from a to b, in degrees clockwise from north.
function bearing(a, b) {
  const k = Math.cos((a[0] * Math.PI) / 180);
  return (Math.atan2((b[1] - a[1]) * k, b[0] - a[0]) * 180) / Math.PI;
}

// Fairway width at `target`, measured square to the line of play from `tee`.
// Returns the two fairway edges and the width in yards, or null when no fairway
// crosses that line within reach. If the target is just off the fairway, the
// nearest stretch of fairway is measured.
export function fairwayWidth(tee, target, features, reachYd = 80) {
  const k = Math.cos((target[0] * Math.PI) / 180);
  const local = p => [(p[1] - target[1]) * M_PER_DEG * k, (p[0] - target[0]) * M_PER_DEG]; // metres east, north
  const t0 = local(tee);
  const len = Math.hypot(t0[0], t0[1]);
  if (len < 1) return null;
  const right = [-t0[1] / len, t0[0] / len]; // unit vector pointing right of the line of play
  const reach = reachYd / YD_PER_M;
  let best = null;
  for (const f of features) {
    if (f.t !== 'fairway') continue;
    // Where the cross line meets this fairway's edges, as metres right (+) or left (-) of the target.
    const hits = [];
    for (const ring of f.p) {
      for (let i = 0; i < ring.length; i++) {
        const a = local(ring[i]), b = local(ring[(i + 1) % ring.length]);
        const da = right[0] * a[1] - right[1] * a[0], db = right[0] * b[1] - right[1] * b[0];
        if ((da > 0) === (db > 0)) continue;
        const s = da / (da - db);
        hits.push((a[0] + s * (b[0] - a[0])) * right[0] + (a[1] + s * (b[1] - a[1])) * right[1]);
      }
    }
    hits.sort((x, y) => x - y);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const [l, r] = [hits[i], hits[i + 1]];
      const gap = l <= 0 && r >= 0 ? 0 : Math.min(Math.abs(l), Math.abs(r));
      if (gap <= reach && (!best || gap < best.gap)) best = { gap, l, r };
    }
  }
  if (!best) return null;
  const at = t => [target[0] + (t * right[1]) / M_PER_DEG, target[1] + (t * right[0]) / (M_PER_DEG * k)];
  return { left: at(best.l), right: at(best.r), yards: (best.r - best.l) * YD_PER_M, onFairway: best.gap === 0 };
}

export function renderHole(view, n) {
  closeHole();
  sessionStorage.setItem('hole', n);
  const ch = course.holes[n - 1];
  const settings = store.get('settings') || {};
  const teeName = settings.tee || 'Blue';
  const teeSet = course.tees.find(t => t.name === teeName) || course.tees[0];

  let tee = teePosition(teeName, ch);
  let pin = ch.pin;
  let target = tee;
  let showWidth = sessionStorage.getItem('fairwayWidth') === '1';

  const mapEl = h('div', { id: 'gmap' });
  const widthLabel = h('div', { class: 'widthlabel', hidden: true });
  const widthBtn = h('button', { class: 'fab width' + (showWidth ? ' on' : ''), 'aria-pressed': String(showWidth), title: 'Fairway width at the crosshair',
    onclick: () => {
      showWidth = !showWidth; sessionStorage.setItem('fairwayWidth', showWidth ? '1' : '0');
      widthBtn.classList.toggle('on', showWidth); widthBtn.setAttribute('aria-pressed', String(showWidth)); update();
    } }, h('span', {}, '↔'), h('small', {}, 'Width'));
  const menu = h('div', { class: 'sheet', hidden: true },
    h('label', {}, 'Tees ', h('select', { onchange: e => { store.set('settings', { ...(store.get('settings') || {}), tee: e.target.value }); renderHole(view, n); } },
      course.tees.map(t => h('option', { value: t.name, selected: t.name === teeName }, `${t.name} · ${t.yards.reduce((a, b) => a + b, 0)} yd`)))),
    h('a', { class: 'btn', href: '#/course' }, 'Edit course outlines'),
    h('a', { class: 'btn', href: '#/settings' }, 'Settings'));

  view.replaceChildren(h('div', { class: 'holeview' }, mapEl,
    h('div', { class: 'crosshair' }), widthLabel,
    h('button', { class: 'fab menu', 'aria-label': 'Menu', onclick: () => { menu.hidden = !menu.hidden; } }, '☰'),
    widthBtn, menu,
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
    center: ll(ch.line[Math.floor(ch.line.length / 2)]), zoom: 16, bearing: bearing(tee, pin),
    maxZoom: 21, pitchWithRotate: false, touchPitch: false,
    attributionControl: false,
  });
  m.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
  window.holeMap = m; // handy for debugging from the console

  // Fit the whole hole with the tee at the bottom and the green at the top.
  // Padding is even top and bottom so the crosshair (screen centre) starts mid-hole.
  const fit = () => {
    const b = new maplibregl.LngLatBounds();
    [tee, pin, ...ch.line].forEach(p => b.extend(ll(p)));
    m.fitBounds(b, { bearing: bearing(tee, pin), padding: { top: 110, bottom: 110, left: 50, right: 50 }, animate: false });
  };
  fit();

  // Distance labels sit at the middle of each leg and stay upright.
  const label = cls => { const el = h('div', { class: 'dist ' + cls }); return { el, marker: new maplibregl.Marker({ element: el }).setLngLat(ll(tee)).addTo(m) }; };
  const fromTee = label('from');
  const toPin = label('to');
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const line = pts => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts.map(ll) } });

  function update() {
    // The crosshair is drawn at the centre of the map element; read what is under it.
    const c = m.unproject([mapEl.clientWidth / 2, mapEl.clientHeight / 2]);
    target = [c.lat, c.lng];
    const d1 = yards(tee, target), d2 = yards(target, pin);
    const lie = lieAt(target, course.features);
    fromTee.marker.setLngLat(ll(mid(tee, target)));
    fromTee.el.replaceChildren(h('b', {}, `${Math.round(d1)} yd`), h('span', { class: 'lie', style: `color:${LIE_COLOR[lie]}` }, LIE_NAME[lie]));
    toPin.marker.setLngLat(ll(mid(target, pin)));
    toPin.el.replaceChildren(h('b', {}, `${Math.round(d2)} yd`));

    const w = showWidth ? fairwayWidth(tee, target, course.features) : null;
    widthLabel.hidden = !showWidth;
    widthLabel.textContent = w ? `${Math.round(w.yards)} yd wide` : 'No fairway here';
    const path = m.getSource('path'), width = m.getSource('width');
    if (path) path.setData(line([tee, target, pin]));
    if (width) width.setData(line(w ? [w.left, w.right] : []));
  }

  const dragMarker = (el, pos, opts, onMove) => {
    const mk = new maplibregl.Marker({ element: el, draggable: true, ...opts }).setLngLat(ll(pos)).addTo(m);
    mk.on('drag', () => { const p = mk.getLngLat(); onMove([p.lat, p.lng], false); });
    mk.on('dragend', () => { const p = mk.getLngLat(); onMove([p.lat, p.lng], true); });
    return mk;
  };
  dragMarker(h('div', { class: 'teemark', title: 'Tee (drag to move)' }), tee, {}, (p, done) => { tee = p; if (done) rememberTee(teeName, ch, p); update(); });
  dragMarker(h('div', { class: 'pinmark', title: 'Pin (drag to move)' }, h('div', { class: 'flag' })), pin, { anchor: 'bottom-left', offset: [-3, 1] }, p => { pin = p; update(); });

  m.on('move', update);
  m.on('click', () => { menu.hidden = true; });

  m.on('load', () => {
    if (map !== m) return;
    m.resize(); fit();
    const credit = mapEl.querySelector('.maplibregl-ctrl-attrib'); // start collapsed to the (i) button
    if (credit) credit.classList.remove('maplibregl-compact-show');
    m.addSource('outlines', { type: 'geojson', data: { type: 'FeatureCollection', features: course.features.map(f => ({
      type: 'Feature', properties: { color: LIE_COLOR[f.t] }, geometry: { type: 'Polygon', coordinates: f.p.map(r => r.map(ll)) } })) } });
    m.addLayer({ id: 'outlines', type: 'line', source: 'outlines', paint: { 'line-color': ['get', 'color'], 'line-width': 1.25, 'line-opacity': 0.7 } });
    m.addSource('path', { type: 'geojson', data: line([]) });
    m.addLayer({ id: 'path-shadow', type: 'line', source: 'path', paint: { 'line-color': '#000', 'line-width': 4, 'line-opacity': 0.35 } });
    m.addLayer({ id: 'path', type: 'line', source: 'path', paint: { 'line-color': '#fff', 'line-width': 2 } });
    m.addSource('width', { type: 'geojson', data: line([]) });
    m.addLayer({ id: 'width-shadow', type: 'line', source: 'width', paint: { 'line-color': '#000', 'line-width': 5, 'line-opacity': 0.4 } });
    m.addLayer({ id: 'width', type: 'line', source: 'width', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffe14d', 'line-width': 3, 'line-dasharray': [0.1, 2] } });
    update();
  });
  update();
}

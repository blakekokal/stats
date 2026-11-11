// Hole viewer: the hole drawn tee-at-bottom, green-at-top, with one movable
// target point showing the distance from the tee and the distance left to the pin.

import { h, course, TILE_URL, LIE_COLOR, teePosition, rememberTee } from './app.js';
import { store } from './store.js';
import { lieAt, yards } from './geo.js';

const maplibregl = window.maplibregl;
const LIE_NAME = { tee: 'Tee box', fairway: 'Fairway', rough: 'Rough', bunker: 'Bunker', green: 'Green', water: 'Water' };
const ll = p => [p[1], p[0]]; // [lat, lng] -> MapLibre's [lng, lat]

let map = null;

export function closeHole() { if (map) { map.remove(); map = null; } }
export const lastHole = () => +sessionStorage.getItem('hole') || 1;

// Compass direction from a to b, in degrees clockwise from north.
function bearing(a, b) {
  const k = Math.cos((a[0] * Math.PI) / 180);
  return (Math.atan2((b[1] - a[1]) * k, b[0] - a[0]) * 180) / Math.PI;
}

// A point `yd` yards along the hole's centre line, starting from the tee.
function alongLine(line, yd) {
  for (let i = 0; i < line.length - 1; i++) {
    const seg = yards(line[i], line[i + 1]);
    if (yd <= seg) { const t = yd / seg; return [line[i][0] + t * (line[i + 1][0] - line[i][0]), line[i][1] + t * (line[i + 1][1] - line[i][1])]; }
    yd -= seg;
  }
  return line[line.length - 1];
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
  // Start the target at a typical drive on par 4s and 5s, and on the pin on par 3s.
  let target = ch.par === 3 ? pin : alongLine([tee, ...ch.line.slice(1)], 250);

  const mapEl = h('div', { id: 'gmap' });
  const menu = h('div', { class: 'sheet', hidden: true },
    h('label', {}, 'Tees ', h('select', { onchange: e => { store.set('settings', { ...(store.get('settings') || {}), tee: e.target.value }); renderHole(view, n); } },
      course.tees.map(t => h('option', { value: t.name, selected: t.name === teeName }, `${t.name} · ${t.yards.reduce((a, b) => a + b, 0)} yd`)))),
    h('a', { class: 'btn', href: '#/course' }, 'Edit course outlines'),
    h('a', { class: 'btn', href: '#/settings' }, 'Settings'));

  view.replaceChildren(h('div', { class: 'holeview' }, mapEl,
    h('button', { class: 'fab menu', 'aria-label': 'Menu', onclick: () => { menu.hidden = !menu.hidden; } }, '☰'),
    menu,
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
    center: ll(alongLine(ch.line, 200)), zoom: 16, bearing: bearing(tee, pin),
    maxZoom: 21, pitchWithRotate: false, touchPitch: false, doubleClickZoom: false,
    attributionControl: false,
  });
  m.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
  window.holeMap = m; // handy for debugging from the console

  // Fit the whole hole with the tee at the bottom and the green at the top,
  // leaving room for the hole pill.
  const fit = () => {
    const b = new maplibregl.LngLatBounds();
    [tee, pin, ...ch.line].forEach(p => b.extend(ll(p)));
    m.fitBounds(b, { bearing: bearing(tee, pin), padding: { top: 60, bottom: 120, left: 50, right: 50 }, animate: false });
  };
  fit();

  // Distance labels sit at the middle of each leg and stay upright.
  const label = cls => { const el = h('div', { class: 'dist ' + cls }); return { el, marker: new maplibregl.Marker({ element: el }).setLngLat(ll(tee)).addTo(m) }; };
  const fromTee = label('from');
  const toPin = label('to');
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

  function update() {
    const src = m.getSource('path');
    if (src) src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [ll(tee), ll(target), ll(pin)] } });
    const d1 = yards(tee, target), d2 = yards(target, pin);
    const lie = lieAt(target, course.features);
    fromTee.marker.setLngLat(ll(mid(tee, target)));
    fromTee.el.replaceChildren(h('b', {}, `${Math.round(d1)} yd`), h('span', { class: 'lie', style: `color:${LIE_COLOR[lie]}` }, LIE_NAME[lie]));
    toPin.marker.setLngLat(ll(mid(target, pin)));
    toPin.el.replaceChildren(h('b', {}, `${Math.round(d2)} yd`));
    toPin.el.hidden = d2 < 3;
  }

  const dragMarker = (el, pos, opts, onMove) => {
    const mk = new maplibregl.Marker({ element: el, draggable: true, ...opts }).setLngLat(ll(pos)).addTo(m);
    mk.on('drag', () => { const p = mk.getLngLat(); onMove([p.lat, p.lng], false); });
    mk.on('dragend', () => { const p = mk.getLngLat(); onMove([p.lat, p.lng], true); });
    return mk;
  };
  dragMarker(h('div', { class: 'teemark', title: 'Tee (drag to move)' }), tee, {}, (p, done) => { tee = p; if (done) rememberTee(teeName, ch, p); update(); });
  dragMarker(h('div', { class: 'pinmark', title: 'Pin (drag to move)' }, h('div', { class: 'flag' })), pin, { anchor: 'bottom-left', offset: [-3, 1] }, p => { pin = p; update(); });
  const targetMarker = dragMarker(h('div', { class: 'target', title: 'Target (drag, or tap the map)' }), target, {}, p => { target = p; update(); });

  m.on('click', e => { target = [e.lngLat.lat, e.lngLat.lng]; targetMarker.setLngLat(e.lngLat); menu.hidden = true; update(); });

  m.on('load', () => {
    if (map !== m) return;
    m.resize(); fit();
    const credit = mapEl.querySelector('.maplibregl-ctrl-attrib'); // start collapsed to the (i) button
    if (credit) credit.classList.remove('maplibregl-compact-show');
    m.addSource('outlines', { type: 'geojson', data: { type: 'FeatureCollection', features: course.features.map(f => ({
      type: 'Feature', properties: { color: LIE_COLOR[f.t] }, geometry: { type: 'Polygon', coordinates: f.p.map(r => r.map(ll)) } })) } });
    m.addLayer({ id: 'outlines', type: 'line', source: 'outlines', paint: { 'line-color': ['get', 'color'], 'line-width': 1.25, 'line-opacity': 0.7 } });
    m.addSource('path', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
    m.addLayer({ id: 'path-shadow', type: 'line', source: 'path', paint: { 'line-color': '#000', 'line-width': 4, 'line-opacity': 0.35 } });
    m.addLayer({ id: 'path', type: 'line', source: 'path', paint: { 'line-color': '#fff', 'line-width': 2 } });
    update();
  });
  update();
}

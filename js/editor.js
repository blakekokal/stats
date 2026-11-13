// Course outline editor: fix or redraw the fairway / green / bunker / water / tee
// polygons that decide the lie of every shot.

import { h, course, toast, satellite, LIE_COLOR, loadCourse } from './app.js';
import { store } from './store.js';
import { boundsOf } from './geo.js';

const L = window.L;
const TYPES = ['fairway', 'rough', 'green', 'bunker', 'water', 'recovery', 'tee'];
const LABEL = { fairway: 'Fairway', rough: 'Rough', green: 'Green', bunker: 'Bunker', water: 'Water', recovery: 'Recovery', tee: 'Tee box' };
let map = null;

export function renderCourseEditor(view) {
  if (map) { map.remove(); map = null; }
  let dirty = false;
  const typeSel = h('select', { 'aria-label': 'Type for new outlines' }, TYPES.map(t => h('option', { value: t }, LABEL[t])));
  const holeSel = h('select', { 'aria-label': 'Jump to hole', onchange: e => {
    const v = e.target.value;
    map.fitBounds(boundsOf(v === 'all' ? course.holes.flatMap(c => c.line) : course.holes[v - 1].line, 40));
  } }, h('option', { value: 'all' }, 'Whole course'), course.holes.map(c => h('option', { value: c.n }, `Hole ${c.n}`)));
  const saveBtn = h('button', { class: 'primary', disabled: true, onclick: save }, 'Save outlines');
  const mapEl = h('div', { id: 'map' });

  view.replaceChildren(h('div', { class: 'editor' },
    h('div', { class: 'toolbar' }, holeSel, h('label', {}, 'New outline: ', typeSel), saveBtn,
      h('button', { onclick: reset }, 'Reset to original'),
      h('span', { class: 'legend' }, TYPES.map(t => h('span', {}, h('i', { style: `background:${LIE_COLOR[t]}` }), LABEL[t])), h('span', { class: 'muted' }, 'Anything else is rough'))),
    h('p', { class: 'muted help' }, 'Use the tools on the map: pencil icon to draw a new outline, the edit icon to drag corners, the eraser to delete. Tap an outline to change its type.'),
    mapEl));

  map = L.map(mapEl, { zoomSnap: 0.25 });
  satellite(map);
  map.fitBounds(boundsOf(course.holes.flatMap(c => c.line), 40));
  const group = L.featureGroup().addTo(map);
  const style = t => ({ color: LIE_COLOR[t], weight: 2, fillOpacity: 0.2 });
  const touch = () => { dirty = true; saveBtn.disabled = false; };

  function add(layer, t) {
    layer.featureType = t;
    layer.setStyle(style(t));
    layer.on('pm:edit', touch);
    layer.on('click', () => {
      if (map.pm.globalEditModeEnabled() || map.pm.globalRemovalModeEnabled()) return;
      const sel = h('select', { onchange: e => { layer.featureType = e.target.value; layer.setStyle(style(e.target.value)); touch(); map.closePopup(); } },
        TYPES.map(x => h('option', { value: x, selected: x === layer.featureType }, LABEL[x])));
      L.popup().setLatLng(layer.getBounds().getCenter()).setContent(h('label', {}, 'Type: ', sel)).openOn(map);
    });
    group.addLayer(layer);
  }
  for (const f of course.features) if (f.t !== 'ob') add(L.polygon(f.p), f.t); // OB is the course boundary, not edited here

  map.pm.addControls({ position: 'topleft', drawMarker: false, drawCircleMarker: false, drawPolyline: false, drawRectangle: false,
    drawCircle: false, drawText: false, cutPolygon: false, rotateMode: false, dragMode: false, drawPolygon: true, editMode: true, removalMode: true });
  map.pm.setGlobalOptions({ layerGroup: group, snappable: false });
  map.on('pm:create', e => { group.removeLayer(e.layer); map.removeLayer(e.layer); add(L.polygon(e.layer.getLatLngs()), typeSel.value); touch(); });
  map.on('pm:remove', e => { group.removeLayer(e.layer); touch(); });

  function save() {
    const features = [];
    group.eachLayer(layer => {
      let rings = layer.getLatLngs();
      if (rings.length && !Array.isArray(rings[0])) rings = [rings];
      const p = rings.map(r => r.map(ll => [+ll.lat.toFixed(6), +ll.lng.toFixed(6)])).filter(r => r.length >= 3);
      if (p.length) features.push({ t: layer.featureType, p });
    });
    // OB isn't edited here: keep it as it is (including any edits from the hole editor).
    features.push(...course.features.filter(f => f.t === 'ob'));
    store.set('course:' + course.id, { features, ob: true });
    loadCourse();
    dirty = false; saveBtn.disabled = true;
    toast('Outlines saved. Lies on past rounds are unchanged; new shots use the new outlines.');
  }

  function reset() {
    if (!confirm('Discard all your outline edits and go back to the original map?')) return;
    store.remove('course:' + course.id);
    loadCourse().then(() => renderCourseEditor(view));
  }

  window.onbeforeunload = () => (dirty ? 'Unsaved outline edits' : undefined);
  const m = map;
  requestAnimationFrame(() => { if (map === m) { m.invalidateSize(); m.fitBounds(boundsOf(course.holes.flatMap(c => c.line), 40)); } });
}

// Boundary editor for one hole, on the hole map (GPS Scouting).
//
// Shows only the boundaries of the hole being looked at. Tap one to select it:
// drag the ✥ in its middle to move the whole shape, the ⤡ at its corner (or
// Size − / +) to resize it, drag its white corner dots to move them, drag a small dot between two corners
// to add a corner, tap a corner then "Delete point" to remove it, change its type
// with the type buttons, or delete the whole boundary. "Draw" adds a new
// boundary: pick its type, tap the map to place its corners, then Finish (or tap
// the first corner again). Nothing is kept until Save; Undo steps back.
// ‹ › go to another hole without saving: the edits carry over until Save or Cancel.
//
// Edits are stored like the Course page's: the whole feature list, out of bounds
// included, under 'course:<id>' (with ob: true so the OB edits are used too).

import { h, course, toast, LIE_COLOR, loadCourse } from './app.js';
import { store } from './store.js';

const maplibregl = window.maplibregl;
export const EDIT_TYPES = ['fairway', 'rough', 'bunker', 'water', 'recovery', 'tee', 'green', 'ob'];
export const EDIT_LABEL = { fairway: 'Fairway', rough: 'Rough', bunker: 'Bunker', water: 'Water', recovery: 'Recovery', tee: 'Tee box', green: 'Green', ob: 'OB' };
// The usual rough colour is too dark to see on the imagery. (A function: app.js
// imports this module before LIE_COLOR exists.)
const color = t => (t === 'rough' ? '#7dbb4a' : LIE_COLOR[t] || '#fff');
const ll = p => [p[1], p[0]];
const MAX_HANDLES = 400; // corners shown at once; zoom in for more

// Rings are stored closed (last point = first); the editor works on open rings.
const open = r => (r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1] ? r.slice(0, -1) : r);
const close = r => [...r, r[0]];
const round6 = p => [+p[0].toFixed(6), +p[1].toFixed(6)];

// `own`: the boundaries that belong to this hole (the ones its map outlines);
// only those are shown and editable, plus any drawn here.
// Edits not saved yet, kept while moving between holes (‹ ›) so one Save stores
// them all. `goto`: the hole to reopen the editor on.
let pending = null;
export const resumeEditAt = n => !!pending && pending.course === course.id && pending.goto === n;
// The boundaries as they stand in the editor (unsaved edits included).
export const editFeatures = () => (pending && pending.course === course.id ? pending.work : course.features);

export function openBoundaryEditor({ m, root, ch, own, prev, next, go, onClose }) {
  const resumed = pending && pending.course === course.id ? pending : null;
  pending = null;
  let work = resumed ? resumed.work : course.features.slice(); // features are replaced, never changed in place
  const history = [];
  let dirty = resumed ? resumed.dirty : false;
  let sel = null; // the selected feature object (in work)
  let selVtx = null; // [ring, index] of the selected corner
  let drawType = sessionStorage.getItem('gs:drawType') || 'fairway';
  let draft = null; // corners of a boundary being drawn
  let mode = 'pick'; // pick | draw
  let handles = [];
  let dragEnd = 0; // a drag ends with a click on the dot: ignore it
  const justDragged = () => Date.now() - dragEnd < 400;

  const scoped = new Set(own);
  const inScope = f => scoped.has(f);

  // ---------- map layers ----------
  const fc = features => ({ type: 'FeatureCollection', features });
  m.addSource('bedit', { type: 'geojson', data: fc([]) });
  m.addSource('bedit-draft', { type: 'geojson', data: fc([]) });
  m.addLayer({ id: 'bedit-fill', type: 'fill', source: 'bedit', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['get', 'sel'], 0.35, 0.12] } });
  m.addLayer({ id: 'bedit-line', type: 'line', source: 'bedit', paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'sel'], 3.5, 1.75], 'line-opacity': 0.95 } });
  m.addLayer({ id: 'bedit-draft', type: 'line', source: 'bedit-draft', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': ['literal', [2, 1.2]] } });
  const hidden = ['outlines', 'sgt', 'sgt-shadow', 'shots', 'shots-shadow', 'shotspen', 'shotspen-shadow'].filter(id => m.getLayer(id));
  const wasVisible = hidden.map(id => m.getLayoutProperty(id, 'visibility'));
  hidden.forEach(id => m.setLayoutProperty(id, 'visibility', 'none'));
  root.classList.add('bedit');

  function drawLayers() {
    const feats = work.filter(inScope).map((f, i) => ({
      type: 'Feature', id: i, properties: { k: work.indexOf(f), color: color(f.t), sel: f === sel },
      geometry: { type: 'Polygon', coordinates: f.p.map(r => r.map(ll)) },
    }));
    // The selected one last, so its outline is drawn on top.
    feats.sort((a, b) => a.properties.sel - b.properties.sel);
    m.getSource('bedit').setData(fc(feats));
    const d = draft && draft.length ? [{ type: 'Feature', properties: { color: color(drawType) }, geometry: { type: 'LineString', coordinates: (draft.length > 2 ? close(draft) : draft).map(ll) } }] : [];
    m.getSource('bedit-draft').setData(fc(d));
  }

  // ---------- handles (corner dots) ----------
  function clearHandles() { handles.forEach(mk => mk.remove()); handles = []; }
  function marker(cls, at, opts = {}) {
    const mk = new maplibregl.Marker({ element: h('div', { class: cls }), ...opts }).setLngLat(ll(at)).addTo(m);
    handles.push(mk);
    return mk;
  }
  const visibleBox = () => {
    const b = m.getBounds(), padLat = (b.getNorth() - b.getSouth()) * 0.25, padLng = (b.getEast() - b.getWest()) * 0.25;
    return p => p[0] >= b.getSouth() - padLat && p[0] <= b.getNorth() + padLat && p[1] >= b.getWest() - padLng && p[1] <= b.getEast() + padLng;
  };
  function drawHandles() {
    clearHandles();
    if (mode === 'draw') {
      (draft || []).forEach((p, i) => {
        const mk = marker('bvtx draft' + (i === 0 && draft.length > 2 ? ' first' : ''), p);
        if (i === 0) mk.getElement().addEventListener('click', e => { e.stopPropagation(); if (draft.length > 2) finishDraw(); });
      });
      return;
    }
    if (!sel) return;
    const seen = visibleBox();
    const rings = sel.p.map(open);
    addMoveHandle(rings, seen);
    const count = rings.reduce((a, r) => a + r.filter(seen).length, 0);
    if (count > MAX_HANDLES) { hint.textContent = 'Zoom in to move this boundary’s points.'; return; }
    rings.forEach((r, ri) => {
      r.forEach((p, vi) => {
        if (!seen(p)) return;
        // The dot between this corner and the next: drag it to add a corner there.
        const q = r[(vi + 1) % r.length];
        const a = m.project(ll(p)), b = m.project(ll(q));
        if (Math.hypot(a.x - b.x, a.y - b.y) < 36) return; // too close together to grab: zoom in
        const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        const mm = marker('bmid', mid, { draggable: true });
        mm.on('dragstart', () => { push(); setRing(ri, rr => [...rr.slice(0, vi + 1), mid, ...rr.slice(vi + 1)]); });
        mm.on('drag', () => { const at = mm.getLngLat(); setRing(ri, rr => rr.map((x, k) => (k === vi + 1 ? [at.lat, at.lng] : x)), true); });
        mm.on('dragend', () => { dragEnd = Date.now(); selVtx = null; refresh(); });
      });
      r.forEach((p, vi) => {
        if (!seen(p)) return;
        const on = selVtx && selVtx[0] === ri && selVtx[1] === vi;
        const mk = marker('bvtx' + (on ? ' on' : ''), p, { draggable: true });
        mk.getElement().addEventListener('click', e => { e.stopPropagation(); if (justDragged()) return; selVtx = on ? null : [ri, vi]; refresh(); });
        mk.on('dragstart', () => push());
        mk.on('drag', () => { const at = mk.getLngLat(); setRing(ri, rr => rr.map((x, k) => (k === vi ? [at.lat, at.lng] : x)), true); });
        mk.on('dragend', () => { dragEnd = Date.now(); refresh(); });
      });
    });
  }

  // The ✥ dot in the middle of the selected boundary drags the whole shape, to
  // line it up with the imagery. Not offered for the course-wide OB area (the
  // course boundary), which only makes sense point by point.
  function addMoveHandle(rings, seen) {
    if (!canReshape(sel)) return;
    const pts = rings[0].filter(seen);
    if (!pts.length) return;
    const at = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
    const mk = new maplibregl.Marker({ element: h('div', { class: 'bmove', title: 'Drag to move the whole shape' }, '\u2725'), draggable: true }).setLngLat(ll(at)).addTo(m);
    handles.push(mk);
    let from = null, orig = null;
    mk.on('dragstart', () => { push(); from = mk.getLngLat(); orig = sel.p; root.classList.add('bmoving'); });
    mk.on('drag', () => {
      const to = mk.getLngLat(), dLat = to.lat - from.lat, dLng = to.lng - from.lng;
      replace(sel, { ...sel, p: orig.map(r => r.map(p => round6([p[0] + dLat, p[1] + dLng]))) });
      dirty = true; drawLayers();
    });
    mk.on('dragend', () => { dragEnd = Date.now(); root.classList.remove('bmoving'); selVtx = null; refresh(); });
    mk.getElement().addEventListener('click', e => e.stopPropagation());
    addScaleHandle(at, pts);
  }

  // Scaling: the ⤡ dot at the shape's corner (as seen on screen) makes it bigger
  // or smaller about its middle, keeping its shape; − and + in the panel do it
  // in small steps.
  const scaled = (p0, c, k) => p0.map(r => r.map(p => round6([c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k])));
  const middle = f => { const r = open(f.p[0]); return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length]; };
  function addScaleHandle(at, pts) {
    const c = m.project(ll(at));
    const px = pts.map(p => m.project(ll(p)));
    const corner = [Math.max(...px.map(q => q.x)) + 14, Math.max(...px.map(q => q.y)) + 14];
    const mk = new maplibregl.Marker({ element: h('div', { class: 'bscale', title: 'Drag to resize the shape' }, '\u2921'), draggable: true }).setLngLat(m.unproject(corner)).addTo(m);
    handles.push(mk);
    let start = 0, orig = null;
    const dist = () => { const q = m.project(mk.getLngLat()); return Math.hypot(q.x - c.x, q.y - c.y); };
    mk.on('dragstart', () => { push(); start = dist() || 1; orig = sel.p; root.classList.add('bmoving'); });
    mk.on('drag', () => {
      const k = Math.min(5, Math.max(0.2, dist() / start));
      replace(sel, { ...sel, p: scaled(orig, at, k) });
      dirty = true; drawLayers();
    });
    mk.on('dragend', () => { dragEnd = Date.now(); root.classList.remove('bmoving'); selVtx = null; refresh(); });
    mk.getElement().addEventListener('click', e => e.stopPropagation());
  }
  function nudgeScale(k) { push(); replace(sel, { ...sel, p: scaled(sel.p, middle(sel), k) }); dirty = true; refresh(); }
  const canReshape = f => !(f.p.length > 1 && f.t === 'ob');

  // Replace ring `ri` of the selected feature (fn gets and returns an open ring).
  function setRing(ri, fn, live = false) {
    const p = sel.p.map((r, k) => (k === ri ? close(fn(open(r)).map(round6)) : r));
    replace(sel, { ...sel, p });
    dirty = true;
    if (live) drawLayers();
  }
  function replace(old, nu) {
    const i = work.indexOf(old);
    work = [...work.slice(0, i), nu, ...work.slice(i + 1)];
    if (scoped.has(old)) { scoped.delete(old); scoped.add(nu); }
    if (sel === old) sel = nu;
  }
  function push() { history.push({ work, sel, scoped: new Set(scoped) }); undoBtn.disabled = false; }

  // ---------- toolbars ----------
  const typeChips = (cur, pick) => h('div', { class: 'btypes' }, EDIT_TYPES.map(t => h('button', {
    class: 'btype' + (t === cur ? ' on' : ''), style: `--c:${color(t)}`, onclick: () => pick(t),
  }, h('i', {}), EDIT_LABEL[t])));

  const undoBtn = h('button', { disabled: true, onclick: undo }, '↶ Undo');
  const saveBtn = h('button', { class: 'bsave', onclick: save }, 'Save');
  const top = h('div', { class: 'beditbar' },
    h('button', { onclick: cancel }, 'Cancel'),
    h('div', { class: 'bnav' },
      h('button', { 'aria-label': `Hole ${prev}`, onclick: () => toHole(prev) }, '\u2039'),
      h('strong', {}, `Hole ${ch.n}`),
      h('button', { 'aria-label': `Hole ${next}`, onclick: () => toHole(next) }, '\u203a')),
    undoBtn, saveBtn);
  const hint = h('p', { class: 'bhint' });
  const panel = h('div', { class: 'beditpanel' });
  root.append(top, panel);

  function refresh() {
    drawLayers();
    hint.textContent = '';
    drawHandles();
    if (mode === 'draw') {
      const n = draft.length;
      if (!hint.textContent) hint.textContent = n === 0 ? `Tap the map to place the first corner of the new ${EDIT_LABEL[drawType].toLowerCase()}.`
        : n < 3 ? 'Keep tapping to add corners.' : 'Add more corners, or tap Finish (or the first corner).';
      panel.replaceChildren(hint,
        typeChips(drawType, t => { drawType = t; sessionStorage.setItem('gs:drawType', t); refresh(); }),
        h('div', { class: 'brow' },
          h('button', { onclick: () => { mode = 'pick'; draft = null; refresh(); } }, 'Cancel'),
          h('button', { disabled: !n, onclick: () => { draft.pop(); refresh(); } }, 'Remove point'),
          h('button', { class: 'bgo', disabled: n < 3, onclick: finishDraw }, 'Finish')));
    } else if (sel) {
      const ringLen = selVtx ? open(sel.p[selVtx[0]]).length : 0;
      if (!hint.textContent) hint.textContent = selVtx ? 'Corner selected: drag it, or delete it.' : 'Drag \u2725 to move the whole shape, \u2921 to resize it, or the white dots to move corners; drag a small dot between them to add one (zoom in if there are none). Tap a type to change it.';
      panel.replaceChildren(hint,
        typeChips(sel.t, t => { if (t === sel.t) return; push(); replace(sel, { ...sel, t }); dirty = true; refresh(); }),
        h('div', { class: 'brow' },
          canReshape(sel) ? h('span', { class: 'bsize' }, 'Size',
            h('button', { 'aria-label': 'Smaller', onclick: () => nudgeScale(0.97) }, '\u2212'),
            h('button', { 'aria-label': 'Bigger', onclick: () => nudgeScale(1.03) }, '+')) : null,
          h('button', { class: 'bdel', onclick: () => { push(); work = work.filter(f => f !== sel); scoped.delete(sel); sel = null; selVtx = null; dirty = true; refresh(); } }, 'Delete boundary'),
          selVtx ? h('button', { disabled: ringLen <= 3, onclick: () => {
            const [ri, vi] = selVtx; push(); setRing(ri, r => r.filter((_, k) => k !== vi)); selVtx = null; refresh();
          } }, 'Delete point') : null,
          h('button', { class: 'bgo', onclick: () => { sel = null; selVtx = null; refresh(); } }, 'Done')));
    } else {
      hint.textContent = 'Tap a boundary to edit it, or draw a new one.';
      panel.replaceChildren(hint, h('div', { class: 'brow' },
        h('button', { class: 'bgo', onclick: () => { mode = 'draw'; draft = []; sel = null; selVtx = null; refresh(); } }, '✏️ Draw new boundary')),
        h('small', { class: 'muted' }, 'Anything outside every boundary counts as rough.'));
    }
  }

  function finishDraw() {
    if (!draft || draft.length < 3) return;
    push();
    const f = { t: drawType, p: [close(draft.map(round6))] };
    work = [...work, f]; scoped.add(f); sel = f; selVtx = null;
    draft = null; mode = 'pick'; dirty = true;
    refresh();
  }

  function undo() {
    const s = history.pop();
    if (!s) return;
    ({ work, sel } = s);
    scoped.clear(); s.scoped.forEach(f => scoped.add(f));
    if (sel && !work.includes(sel)) sel = null;
    selVtx = null; dirty = true;
    undoBtn.disabled = !history.length;
    refresh();
  }

  // ---------- map taps ----------
  function onClick(e) {
    if (e.originalEvent?.target?.closest?.('.bvtx, .bmid, .bmove, .bscale') || justDragged()) return;
    if (mode === 'draw') { draft.push([e.lngLat.lat, e.lngLat.lng]); refresh(); return; }
    // The smallest boundary under the tap (a bunker in a fairway, not the fairway).
    const hits = m.queryRenderedFeatures(e.point, { layers: ['bedit-fill'] }).map(x => work[x.properties.k]).filter(Boolean);
    const area = f => { const r = f.p[0]; let a = 0; for (let i = 1; i < r.length; i++) a += r[i - 1][1] * r[i][0] - r[i][1] * r[i - 1][0]; return Math.abs(a); };
    const pick = hits.sort((a, b) => area(a) - area(b))[0] || null;
    sel = pick === sel ? sel : pick; selVtx = null;
    refresh();
  }
  const onMoveEnd = () => { if (sel || mode === 'draw') drawHandles(); };
  m.on('click', onClick);
  m.on('moveend', onMoveEnd);

  // ---------- save / leave ----------
  function teardown() {
    clearHandles();
    m.off('click', onClick); m.off('moveend', onMoveEnd);
    ['bedit-draft', 'bedit-line', 'bedit-fill'].forEach(id => m.getLayer(id) && m.removeLayer(id));
    ['bedit', 'bedit-draft'].forEach(id => m.getSource(id) && m.removeSource(id));
    hidden.forEach((id, i) => m.getLayer(id) && m.setLayoutProperty(id, 'visibility', wasVisible[i] || 'visible'));
    top.remove(); panel.remove();
    root.classList.remove('bedit');
    window.onbeforeunload = null;
  }
  function cancel() {
    if (dirty && !confirm('Discard all your unsaved boundary changes?')) return;
    teardown(); onClose(false);
  }
  // Another hole, still editing: the changes so far go with it (Undo starts afresh there).
  function toHole(k) {
    if (mode === 'draw' && draft && draft.length >= 3) finishDraw();
    pending = { course: course.id, work, dirty, goto: k };
    teardown();
    if (dirty) window.onbeforeunload = () => 'Unsaved boundary edits';
    go(k);
  }
  async function save() {
    if (mode === 'draw' && draft && draft.length >= 3) finishDraw();
    if (!dirty) { teardown(); onClose(false); return; }
    const features = work.filter(f => f.p.length && f.p[0].length >= 4);
    store.set('course:' + course.id, { features, ob: true });
    await loadCourse(true);
    teardown();
    toast('Boundaries saved on every hole you changed. New shots use them; past rounds keep their lies.');
    onClose(true);
  }
  window.onbeforeunload = () => (dirty ? 'Unsaved boundary edits' : undefined);

  refresh();
  return { close: teardown };
}

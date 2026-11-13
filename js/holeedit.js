// Boundary editor for one hole, on the hole map (GPS Scouting).
//
// Shows only the boundaries of the hole being looked at. Tap one to select it:
// drag the ✥ in its middle to move the whole shape, the ⤡ at its corner (or
// Size − / +) to resize it, drag its white corner dots to move them, drag a small dot between two corners
// to add a corner, tap a corner then "Delete point" to remove it, change its type
// with the type buttons, cut it in two between two corners (✂ Cut), or delete
// the whole boundary. "Draw" adds a new
// boundary: pick its type, tap the map to place its corners, then Finish (or tap
// the first corner again). Nothing is kept until Save; Undo steps back.
// ‹ › go to another hole without saving: the edits carry over until Save or Cancel.
//
// Edits are stored like the Course page's: the whole feature list, out of bounds
// included, under 'course:<id>' (with ob: true so the OB edits are used too).

import { h, course, toast, LIE_COLOR, loadCourse, along } from './app.js';
import { store } from './store.js';
import { inPolygon } from './geo.js';

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
  let mode = 'pick'; // pick | draw | cut
  let cutA = null; // cut: the first corner tapped, [ring, index]
  // The course-wide OB (a big area with the course cut out of it) isn't split:
  // Cut picks out a stretch of its boundary line instead, to drag as one unit.
  let section = null; // { f: the feature, ri: ring, idx: [corner indices], n: ring length }
  const isCourseOb = f => f.p.length > 1 && f.t === 'ob';
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
    drawTeeLabels();
  }

  // Each tee box is labelled with its yardage to the green and the tee sets
  // that play from it: for each set, the box whose yardage is closest to the
  // scorecard's (as the hole map picks the tee).
  let teeLabels = [];
  const TEE_INK = { black: '#111', blue: '#2563eb', white: '#fff', red: '#dc2626', gold: '#eab308', yellow: '#eab308', green: '#16a34a', silver: '#c0c0c0', orange: '#f97316', purple: '#9333ea' };
  function drawTeeLabels() {
    teeLabels.forEach(mk => mk.remove()); teeLabels = [];
    const boxes = work.filter(f => f.t === 'tee' && inScope(f)).map(f => {
      const r = open(f.p[0]), c = [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length];
      return { f, c, yd: Math.round(along(ch, c)), sets: [] };
    });
    if (!boxes.length) return;
    for (const t of course.tees) {
      const want = t.yards[ch.n - 1];
      if (want) boxes.reduce((b, x) => (Math.abs(x.yd - want) < Math.abs(b.yd - want) ? x : b)).sets.push(t);
    }
    for (const b of boxes) {
      const el = h('div', { class: 'btee' + (b.f === sel ? ' sel' : '') },
        b.sets.map(t => h('span', { class: 'bteeset' }, h('i', { style: `background:${TEE_INK[t.name.toLowerCase()] || '#888'}` }), `${t.name} ${t.yards[ch.n - 1]}`)),
        h('small', {}, b.sets.length ? `box ${b.yd} yd` : `Tee box \u00b7 ${b.yd} yd \u00b7 no tee set`));
      teeLabels.push(new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -14] }).setLngLat(ll(b.c)).addTo(m));
    }
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
    if (mode === 'cut') {
      const seen = visibleBox();
      // A shape is cut across its outline; the course OB along its course boundary lines.
      const rings = sel.p.map((r, ri) => [ri, open(r)]).filter(([ri]) => (isCourseOb(sel) ? ri > 0 : ri === 0));
      if (rings.reduce((a, [, r]) => a + r.filter(seen).length, 0) > MAX_HANDLES) { hint.textContent = 'Zoom in to pick the corners.'; return; }
      rings.forEach(([ri, r]) => r.forEach((p, vi) => {
        if (!seen(p)) return;
        const on = cutA && cutA[0] === ri && cutA[1] === vi;
        const mk = marker('bvtx cut' + (on ? ' on' : ''), p);
        mk.getElement().addEventListener('click', e => { e.stopPropagation(); cutAt(ri, vi); });
      }));
      return;
    }
    if (!sel) return;
    const seen = visibleBox();
    const rings = sel.p.map(open);
    addMoveHandle(rings, seen);
    if (section && (section.f !== sel || rings[section.ri]?.length !== section.n)) section = null; // corners added or removed since
    if (section) addSectionHandle(rings, seen);
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
        const inSec = section && section.ri === ri && section.idx.includes(vi);
        const mk = marker('bvtx' + (on ? ' on' : '') + (inSec ? ' sec' : ''), p, { draggable: true });
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
  // Fairways, tee boxes, greens and rough drawn or changed here belong to this
  // hole from then on (`h`), however close they sit to another hole's line.
  const OWNED = ['fairway', 'tee', 'green', 'rough'];
  const tag = f => (OWNED.includes(f.t) && f.h !== ch.n ? { ...f, h: ch.n } : f);
  // Pin the hole's current fairways etc. to it when leaving or saving.
  function tagScoped() { [...scoped].forEach(f => { const g = tag(f); if (g !== f) replace(f, g); }); }
  function replace(old, nu) {
    nu = tag(nu);
    if (section && section.f === old) section.f = nu;
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
    } else if (mode === 'cut') {
      if (!hint.textContent) hint.textContent = isCourseOb(sel)
        ? (cutA == null ? '\u2702 Tap a corner on the boundary line where the stretch starts.' : '\u2702 Now tap the corner where it ends. That stretch of line can then be moved on its own.')
        : (cutA == null ? '\u2702 Tap the corner to start the cut.' : '\u2702 Now tap the corner to cut to. The shape splits along the straight line between them.');
      panel.replaceChildren(hint, h('div', { class: 'brow' },
        h('button', { onclick: () => { mode = 'pick'; cutA = null; refresh(); } }, 'Cancel cut')));
    } else if (sel) {
      const ringLen = selVtx ? open(sel.p[selVtx[0]]).length : 0;
      if (!hint.textContent && section) hint.textContent = 'Drag the red \u2725 to move the highlighted stretch of the boundary; Other side switches to the rest of the line.';
      if (!hint.textContent) hint.textContent = selVtx ? 'Corner selected: drag it, or delete it.' : 'Drag \u2725 to move the whole shape, \u2921 to resize it, or the white dots to move corners; drag a small dot between them to add one (zoom in if there are none). Tap a type to change it.';
      panel.replaceChildren(hint,
        typeChips(sel.t, t => { if (t === sel.t) return; push(); replace(sel, { ...sel, t }); dirty = true; refresh(); }),
        h('div', { class: 'brow' },
          canReshape(sel) ? h('span', { class: 'bsize' }, 'Size',
            h('button', { 'aria-label': 'Smaller', onclick: () => nudgeScale(0.97) }, '\u2212'),
            h('button', { 'aria-label': 'Bigger', onclick: () => nudgeScale(1.03) }, '+')) : null,
          isCourseOb(sel) || open(sel.p[0]).length >= 4 ? h('button', { onclick: () => {
            mode = 'cut'; cutA = selVtx && (isCourseOb(sel) ? selVtx[0] > 0 : selVtx[0] === 0) ? selVtx : null; selVtx = null; section = null; refresh();
          } }, '\u2702 Cut') : null,
          section ? h('button', { onclick: () => { const { idx, other } = section; section = { ...section, idx: other, other: idx }; refresh(); } }, 'Other side') : null,
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

  // The ✥ for a stretch of the course OB line: drags just those corners; the
  // line stays joined to the corners either side.
  function addSectionHandle(rings, seen) {
    const r = rings[section.ri], pts = section.idx.map(i => r[i]);
    const vis = pts.filter(seen);
    if (!vis.length) return;
    // On the line, halfway along the part of the stretch in view.
    const k = Math.floor(vis.length / 2), at = vis.length > 1 ? [(vis[k - 1][0] + vis[k][0]) / 2, (vis[k - 1][1] + vis[k][1]) / 2] : vis[0];
    const mk = new maplibregl.Marker({ element: h('div', { class: 'bmove sec', title: 'Drag to move this stretch of the boundary' }, '\u2725'), draggable: true }).setLngLat(ll(at)).addTo(m);
    handles.push(mk);
    let from = null, orig = null;
    const idx = new Set(section.idx), ri = section.ri;
    mk.on('dragstart', () => { push(); from = mk.getLngLat(); orig = sel.p; root.classList.add('bmoving'); });
    mk.on('drag', () => {
      const to = mk.getLngLat(), dLat = to.lat - from.lat, dLng = to.lng - from.lng;
      replace(sel, { ...sel, p: orig.map((rr, k) => (k !== ri ? rr : close(open(rr).map((q, i) => (idx.has(i) ? round6([q[0] + dLat, q[1] + dLng]) : q))))) });
      dirty = true; drawLayers();
    });
    mk.on('dragend', () => { dragEnd = Date.now(); root.classList.remove('bmoving'); selVtx = null; refresh(); });
    mk.getElement().addEventListener('click', e => e.stopPropagation());
  }
  // The corners from a to b going round the ring one way, or (other) the other way.
  const arc = (n, a, b) => { const out = [a]; for (let i = a; i !== b;) { i = (i + 1) % n; out.push(i); } return out; };
  function pickSection(ri, a, b) {
    const n = open(sel.p[ri]).length, one = arc(n, a, b), two = arc(n, b, a);
    section = { f: sel, ri, n, idx: one.length <= two.length ? one : two, other: one.length <= two.length ? two : one };
    mode = 'pick'; cutA = null; selVtx = null;
    refresh();
    toast('Drag the red \u2725 to move this stretch of the boundary.');
  }

  // Cut: split the selected shape in two along the straight line between two
  // of its corners. Each piece keeps the type; any hole goes with the piece it's in.
  function cutAt(ri, vi) {
    if (!cutA || (cutA[0] === ri && cutA[1] === vi)) { cutA = cutA ? null : [ri, vi]; refresh(); return; }
    if (cutA[0] !== ri) { toast('Pick two corners on the same line.'); return; }
    if (isCourseOb(sel)) { pickSection(ri, cutA[1], vi); return; }
    const r = open(sel.p[0]), n = r.length, i = Math.min(cutA[1], vi), j = Math.max(cutA[1], vi);
    if (j - i < 2 || n - (j - i) < 2) { toast('Pick two corners that aren\u2019t next to each other.'); return; }
    const pieces = [r.slice(i, j + 1), [...r.slice(j), ...r.slice(0, i + 1)]].map(close);
    const holes = sel.p.slice(1);
    const parts = pieces.map(pc => tag({ ...sel, p: [pc, ...holes.filter(hr => inPolygon(hr[0], [pc]))] }));
    const mid = [(r[i][0] + r[j][0]) / 2, (r[i][1] + r[j][1]) / 2];
    push();
    const k = work.indexOf(sel);
    work = [...work.slice(0, k), ...parts, ...work.slice(k + 1)];
    scoped.delete(sel); parts.forEach(f => scoped.add(f));
    sel = parts[0]; selVtx = null; cutA = null; mode = 'pick'; dirty = true;
    refresh();
    toast(inPolygon(mid, [close(r)]) ? 'Cut in two. Tap either piece to move it.' : 'Cut in two, but the cut line runs outside the shape. Undo if it looks wrong.');
  }

  function finishDraw() {
    if (!draft || draft.length < 3) return;
    push();
    const f = tag({ t: drawType, p: [close(draft.map(round6))] });
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
    selVtx = null; section = null; dirty = true;
    undoBtn.disabled = !history.length;
    refresh();
  }

  // ---------- map taps ----------
  function onClick(e) {
    if (e.originalEvent?.target?.closest?.('.bvtx, .bmid, .bmove, .bscale') || justDragged()) return;
    if (mode === 'cut') return; // only the corners count while cutting
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
    teeLabels.forEach(mk => mk.remove()); teeLabels = [];
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
    if (mode === 'cut') { mode = 'pick'; cutA = null; }
    if (dirty) tagScoped();
    pending = { course: course.id, work, dirty, goto: k };
    teardown();
    if (dirty) window.onbeforeunload = () => 'Unsaved boundary edits';
    go(k);
  }
  async function save() {
    if (mode === 'draw' && draft && draft.length >= 3) finishDraw();
    if (!dirty) { teardown(); onClose(false); return; }
    tagScoped();
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

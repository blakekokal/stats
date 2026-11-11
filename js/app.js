import { lieAt, yards, boundsOf } from './geo.js';
import { analyzeHole, analyzeRound, newRound, pinOf, distOf, fmtSg, fmtPar, LIES, LIE_LABEL } from './model.js';
import { store, sync, init as initSync } from './store.js';
import { renderStats } from './stats.js';
import { renderCourseEditor } from './editor.js';
import { renderSettings } from './settings.js';

const L = window.L;
const view = document.getElementById('view');
export const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const LIE_COLOR = { tee: '#f4f4f0', fairway: '#8fd14f', rough: '#4d7c3a', bunker: '#f2d58a', recovery: '#b98b5e', green: '#3ee08f', water: '#4aa8ff' };

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

let baseCourse = null;
export let course = null;

export async function loadCourse() {
  if (!baseCourse) baseCourse = await (await fetch('data/bridlewood.json')).json();
  const edited = store.get('course:' + baseCourse.id);
  course = { ...baseCourse, features: edited ? edited.features : baseCourse.features };
  return course;
}
export const originalFeatures = () => baseCourse.features;

function centroid(ring) {
  let la = 0, lo = 0;
  for (const p of ring) { la += p[0]; lo += p[1]; }
  return [la / ring.length, lo / ring.length];
}

// Pick the tee box whose distance to the green best matches the scorecard
// yardage for the chosen tees; remembered once the user drags the tee marker.
function teePosition(round, ch) {
  const saved = (store.get('settings') || {}).teePos || {};
  const key = `${course.id}:${round.tee}:${ch.n}`;
  if (saved[key]) return saved[key];
  const tee = course.tees.find(t => t.name === round.tee);
  const target = tee ? tee.yards[ch.n - 1] : null;
  if (!target) return ch.tee;
  const pathFrom = p => {
    let d = yards(p, ch.line[1]);
    for (let i = 1; i < ch.line.length - 1; i++) d += yards(ch.line[i], ch.line[i + 1]);
    return d;
  };
  let best = ch.tee, bestErr = Math.abs(pathFrom(ch.tee) - target);
  for (const f of course.features) {
    if (f.t !== 'tee') continue;
    const c = centroid(f.p[0]);
    if (yards(c, ch.tee) > 130) continue;
    if (course.holes.some(o => o !== ch && yards(c, o.tee) < yards(c, ch.tee))) continue;
    const err = Math.abs(pathFrom(c) - target);
    if (err < bestErr) { best = c; bestErr = err; }
  }
  return best;
}

function rememberTee(round, ch, pos) {
  const s = store.get('settings') || {};
  s.teePos = { ...(s.teePos || {}), [`${course.id}:${round.tee}:${ch.n}`]: pos };
  store.set('settings', s);
}

// ---------- rounds list ----------

function renderRounds() {
  const rounds = store.list('round:').sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updated - a.updated));
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const lastTee = (store.get('settings') || {}).tee || 'Blue';
  const dateIn = h('input', { type: 'date', value: today, 'aria-label': 'Round date' });
  const teeIn = h('select', { 'aria-label': 'Tees' }, course.tees.map(t =>
    h('option', { value: t.name, selected: t.name === lastTee }, `${t.name} · ${t.yards.reduce((a, b) => a + b, 0)} yd`)));

  const start = () => {
    const r = newRound(course, teeIn.value, dateIn.value || today);
    store.set('round:' + r.id, r);
    store.set('settings', { ...(store.get('settings') || {}), tee: teeIn.value });
    location.hash = `#/round/${r.id}/1`;
  };

  view.replaceChildren(h('div', { class: 'page' },
    h('h1', {}, course.name),
    h('p', { class: 'muted' }, course.location),
    h('div', { class: 'card row' }, dateIn, teeIn, h('button', { class: 'primary', onclick: start }, 'New round')),
    h('h2', {}, 'Rounds'),
    rounds.length ? h('div', { class: 'list' }, rounds.map(r => {
      const a = analyzeRound(r, course);
      const firstOpen = course.holes.find(ch => !(r.holes[ch.n] && r.holes[ch.n].done));
      return h('a', { class: 'card round', href: `#/round/${r.id}/${firstOpen ? firstOpen.n : 1}` },
        h('div', {},
          h('strong', {}, new Date(r.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })),
          h('div', { class: 'muted' }, `${r.tee} tees · ${a.holes === 18 ? '18 holes' : a.holes + ' of 18 holes'}`)),
        h('div', { class: 'right' },
          h('strong', {}, a.holes ? `${a.score} (${fmtPar(a.score - a.par)})` : '–'),
          h('div', { class: 'muted' }, a.holes ? `SG ${fmtSg(a.sg.total)}` : 'not started')));
    })) : h('p', { class: 'muted' }, 'No rounds yet. Pick a date and tees above to start one.'),
  ));
}

// ---------- play a hole ----------

let playMap = null;

function renderPlay(roundId, holeNo) {
  const round = store.get('round:' + roundId);
  if (!round) { location.hash = '#/'; return; }
  const ch = course.holes[holeNo - 1] || course.holes[0];
  const teeYards = (course.tees.find(t => t.name === round.tee) || course.tees[0]).yards[ch.n - 1];

  // The hole exists in memory immediately but is only saved once something is recorded.
  let hole = round.holes[ch.n];
  if (!hole) hole = { pin: null, done: false, shots: [{ pos: teePosition(round, ch), lie: 'tee', ft: null, pen: 0 }] };
  const save = () => { round.holes[ch.n] = hole; round.updated = Date.now(); store.set('round:' + round.id, round); draw(); };

  const mapEl = h('div', { id: 'map' });
  const panel = h('div', { class: 'panel' });
  const strip = h('div', { class: 'strip' });
  view.replaceChildren(h('div', { class: 'play' }, h('div', { class: 'mapwrap' }, mapEl), h('div', { class: 'side' }, strip, panel)));

  if (playMap) playMap.remove();
  const map = playMap = L.map(mapEl, { zoomControl: false, zoomSnap: 0.25, doubleClickZoom: false });
  window.playMap = map; // handy for debugging from the console
  L.control.zoom({ position: 'topright' }).addTo(map);
  satellite(map);
  const outlines = L.layerGroup().addTo(map);
  const marks = L.layerGroup().addTo(map);
  const pts = [...ch.line, ...hole.shots.filter(s => s.pos).map(s => s.pos)];
  // Fit once now (layers need a view) and again after layout settles, since the
  // map container's final size isn't known until the side panel has rendered.
  const fit = () => { if (playMap !== map) return; map.invalidateSize(); map.fitBounds(boundsOf(pts, 35)); };
  fit(); requestAnimationFrame(fit);
  const ro = new ResizeObserver(() => (playMap === map ? map.invalidateSize() : ro.disconnect()));
  ro.observe(mapEl);

  const near = boundsOf(ch.line, 150);
  for (const f of course.features) {
    const p = f.p[0][0];
    if (p[0] < near[0][0] || p[0] > near[1][0] || p[1] < near[0][1] || p[1] > near[1][1]) continue;
    L.polygon(f.p, { color: LIE_COLOR[f.t], weight: 1.5, opacity: 0.8, fillOpacity: 0.06, interactive: false }).addTo(outlines);
  }

  map.on('click', e => {
    if (hole.done) return toast('Hole is finished. Use Undo to change it.');
    const p = [+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)];
    const lie = lieAt(p, course.features);
    const last = hole.shots[hole.shots.length - 1];
    if (lie === 'water') {
      last.pen = (last.pen || 0) + 1; last.water = p;
      toast('Water: +1 penalty. Tap where you dropped.');
    } else {
      hole.shots.push({ pos: p, lie: lie === 'tee' ? 'fairway' : lie, ft: null, pen: 0 });
    }
    save();
  });

  const actions = {
    holed() { hole.done = true; save(); },
    putt() {
      hole.shots.push({ pos: null, lie: 'green', ft: 3, pen: 0 }); save();
      const inputs = panel.querySelectorAll('input.ft'); const el = inputs[inputs.length - 1];
      if (el) { el.focus(); el.select(); }
    },
    replay() {
      const last = hole.shots[hole.shots.length - 1];
      last.pen = (last.pen || 0) + 1;
      hole.shots.push({ pos: last.pos, lie: last.lie, ft: last.ft, pen: 0 });
      toast('+1 penalty, replaying from the same spot.');
      save();
    },
    undo() {
      const last = hole.shots[hole.shots.length - 1];
      if (hole.done) hole.done = false;
      else if (last.pen) { last.pen--; if (!last.pen) delete last.water; }
      else if (hole.shots.length > 1) hole.shots.pop();
      else return;
      save();
    },
  };

  function shotIcon(n, lie) {
    return L.divIcon({ className: '', iconSize: [26, 26], iconAnchor: [13, 13],
      html: `<div class="shotmark" style="background:${LIE_COLOR[lie] || '#fff'}">${n}</div>` });
  }

  function draw() {
    const pin = pinOf(hole, ch);
    const a = analyzeHole(hole, ch);

    // map
    marks.clearLayers();
    hole.shots.forEach((s, i) => {
      if (!s.pos) return;
      if (s.water) {
        L.polyline([s.pos, s.water], { color: LIE_COLOR.water, weight: 2, dashArray: '4 6', interactive: false }).addTo(marks);
        L.circleMarker(s.water, { radius: 5, color: '#fff', weight: 1, fillColor: LIE_COLOR.water, fillOpacity: 1, interactive: false }).addTo(marks);
      }
      const m = L.marker(s.pos, { icon: shotIcon(i + 1, s.lie), draggable: !hole.done, zIndexOffset: 100 + i }).addTo(marks);
      m.on('dragend', () => {
        const ll = m.getLatLng(); const p = [+ll.lat.toFixed(6), +ll.lng.toFixed(6)];
        s.pos = p; s.ft = null;
        if (i === 0) rememberTee(round, ch, p);
        else { const lie = lieAt(p, course.features); s.lie = lie === 'water' || lie === 'tee' ? 'rough' : lie; }
        save();
      });
    });
    // Break the line where a ball went in the water: the next shot starts from the drop.
    let seg = [];
    hole.shots.forEach(s => {
      if (!s.pos) return;
      seg.push(s.pos);
      if (s.pen) { if (seg.length > 1) L.polyline(seg, { color: '#fff', weight: 2, interactive: false }).addTo(marks); seg = s.water ? [] : [s.pos]; }
    });
    if (hole.done && seg.length) seg.push(pin);
    if (seg.length > 1) L.polyline(seg, { color: '#fff', weight: 2, interactive: false }).addTo(marks);

    const flag = L.marker(pin, { draggable: true, zIndexOffset: 50, title: 'Pin (drag to today\'s position)',
      icon: L.divIcon({ className: '', iconSize: [24, 30], iconAnchor: [3, 29], html: '<div class="flag"></div>' }) }).addTo(marks);
    flag.on('dragend', () => { const ll = flag.getLatLng(); hole.pin = [+ll.lat.toFixed(6), +ll.lng.toFixed(6)]; save(); });

    // scorecard strip
    const ra = analyzeRound(round, course);
    strip.replaceChildren(
      h('a', { class: 'back', href: '#/', 'aria-label': 'Back to rounds' }, '‹'),
      h('div', { class: 'chips' }, course.holes.map(c => {
        const hh = round.holes[c.n];
        const sc = hh && hh.done ? analyzeHole(hh, c).score : null;
        const d = sc == null ? '' : sc - c.par;
        return h('a', { href: `#/round/${round.id}/${c.n}`, class: 'chip' + (c.n === ch.n ? ' on' : '') + (sc == null ? '' : d < 0 ? ' under' : d > 0 ? ' over' : ' even') },
          h('small', {}, c.n), h('b', {}, sc == null ? '·' : sc));
      })),
      h('div', { class: 'total' }, ra.holes ? `${fmtPar(ra.score - ra.par)} thru ${ra.holes}` : ''));
    const on = strip.querySelector('.chip.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });

    // panel
    const last = hole.shots[hole.shots.length - 1];
    const hint = hole.done ? `Holed in ${a.score} (${fmtPar(a.score - ch.par)}) · SG ${fmtSg(a.rows.reduce((t, r) => t + r.sg, 0))}`
      : last.water && last.pen ? 'Tap where you dropped.'
      : last.lie === 'green' ? 'On the green: set the putt length, then Holed or + Putt.'
      : `Tap where shot ${hole.shots.length} finished.`;

    panel.replaceChildren(
      h('div', { class: 'holehead' },
        h('div', {}, h('h1', {}, `Hole ${ch.n}`), h('span', { class: 'muted' }, `Par ${ch.par} · ${teeYards} yd · Hcp ${ch.hcp}`)),
        h('div', { class: 'navbtns' },
          h('a', { class: 'btn', href: `#/round/${round.id}/${ch.n === 1 ? 18 : ch.n - 1}` }, '‹ Prev'),
          h('a', { class: 'btn' + (hole.done ? ' primary' : ''), href: `#/round/${round.id}/${ch.n === 18 ? 1 : ch.n + 1}` }, 'Next ›'))),
      h('p', { class: 'hint' }, hint),
      h('div', { class: 'actions' },
        h('button', { class: 'primary', disabled: hole.done, onclick: actions.holed }, 'Holed'),
        h('button', { disabled: hole.done, onclick: actions.putt }, '+ Putt'),
        h('button', { disabled: hole.done, onclick: actions.replay, title: 'Out of bounds or lost ball: one penalty stroke, replay from the same spot' }, 'OB / lost'),
        h('button', { disabled: hole.shots.length === 1 && !last.pen && !hole.done, onclick: actions.undo }, 'Undo')),
      h('table', { class: 'shots' },
        h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'From'), h('th', { class: 'num' }, 'To pin'), h('th', { class: 'num' }, 'Shot'), h('th', { class: 'num' }, 'SG'))),
        h('tbody', {}, a.rows.map(r => {
          const s = r.shot;
          const lieSel = h('select', { 'aria-label': `Lie for shot ${r.i + 1}`, onchange: e => { s.lie = e.target.value; if (s.lie !== 'green') s.ft = null; save(); } },
            LIES.map(l => h('option', { value: l, selected: l === s.lie }, LIE_LABEL[l])));
          const dist = s.lie === 'green'
            ? h('span', {}, h('input', { class: 'ft', type: 'number', min: 1, max: 150, inputmode: 'numeric', value: Math.round(r.dist), 'aria-label': `Putt ${r.i + 1} length in feet`,
              onchange: e => { const v = parseFloat(e.target.value); if (v > 0) { s.ft = v; save(); } } }), ' ft')
            : `${Math.round(r.dist)} yd`;
          return h('tr', {},
            h('td', {}, h('span', { class: 'dot', style: `background:${LIE_COLOR[s.lie]}` }), String(r.i + 1)),
            h('td', {}, lieSel),
            h('td', { class: 'num' }, dist),
            h('td', { class: 'num' }, s.pen ? h('span', { class: 'pen' }, `+${s.pen} pen`) : r.len != null ? `${Math.round(r.len)} yd` : ''),
            h('td', { class: 'num sg ' + (r.sg == null ? '' : r.sg >= 0 ? 'pos' : 'neg') }, fmtSg(r.sg)));
        }))),
    );
  }
  draw();
}

// ---------- router ----------

async function route() {
  await loadCourse();
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const tab = parts[0] || 'rounds';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === (tab === 'round' ? 'rounds' : tab)));
  document.body.classList.toggle('playing', tab === 'round');
  if (tab !== 'round' && playMap) { playMap.remove(); playMap = null; }
  if (tab === 'round') renderPlay(parts[1], parseInt(parts[2], 10) || 1);
  else if (tab === 'stats') renderStats(view);
  else if (tab === 'course') renderCourseEditor(view);
  else if (tab === 'settings') renderSettings(view);
  else renderRounds();
}

window.addEventListener('hashchange', route);
// Re-render when another device's changes arrive, but never while playing a hole
// (that would wipe an in-progress edit).
store.onChange(() => { if (!location.hash.startsWith('#/round/')) route(); });
sync.onStatus(() => {
  const dot = document.getElementById('sync-dot');
  dot.className = sync.status;
  dot.title = { off: 'Sync not set up', 'signed-out': 'Sync: signed out', syncing: 'Syncing…', ok: 'Synced', error: 'Sync error: ' + sync.error }[sync.status];
});

route();
initSync();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');

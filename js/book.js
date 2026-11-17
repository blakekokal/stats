// Yardage book (GPS Overview > View > Yardage book): a clean, printable page
// per hole drawn from the course file, laid out like a tour player's book.
// The hole page runs tee (bottom) to green (top); the green page shows the
// green as it's approached, with a grid, contours and slope arrows. Every
// number on the pages is yards to the FRONT of the green. What's drawn is
// picked with switches (kept on this device); Print makes a PDF / paper copy
// of this hole or of the whole course.

import { h, course, teePosition, teeBoxFor, boxCentre, partOf } from './app.js';
import { elevIndex, heightAt } from './elev.js';

const M_PER_DEG = 111320, M_PER_YD = 0.9144, FT_PER_M = 3.28084, IN_PER_M = 39.3701;
const SVGNS = 'http://www.w3.org/2000/svg';
const W = 400; // a page's width in SVG units (pages are 400 x 650: a 4 x 6.5 pocket book)

// ---------- the switches ----------

export const BOOK_OPTIONS = [
  // [key, label, group, default, not in a tournament (elevation, or a green map: Rules 4.3)]
  ['fairway', 'Fairways', 'Hole page', true],
  ['bunkers', 'Bunkers', 'Hole page', true],
  ['water', 'Water', 'Hole page', true],
  ['trees', 'Trees', 'Hole page', true],
  ['ob', 'Out of bounds', 'Hole page', true],
  ['otherHoles', 'Neighbouring holes', 'Hole page', true],
  ['allTees', 'Every tee box', 'Hole page', true],
  ['centre', 'Centre line', 'Hole page', true],
  ['layup', 'Layup lines (100 · 150 · 200 · 250)', 'Hole page', true],
  ['edges', 'Fairway edge numbers', 'Hole page', true],
  ['hazards', 'Bunker & water numbers', 'Hole page', true],
  ['width', 'Fairway widths', 'Hole page', true],
  ['contours', 'Contours & downhill arrows', 'Hole page', true, true],
  ['heights', 'Height circles (feet vs the green)', 'Hole page', true, true],
  ['playsLike', 'Plays-like (height change)', 'Hole page', true, true],
  ['north', 'North arrow & scale', 'Hole page', true],
  ['greenPage', 'Green page', 'Green page', true, true],
  ['grid', 'Yard grid', 'Green page', true, true],
  ['greenContours', 'Green contours', 'Green page', true, true],
  ['slopes', 'Slope arrows', 'Green page', true, true],
  ['notes', 'Notes lines', 'Green page', true, true],
];
const PREFS_KEY = 'gs:bookPrefs';
function loadPrefs() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { p = {}; }
  const out = {};
  for (const [k, , , d] of BOOK_OPTIONS) out[k] = typeof p[k] === 'boolean' ? p[k] : d;
  out.gridYd = [3, 5].includes(p.gridYd) ? p.gridYd : 3;
  return out;
}
const savePrefs = p => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* not kept */ } };

// ---------- geometry ----------

// A flat frame in yards around an origin, turned so `up` (a bearing in
// radians) points to the top of the page.
function frame(origin, up) {
  const k = Math.cos((origin[0] * Math.PI) / 180), c = Math.cos(up), s = Math.sin(up);
  const loc = p => [((p[1] - origin[1]) * M_PER_DEG * k) / M_PER_YD, ((p[0] - origin[0]) * M_PER_DEG) / M_PER_YD]; // east, north (yd)
  const rot = ([x, y]) => [x * c - y * s, x * s + y * c]; // +y is up the page
  const fwd = p => rot(loc(p));
  const back = ([X, Y]) => { const x = X * c + Y * s, y = -X * s + Y * c; return [origin[0] + (y * M_PER_YD) / M_PER_DEG, origin[1] + (x * M_PER_YD) / (M_PER_DEG * k)]; };
  return { loc, fwd, back, rotV: rot };
}
const bearingOf = (a, b, f) => { const [x1, y1] = f.loc(a), [x2, y2] = f.loc(b); return Math.atan2(x2 - x1, y2 - y1); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ringOf = f => f.p[0];
const closeRing = r => (r.length && (r[0][0] !== r.at(-1)[0] || r[0][1] !== r.at(-1)[1]) ? [...r, r[0]] : r);
function inside(q, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > q[1]) !== (yj > q[1]) && q[0] < ((xj - xi) * (q[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// Where segment a-b first crosses ring r (as a fraction along a-b), or null.
function firstCross(a, b, r) {
  let best = null;
  for (let i = 0; i < r.length - 1; i++) {
    const p = r[i], q = r[i + 1];
    const d = (b[0] - a[0]) * (q[1] - p[1]) - (b[1] - a[1]) * (q[0] - p[0]);
    if (!d) continue;
    const t = ((p[0] - a[0]) * (q[1] - p[1]) - (p[1] - a[1]) * (q[0] - p[0])) / d;
    const u = ((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / d;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && (best == null || t < best)) best = t;
  }
  return best;
}
// Every crossing of the line through p (direction d) with ring r, as signed distances.
function crossings(p, d, r, reach) {
  const a = [p[0] - d[0] * reach, p[1] - d[1] * reach], b = [p[0] + d[0] * reach, p[1] + d[1] * reach];
  const out = [];
  for (let i = 0; i < r.length - 1; i++) {
    const s = r[i], q = r[i + 1];
    const den = (b[0] - a[0]) * (q[1] - s[1]) - (b[1] - a[1]) * (q[0] - s[0]);
    if (!den) continue;
    const t = ((s[0] - a[0]) * (q[1] - s[1]) - (s[1] - a[1]) * (q[0] - s[0])) / den;
    const u = ((s[0] - a[0]) * (b[1] - a[1]) - (s[1] - a[1]) * (b[0] - a[0])) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) out.push((t - 0.5) * 2 * reach);
  }
  return out.sort((x, y) => x - y);
}
const centroid = r => { const pts = r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1] ? r.slice(0, -1) : r; return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length]; };

// ---------- svg helpers ----------

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid);
  return e;
};
const pathD = (pts, close) => pts.length ? 'M' + pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + (close ? 'Z' : '') : '';
const txt = (x, y, s, attrs = {}) => el('text', { x: x.toFixed(1), y: y.toFixed(1), ...attrs }, String(s));
const INK = '#1c2a22', SOFT = '#5d6b62', FONT = "'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif";

// The shared patterns: stippled sand, rippled water.
function defs(id) {
  return el('defs', {},
    el('pattern', { id: `${id}-sand`, width: 5, height: 5, patternUnits: 'userSpaceOnUse' },
      el('rect', { width: 5, height: 5, fill: '#fbf2d6' }),
      el('circle', { cx: 1.2, cy: 1.3, r: 0.45, fill: '#c7a764' }), el('circle', { cx: 3.7, cy: 3.6, r: 0.45, fill: '#c7a764' })),
    el('pattern', { id: `${id}-water`, width: 12, height: 6, patternUnits: 'userSpaceOnUse' },
      el('rect', { width: 12, height: 6, fill: '#cfe8f6' }),
      el('path', { d: 'M0,3.5 q3,-2 6,0 t6,0', fill: 'none', stroke: '#7fb8dc', 'stroke-width': 0.6 })),
    el('marker', { id: `${id}-arr`, viewBox: '0 0 6 6', refX: 5, refY: 3, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' },
      el('path', { d: 'M0,0 L6,3 L0,6 z', fill: SOFT })));
}

// Labels that keep out of each other's way: try each spot in turn, keep the first free one.
function labeller() {
  const boxes = [];
  const free = b => boxes.every(o => b[0] > o[2] || b[2] < o[0] || b[1] > o[3] || b[3] < o[1]);
  return {
    block(b) { boxes.push(b); },
    place(spots, w, hgt, bounds) {
      for (const [x, y, anchor = 'middle'] of spots) {
        const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
        const b = [x0 - 1, y - hgt * 0.8, x0 + w + 1, y + hgt * 0.25];
        if (bounds && (b[0] < bounds[0] || b[2] > bounds[2] || b[1] < bounds[1] || b[3] > bounds[3])) continue;
        if (free(b)) { boxes.push(b); return [x, y, anchor]; }
      }
      return null;
    },
  };
}
const textW = (s, size) => String(s).length * size * 0.52;

// ---------- heights (for plays-like and the green page) ----------

// Heights in metres at many points, once the height tiles are in (or null
// where there are none). Waits for tiles up to ~6 s.
function heightsAt(cid, info, pts) {
  return new Promise(resolve => {
    let done = false, timer = null;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve(pts.map(p => heightAt(cid, info, p))); };
    const tryNow = () => {
      if (done) return;
      const hs = pts.map(p => heightAt(cid, info, p, () => setTimeout(tryNow, 0)));
      if (hs.every(v => v != null)) finish();
    };
    timer = setTimeout(finish, 6000);
    tryNow();
  });
}
const contourCache = {};
const loadContours = cid => (contourCache[cid] ||= fetch(new URL(`data/elev/${cid}.contours.json`, location.href)).then(r => (r.ok ? r.json() : null)).catch(() => null));

// Marching squares over a grid of heights: line segments at each level.
function isolines(grid, nx, ny, x0, y0, step, levels) {
  const segs = [];
  const at = (i, j) => grid[j * nx + i];
  for (const lv of levels) {
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      if ([a, b, c, d].some(v => v == null)) continue;
      const X = x0 + i * step, Y = y0 + j * step;
      const pts = [];
      const edge = (v1, v2, p1, p2) => { if ((v1 < lv) !== (v2 < lv)) { const t = (lv - v1) / (v2 - v1); pts.push([p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]); } };
      edge(a, b, [X, Y], [X + step, Y]); edge(b, c, [X + step, Y], [X + step, Y + step]);
      edge(c, d, [X + step, Y + step], [X, Y + step]); edge(d, a, [X, Y + step], [X, Y]);
      if (pts.length === 2) segs.push(pts);
      else if (pts.length === 4) segs.push([pts[0], pts[1]], [pts[2], pts[3]]);
    }
  }
  return segs;
}

// A box blur of radius r cells over a grid with holes (null) in it.
function blur(grid, nx, ny, r) {
  const out = new Array(grid.length).fill(null);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (grid[j * nx + i] == null) continue;
    let sum = 0, cnt = 0;
    for (let b = Math.max(0, j - r); b <= Math.min(ny - 1, j + r); b++) for (let a = Math.max(0, i - r); a <= Math.min(nx - 1, i + r); a++) {
      const v = grid[b * nx + a]; if (v != null) { sum += v; cnt++; }
    }
    out[j * nx + i] = sum / cnt;
  }
  return out;
}

// ---------- one hole's facts ----------

// Everything the pages need about hole n from the tee set `teeName`.
// helpers: { holeFeatures(ch), ownGreen(ch) } from the hole screen.
function holeFacts(n, teeName, helpers) {
  const ch = course.holes[n - 1];
  const own = helpers.holeFeatures(ch);
  const ownSet = new Set(own);
  const greenF = helpers.ownGreen(ch);
  const boxes = own.filter(f => f.t === 'tee');
  const teeBox = teeBoxFor(teeName, ch, boxes);
  const tee = teePosition(teeName, ch, boxes);
  const line = [tee, ...ch.line.slice(1)];
  const pin = ch.pin;
  const greenRing = greenF ? closeRing(ringOf(greenF)) : null;
  return { ch, own, ownSet, greenF, greenRing, boxes, teeBox, tee, line, pin };
}

// "To the front of the green" from any point, in a frame f (yards): along the
// straight line to the middle of the green, to where it first meets the green.
function frontFn(f, greenRing, pin) {
  if (!greenRing) return p => dist(p, f.fwd(pin));
  const g = greenRing.map(f.fwd), c = centroid(g);
  return p => {
    if (inside(p, g)) return 0;
    const t = firstCross(p, c, g);
    return t == null ? dist(p, c) : dist(p, c) * t;
  };
}

// ---------- the hole page ----------

// A tour-style flip page: one tall strip, folded in the middle like a book
// bound at the top — the green half above the fold, the tee half below.
export const FLIP_H = 1300; // the strip's height; each half is FLIP_H / 2
const SANS = 'Arial, Helvetica, system-ui, sans-serif';

async function holePage(n, teeName, prefs, helpers, opts) {
  const H = FLIP_H, FOLD = H / 2;
  const F = holeFacts(n, teeName, helpers);
  const { ch, line, tee, pin, greenRing } = F;
  const teeSet = course.tees.find(t => t.name === teeName) || course.tees[0];
  const card = teeSet?.yards[n - 1];
  const up = bearingOf(tee, greenRing ? centroid(greenRing) : pin, frame(tee, 0));
  const f = frame(tee, up);
  const toFront = frontFn(f, greenRing, pin);
  const L = line.map(f.fwd);
  const greenL = greenRing ? greenRing.map(f.fwd) : null;
  const ownFair = F.own.filter(x => x.t === 'fairway').map(x => closeRing(ringOf(x)).map(f.fwd));
  const teeBoxesL = F.boxes.map(b => ({ b, r: closeRing(ringOf(b)).map(f.fwd) }));

  // What has to fit: the line, the hole's fairways, green and tee boxes.
  const keep = [...L, ...ownFair.flat(), ...(greenL || []), ...teeBoxesL.flatMap(t => t.r)];
  let [minX, maxX] = [Math.min(...keep.map(p => p[0])), Math.max(...keep.map(p => p[0]))];
  let [minY, maxY] = [Math.min(...keep.map(p => p[1])), Math.max(...keep.map(p => p[1]))];
  minX = Math.min(minX - 30, -42); maxX = Math.max(maxX + 30, 42); minY -= 16; maxY += 26;
  const left = 8, right = W - 8, top = 8, bottom = H - 8;
  const s = Math.min((right - left) / (maxX - minX), (bottom - top - 90) / (maxY - minY), 4.6);
  // Centred across; along the hole, the green sits a little below the top.
  const cx = (left + right) / 2 - ((minX + maxX) / 2) * s;
  const spare = (bottom - top) - (maxY - minY) * s;
  const cy = top + Math.min(spare / 2, 70) + maxY * s;
  const P = ([x, y]) => [cx + x * s, cy - y * s];
  const viewYd = [(left - cx) / s, (right - cx) / s, (cy - bottom) / s, (cy - top) / s];
  const inView = pts => pts.some(([x, y]) => x > viewYd[0] - 20 && x < viewYd[1] + 20 && y > viewYd[2] - 20 && y < viewYd[3] + 20);

  const id = `bk${n}p${Math.random().toString(36).slice(2, 7)}`;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bookpage flip', xmlns: SVGNS, 'font-family': SANS });
  const ownShapes = [...ownFair, ...(greenL ? [greenL] : []), ...teeBoxesL.map(t => t.r)];
  svg.append(defs(id),
    el('defs', {},
      el('radialGradient', { id: `${id}-tree`, cx: '38%', cy: '35%', r: '70%' },
        el('stop', { offset: '0%', 'stop-color': '#6aa84c' }), el('stop', { offset: '65%', 'stop-color': '#3a7a33' }), el('stop', { offset: '100%', 'stop-color': '#245a26' })),
      // Leafy texture over the trees' colour.
      el('pattern', { id: `${id}-leaf`, width: 7, height: 7, patternUnits: 'userSpaceOnUse' },
        el('circle', { cx: 1.5, cy: 1.8, r: 1.1, fill: '#9ccc78', 'fill-opacity': 0.45 }), el('circle', { cx: 5, cy: 4.6, r: 1.2, fill: '#163f18', 'fill-opacity': 0.35 }),
        el('circle', { cx: 4.4, cy: 1.2, r: 0.7, fill: '#163f18', 'fill-opacity': 0.3 }), el('circle', { cx: 1.4, cy: 5.6, r: 0.8, fill: '#b4dc90', 'fill-opacity': 0.35 })),
      el('linearGradient', { id: `${id}-fold`, x1: 0, y1: 0, x2: 0, y2: 1 },
        el('stop', { offset: '0%', 'stop-color': '#000', 'stop-opacity': 0 }), el('stop', { offset: '78%', 'stop-color': '#000', 'stop-opacity': 0.05 }),
        el('stop', { offset: '80%', 'stop-color': '#000', 'stop-opacity': 0.2 }), el('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': 0 })),
      el('clipPath', { id: `${id}-own` }, ownShapes.map(r => el('path', { d: pathD(r.map(P), true) })))),
    el('clipPath', { id: `${id}-clip` }, el('rect', { x: left, y: top, width: right - left, height: bottom - top })));
  svg.append(el('rect', { width: W, height: H, fill: '#fff' }));
  const mapG = el('g', { 'clip-path': `url(#${id}-clip)` });
  const labG = el('g', { 'clip-path': `url(#${id}-clip)` });
  svg.append(mapG, labG);
  const lab = labeller();
  const bounds = [left + 4, top + 4, right - 4, bottom - 4];

  const elevId = partOf(course, n);
  const info = opts.tourney ? null : (await elevIndex())[elevId] || null;

  // The hole's corridor: a pale band either side of the line, like the rough
  // the book is drawn on.
  const end = greenL ? centroid(greenL) : L.at(-1);
  if (prefs.fairway) mapG.append(el('path', { d: pathD([...L.slice(0, -1), end].map(P)), fill: 'none', stroke: '#f0f8f2', 'stroke-width': 76 * s, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));

  // The course's shapes.
  const feats = course.features.filter(x => x.t !== 'ob').map(x => ({ x, r: closeRing(ringOf(x)).map(f.fwd) })).filter(o => inView(o.r));
  const own = o => F.ownSet.has(o.x);
  const draw = (o, attrs, g = mapG) => g.append(el('path', { d: pathD(o.r.map(P), true), ...attrs }));
  const faint = o => (!own(o) ? { opacity: 0.5 } : {});
  const others = prefs.otherHoles;
  if (prefs.water) for (const o of feats.filter(o => o.x.t === 'water')) draw(o, { fill: '#dce9ee', stroke: '#b3ccd6', 'stroke-width': 1 });
  if (prefs.fairway) for (const o of feats.filter(o => o.x.t === 'fairway' && (own(o) || others))) draw(o, { fill: '#cdeedb', stroke: '#9fd3b4', 'stroke-width': 1, ...faint(o) });
  for (const o of feats.filter(o => o.x.t === 'tee' && (own(o) || others))) {
    if (own(o) && !prefs.allTees && o.x !== F.teeBox) continue;
    draw(o, { fill: o.x === F.teeBox ? '#9edfb5' : '#d6f1e1', stroke: '#86c79d', 'stroke-width': 1, ...faint(o) });
  }
  for (const o of feats.filter(o => o.x.t === 'green' && (own(o) || others))) draw(o, own(o) ? { fill: '#62cf8a', stroke: '#1fae4b', 'stroke-width': 2.2 } : { fill: '#cdeedb', stroke: '#9fd3b4', 'stroke-width': 1, opacity: 0.6 });

  // Contours on the hole's own short grass, with small downhill arrows.
  if (prefs.contours && info) {
    const gj = await loadContours(elevId);
    const g = el('g', { 'clip-path': `url(#${id}-own)`, fill: 'none', stroke: '#5f9f78', 'stroke-width': 0.55, 'stroke-opacity': 0.8 });
    let arrows = '';
    const near = pts => pts.some(p => ownShapes.some(r => inside(p, r)));
    for (const c of gj?.features || []) {
      const pts = c.geometry.coordinates.map(q => f.fwd([q[1], q[0]]));
      if (!inView(pts) || !near(pts)) continue;
      g.append(el('path', { d: pathD(pts.map(P)) }));
      let next = 6, run = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const seg = dist(pts[i], pts[i + 1]);
        while (seg && next <= run + seg) {
          const t = (next - run) / seg, p = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
          next += 16;
          if (!ownShapes.some(r => inside(p, r))) continue;
          const dx = (pts[i + 1][0] - pts[i][0]) / seg, dy = (pts[i + 1][1] - pts[i][1]) / seg;
          const side = c.properties.dn === 1 ? [-dy, dx] : [dy, -dx];
          const a = P([p[0] + side[0] * 0.8, p[1] + side[1] * 0.8]), b = P([p[0] + side[0] * 3.6, p[1] + side[1] * 3.6]);
          const ux = (b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]), uy = (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]);
          arrows += `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}M${(b[0] - ux * 2.6 - uy * 1.6).toFixed(1)},${(b[1] - uy * 2.6 + ux * 1.6).toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}L${(b[0] - ux * 2.6 + uy * 1.6).toFixed(1)},${(b[1] - uy * 2.6 - ux * 1.6).toFixed(1)}`;
        }
        run += seg;
      }
    }
    if (arrows) g.append(el('path', { d: arrows, stroke: '#4e6e5a', 'stroke-width': 0.7, 'stroke-opacity': 0.75 }));
    mapG.append(g);
  }

  if (prefs.bunkers) for (const o of feats.filter(o => o.x.t === 'bunker')) draw(o, { fill: '#ecdcc9', stroke: '#d8b896', 'stroke-width': 1 });
  if (prefs.trees) for (const o of feats.filter(o => o.x.t === 'trees')) {
    draw(o, { fill: `url(#${id}-tree)`, stroke: '#245a26', 'stroke-width': 1.6, 'stroke-dasharray': '1.6 1.4', 'stroke-linecap': 'round' });
    draw(o, { fill: `url(#${id}-leaf)` });
  }
  if (prefs.ob) {
    for (const x of course.features.filter(x => x.t === 'ob')) {
      for (const r of x.p.length > 1 ? x.p.slice(1) : x.p) {
        const pts = r.map(f.fwd);
        if (!inView(pts)) continue;
        mapG.append(el('path', { d: pathD(pts.map(P)), fill: 'none', stroke: '#333', 'stroke-width': 1.1, 'stroke-dasharray': '1.2 4.5', 'stroke-linecap': 'round' }));
      }
    }
  }
  if (prefs.centre) mapG.append(el('path', { d: pathD([...L.slice(0, -1), end].map(P)), fill: 'none', stroke: '#8fb59c', 'stroke-width': 0.8, 'stroke-dasharray': '3 3' }));
  if (greenL) { const [x, y] = P(centroid(greenL)); lab.block([x - 8, y - 8, x + 8, y + 8]); }

  // Walk the hole's line in 1-yard steps: each step's point, direction and yards to the front.
  const walk = [];
  for (let i = 0; i < L.length - 1; i++) {
    const a = L[i], b = L[i + 1], seg = dist(a, b), d = [(b[0] - a[0]) / seg, (b[1] - a[1]) / seg];
    for (let t = 0; t < seg; t += 1) { const p = [a[0] + d[0] * t, a[1] + d[1] * t]; walk.push({ p, d, front: toFront(p), fromTee: (walk.length ? walk.at(-1).fromTee + 1 : 0) }); }
  }
  const spotAt = yd => { for (let i = walk.length - 1; i > 0; i--) if (walk[i].front >= yd) return walk[i]; return null; };
  const edgesAt = w => {
    const perp = [w.d[1], -w.d[0]];
    const hits = ownFair.flatMap(r => crossings(w.p, perp, r, 60));
    if (!hits.length || !ownFair.some(r => inside(w.p, r))) return null;
    const lft = hits.filter(v => v < 0), rgt = hits.filter(v => v > 0);
    if (!lft.length || !rgt.length) return null;
    const l = Math.max(...lft), r = Math.min(...rgt);
    return { perp, l: [w.p[0] + perp[0] * l, w.p[1] + perp[1] * l], r: [w.p[0] + perp[0] * r, w.p[1] + perp[1] * r], width: r - l };
  };

  // Fairway widths: a line edge to edge with the width in a grey circle.
  const widthMarks = [];
  if (prefs.width && ch.par > 3) {
    for (let fromTee = 200; widthMarks.length < 5; fromTee += 40) {
      const w = walk.find(q => q.fromTee >= fromTee);
      if (!w || w.front < 50) break;
      const e = edgesAt(w);
      if (!e || e.width < 8) continue;
      widthMarks.push(e);
      const A = P([e.l[0] - e.perp[0] * 3, e.l[1] - e.perp[1] * 3]), B = P([e.r[0] + e.perp[0] * 3, e.r[1] + e.perp[1] * 3]);
      const m = P([(e.l[0] + e.r[0]) / 2, (e.l[1] + e.r[1]) / 2]);
      labG.append(el('path', { d: pathD([A, B]), stroke: '#3b4a42', 'stroke-width': 0.9 }),
        el('circle', { cx: m[0], cy: m[1], r: 8, fill: '#e3e7ec', stroke: '#9aa3ad', 'stroke-width': 0.9 }),
        txt(m[0], m[1] + 3.2, Math.round(e.width), { 'font-size': 8.5, fill: '#4a5560', 'text-anchor': 'middle' }));
      lab.block([m[0] - 9, m[1] - 9, m[0] + 9, m[1] + 9]);
    }
  }

  // Height circles down the middle: how many feet each spot is above (+) or
  // below (−) the middle of the green.
  let plays = null;
  if (info && greenRing && (prefs.heights || prefs.playsLike)) {
    const spots = [];
    if (prefs.heights) {
      for (let yd = 20; ; yd += 25) {
        const w = spotAt(yd);
        if (!w || w.fromTee < 30) break;
        if (ownFair.some(r => inside(w.p, r)) || (greenL && inside(w.p, greenL))) spots.push(w);
      }
    }
    const hs = await heightsAt(elevId, info, [centroid(greenRing), tee, ...spots.map(w => f.back(w.p))]);
    const [hg, ht] = hs;
    if (prefs.playsLike && hg != null && ht != null) plays = { ft: Math.round((hg - ht) * FT_PER_M), yd: Math.round((hg - ht) / M_PER_YD) };
    spots.forEach((w, i) => {
      const v = hs[i + 2];
      if (v == null || hg == null) return;
      const ft = Math.round((v - hg) * FT_PER_M), [x, y] = P(w.p);
      const b = [x - 8, y - 8, x + 8, y + 8];
      if (!lab.place([[x - 8, y + 4, 'start']], 16, 12, bounds)) return;
      const col = ft < 0 ? '#c8352b' : '#1f9a46';
      labG.append(el('circle', { cx: x, cy: y, r: 7.5, fill: '#fff', stroke: col, 'stroke-width': 1 }),
        txt(x, y + 3, ft > 0 ? `+${ft}` : ft < 0 ? `−${-ft}` : '0', { 'font-size': 7.5, fill: col, 'text-anchor': 'middle', 'font-weight': 700 }));
      lab.block(b);
    });
  }

  // Layup lines across the fairway, to the front of the green.
  const layupYds = [100, 150, 200, 250, 300];
  if (prefs.layup) {
    for (const yd of layupYds) {
      const w = spotAt(yd);
      if (!w || w.fromTee < 40) continue;
      const e = edgesAt(w), perp = [w.d[1], -w.d[0]];
      const a = e ? [e.l[0] - perp[0] * 3, e.l[1] - perp[1] * 3] : [w.p[0] - perp[0] * 16, w.p[1] - perp[1] * 16];
      const b = e ? [e.r[0] + perp[0] * 3, e.r[1] + perp[1] * 3] : [w.p[0] + perp[0] * 16, w.p[1] + perp[1] * 16];
      const [A, B] = [P(a), P(b)];
      labG.append(el('path', { d: pathD([A, B]), stroke: '#2e7bd6', 'stroke-width': 1, 'stroke-dasharray': '5 3' }));
      const wdt = textW(yd, 10) + 8;
      const spot = lab.place([[B[0] + 3, B[1] + 3.5, 'start'], [A[0] - 3, A[1] + 3.5, 'end']], wdt, 12, bounds);
      if (spot) {
        const [x, y, anc] = spot, x0 = anc === 'start' ? x : x - wdt;
        labG.append(el('rect', { x: x0, y: y - 9.5, width: wdt, height: 13, rx: 6.5, fill: '#2e7bd6' }),
          txt(x0 + wdt / 2, y, yd, { 'font-size': 10, 'font-weight': 700, fill: '#fff', 'text-anchor': 'middle' }));
      }
    }
  }

  // Numbered boxes: a yellow dot on the spot and the yards to the front in a
  // box beside it (with a short leader when it has to sit further off).
  const box = (q, v, opt = {}) => {
    const [x, y] = P(q), size = 11, wdt = textW(v, size) * 1.12 + 8, hgt = 15;
    const dir = opt.side ?? 1;
    const near = [[x + dir * 6, y - 1], [x + dir * 6, y + 13], [x + dir * 6, y - 10], [x - dir * 6, y - 1], [x - dir * 6, y + 13], [x - dir * 6, y - 10]];
    const far = [[x + dir * 16, y + 4], [x + dir * 16, y - 12], [x + dir * 16, y + 20], [x - dir * 16, y + 4]];
    let spot = null, lead = false;
    for (const [i, cand] of [...near, ...far].entries()) {
      const anc = cand[0] >= x ? 'start' : 'end';
      spot = lab.place([[cand[0], cand[1], anc]], wdt, hgt, bounds);
      if (spot) { lead = i >= near.length; break; }
    }
    labG.append(el('circle', { cx: x, cy: y, r: 2.6, fill: opt.dot || '#f3df1d', stroke: '#6e6410', 'stroke-width': 0.7 }));
    if (!spot) return;
    const [sx, sy, anc] = spot, x0 = anc === 'start' ? sx : sx - wdt;
    if (lead) labG.append(el('path', { d: pathD([[x, y], [anc === 'start' ? x0 : x0 + wdt, sy - 4]]), stroke: '#777', 'stroke-width': 0.6 }));
    labG.append(el('rect', { x: x0, y: sy - 11, width: wdt, height: hgt, fill: '#fff', stroke: '#8c8c8c', 'stroke-width': 0.8, rx: 1 }),
      txt(x0 + wdt / 2, sy, v, { 'font-size': size, 'font-weight': 700, fill: opt.color || '#111', 'text-anchor': 'middle' }));
  };

  // Bunker and water: the near edge (to reach it) and the far edge (to carry it).
  if (prefs.hazards) {
    const hz = F.own.filter(x => (x.t === 'bunker' && prefs.bunkers) || (x.t === 'water' && prefs.water));
    for (const x of hz) {
      const pts = ringOf(x).map(f.fwd).filter(p => walk.some(w => Math.abs(w.p[1] - p[1]) < 3 && Math.abs(w.p[0] - p[0]) < 45));
      if (pts.length < 2) continue;
      const fr = pts.map(toFront);
      const iR = fr.indexOf(Math.max(...fr)), iC = fr.indexOf(Math.min(...fr));
      const reach = Math.round(fr[iR]), carry = Math.round(fr[iC]);
      if ((x.t === 'bunker' ? carry < 12 : reach < 15) || reach > 420) continue;
      const c = centroid(pts);
      const nearLine = walk.reduce((b, w) => (dist(w.p, c) < dist(b.p, c) ? w : b), walk[0]);
      const side = (c[0] - nearLine.p[0]) * nearLine.d[1] - (c[1] - nearLine.p[1]) * nearLine.d[0] >= 0 ? 1 : -1;
      box(pts[iR], reach, { side });
      if (reach - carry >= 3) box(pts[iC], carry, { side, color: '#1f8a3f' });
    }
  }

  // Fairway edge numbers every 20 yards.
  if (prefs.edges) {
    for (let yd = 40; yd <= 340; yd += 20) {
      if (prefs.layup && layupYds.includes(yd)) continue;
      const w = spotAt(yd);
      if (!w || w.fromTee < 60) continue;
      const e = edgesAt(w);
      if (!e) continue;
      box(e.l, Math.round(toFront(e.l)), { side: -1 });
      box(e.r, Math.round(toFront(e.r)), { side: 1 });
    }
  }

  // Tee boxes, each with its yards to the front.
  for (const { b, r } of teeBoxesL) {
    const chosen = b === F.teeBox;
    if (!chosen && !prefs.allTees) continue;
    const c = P(centroid(r));
    const names = course.tees.filter(t => teeBoxFor(t.name, ch, F.boxes) === b).map(t => t.name);
    const v = Math.round(toFront(f.fwd(boxCentre(b))));
    const label = `${names.join('/') || 'Tee'} ${v}`, size = chosen ? 10 : 8.5;
    const spot = lab.place([[c[0] + 10, c[1] + 3, 'start'], [c[0] - 10, c[1] + 3, 'end'], [c[0] + 10, c[1] + 13, 'start'], [c[0] - 10, c[1] + 13, 'end']], textW(label, size) * 1.1, size + 2, bounds);
    if (spot) labG.append(txt(spot[0], spot[1], label, { 'font-size': size, 'font-weight': chosen ? 700 : 400, fill: chosen ? '#111' : '#555', 'text-anchor': spot[2] }));
  }
  if (!F.teeBox) { const [x, y] = P(f.fwd(tee)); labG.append(el('circle', { cx: x, cy: y, r: 3, fill: '#111' })); }

  // The fold, with the hole number on it.
  const foldBand = el('rect', { x: left, y: FOLD - 34, width: right - left, height: 80, fill: `url(#${id}-fold)` });
  svg.append(foldBand, el('line', { x1: left, x2: right, y1: FOLD, y2: FOLD, stroke: '#9a9a9a', 'stroke-width': 0.8 }));
  const ring = (x, y, r, kids) => el('g', {}, el('circle', { cx: x, cy: y, r, fill: '#fff', stroke: '#2b2b2b', 'stroke-width': 1.6 }), kids);
  svg.append(ring(right - 30, FOLD, 20, txt(right - 30, FOLD + 9, n, { 'font-size': 25, 'font-weight': 700, 'text-anchor': 'middle', fill: '#111' })));

  // Top: north arrow and the course; the tee and its numbers on the right.
  const nv = f.rotV([0, 1]), nx = left + 24, ny = top + 26;
  const nameW = Math.max(textW(course.name.replace(/ Golf (Club|Course)$/, ''), 11.5), textW(course.location || 'Golf Course', 11.5)) * 1.15 + 14;
  svg.append(el('rect', { x: nx + 16, y: ny - 15, width: nameW, height: 32, rx: 4, fill: '#fff', 'fill-opacity': 0.92 }));
  svg.append(el('circle', { cx: nx, cy: ny, r: 15, fill: '#fff', stroke: '#2b2b2b', 'stroke-width': 1.2 }),
    el('path', { d: `M${(nx + nv[0] * 11).toFixed(1)},${(ny - nv[1] * 11).toFixed(1)}L${(nx - nv[0] * 8 + nv[1] * 6).toFixed(1)},${(ny + nv[1] * 8 + nv[0] * 6).toFixed(1)}L${(nx - nv[0] * 3).toFixed(1)},${(ny + nv[1] * 3).toFixed(1)}Z`, fill: '#111' }),
    txt(nx + 22, ny - 2, course.name.replace(/ Golf (Club|Course)$/, ''), { 'font-size': 11.5, fill: '#111' }),
    txt(nx + 22, ny + 12, /Golf (Club|Course)$/.test(course.name) ? course.name.match(/Golf (Club|Course)$/)[0] : course.location || '', { 'font-size': 11.5, fill: '#111' }));
  const info2 = [`${(teeSet?.name || teeName).toUpperCase()} TEES`, `${toFrontTee(F, f, toFront)} to front`];
  if (plays) info2.push(`Plays ${plays.yd >= 0 ? '+' : '−'}${Math.abs(plays.yd)} (${Math.abs(plays.ft)} ft ${plays.ft >= 0 ? 'up' : 'down'})`);
  const iw = Math.max(...info2.map(t => textW(t, 10))) + 14;
  svg.append(el('rect', { x: right - 8 - iw, y: top + 8, width: iw, height: 14 * info2.length + 6, rx: 4, fill: '#fff', 'fill-opacity': 0.92, stroke: '#c9c9c9', 'stroke-width': 0.8 }),
    ...info2.map((t, i) => txt(right - 15, top + 22 + i * 14, t, { 'font-size': 10, 'text-anchor': 'end', fill: i === 2 ? (plays.ft >= 0 ? '#a0522d' : '#2f6f9a') : '#111', 'font-weight': i === 0 ? 700 : 400 })));

  // Bottom: par and yards on the left, the hole number on the right.
  svg.append(ring(left + 32, bottom - 32, 24, [
    txt(left + 32, bottom - 34, `Par ${ch.par}`, { 'font-size': 11, 'text-anchor': 'middle', fill: '#111' }),
    txt(left + 32, bottom - 22, card ?? '', { 'font-size': 9.5, 'text-anchor': 'middle', fill: '#111' })]),
  ring(right - 32, bottom - 32, 24, txt(right - 32, bottom - 21, n, { 'font-size': 29, 'font-weight': 700, 'text-anchor': 'middle', fill: '#111' })),
  el('rect', { x: W / 2 - 112, y: bottom - 47, width: 224, height: 42, rx: 5, fill: '#fff', 'fill-opacity': 0.92 }),
  txt(W / 2, bottom - 36, 'ALL NUMBERS: YARDS TO THE FRONT OF THE GREEN', { 'font-size': 7.5, 'text-anchor': 'middle', fill: '#555', 'letter-spacing': 0.4 }),
  txt(W / 2, bottom - 25, [prefs.hazards ? 'black = reach · green = carry' : '', prefs.heights && info ? '○ ft above (+) / below (−) the green' : ''].filter(Boolean).join('   '), { 'font-size': 7.5, 'text-anchor': 'middle', fill: '#555' }));
  if (prefs.north) {
    const len = 50 * s, sx = W / 2 - len / 2, sy = bottom - 12;
    svg.append(el('path', { d: `M${sx},${sy - 3}V${sy}H${sx + len}V${sy - 3}`, fill: 'none', stroke: '#777', 'stroke-width': 0.8 }),
      txt(sx + len + 4, sy, '50 yd', { 'font-size': 7.5, fill: '#777' }));
  }
  svg.append(el('rect', { x: 2.5, y: 2.5, width: W - 5, height: H - 5, fill: 'none', stroke: '#6f9a69', 'stroke-width': 5 }));
  return svg;
}
const toFrontTee = (F, f, toFront) => Math.round(toFront(f.fwd(F.tee)));

// The two halves of a flip page, as separate pages (for printing).
function flipHalves(svg) {
  const H = FLIP_H, a = svg.cloneNode(true), b = svg.cloneNode(true);
  a.setAttribute('viewBox', `0 0 ${W} ${H / 2}`); b.setAttribute('viewBox', `0 ${H / 2} ${W} ${H / 2}`);
  return [a, b];
}

// ---------- the green page ----------

async function greenPage(n, teeName, prefs, helpers, opts) {
  const H = FLIP_H / 2;
  const F = holeFacts(n, teeName, helpers);
  const { ch, greenRing, line } = F;
  if (!greenRing) return null;
  const gC = centroid(greenRing);
  // Turned as the green is played into: from the hole line's last bend.
  const from = line.length > 2 ? line.at(-2) : line[0];
  const f = frame(gC, bearingOf(from, gC, frame(gC, 0)));
  const g = greenRing.map(f.fwd);
  const minX = Math.min(...g.map(p => p[0])), maxX = Math.max(...g.map(p => p[0]));
  const minY = Math.min(...g.map(p => p[1])), maxY = Math.max(...g.map(p => p[1]));
  // Depth and width along the line of play and square to it, through the middle.
  const depth = crossings([0, 0], [0, 1], g, 200), width = crossings([0, 0], [1, 0], g, 200);
  const depthYd = depth.length >= 2 ? Math.round(depth.at(-1) - depth[0]) : Math.round(maxY - minY);
  const widthYd = width.length >= 2 ? Math.round(width.at(-1) - width[0]) : Math.round(maxX - minX);
  const frontY = depth.length ? depth[0] : minY;

  const top = 86, bottom = prefs.notes ? 430 : H - 62, left = 30, right = W - 30;
  const pad = 9;
  const s = Math.min((right - left) / (maxX - minX + pad * 2), (bottom - top) / (maxY - minY + pad * 2));
  const cx = (left + right) / 2 - ((minX + maxX) / 2) * s, cy = (top + bottom) / 2 + ((minY + maxY) / 2) * s;
  const P = ([x, y]) => [cx + x * s, cy - y * s];
  const view = [(left - cx) / s, (right - cx) / s, (cy - bottom) / s, (cy - top) / s];
  const inView = pts => pts.some(([x, y]) => x > view[0] - 10 && x < view[1] + 10 && y > view[2] - 10 && y < view[3] + 10);

  const id = `bk${n}g${Math.random().toString(36).slice(2, 7)}`;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bookpage', xmlns: SVGNS, 'font-family': FONT });
  const gPath = pathD(g.map(P), true);
  svg.append(defs(id),
    el('clipPath', { id: `${id}-clip` }, el('rect', { x: left - 16, y: top, width: right - left + 32, height: bottom - top })),
    el('clipPath', { id: `${id}-green` }, el('path', { d: gPath })));
  svg.append(el('rect', { width: W, height: H, fill: '#fff' }));
  const mapG = el('g', { 'clip-path': `url(#${id}-clip)` });
  svg.append(mapG);

  // What's around the green.
  for (const x of course.features) {
    if (x.t === 'ob' || x === F.greenF) continue;
    if (x.t === 'fairway' && !prefs.fairway) continue;
    if (x.t === 'bunker' && !prefs.bunkers) continue;
    if (x.t === 'water' && !prefs.water) continue;
    if (x.t === 'trees' && !prefs.trees) continue;
    const r = closeRing(ringOf(x)).map(f.fwd);
    if (!inView(r)) continue;
    const style = { fairway: { fill: '#e3f4da', stroke: '#8bbf7b', 'stroke-width': 0.8 }, bunker: { fill: `url(#${id}-sand)`, stroke: '#b8954e', 'stroke-width': 1 },
      water: { fill: `url(#${id}-water)`, stroke: '#4f97c7', 'stroke-width': 1 }, trees: { fill: '#d6eacb', stroke: '#8cb97e', 'stroke-width': 0.7 },
      tee: { fill: '#eef7e9', stroke: '#9cc48f', 'stroke-width': 0.7 }, green: { fill: '#e3f4da', stroke: '#8bbf7b', 'stroke-width': 0.7 } }[x.t];
    if (style) mapG.append(el('path', { d: pathD(r.map(P), true), ...style }));
  }
  // The fringe, then the green.
  mapG.append(el('path', { d: gPath, fill: 'none', stroke: '#cfe9c2', 'stroke-width': 3 * s, 'stroke-linejoin': 'round' }));
  mapG.append(el('path', { d: gPath, fill: '#a9e3bb' }));

  // The yard grid, lined up on the front of the green and its middle.
  const inner = el('g', { 'clip-path': `url(#${id}-green)` });
  if (prefs.grid) {
    const step = prefs.gridYd;
    let d = '';
    for (let y = frontY; y <= maxY + step; y += step) { const a = P([minX - 2, y]), b = P([maxX + 2, y]); d += `M${a[0].toFixed(1)},${a[1].toFixed(1)}H${b[0].toFixed(1)}`; }
    for (let x = 0; x <= maxX + step; x += step) { const a = P([x, minY - 2]), b = P([x, maxY + 2]); d += `M${a[0].toFixed(1)},${a[1].toFixed(1)}V${b[1].toFixed(1)}`; }
    for (let x = -step; x >= minX - step; x -= step) { const a = P([x, minY - 2]), b = P([x, maxY + 2]); d += `M${a[0].toFixed(1)},${a[1].toFixed(1)}V${b[1].toFixed(1)}`; }
    inner.append(el('path', { d, stroke: '#ffffff', 'stroke-width': 0.9, opacity: 0.9 }));
  }

  // Heights over the green: contours every few inches and slope arrows.
  const elevId = partOf(course, n);
  const info = opts.tourney ? null : (await elevIndex())[elevId] || null;
  let slopeNote = '', relief = null;
  if (info && (prefs.greenContours || prefs.slopes)) {
    const step = 0.5, x0 = minX - 3, y0 = minY - 3;
    const nx = Math.ceil((maxX - minX + 6) / step) + 1, ny = Math.ceil((maxY - minY + 6) / step) + 1;
    const pts = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pts.push(f.back([x0 + i * step, y0 + j * step]));
    const hs = await heightsAt(elevId, info, pts);
    // The lidar is about 2 m a pixel: smooth it over a couple of yards so the
    // lines and arrows show the green's shape, not the pixels.
    const grid = blur(blur(hs.map(v => (v == null ? null : v * IN_PER_M)), nx, ny, 3), nx, ny, 3);
    const onGreen = grid.map((v, k) => (v != null && inside([x0 + (k % nx) * step, y0 + Math.floor(k / nx) * step], g) ? v : null)).filter(v => v != null);
    if (onGreen.length) {
      const lo = Math.min(...onGreen), hi = Math.max(...onGreen);
      relief = hi - lo;
      if (prefs.greenContours) {
        const iv = [1, 2, 3, 4, 6, 12].find(v => relief / v <= 12) || 24;
        const levels = [];
        for (let v = Math.ceil(lo / iv) * iv; v <= hi; v += iv) levels.push(v);
        const segs = isolines(grid, nx, ny, x0, y0, step, levels);
        inner.append(el('path', { d: segs.map(sg => pathD(sg.map(P))).join(''), fill: 'none', stroke: '#2f5f3a', 'stroke-width': 0.7, 'stroke-opacity': 0.75, 'stroke-linecap': 'round' }));
        slopeNote = `Contours every ${iv}" of height`;
      }
      if (prefs.slopes) {
        const at = (x, y) => { const i = Math.round((x - x0) / step), j = Math.round((y - y0) / step); return i >= 0 && j >= 0 && i < nx && j < ny ? grid[j * nx + i] : null; };
        const gs = prefs.grid ? prefs.gridYd : 3;
        const groups = { lo: '', mid: '', hi: '', top: '' };
        for (let y = frontY + gs / 2; y < maxY; y += gs) {
          for (let x = (Math.round(minX / gs) - 0.5) * gs; x < maxX; x += gs) {
            if (!inside([x, y], g)) continue;
            const e = at(x + 1.5, y), w = at(x - 1.5, y), nn = at(x, y + 1.5), ss = at(x, y - 1.5);
            if ([e, w, nn, ss].some(v => v == null)) continue;
            const gx = (e - w) / 3 / 36, gy = (nn - ss) / 3 / 36; // rise per yard (inches -> yards)
            const pct = Math.hypot(gx, gy) * 100;
            if (pct < 0.4) continue;
            const dx = -gx / Math.hypot(gx, gy), dy = -gy / Math.hypot(gx, gy);
            const len = Math.min(gs * 0.85, 0.9 + pct * 0.45);
            const a = P([x - (dx * len) / 2, y - (dy * len) / 2]), b = P([x + (dx * len) / 2, y + (dy * len) / 2]);
            const hx = b[0] - a[0], hy = b[1] - a[1], hl = Math.hypot(hx, hy) || 1, ux = hx / hl, uy = hy / hl, k = Math.min(4, hl * 0.45);
            const d = `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}M${(b[0] - ux * k - uy * k * 0.6).toFixed(1)},${(b[1] - uy * k + ux * k * 0.6).toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}L${(b[0] - ux * k + uy * k * 0.6).toFixed(1)},${(b[1] - uy * k - ux * k * 0.6).toFixed(1)}`;
            groups[pct < 1 ? 'lo' : pct < 2 ? 'mid' : pct < 3 ? 'hi' : 'top'] += d;
          }
        }
        const colors = { lo: '#3c8a3a', mid: '#c9a227', hi: '#e07b2a', top: '#c8352b' };
        for (const [k, d] of Object.entries(groups)) if (d) inner.append(el('path', { d, fill: 'none', stroke: colors[k], 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
        {
          const ly = bottom + 31;
          svg.append(txt(W - 16 - 4 * 40 - 4, ly, 'SLOPE', { 'font-size': 8.5, fill: SOFT, 'text-anchor': 'end', 'letter-spacing': 0.6 }));
          [['<1%', 'lo'], ['1–2%', 'mid'], ['2–3%', 'hi'], ['3%+', 'top']].forEach(([t, k], i) => {
            const x = W - 16 - (4 - i) * 40;
            svg.append(el('rect', { x, y: ly - 5, width: 9, height: 3.5, fill: colors[k] }), txt(x + 12, ly, t, { 'font-size': 8.5, fill: SOFT }));
          });
        }
      }
    }
  }
  mapG.append(inner);
  mapG.append(el('path', { d: gPath, fill: 'none', stroke: '#1fae4b', 'stroke-width': 2 }));

  // Edge numbers: yards from the front, down both sides of the grid.
  const side = el('g', { 'font-size': 8.5, fill: SOFT });
  const gs = prefs.grid ? prefs.gridYd : 5;
  const every = gs === 3 ? 6 : 5;
  for (let y = 0; frontY + y <= maxY + 0.01; y += every) {
    const [, Y] = P([0, frontY + y]);
    if (Y < top + 6 || Y > bottom - 2) continue;
    side.append(txt(left - 20, Y + 3, y, { 'text-anchor': 'start' }), txt(right + 20, Y + 3, y, { 'text-anchor': 'end' }));
    svg.append(el('path', { d: `M${left - 8},${Y}H${left - 3}M${right + 3},${Y}H${right + 8}`, stroke: '#c3cbc6', 'stroke-width': 0.8 }));
  }
  svg.append(side);
  // The way in: an arrow at the front.
  const [fx, fy] = P([0, frontY]);
  svg.append(el('path', { d: `M${fx},${Math.min(bottom - 2, fy + 22)}V${fy + 7}`, stroke: INK, 'stroke-width': 1.2, 'marker-end': `url(#${id}-arr)` }));
  // North arrow.
  const nv = f.rotV([0, 1]), nx = W - 30, ny = top + 16;
  svg.append(el('circle', { cx: nx, cy: ny, r: 11, fill: '#fff', stroke: '#c9d0cb', 'stroke-width': 0.8 }),
    el('path', { d: pathD([[nx - nv[0] * 7, ny + nv[1] * 7], [nx + nv[0] * 8, ny - nv[1] * 8]]), stroke: INK, 'stroke-width': 1.1, 'marker-end': `url(#${id}-arr)` }),
    txt(nx + nv[0] * 15, ny - nv[1] * 15 + 3, 'N', { 'font-size': 7.5, 'font-weight': 700, 'text-anchor': 'middle', fill: INK }));

  svg.append(
    txt(16, 54, n, { 'font-size': 54, 'font-weight': 900, fill: INK }),
    txt(16 + textW(n, 54) + 10, 32, 'GREEN', { 'font-size': 15, 'font-weight': 700, fill: INK, 'letter-spacing': 1 }),
    txt(16 + textW(n, 54) + 10, 49, `PAR ${ch.par}`, { 'font-size': 12, fill: SOFT, 'letter-spacing': 1 }),
    txt(W - 16, 34, `DEPTH ${depthYd} YDS`, { 'font-size': 15, 'font-weight': 700, fill: INK, 'text-anchor': 'end', 'letter-spacing': 0.6 }),
    txt(W - 16, 52, `WIDTH ${widthYd} YDS`, { 'font-size': 15, 'font-weight': 700, fill: INK, 'text-anchor': 'end', 'letter-spacing': 0.6 }),
    relief != null ? txt(W - 16, 68, `${(relief / 12).toFixed(1)} FT FROM HIGH TO LOW`, { 'font-size': 10, fill: SOFT, 'text-anchor': 'end', 'letter-spacing': 0.6 }) : null,
    el('line', { x1: 14, x2: W - 14, y1: top - 4, y2: top - 4, stroke: '#d6dcd8', 'stroke-width': 0.8 }),
    txt(16, bottom + 18, `${prefs.grid ? `${prefs.gridYd}-YD GRID · ` : ''}EDGE NUMBERS ARE YARDS FROM THE FRONT`, { 'font-size': 8.5, fill: SOFT, 'letter-spacing': 0.6 }),
    slopeNote ? txt(16, bottom + 30, `${slopeNote} · USGS lidar`, { 'font-size': 8.5, fill: SOFT }) : null,
    txt(16, H - 12, course.name.toUpperCase(), { 'font-size': 9, fill: '#9aa59e', 'letter-spacing': 1 }),
    txt(W - 16, H - 12, `HOLE ${n} · GREEN`, { 'font-size': 9, fill: '#9aa59e', 'text-anchor': 'end', 'letter-spacing': 1 }));
  if (prefs.notes) {
    svg.append(txt(16, bottom + 52, 'NOTES', { 'font-size': 10, 'font-weight': 700, fill: INK, 'letter-spacing': 1.2 }));
    for (let y = bottom + 74; y < H - 30; y += 22) svg.append(el('line', { x1: 16, x2: W - 16, y1: y, y2: y, stroke: '#d6dcd8', 'stroke-width': 0.8 }));
  }
  svg.append(el('rect', { x: 2.5, y: 2.5, width: W - 5, height: H - 5, fill: 'none', stroke: '#6f9a69', 'stroke-width': 5 }));
  return svg;
}

// ---------- the screen ----------

// Opens the yardage book over the hole screen on hole n.
// opts: { teeName, tourney, holeFeatures, ownGreen, onHole(n) }
export function openBook(n, opts) {
  const saved = loadPrefs();
  // In a tournament the switches marked so stay off (and aren't shown).
  const prefs = opts.tourney ? new Proxy(saved, { get: (o, k) => (BOOK_OPTIONS.some(r => r[0] === k && r[4]) ? false : o[k]) }) : saved;
  let hole = n, teeName = opts.teeName;
  const helpers = { holeFeatures: opts.holeFeatures, ownGreen: opts.ownGreen };
  const pages = h('div', { class: 'bookpages' });
  const title = h('b', {});
  const status = h('small', { class: 'bookstatus' });
  let token = 0;
  async function draw() {
    const my = ++token;
    title.textContent = `Hole ${hole}`;
    status.textContent = 'Drawing…';
    const hp = await holePage(hole, teeName, prefs, helpers, opts);
    const gp = prefs.greenPage ? await greenPage(hole, teeName, prefs, helpers, opts) : null;
    if (my !== token) return;
    pages.replaceChildren(hp, ...(gp ? [gp] : []));
    status.textContent = '';
  }
  const elevOk = !opts.tourney;
  const optRows = [];
  let group = '';
  for (const [k, label, grp, , needsElev] of BOOK_OPTIONS) {
    if (needsElev && !elevOk) continue;
    if (grp !== group) { group = grp; optRows.push(h('div', { class: 'bookgroup' }, grp)); }
    const input = h('input', { type: 'checkbox', onchange: e => { prefs[k] = e.target.checked; savePrefs(saved); draw(); } });
    input.checked = prefs[k];
    optRows.push(h('label', { class: 'bookopt' }, input, h('span', {}, label)));
  }
  const gridSel = h('select', { onchange: e => { prefs.gridYd = +e.target.value; savePrefs(saved); draw(); } },
    [3, 5].map(v => h('option', { value: v, selected: v === prefs.gridYd }, `${v}-yard grid`)));
  const setAll = v => { for (const [k] of BOOK_OPTIONS) prefs[k] = v; if (!v) prefs.fairway = prefs.bunkers = prefs.water = prefs.greenPage = true; savePrefs(saved); syncInputs(); draw(); };
  const allOn = h('button', { class: 'bookbtn', onclick: () => setAll(true) }, 'All on');
  const allOff = h('button', { class: 'bookbtn', onclick: () => setAll(false) }, 'Basic');
  const opts_ = h('div', { class: 'bookopts', hidden: true }, h('div', { class: 'bookrow' }, allOn, allOff, gridSel), ...optRows,
    opts.tourney ? h('small', { class: 'muted' }, 'Tournament: no green page, contours or plays-like (Rules of Golf 4.3)') : null);
  function syncInputs() {
    let i = 0;
    for (const [k, , , , needsElev] of BOOK_OPTIONS) { if (needsElev && !elevOk) continue; const inp = opts_.querySelectorAll('input')[i++]; if (inp) inp.checked = prefs[k]; }
  }
  const teeSel = h('select', { 'aria-label': 'Tee box', onchange: e => { teeName = e.target.value; draw(); } },
    course.tees.map(t => h('option', { value: t.name, selected: t.name === teeName }, `${t.name} tees`)));
  const go = d => { hole = ((hole - 1 + d + course.holes.length) % course.holes.length) + 1; draw(); };
  const close = () => { ov.remove(); document.body.classList.remove('bookopen'); if (hole !== n) opts.onHole?.(hole); };
  async function printAll(all) {
    const holes = all ? course.holes.map(c => c.n) : [hole];
    status.textContent = all ? 'Drawing every hole…' : 'Getting ready…';
    const sheet = h('div', { class: 'bookprint' });
    for (const k of holes) {
      sheet.append(...flipHalves(await holePage(k, teeName, prefs, helpers, opts)));
      if (prefs.greenPage) { const gp = await greenPage(k, teeName, prefs, helpers, opts); if (gp) sheet.append(gp); }
      if (all) status.textContent = `Drawing hole ${k} of ${holes.length}…`;
    }
    status.textContent = '';
    document.body.append(sheet);
    document.body.classList.add('bookprinting');
    const done = () => { sheet.remove(); document.body.classList.remove('bookprinting'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  }
  const ov = h('div', { class: 'bookov' },
    h('div', { class: 'booktop' },
      h('button', { class: 'bookbtn', 'aria-label': 'Close', onclick: close }, '✕'),
      h('button', { class: 'bookbtn', 'aria-label': 'Previous hole', onclick: () => go(-1) }, '‹'), title,
      h('button', { class: 'bookbtn', 'aria-label': 'Next hole', onclick: () => go(1) }, '›'),
      teeSel,
      h('button', { class: 'bookbtn', onclick: () => { opts_.hidden = !opts_.hidden; } }, '☰ Show'),
      h('button', { class: 'bookbtn', onclick: () => printAll(false) }, '⎙ Hole'),
      h('button', { class: 'bookbtn', onclick: () => printAll(true) }, '⎙ Book'),
      status),
    opts_, pages);
  document.body.append(ov);
  document.body.classList.add('bookopen');
  draw();
  return ov;
}

// For tests and tools: draw a hole's pages without the screen.
export const bookPages = async (n, teeName, prefs, helpers, opts = {}) => {
  const p = { ...loadPrefs(), ...prefs };
  return [await holePage(n, teeName, p, helpers, opts), p.greenPage ? await greenPage(n, teeName, p, helpers, opts) : null].filter(Boolean);
};

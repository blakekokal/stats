// Yardage book (GPS Overview > View > Yardage book): a clean, printable page
// per hole drawn from the course file, laid out like a tour player's book.
// Laid out like a tour book flipped open: the green page on top, the hole
// page below the fold. The hole page runs tee (bottom) to green (top); the green page shows the
// green as it's approached, with a grid, contours and slope arrows. Every
// number on the pages is yards to the FRONT of the green. What's drawn is
// picked with switches (kept on this device); Print makes a PDF / paper copy
// of this hole or of the whole course.

import { h, course, teePosition, teeBoxFor, boxCentre, partOf, TILE_URL } from './app.js';
import { elevIndex, heightAt } from './elev.js';

const M_PER_DEG = 111320, M_PER_YD = 0.9144, IN_PER_M = 39.3701;
const SVGNS = 'http://www.w3.org/2000/svg';
// One page, in SVG units: 4 1/4 x 7 inches at 100% (the USGA's size limit for
// a yardage book, Rule 4.3 / Interpretation 4.3a(1)/1).
const W = 400, PAGE_H = 658; // a page's height can change for a print layout (opts.pageH)
// The USGA's scale limit for any picture of a putting green: 3/8 inch to 5
// yards (1:480). At W units = 4.25 in that's 400 / 4.25 * 0.075 = 7.06 units a
// yard; every page stays under it.
const MAX_UNITS_PER_YD = 7;

// ---------- the switches ----------

export const BOOK_OPTIONS = [
  // [key, label, group, default, not in a tournament (elevation, or a green map: Rules 4.3)]
  ['fairway', 'Fairways', 'Hole overview page', true],
  ['bunkers', 'Bunkers', 'Hole overview page', true],
  ['water', 'Water', 'Hole overview page', true],
  ['trees', 'Trees', 'Hole overview page', true],
  ['ob', 'Out of bounds', 'Hole overview page', true],
  ['onlyHole', 'Only this hole (saves ink)', 'Hole overview page', true],
  ['otherHoles', 'Neighboring holes', 'Hole overview page', true],
  ['teeInset', 'Zoomed view (starts at the fairway, tees in a box)', 'Hole overview page', true],
  ['allTees', 'Every tee box', 'Hole overview page', true],
  ['centre', 'Center line', 'Hole overview page', true],
  ['layup', 'Center numbers (50 · 100 · 150 · 200 · 250 · 300)', 'Hole overview page', true],
  ['hazards', 'Bunker & water numbers (start and end)', 'Hole overview page', true],
  ['contours', 'Contours & slope arrows', 'Hole overview page', true, true],
  ['deltas', 'Up/down yards by each number', 'Hole overview page', true, true],
  ['north', 'North arrow & scale', 'Hole overview page', true],
  ['greenPage', 'Green page', 'Green overview page', true, true],
  ['grid', 'Yard grid', 'Green overview page', true, true],
  ['greenContours', 'Green contours', 'Green overview page', true, true],
  ['slopes', 'Slope arrows', 'Green overview page', true, true],
  ['notes', 'Notes lines', 'Green overview page', true, true],
];
// Not switches on the screen: Only this hole and the green page are always on,
// and Zoomed view is its own choice (Zoomed or Entire hole).
const HIDDEN = new Set(['onlyHole', 'greenPage', 'teeInset']);
const PREFS_KEY = 'gs:bookPrefs';
function loadPrefs() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { p = {}; }
  const out = {};
  for (const [k, , , d] of BOOK_OPTIONS) out[k] = typeof p[k] === 'boolean' ? p[k] : d;
  out.onlyHole = out.greenPage = true;
  // A new name (was gridYd, 3 to start): everyone starts on the 5-yard grid, like a tour book.
  out.gridYd = out.gridYards = [3, 5].includes(p.gridYards) ? p.gridYards : 5;
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

// ---------- heights (for contours and the green page) ----------

// Heights in metres at many points, once the height tiles are in (or null
// where there are none). Waits for tiles up to ~6 s.
function heightsAt(cid, info, pts) {
  return new Promise(resolve => {
    let done = false, timer = null;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve(pts.map(p => heightAt(cid, info, p))); };
    // Points outside the course's height tiles never get a height: don't wait for them.
    const [w, so, e, no] = info.bounds;
    const inTiles = pts.map(p => p[1] >= w && p[1] <= e && p[0] >= so && p[0] <= no);
    let queued = false;
    const tryNow = () => {
      queued = false;
      if (done) return;
      const again = () => { if (!queued) { queued = true; setTimeout(tryNow, 30); } };
      let ready = true;
      for (let i = 0; i < pts.length; i++) if (inTiles[i] && heightAt(cid, info, pts[i], again) == null) ready = false;
      if (ready) finish();
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

// Heights (inches) on a grid over area [x0, y0, x1, y1] of frame f (yards),
// every `step` yards, smoothed over `r` cells: { at(x, y), lines(levels), lo, hi }.
async function reliefGrid(elevId, info, f, [x0, y0, x1, y1], step, r) {
  // Keep it to about 25,000 points (phones), spacing them out on big areas.
  while (((x1 - x0) / step + 1) * ((y1 - y0) / step + 1) > 25000) step *= 1.25;
  const nx = Math.ceil((x1 - x0) / step) + 1, ny = Math.ceil((y1 - y0) / step) + 1;
  const pts = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pts.push(f.back([x0 + i * step, y0 + j * step]));
  const hs = await heightsAt(elevId, info, pts);
  // The lidar is about 2 m a pixel: smoothing shows the ground's shape, not the pixels.
  let grid = hs.map(v => (v == null ? null : v * IN_PER_M));
  for (let k = 0; k < 2; k++) grid = blur(grid, nx, ny, r);
  const vals = grid.filter(v => v != null);
  const at = (x, y) => { const i = Math.round((x - x0) / step), j = Math.round((y - y0) / step); return i >= 0 && j >= 0 && i < nx && j < ny ? grid[j * nx + i] : null; };
  // A loop, not Math.min(...vals): Safari can't take tens of thousands of arguments.
  let lo = Infinity, hi = -Infinity;
  for (const v of vals) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return { at, lo, hi, ok: vals.length > 0,
    lines: levels => isolines(grid, nx, ny, x0, y0, step, levels) };
}
// Contour levels every `iv` inches between lo and hi.
const levelsOf = (lo, hi, iv) => { const out = []; for (let v = Math.ceil(lo / iv) * iv; v <= hi; v += iv) out.push(v); return out; };
// Small downhill arrows, yardage-book style: one per `gap` yards where
// keep(x, y) says so, longer where it's steeper. Returns an SVG path.
function slopeArrows(R, [x0, y0, x1, y1], gap, P, keep, scale = 1) {
  let d = '';
  const b = Math.max(1.5, gap / 2);
  for (let y = y0 + gap / 2; y < y1; y += gap) for (let x = x0 + gap / 2; x < x1; x += gap) {
    if (!keep(x, y)) continue;
    // The slope over 1.5b yards each way and over twice that: where a small bump
    // or bank tilts against the ground around it, no arrow (it would look
    // uphill); otherwise the two together, so every arrow points down the
    // way the ground falls.
    const grad = d => {
      const e = R.at(x + d, y), w = R.at(x - d, y), nn = R.at(x, y + d), ss = R.at(x, y - d);
      return [e, w, nn, ss].some(v => v == null) ? null : [(e - w) / (2 * d) / 36, (nn - ss) / (2 * d) / 36]; // rise per yard
    };
    const g1 = grad(1.5 * b), g2 = grad(3 * b);
    if (!g1 || !g2) continue;
    const m1 = Math.hypot(...g1), m2 = Math.hypot(...g2);
    if (!m1 || !m2 || (g1[0] * g2[0] + g1[1] * g2[1]) / (m1 * m2) < 0.5) continue;
    const gx = (g1[0] + g2[0]) / 2, gy = (g1[1] + g2[1]) / 2;
    const pct = Math.hypot(gx, gy) * 100;
    if (pct < 0.5) continue;
    const dx = -gx / Math.hypot(gx, gy), dy = -gy / Math.hypot(gx, gy);
    const len = Math.min(gap * 0.8, gap * (0.25 + pct * 0.09)) * scale;
    const A = P([x - (dx * len) / 2, y - (dy * len) / 2]), B = P([x + (dx * len) / 2, y + (dy * len) / 2]);
    const hx = B[0] - A[0], hy = B[1] - A[1], hl = Math.hypot(hx, hy) || 1, ux = hx / hl, uy = hy / hl, k = Math.min(1.8, hl * 0.35);
    d += `M${A[0].toFixed(1)},${A[1].toFixed(1)}L${B[0].toFixed(1)},${B[1].toFixed(1)}M${(B[0] - ux * k - uy * k * 0.55).toFixed(1)},${(B[1] - uy * k + ux * k * 0.55).toFixed(1)}L${B[0].toFixed(1)},${B[1].toFixed(1)}L${(B[0] - ux * k + uy * k * 0.55).toFixed(1)},${(B[1] - uy * k - ux * k * 0.55).toFixed(1)}`;
  }
  return d;
}
const RELIEF_LINE = { fill: 'none', stroke: '#6b6f6c', 'stroke-width': 0.45, 'stroke-opacity': 0.75, 'stroke-linecap': 'round' };
const RELIEF_ARROW = { fill: 'none', stroke: '#2b2f2c', 'stroke-width': 0.55, 'stroke-opacity': 0.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

// ---------- one hole's facts ----------

// Everything the pages need about hole n from the tee set `teeName`.
// helpers: { holeFeatures(ch), ownGreen(ch) } from the hole screen.
// The front of a tee box: where a line from its middle toward `toward` (the
// hole's first bend or the green) leaves the box.
function boxFront(box, toward) {
  const c = boxCentre(box), f = frame(c, 0);
  const r = closeRing(ringOf(box)).map(f.fwd), t = f.fwd(toward), L = Math.hypot(t[0], t[1]) || 1;
  const far = [(t[0] / L) * 400, (t[1] / L) * 400];
  const k = firstCross([0, 0], far, r);
  return k == null ? c : f.back([far[0] * k, far[1] * k]);
}

function holeFacts(n, teeName, helpers) {
  const ch = course.holes[n - 1];
  const own = helpers.holeFeatures(ch);
  const ownSet = new Set(own);
  const greenF = helpers.ownGreen(ch);
  const boxes = own.filter(f => f.t === 'tee');
  const teeBox = teeBoxFor(teeName, ch, boxes);
  if (teeBox && !boxes.includes(teeBox)) boxes.push(teeBox); // tied to this hole by the course file
  // Every number is measured from the front of the tee box (the edge nearest
  // the green), not its middle.
  const tee = teeBox ? boxFront(teeBox, ch.line[1]) : teePosition(teeName, ch, boxes);
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

// Where that line meets the front of the green (in the same frame).
function frontPointFn(f, greenRing, pin) {
  if (!greenRing) return () => f.fwd(pin);
  const g = greenRing.map(f.fwd), c = centroid(g);
  return p => {
    if (inside(p, g)) return p;
    const t = firstCross(p, c, g) ?? 1;
    return [p[0] + (c[0] - p[0]) * t, p[1] + (c[1] - p[1]) * t];
  };
}

// "Only this hole", like the live view's spotlight: everything on the map is
// drawn only within LINE_YD of the hole's line of play or SHAPE_YD of its own
// fairways, green and tee boxes, fading out at the edge. A mask: white strokes
// along the line and round the shapes, softened. Labels sit outside it.
const LINE_YD = 46, SHAPE_YD = 23;
function onlyHole(svg, mapG, id, P, s, line, shapes, lineYd = LINE_YD, shapeYd = SHAPE_YD) {
  const mid = `${id}-only`, H = +svg.getAttribute('viewBox').split(' ')[3];
  const soft = el('filter', { id: `${mid}-soft`, filterUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, el('feGaussianBlur', { stdDeviation: (5 * s).toFixed(1) }));
  const mask = el('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
    el('g', { filter: `url(#${mid}-soft)`, fill: '#fff', stroke: '#fff', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      el('path', { d: pathD(line.map(P)), fill: 'none', 'stroke-width': (2 * lineYd * s).toFixed(1) }),
      ...shapes.map(r => el('path', { d: pathD(r.map(P), true), 'stroke-width': (2 * shapeYd * s).toFixed(1) }))));
  svg.append(el('defs', {}, soft, mask));
  const g = el('g', { mask: `url(#${mid})` });
  g.append(...mapG.childNodes);
  mapG.append(g);
}

// ---------- the hole page ----------

async function holePage(n, teeName, prefs, helpers, opts) {
  const H = opts.pageH || PAGE_H;
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

  // Like a tour book, the map can start just short of the fairway, with the
  // tee boxes in a small box instead (par 4s and 5s whose fairway starts well
  // out): the hole is then drawn bigger.
  const fairYs = ownFair.flat().map(p => p[1]).filter(y => y > 20);
  const startY = prefs.teeInset && ch.par > 3 && fairYs.length && teeBoxesL.length ? Math.min(...fairYs) - 20 : null;
  const cropped = !opts.teeView && startY != null && startY > 50;
  // What has to fit: the line, the hole's fairways, green and tee boxes.
  const keep = cropped ? [...L.filter(p => p[1] >= startY), ...ownFair.flat().filter(p => p[1] >= startY), ...(greenL || [])]
    : [...L, ...ownFair.flat(), ...(greenL || []), ...teeBoxesL.flatMap(t => t.r)];
  let [minX, maxX] = [Math.min(...keep.map(p => p[0])), Math.max(...keep.map(p => p[0]))];
  let [minY, maxY] = [Math.min(...keep.map(p => p[1])), Math.max(...keep.map(p => p[1]))];
  minX = Math.min(minX - 32, -45); maxX = Math.max(maxX + 32, 45); minY = cropped ? startY : minY - 14; maxY += 18;
  const top = 86, bottom = H - 28, left = 14, right = W - 14;
  const s = Math.min((right - left) / (maxX - minX), (bottom - top) / (maxY - minY), 4.2, MAX_UNITS_PER_YD);
  const cx = (left + right) / 2 - ((minX + maxX) / 2) * s, cy = (top + bottom) / 2 + ((minY + maxY) / 2) * s;
  const P = ([x, y]) => [cx + x * s, cy - y * s];
  const viewYd = [(left - cx) / s, (cx - right) / -s, (cy - bottom) / s, (cy - top) / s]; // minX, maxX, minY, maxY in yards
  const inView = pts => pts.some(([x, y]) => x > viewYd[0] - 20 && x < viewYd[1] + 20 && y > viewYd[2] - 20 && y < viewYd[3] + 20);

  const id = `bk${n}p${Math.random().toString(36).slice(2, 7)}`;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bookpage', xmlns: SVGNS, 'font-family': FONT });
  svg.append(defs(id), el('clipPath', { id: `${id}-clip` }, el('rect', { x: left, y: top, width: right - left, height: bottom - top })));
  // Lines (the book over the satellite picture): no paper, just outlines and numbers.
  // opts.satellite (a book printed that way): the same, over the satellite picture, on a white page.
  const lines = !!(opts.lines || opts.satellite);
  if (!opts.lines) svg.append(el('rect', { width: W, height: H, fill: '#fff' }));
  const mapG = el('g', { 'clip-path': `url(#${id}-clip)` });
  // Labels get a white halo so they read over the contours and arrows.
  const labG = el('g', { stroke: '#fff', 'stroke-width': 2.6, 'stroke-linejoin': 'round', 'paint-order': 'stroke' });
  svg.append(mapG, labG);
  const lab = labeller();
  const bounds = [left + 2, top + 2, right - 2, bottom - 2];

  const elevId = partOf(course, n);
  const info = opts.tourney ? null : (await elevIndex())[elevId] || null;
  let reliefNote = '';

  // The course's shapes, near ones first.
  const feats = course.features.filter(x => x.t !== 'ob').map(x => ({ x, r: closeRing(ringOf(x)).map(f.fwd) })).filter(o => inView(o.r));
  const own = o => F.ownSet.has(o.x);
  const LINE_COLOR = { water: '#5cc8ff', fairway: '#a6f08a', green: '#ffffff', bunker: '#ffe7a8', tee: '#ffffff' };
  const draw = (o, attrs) => mapG.append(el('path', { d: pathD(o.r.map(P), true), ...(lines
    ? { fill: 'none', stroke: LINE_COLOR[o.x.t] || '#fff', 'stroke-width': o.x === F.teeBox ? 1.6 : 0.9, ...(attrs.opacity ? { opacity: 0.6 } : {}) }
    : attrs) }));
  const faint = o => (!own(o) ? { opacity: 0.45 } : {});
  const others = prefs.otherHoles;
  if (prefs.water) for (const o of feats.filter(o => o.x.t === 'water')) draw(o, { fill: `url(#${id}-water)`, stroke: '#4f97c7', 'stroke-width': 0.9 });
  if (prefs.fairway) for (const o of feats.filter(o => o.x.t === 'fairway' && (own(o) || others))) draw(o, { fill: '#d9f0cf', stroke: '#6aa65a', 'stroke-width': 0.9, ...faint(o) });
  if (prefs.trees && !lines) for (const o of feats.filter(o => o.x.t === 'trees')) draw(o, { fill: '#cfe5c4', stroke: '#7fae70', 'stroke-width': 0.6, 'fill-opacity': 0.9 });
  for (const o of feats.filter(o => o.x.t === 'tee' && (own(o) || others))) {
    if (own(o) && !prefs.allTees && o.x !== F.teeBox) continue;
    // Tee boxes in grey; yours dark with a heavy outline.
    draw(o, o.x === F.teeBox ? { fill: '#3a3f3c', stroke: '#111', 'stroke-width': 1.8, ...faint(o) } : { fill: '#a7aca9', stroke: '#6d7370', 'stroke-width': 0.8, ...faint(o) });
  }
  if (prefs.bunkers) for (const o of feats.filter(o => o.x.t === 'bunker')) draw(o, { fill: `url(#${id}-sand)`, stroke: '#b8954e', 'stroke-width': 0.9 });
  for (const o of feats.filter(o => o.x.t === 'green' && (own(o) || others))) draw(o, { fill: own(o) ? '#a6dc94' : '#cdeac2', stroke: '#3f8a3a', 'stroke-width': own(o) ? 1.3 : 0.8, ...faint(o) });
  if (prefs.ob) {
    for (const x of course.features.filter(x => x.t === 'ob')) {
      for (const r of x.p.length > 1 ? x.p.slice(1) : x.p) {
        const pts = r.map(f.fwd);
        if (!inView(pts)) continue;
        mapG.append(el('path', { d: pathD(pts.map(P)), fill: 'none', stroke: lines ? '#fff' : INK, 'stroke-width': 1.1, 'stroke-dasharray': '1.2 4.5', 'stroke-linecap': 'round' }));
      }
    }
  }

  // Contour lines and a field of small downhill arrows over the whole hole,
  // like a tour book (not in bunkers, water or on the green: that's the green page).
  if (prefs.contours && info && !lines) {
    const area = [viewYd[0], viewYd[2], viewYd[1], viewYd[3]];
    const R = await reliefGrid(elevId, info, f, area, 1.5, 2);
    if (R.ok) {
      const iv = [12, 24, 36, 48, 72].find(v => (R.hi - R.lo) / v <= 22) || 120;
      const no = feats.filter(o => ['water', 'bunker'].includes(o.x.t) || (o.x.t === 'green' && own(o))).map(o => o.r);
      const reliefG = el('g', {});
      reliefG.append(el('path', { d: R.lines(levelsOf(R.lo, R.hi, iv)).map(sg => pathD(sg.map(P))).join(''), ...RELIEF_LINE, 'stroke-opacity': 0.5 }));
      reliefG.append(el('path', { d: slopeArrows(R, area, 10.8, P, (x, y) => !no.some(r => inside([x, y], r)), 0.6), ...RELIEF_ARROW, 'stroke-opacity': 0.55 }));
      mapG.append(reliefG);
      reliefNote = `Contours every ${iv >= 12 ? `${iv / 12} ft` : `${iv}"`} · arrows point downhill`;
    }
  }

  // Centre line, tee to the front of the green (where every number is
  // measured to), with a yellow dot there.
  if (prefs.centre) {
    const end = greenL ? frontPointFn(f, greenRing, pin)(L.at(-2)) : L.at(-1);
    mapG.append(el('path', { d: pathD([...L.slice(0, -1), end].map(P)), fill: 'none', stroke: lines ? '#fff' : SOFT, 'stroke-width': 0.8, 'stroke-dasharray': '3 3' }));
    for (const p of L.slice(1, -1)) { const [x, y] = P(p); mapG.append(el('circle', { cx: x, cy: y, r: 1.8, fill: '#fff', stroke: SOFT, 'stroke-width': 0.8 })); }
    if (greenL) { const [x, y] = P(end); labG.append(el('circle', { cx: x, cy: y, r: 2.4, fill: '#f3c623', stroke: '#6e5a10', 'stroke-width': 0.6 })); }
  }
  if (greenL) { const [x, y] = P(centroid(greenL)); lab.block([x - 6, y - 6, x + 6, y + 6]); }

  // Walk the hole's line in 1-yard steps: each step's point, direction and yards to the front.
  const walk = [];
  for (let i = 0; i < L.length - 1; i++) {
    const a = L[i], b = L[i + 1], seg = dist(a, b), d = [(b[0] - a[0]) / seg, (b[1] - a[1]) / seg];
    for (let t = 0; t < seg; t += 1) { const p = [a[0] + d[0] * t, a[1] + d[1] * t]; walk.push({ p, d, front: toFront(p), fromTee: (walk.length ? walk.at(-1).fromTee + 1 : 0) }); }
  }
  // The spot on the line (nearest the green) that's `yd` to the front.
  const spotAt = yd => { for (let i = walk.length - 1; i > 0; i--) if (walk[i].front >= yd) return walk[i]; return null; };
  const edgesAt = w => {
    const perp = [w.d[1], -w.d[0]]; // to the right
    const hits = ownFair.flatMap(r => crossings(w.p, perp, r, 60));
    const inFw = ownFair.some(r => inside(w.p, r));
    if (!hits.length) return null;
    const lft = hits.filter(v => v < 0), rgt = hits.filter(v => v > 0);
    if (!inFw || !lft.length || !rgt.length) return null;
    const l = Math.max(...lft), r = Math.min(...rgt);
    return { perp, l: [w.p[0] + perp[0] * l, w.p[1] + perp[1] * l], r: [w.p[0] + perp[0] * r, w.p[1] + perp[1] * r], width: r - l };
  };

  if (cropped) await teeInset(); // first, so the numbers keep out of its way
  // Numbers in pairs, tour-book style: a dot on the spot, the yards to the
  // front of the green above (red) and the yards from the tee below (black),
  // off to the side on a short straight line. Beside each, in blue, how many
  // yards the ground rises (+) or falls (−): from the spot up to the front of
  // the green, and from the tee to the spot.
  const RED = '#c62f2f', BLUE = '#2f5fb3';
  for (const o of feats) {
    if (!(o.x.t === 'green' && own(o))) continue;
    const q = o.r.map(P), xs = q.map(p => p[0]), ys = q.map(p => p[1]);
    lab.block([Math.min(...xs) - 1.5, Math.min(...ys) - 1.5, Math.max(...xs) + 1.5, Math.max(...ys) + 1.5]);
  }
  const pairs = [];
  const pair = (q, front, tee, side) => pairs.push({ q, front, tee, side });

  // Bunkers and water: the start and the end of each (not greenside bunkers).
  if (prefs.hazards) {
    const hz = F.own.filter(x => (x.t === 'bunker' && prefs.bunkers) || (x.t === 'water' && prefs.water));
    for (const x of hz) {
      // Only the part near the line of play (a lake can be huge).
      // Water reaches further: a pond well off the line is still worth its numbers.
      const reach = x.t === 'water' ? 80 : 45;
      const pts = ringOf(x).map(f.fwd).filter(p => walk.some(w => Math.abs(w.p[1] - p[1]) < 3 && Math.abs(w.p[0] - p[0]) < reach));
      if (pts.length < 2) continue;
      const fr = pts.map(toFront);
      let iS = fr.indexOf(Math.max(...fr)), iE = fr.indexOf(Math.min(...fr));
      if (x.t === 'water') { // the nearest point from the tee (to reach it) and the farthest (to carry it all)
        const dt = pts.map(q => dist(q, [0, 0]));
        iS = dt.indexOf(Math.min(...dt)); iE = dt.indexOf(Math.max(...dt));
      }
      if (fr[iS] > 440) continue; // behind the tee
      if (x.t === 'bunker' && fr[iE] < 10) continue; // greenside
      const nearTee = q => dist(q, [0, 0]) < 25; // beside the tee: no number there
      if (nearTee(pts[iS]) && (x.t !== 'water' || nearTee(pts[iE]))) continue;
      const c = centroid(pts);
      const nearLine = walk.reduce((b, w) => (dist(w.p, c) < dist(b.p, c) ? w : b), walk[0]);
      const side = (c[0] - nearLine.p[0]) * nearLine.d[1] - (c[1] - nearLine.p[1]) * nearLine.d[0] >= 0 ? 1 : -1;
      // Water by the tee still gets its far end (the carry).
      if (!nearTee(pts[iS])) pair(pts[iS], Math.round(fr[iS]), Math.round(dist(pts[iS], [0, 0])), side);
      if (Math.abs(fr[iS] - fr[iE]) >= 3 || dist(pts[iE], pts[iS]) >= 3 || nearTee(pts[iS])) pair(pts[iE], Math.round(fr[iE]), Math.round(dist(pts[iE], [0, 0])), side);
    }
  }

  // Water across the line of play: where the centre line, and lines 20 yards
  // either side of it, go into the water and come out of it (the carry).
  if (prefs.hazards && prefs.water) {
    const near = (q, d) => pairs.some(pr => dist(pr.q, q) < d);
    for (const x of F.own.filter(x => x.t === 'water')) {
      const r = closeRing(ringOf(x)).map(f.fwd);
      for (const off of [0, -20, 20]) {
        let inW = false, prev = null;
        for (const w of walk) {
          const q = off ? [w.p[0] + w.d[1] * off, w.p[1] - w.d[0] * off] : w.p;
          const now = inside(q, r);
          const mark = now !== inW ? (now ? q : prev) : null;
          inW = now; prev = q;
          if (!mark) continue;
          const tee = dist(mark, [0, 0]), front = toFront(mark);
          if (tee < 25 || front < 3) continue;
          if (off && now) continue; // beside the line: only where it comes out (the carry)
          if (near(mark, off ? 14 : 8)) continue;
          pair(mark, Math.round(front), Math.round(tee), off < 0 ? -1 : 1);
        }
      }
    }
  }

  // Down the middle: 50, 100, 150 and 200 to the front of the green (and 250
  // and 300 on a par 5).
  if (prefs.layup && !opts.teeView && ch.par > 3) { // (they're on the map, not in the tees box; none on a par 3)
    for (const yd of ch.par >= 5 ? [50, 100, 150, 200, 250, 300] : [50, 100, 150, 200]) {
      const w = spotAt(yd);
      if (!w || w.fromTee < 40) continue;
      pair(w.p, yd, Math.round(w.fromTee), 1);
    }
  }

  // The rises and falls, in yards, from the height tiles.
  if (pairs.length && prefs.deltas && info) {
    const frontPt = frontPointFn(f, greenRing, pin);
    const hs = await heightsAt(elevId, info, [tee, ...pairs.flatMap(pr => [f.back(pr.q), f.back(frontPt(pr.q))])]);
    pairs.forEach((pr, i) => {
      const ht = hs[0], hp = hs[1 + i * 2], hf = hs[2 + i * 2];
      if (hp == null) return;
      if (hf != null) pr.dFront = Math.round((hf - hp) / M_PER_YD);
      if (ht != null) pr.dTee = Math.round((hp - ht) / M_PER_YD);
    });
  }
  const signed = v => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
  for (const { q, front, tee, side, dFront, dTee } of pairs) {
    const [x, y] = P(q);
    if (y > bottom - 6 || y < top + 6) continue; // off the map (short of where it starts)
    if (opts.teeView && tee > 130) continue; // the tees box: just what's near the tees
    // Four rows: blue up/down to the green, red to the front, black from the
    // tee, blue up/down from the tee. The labeller boxes them from 32 above
    // the anchor's y to 10 below; their middle (my) is level with the spot.
    const wdt = Math.max(textW(front, 10), textW(tee, 9.5), dFront != null ? textW(signed(dFront), 8) : 0, dTee != null ? textW(signed(dTee), 8) : 0) + 2, hgt = 40;
    labG.append(el('circle', { cx: x, cy: y, r: 1.9, fill: INK }));
    // Level with the spot, so the line out to it is straight across; it may
    // run over the edge of its bunker.
    const cands = [];
    for (const dir of [side, -side]) for (const dx of [10, 16, 24, 34, 46]) cands.push([x + dir * dx, y + 10, dir > 0 ? 'start' : 'end']);
    // No room level with it: a little above or below, the line still going
    // straight out and then a short step to the numbers.
    const more = [];
    for (const dy of [-14, 14, -26, 26]) for (const dir of [side, -side]) for (const dx of [14, 24, 34, 46]) more.push([x + dir * dx, y + 10 + dy, dir > 0 ? 'start' : 'end']);
    const spot = lab.place(cands, wdt, hgt, bounds) || lab.place(more, wdt, hgt, bounds) || [x + side * 10, y + 10, side > 0 ? 'start' : 'end'];
    const [sx, sy, anc] = spot;
    const x0 = anc === 'start' ? sx : sx - wdt, my = sy - 10;
    const ex = anc === 'start' ? x0 - 2 : x0 + wdt + 2;
    const knee = anc === 'start' ? ex - 4 : ex + 4;
    labG.append(el('path', { d: Math.abs(my - y) < 1 ? pathD([[x, y], [ex, y]]) : pathD([[x, y], [knee, y], [ex, my]]), stroke: INK, 'stroke-width': 0.6, fill: 'none' }),
      txt(x0, my - 3, front, { 'font-size': 10, 'font-weight': 700, fill: RED }),
      txt(x0, my + 8, tee, { 'font-size': 9.5, fill: INK }));
    if (dFront != null) labG.append(txt(x0, my - 13, signed(dFront), { 'font-size': 8, fill: BLUE, 'font-weight': 700 }));
    if (dTee != null) labG.append(txt(x0, my + 17, signed(dTee), { 'font-size': 8, fill: BLUE, 'font-weight': 700 }));
  }

  const teeFrontYd = Math.round(toFront(f.fwd(tee)));
  const teeMarks = []; // the ruler round the tees (page units), for the tees box
  const teeInfo = []; // the tees' labels, for the tees box: { y (page units), label, chosen }
  // Tee boxes: the chosen one marked, each with its yards to the front.
  const teeFront = Math.round(toFront(f.fwd(tee)));
  for (const { b, r } of cropped ? [] : teeBoxesL) {
    const chosen = b === F.teeBox;
    if (!chosen && !prefs.allTees) continue;
    const c = P(centroid(r));
    const names = course.tees.filter(t => teeBoxFor(t.name, ch, F.boxes) === b).map(t => t.name);
    const v = Math.round(toFront(f.fwd(boxFront(b, ch.line[1]))));
    // The other tees say how much further back (+) or forward (−) they are
    // than yours: add it to the black (from the tee) numbers when playing them.
    const gap = v - teeFrontYd;
    const label = chosen ? `${names.length ? names.join('/') : teeName} ${v}` : `${names.join('/') || 'Tee'} ${v} · ${gap > 0 ? '+' : gap < 0 ? '−' : '±'}${Math.abs(gap)}`;
    if (opts.teeView) { // the tees box writes these beside its picture: just the yards (no tee names, to save space)
      const fp = P(f.fwd(boxFront(b, ch.line[1])));
      teeInfo.push({ y: fp[1], label: chosen ? `${v}` : `${v} ${gap > 0 ? '+' : gap < 0 ? '−' : '±'}${Math.abs(gap)}`, yards: v, gap: chosen ? null : gap, chosen });
      continue;
    }
    const size = chosen ? 10 : 8.5;
    const spot = lab.place([[c[0] + 9, c[1] + 3, 'start'], [c[0] - 9, c[1] + 3, 'end'], [c[0] + 9, c[1] + 12, 'start'], [c[0] - 9, c[1] + 12, 'end']], textW(label, size), size, bounds);
    if (spot) {
      labG.append(txt(spot[0], spot[1], label, { 'font-size': size, 'font-weight': chosen ? 700 : 400, fill: chosen ? INK : SOFT, 'text-anchor': spot[2] }));
      const lw = textW(label, size) * 1.05, lx = spot[2] === 'start' ? spot[0] : spot[0] - lw;
      teeMarks.push([lx, spot[1] - size, lx + lw, spot[1] + 2]);
    }
  }
  // In the tees box: a ruler beside the tees, with a line from the front of
  // each tee box (a dot) to it, to show the distances are front to front.
  if (opts.teeView) {
    const fronts = teeBoxesL.filter(t => t.b === F.teeBox || prefs.allTees).map(t => f.fwd(boxFront(t.b, ch.line[1])));
    if (fronts.length > 1) {
      const rx = Math.min(...teeBoxesL.flatMap(t => t.r.map(p => p[0]))) - 8;
      const ys = fronts.map(q => q[1]);
      const [a, b] = [P([rx, Math.min(...ys)]), P([rx, Math.max(...ys)])];
      labG.append(el('path', { d: pathD([a, b]), stroke: INK, 'stroke-width': 0.9, fill: 'none' }));
      for (const q of fronts) {
        const [fx, fy] = P(q), [tx, ty] = P([rx, q[1]]);
        labG.append(el('path', { d: `M${fx.toFixed(1)},${fy.toFixed(1)}L${tx.toFixed(1)},${ty.toFixed(1)}`, stroke: INK, 'stroke-width': 0.6, 'stroke-dasharray': '2 1.5', fill: 'none' }),
          el('path', { d: `M${(tx - 3).toFixed(1)},${ty.toFixed(1)}H${(tx + 3).toFixed(1)}`, stroke: INK, 'stroke-width': 1, fill: 'none' }),
          el('circle', { cx: fx, cy: fy, r: 1.8, fill: '#f3c623', stroke: '#6e5a10', 'stroke-width': 0.5 }));
        teeMarks.push([tx - 4, Math.min(fy, ty) - 2, Math.max(fx, tx) + 4, Math.max(fy, ty) + 2]);
      }
    }
  }
  if (!F.teeBox && !cropped) { const [x, y] = P(f.fwd(tee)); labG.append(el('circle', { cx: x, cy: y, r: 3, fill: INK })); }

  // The tees, in a small box at the top left: the tee area exactly as it's drawn
  // when the hole is shown whole (the same page, drawn uncropped, seen through
  // a window), with each tee's yards to the front and its distance from yours.
  async function teeInset() {
    const full = await holePage(n, teeName, prefs, helpers, { ...opts, teeView: true });
    const tb = full.dataset.teebox?.split(' ').map(Number);
    if (!tb) return;
    // A narrow picture of just the tee markers (and the ruler, and a little
    // in front of them), with each tee's name, yards to the front and
    // distance from yours written beside it at a readable size.
    const pad = 3, ahead = 10; // page units; "ahead" is towards the green (up)
    const ax = tb[0] - pad, ay = tb[1] - pad - ahead, vw = tb[2] - tb[0] + 2 * pad, vh = tb[3] - tb[1] + 2 * pad + ahead;
    const zoom = Math.min(1.1, 130 / vh, 40 / vw);
    const pw = vw * zoom, ph = Math.max(40, vh * zoom);
    const tees = JSON.parse(full.dataset.tees || '[]').sort((p1, p2) => p1.y - p2.y);
    const labW = Math.max(18, ...tees.map(t => textW(t.label, t.chosen ? 9.5 : 8.5) + 2));
    const bw = pw + labW + 10, bh = ph;
    // Top left, like a tour book (its TEES tab just above it).
    const x0 = left + 4, y0 = top + 16;
    // The numbers on the left, by the ruler; the tee markers' picture right of them.
    const px = x0 + labW + 6;
    const win = el('svg', { x: px, y: y0, width: pw, height: ph, viewBox: `${ax.toFixed(1)} ${ay.toFixed(1)} ${vw.toFixed(1)} ${(ph / zoom).toFixed(1)}`, preserveAspectRatio: 'xMidYMin meet' });
    win.append(...full.childNodes);
    const g = el('g', {});
    g.append(el('rect', { x: x0 - 1, y: y0 - 1, width: bw + 2, height: bh + 2, fill: '#fff', stroke: 'none' }), win,
      el('rect', { x: x0, y: y0, width: bw, height: bh, fill: 'none', stroke: '#6b746e', 'stroke-width': 1 }),
      el('rect', { x: x0, y: y0 - 12, width: 30, height: 12, fill: '#6b746e' }),
      txt(x0 + 15, y0 - 3, 'TEES', { 'font-size': 8, 'font-weight': 700, fill: '#fff', 'text-anchor': 'middle', 'letter-spacing': 0.6, stroke: 'none' }));
    let lastY = -Infinity;
    for (const t of tees) {
      const ly = Math.max(y0 + (t.y - ay) * zoom + 3, lastY + 10, y0 + 9);
      lastY = ly;
      g.append(el('path', { d: `M${(px + 2).toFixed(1)},${(y0 + (t.y - ay) * zoom).toFixed(1)}L${(px - 1).toFixed(1)},${(ly - 3).toFixed(1)}`, stroke: '#9aa59e', 'stroke-width': 0.5, fill: 'none' }),
        // The gap from your tee: red when further back (+), green when forward (−).
        el('text', { x: (px - 3).toFixed(1), y: ly.toFixed(1), 'font-size': t.chosen ? 9.5 : 8.5, 'font-weight': t.chosen ? 700 : 400, fill: t.chosen ? INK : SOFT, stroke: 'none', 'text-anchor': 'end' },
          t.gap == null ? `${t.yards ?? t.label}` : [el('tspan', {}, `${t.yards} `),
            el('tspan', { fill: t.gap > 0 ? '#c62f2f' : t.gap < 0 ? '#1f8a3f' : SOFT, 'font-weight': 700 }, `${t.gap > 0 ? '+' : t.gap < 0 ? '−' : '±'}${Math.abs(t.gap)}`)]));
    }
    svg.append(g); // on top of the map, under nothing
    lab.block([x0 - 2, y0 - 14, x0 + bw + 2, y0 + bh + 2]);
  }

  // North arrow and a 50-yard scale.
  if (prefs.north) {
    const nx = right - 18, ny = top + 20, nv = f.rotV([0, 1]);
    const tip = [nx + nv[0] * 11, ny - nv[1] * 11], tail = [nx - nv[0] * 9, ny + nv[1] * 9];
    labG.append(el('circle', { cx: nx, cy: ny, r: 14, fill: '#fff', stroke: '#c9d0cb', 'stroke-width': 0.8 }),
      el('path', { d: pathD([tail, tip]), stroke: INK, 'stroke-width': 1.2, 'marker-end': `url(#${id}-arr)` }),
      txt(tip[0] + nv[0] * 5, tip[1] - nv[1] * 5 + 3, 'N', { 'font-size': 8, 'font-weight': 700, 'text-anchor': 'middle', fill: INK }));
    lab.block([nx - 15, ny - 15, nx + 15, ny + 15]);
    const len = 50 * s, sx = left + 6, sy = bottom - 8;
    labG.append(el('path', { d: `M${sx},${sy - 3}V${sy}H${sx + len}V${sy - 3}M${sx + len / 2},${sy}V${sy - 2}`, fill: 'none', stroke: SOFT, 'stroke-width': 0.8 }),
      txt(sx + len + 4, sy, '50 yd', { 'font-size': 8, fill: SOFT }));
  }

  // Header and footer.
  svg.append(
    txt(16, 54, n, { 'font-size': 54, 'font-weight': 900, fill: INK }),
    txt(16 + textW(n, 54) + 10, 32, `PAR ${ch.par}`, { 'font-size': 15, 'font-weight': 700, fill: INK, 'letter-spacing': 1 }),
    txt(16 + textW(n, 54) + 10, 49, ch.hcp ? `HCP ${ch.hcp}` : '', { 'font-size': 12, fill: SOFT, 'letter-spacing': 1 }),
    txt(W - 16, 44, card ?? teeFront, { 'font-size': 36, 'font-weight': 900, fill: INK, 'text-anchor': 'end' }),
    txt(W - 16, 60, `${(teeSet?.name || teeName).toUpperCase()} TEES · ${teeFront} TO FRONT`, { 'font-size': 10.5, fill: SOFT, 'text-anchor': 'end', 'letter-spacing': 0.6 }),
    el('line', { x1: 14, x2: W - 14, y1: top - 4, y2: top - 4, stroke: '#d6dcd8', 'stroke-width': 0.8 }),
    el('line', { x1: 14, x2: W - 14, y1: bottom + 4, y2: bottom + 4, stroke: '#d6dcd8', 'stroke-width': 0.8 }),
    txt(16, H - 12, course.name.toUpperCase(), { 'font-size': 9, fill: '#9aa59e', 'letter-spacing': 1 }),
    txt(W - 16, H - 12, `HOLE ${n} OF ${course.holes.length}`, { 'font-size': 9, fill: '#9aa59e', 'text-anchor': 'end', 'letter-spacing': 1 }));
  if (prefs.onlyHole) {
    const tail = greenL ? centroid(greenL) : L.at(-1);
    // The band takes up about 90% of the page's width (never narrower than LINE_YD each side).
    const band = Math.max(LINE_YD, (0.45 * (right - left)) / s);
    onlyHole(svg, mapG, id, P, s, [...L.slice(0, -1), tail], [...ownFair, ...(greenL ? [greenL] : []), ...teeBoxesL.map(t => t.r)], band, Math.max(SHAPE_YD, band / 2));
  }
  // Where the tee boxes are on this page (for the tees box of a cropped page).
  if (teeBoxesL.length) {
    const q = [...teeBoxesL.flatMap(t => t.r.map(P)), ...teeMarks.flatMap(m => [[m[0], m[1]], [m[2], m[3]]])];
    svg.dataset.tees = JSON.stringify(teeInfo);
    svg.dataset.teebox = [Math.min(...q.map(p => p[0])), Math.min(...q.map(p => p[1])), Math.max(...q.map(p => p[0])), Math.max(...q.map(p => p[1]))].map(v => v.toFixed(1)).join(' ');
  }
  // The map view: where the page's corners are on the ground.
  svg.geo = { at: (u, v) => f.back([(u - cx) / s, (cy - v) / s]), rect: [left, top, right, bottom], up };
  if (opts.satellite) {
    const url = await satelliteUnder(svg.geo.at, svg.geo.rect);
    if (url) mapG.parentNode.insertBefore(el('image', { href: url, x: left, y: top, width: right - left, height: bottom - top, preserveAspectRatio: 'none' }), mapG);
  }
  return svg;
}

// ---------- the green page ----------

// The front of a green (turned so play is up the page): where the line up its middle first meets it.
const frontY0 = g => { const d = crossings([0, 0], [0, 1], g, 200); return d.length ? d[0] : Math.min(...g.map(p => p[1])); };

async function greenPage(n, teeName, prefs, helpers, opts) {
  const H = opts.pageH || PAGE_H;
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

  const top = 86, bottom = prefs.notes ? H - 106 : H - 28, left = 18, right = W - 18;
  // Zoomed in on the green as far as the USGA allows (3/8 inch to 5 yards),
  // or until it fills the map; any room left over shows the approach below it.
  const pad = 5;
  const s = Math.min((right - left) / (maxX - minX + pad * 2), (bottom - top) / (maxY - minY + pad * 2), MAX_UNITS_PER_YD);
  const cx = (left + right) / 2 - ((minX + maxX) / 2) * s, cy = top + (maxY + pad + 2) * s;
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
  // The satellite book: the green over the satellite picture (zoom 19), outlines only.
  const sat = !!opts.satellite;
  if (sat) {
    const [l, t, r, b] = [left - 16, top, right + 16, bottom];
    const url = await satelliteUnder((u, v) => f.back([(u - cx) / s, (cy - v) / s]), [l, t, r, b], 3, 19);
    if (url) svg.insertBefore(el('image', { href: url, x: l, y: t, width: r - l, height: b - t, preserveAspectRatio: 'none' }), mapG);
  }
  const SAT_LINE = { water: '#5cc8ff', fairway: '#a6f08a', bunker: '#ffe7a8', tee: '#ffffff', green: '#ffffff' };

  // What's around the green, plainly drawn like a tour book's green page:
  // bunkers pale yellow with a dark edge, the green white with a heavy line.
  const flat = []; // bunkers and water: no contours or arrows over them
  for (const x of course.features) {
    if (x.t === 'ob' || x === F.greenF) continue;
    if (x.t === 'fairway' && !prefs.fairway) continue;
    if (x.t === 'trees' && sat) continue;
    if (x.t === 'bunker' && !prefs.bunkers) continue;
    if (x.t === 'water' && !prefs.water) continue;
    if (x.t === 'trees' && !prefs.trees) continue;
    const r = closeRing(ringOf(x)).map(f.fwd);
    if (!inView(r)) continue;
    if (x.t === 'bunker' || x.t === 'water') flat.push({ x, r });
    const style = { fairway: { fill: '#f1f8f1', stroke: '#a9c9ad', 'stroke-width': 0.7 }, bunker: { fill: '#efe6a2', stroke: '#2b2b2b', 'stroke-width': 1.2 },
      water: { fill: '#d6e9f5', stroke: '#2b2b2b', 'stroke-width': 1.2 }, trees: { fill: '#e2efdc', stroke: '#9dbf92', 'stroke-width': 0.6 },
      tee: { fill: '#a7aca9', stroke: '#6d7370', 'stroke-width': 0.6 }, green: { fill: '#f1f8f1', stroke: '#a9c9ad', 'stroke-width': 0.6 } }[x.t];
    if (style && x.t !== 'bunker' && x.t !== 'water') mapG.append(el('path', { d: pathD(r.map(P), true), ...(sat ? { fill: 'none', stroke: SAT_LINE[x.t] || '#fff', 'stroke-width': 0.9 } : style) }));
  }
  if (!sat) mapG.append(el('path', { d: gPath, fill: '#ffffff' }));

  // The yard grid over the whole map, lined up on the front of the green and
  // its middle.
  const gridStep = prefs.grid ? prefs.gridYd : 0;
  if (gridStep) {
    let d = '';
    for (let y = frontY - Math.ceil((frontY - view[2]) / gridStep) * gridStep; y <= view[3]; y += gridStep) { const a = P([view[0], y]), b = P([view[1], y]); d += `M${a[0].toFixed(1)},${a[1].toFixed(1)}H${b[0].toFixed(1)}`; }
    for (let x = Math.ceil(view[0] / gridStep) * gridStep; x <= view[1]; x += gridStep) { if (Math.abs(x) < 0.01) continue; const a = P([x, view[2]]), b = P([x, view[3]]); d += `M${a[0].toFixed(1)},${a[1].toFixed(1)}V${b[1].toFixed(1)}`; }
    mapG.append(el('path', { d, stroke: sat ? '#fff' : '#8d949a', 'stroke-width': 0.5, 'stroke-opacity': sat ? 0.45 : 0.7 }));
  }
  // The line up the middle, through the front and the back of the green.
  { const a = P([0, view[2]]), b = P([0, view[3]]); mapG.append(el('path', { d: `M${a[0].toFixed(1)},${a[1].toFixed(1)}V${b[1].toFixed(1)}`, stroke: sat ? '#8fb8ff' : '#3d4fb0', 'stroke-width': 0.7 })); }

  // Heights, tour-book style: contour lines around the green (not on it, and
  // not over bunkers or water) and small downhill arrows on and around it.
  const elevId = partOf(course, n);
  const info = opts.tourney ? null : (await elevIndex())[elevId] || null;
  let slopeNote = '', relief = null;
  const reliefG = el('g', { mask: `url(#${id}-flat)` });
  const lineMask = el('mask', { id: `${id}-lines`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
    el('rect', { width: W, height: H, fill: '#fff' }), el('path', { d: gPath, fill: '#000' }), ...flat.map(o => el('path', { d: pathD(o.r.map(P), true), fill: '#000' })));
  const flatMask = el('mask', { id: `${id}-flat`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
    el('rect', { width: W, height: H, fill: '#fff' }), ...flat.map(o => el('path', { d: pathD(o.r.map(P), true), fill: '#000' })));
  svg.append(el('defs', {}, lineMask, flatMask));
  if (info && (prefs.greenContours || prefs.slopes)) {
    const area = [view[0], view[2], view[1], view[3]];
    const R = await reliefGrid(elevId, info, f, area, 0.5, 3);
    if (R.ok) {
      const onG = [];
      for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) if (inside([x, y], g)) { const v = R.at(x, y); if (v != null) onG.push(v); }
      let lo = Infinity, hi = -Infinity;
      for (const v of onG) { if (v < lo) lo = v; if (v > hi) hi = v; }
      if (onG.length) relief = hi - lo;
      if (prefs.greenContours) {
        let iv = 2;
        while ((R.hi - R.lo) / iv > 40) iv *= 2;
        reliefG.append(el('path', { d: R.lines(levelsOf(R.lo, R.hi, iv)).map(sg => pathD(sg.map(P))).join(''), ...RELIEF_LINE, ...(sat ? { stroke: '#fff', 'stroke-opacity': 0.75 } : {}), 'stroke-width': 0.5, mask: `url(#${id}-lines)` }));
        slopeNote = `Contours every ${iv}" around the green`;
      }
      if (prefs.slopes) {
        reliefG.append(el('path', { d: slopeArrows(R, area, 3.6, P, (x, y) => !flat.some(o => inside([x, y], o.r)), 0.7), ...RELIEF_ARROW, ...(sat ? { stroke: '#fff' } : {}), 'stroke-width': 0.6 }));
        slopeNote += `${slopeNote ? ' · ' : ''}arrows point downhill, longer = steeper`;
      }
    }
  }
  mapG.append(reliefG);
  // Bunkers and water on top, plain.
  for (const { x, r } of flat) mapG.append(el('path', { d: pathD(r.map(P), true), ...(sat ? { fill: 'none', stroke: SAT_LINE[x.t] } : { fill: x.t === 'bunker' ? '#efe6a2' : '#d6e9f5', stroke: '#2b2b2b' }), 'stroke-width': 1.2 }));
  mapG.append(el('path', { d: gPath, fill: 'none', stroke: sat ? '#fff' : '#111', 'stroke-width': 2 }));
  // Front and back of the green, with the depth at the back.
  if (depth.length >= 2) {
    const [ax, ay] = P([0, depth[0]]), [bx, by] = P([0, depth.at(-1)]);
    mapG.append(el('circle', { cx: ax, cy: ay, r: 3.2, fill: '#f3c623', stroke: '#6e5a10', 'stroke-width': 0.7 }),
      el('circle', { cx: bx, cy: by, r: 3.2, fill: '#f3c623', stroke: '#6e5a10', 'stroke-width': 0.7 }),
      txt(bx, by - 8, depthYd, { 'font-size': 13, 'font-weight': 700, fill: '#c62f2f', 'text-anchor': 'middle', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' }));
  }

  // Yards from the front, down the left edge of the green.
  const every = gridStep === 3 ? 6 : 5;
  const labs = el('g', { 'font-size': 10, fill: '#2b2f6b', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke', 'text-anchor': 'end' });
  for (let k = 0; frontY + k <= maxY + 0.01; k += every) {
    const y = frontY + k, hits = crossings([0, y], [1, 0], g, 200);
    const xL = hits.length ? hits[0] : (k === 0 ? 0 : null);
    if (xL == null) continue;
    const [X, Y] = P([xL, y]);
    labs.append(txt(X - 3, Y + 3.5, k));
  }
  mapG.append(labs);
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
    txt(16, H - 12, course.name.toUpperCase(), { 'font-size': 9, fill: '#9aa59e', 'letter-spacing': 1 }),
    txt(W - 16, H - 12, `HOLE ${n} · GREEN`, { 'font-size': 9, fill: '#9aa59e', 'text-anchor': 'end', 'letter-spacing': 1 }));
  if (prefs.notes) {
    svg.append(txt(16, bottom + 20, 'NOTES', { 'font-size': 10, 'font-weight': 700, fill: INK, 'letter-spacing': 1.2 }));
    for (let y = bottom + 42; y < H - 24; y += 22) svg.append(el('line', { x1: 16, x2: W - 16, y1: y, y2: y, stroke: '#d6dcd8', 'stroke-width': 0.8 }));
  }
  if (prefs.onlyHole) {
    const own = F.own.filter(x => x.t === 'fairway' || x.t === 'tee').map(x => closeRing(ringOf(x)).map(f.fwd));
    onlyHole(svg, mapG, id, P, s, line.map(f.fwd), [g, ...own]);
  }
  return svg;
}

// ---------- style and print layout (kept on this device) ----------

const STYLES = [['book', 'Flat'], ['sat', 'Satellite']];
const getStyle = () => { try { return localStorage.getItem('gs:bookStyle') === 'sat' ? 'sat' : 'book'; } catch { return 'book'; } };
const setStyle = v => { try { localStorage.setItem('gs:bookStyle', v); } catch { /* not kept */ } };
// Print layouts, double-sided letter first (and to start), then legal.
const LAYOUTS = [['duplex-letter', 'Double-sided · letter'], ['duplex-legal', 'Double-sided · legal'], ['duplex-letter-2', 'Double-sided · letter, 2 big cards'],
  ['letter', 'Fold · letter (cut once)'], ['legal', 'Fold · legal (cut once)'], ['single', 'Single pages']];
// A new key, so everyone starts on double-sided letter.
const getLayout = () => { let v = 'duplex-letter'; try { v = localStorage.getItem('gs:bookLayout5') || v; } catch { /* none */ } return LAYOUTS.some(([k]) => k === v) ? v : 'duplex-letter'; };
const setLayout = v => { try { localStorage.setItem('gs:bookLayout5', v); } catch { /* not kept */ } };

// ---------- the satellite picture ----------

// The satellite picture under a page's map (the satellite book): the Esri tiles
// (zoom 18) covering it, turned and scaled onto the page. A JPEG data URL, or
// null if the tiles won't load (offline): the page is then drawn without it.
const tileCache = new Map();
// A tile that fails (the server says too many at once, say) is tried twice more, a little later.
const loadTile = url => {
  if (!tileCache.has(url)) tileCache.set(url, new Promise(ok => {
    const go = left => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => ok(img);
      img.onerror = () => { if (left) setTimeout(() => go(left - 1), 1500); else { tileCache.delete(url); ok(null); } };
      img.src = url;
    };
    go(2);
  }));
  return tileCache.get(url);
};
async function satelliteUnder(at, [l, t, r, b], k = 3, z = 18) {
  try {
    const n = 2 ** z;
    const world = ([lat, lng]) => {
      const sin = Math.sin((lat * Math.PI) / 180);
      return [((lng + 180) / 360) * n, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n]; // in tiles
    };
    const A = world(at(l, t)), B = world(at(r, t)), C = world(at(l, b)), D = world(at(r, b));
    const xs = [A, B, C, D].map(p => p[0]), ys = [A, B, C, D].map(p => p[1]);
    const x0 = Math.floor(Math.min(...xs)), x1 = Math.floor(Math.max(...xs)), y0 = Math.floor(Math.min(...ys)), y1 = Math.floor(Math.max(...ys));
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 120) return null; // far too big a hole for this zoom
    const cv = document.createElement('canvas');
    const wpx = Math.round((r - l) * k), hpx = Math.round((b - t) * k);
    cv.width = wpx; cv.height = hpx;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#7a8a6a'; ctx.fillRect(0, 0, wpx, hpx);
    // Canvas pixel (i, j) is at A + ex*i + ey*j (tile units, from tile x0, y0); draw with the inverse.
    const a = [(A[0] - x0) * 256, (A[1] - y0) * 256];
    const ex = [((B[0] - A[0]) * 256) / wpx, ((B[1] - A[1]) * 256) / wpx], ey = [((C[0] - A[0]) * 256) / hpx, ((C[1] - A[1]) * 256) / hpx];
    const det = ex[0] * ey[1] - ey[0] * ex[1];
    const i00 = ey[1] / det, i01 = -ey[0] / det, i10 = -ex[1] / det, i11 = ex[0] / det;
    ctx.setTransform(i00, i10, i01, i11, -(i00 * a[0] + i01 * a[1]), -(i10 * a[0] + i11 * a[1]));
    const jobs = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      jobs.push(loadTile(TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y)).then(img => { if (img) ctx.drawImage(img, (x - x0) * 256 - 0.5, (y - y0) * 256 - 0.5, 257, 257); }));
    }
    await Promise.all(jobs);
    return cv.toDataURL('image/jpeg', 0.85);
  } catch (e) {
    console.error('satellite under the book', e);
    return null;
  }
}

// ---------- making a PDF ----------

const abs = p => new URL(p, location.href).href;
const loadScript = src => new Promise((ok, no) => {
  if (window.jspdf) { ok(); return; }
  const sc = document.createElement('script');
  sc.src = abs(src); sc.onload = ok; sc.onerror = () => no(new Error('the PDF maker didn’t load (offline?)'));
  document.head.append(sc);
});
// The book's font, built into each page so it looks the same in the PDF.
let fontCssP = null;
const bookFontCss = () => (fontCssP ||= Promise.all([400, 700, 900].map(async w => {
  const r = await fetch(abs(`vendor/fonts/barlow-condensed-latin-${w}-normal.woff2`));
  if (!r.ok) return '';
  const b = new Uint8Array(await r.arrayBuffer());
  let str = '';
  for (let i = 0; i < b.length; i += 0x4000) str += String.fromCharCode.apply(null, b.subarray(i, i + 0x4000));
  return `@font-face{font-family:'Barlow Condensed';font-weight:${w};src:url(data:font/woff2;base64,${btoa(str)}) format('woff2');}`;
})).then(a => a.join('')).catch(() => ''));
// One page (an SVG) drawn into a canvas at x, y, w, h (pixels).
async function drawSvg(ctx, svg, x, y, w, hgt, css) {
  const c = svg.cloneNode(true);
  c.setAttribute('xmlns', SVGNS); c.setAttribute('width', Math.round(w)); c.setAttribute('height', Math.round(hgt));
  if (css) c.insertBefore(el('style', {}, css), c.firstChild);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(c)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('a page didn’t draw')); img.src = url; });
    ctx.drawImage(img, x, y, w, hgt);
  } finally { URL.revokeObjectURL(url); }
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
    let pagesNow, note = '';
    try { pagesNow = await drawHole(hole, prefs); } catch (e) {
      // Something in the heights went wrong (a phone running short, say): draw
      // the hole without them rather than leave a blank screen.
      console.error('yardage book', e);
      note = 'Drawn without contours (they didn’t load on this device)';
      try { pagesNow = await drawHole(hole, { ...prefs, contours: false, greenContours: false, slopes: false, deltas: false }); } catch (e2) {
        console.error('yardage book', e2);
        if (my !== token) return;
        pages.replaceChildren(h('div', { class: 'bookerr' }, `Couldn’t draw hole ${hole}: ${e2.message || e2}`));
        status.textContent = '';
        return;
      }
    }
    if (my !== token) return;
    // Like a tour book flipped open: the green page on top, the hole below the fold.
    pages.replaceChildren(h('div', { class: 'flipbook' }, ...pagesNow));
    status.textContent = note;
  }
  async function drawHole(k, p) {
    const hp = await holePage(k, teeName, p, helpers, { ...opts, satellite: style === 'sat' });
    const gp = p.greenPage ? await greenPage(k, teeName, p, helpers, { ...opts, satellite: style === 'sat' }) : null;
    return [...(gp ? [gp] : []), hp];
  }
  const elevOk = !opts.tourney;
  const optRows = [];
  let group = '';
  for (const [k, label, grp, , needsElev] of BOOK_OPTIONS) {
    if ((needsElev && !elevOk) || HIDDEN.has(k)) continue;
    if (grp !== group) { group = grp; optRows.push(h('div', { class: 'bookgroup' }, grp)); }
    const input = h('input', { type: 'checkbox', onchange: e => { prefs[k] = e.target.checked; savePrefs(saved); draw(); } });
    input.checked = prefs[k];
    optRows.push(h('label', { class: 'bookopt' }, input, h('span', {}, label)));
  }
  const gridSel = h('select', { onchange: e => { prefs.gridYd = prefs.gridYards = +e.target.value; savePrefs(saved); draw(); } },
    [3, 5].map(v => h('option', { value: v, selected: v === prefs.gridYd }, `${v}-yard grid`)));
  const setAll = v => { for (const [k] of BOOK_OPTIONS) if (!HIDDEN.has(k)) prefs[k] = v; if (!v) prefs.fairway = prefs.bunkers = prefs.water = true; savePrefs(saved); syncInputs(); draw(); };
  const zoomSel = h('select', { 'aria-label': 'Hole view', onchange: e => { prefs.teeInset = e.target.value === 'zoom'; savePrefs(saved); draw(); } },
    [['zoom', 'Zoomed view'], ['whole', 'Entire hole']].map(([v, t]) => h('option', { value: v, selected: (v === 'zoom') === !!prefs.teeInset }, t)));
  const allOn = h('button', { class: 'bookbtn', onclick: () => setAll(true) }, 'All on');
  const allOff = h('button', { class: 'bookbtn', onclick: () => setAll(false) }, 'Basic');
  const opts_ = h('div', { class: 'bookopts', hidden: true }, h('div', { class: 'bookrow' }, allOn, allOff, zoomSel, gridSel), ...optRows,
    opts.tourney ? h('small', { class: 'muted' }, 'Tournament: no green page or contours (Rules of Golf 4.3)') : null);
  function syncInputs() {
    let i = 0;
    for (const [k, , , , needsElev] of BOOK_OPTIONS) { if ((needsElev && !elevOk) || HIDDEN.has(k)) continue; const inp = opts_.querySelectorAll('input')[i++]; if (inp) inp.checked = prefs[k]; }
  }
  // Style: the plain book, or the satellite picture with the book's outlines
  // and numbers on it (the hole pages; the green pages stay plain). Kept on this device.
  let style = getStyle();
  const styleSel = h('select', { 'aria-label': 'Style', onchange: e => { style = e.target.value; setStyle(style); draw(); } },
    STYLES.map(([v, t]) => h('option', { value: v, selected: v === style }, t)));
  const teeSel = h('select', { 'aria-label': 'Tee box', onchange: e => { teeName = e.target.value; draw(); } },
    course.tees.map(t => h('option', { value: t.name, selected: t.name === teeName }, `${t.name} tees`)));
  const go = d => { hole = ((hole - 1 + d + course.holes.length) % course.holes.length) + 1; draw(); };
  const close = () => { ov.remove(); document.body.classList.remove('bookopen'); if (hole !== n) opts.onHole?.(hole); };
  // Print: the book is made into a PDF here on the device (phones, and the app
  // added to the home screen, won't print a page straight from the app), then
  // shared, opened or saved from the bar that comes up. Layouts:
  //  letter (the default) / legal - fold: each half of the sheet is a strip
  //           with a green page over a hole page. Cut once down the middle,
  //           fold each strip in half (printing outside), stack, bind along the
  //           folds. Each strip is centred in its half (a quarter-inch either
  //           side, so the cut leaves both halves the same) and its pages
  //           fill it: 3 3/4 wide, 6 3/4 tall on legal (folds to 4 1/4 x 7)
  //           or 5 1/4 on letter (folds to 4 1/4 x 5 1/2).
  //  duplex-letter / duplex-legal - printed on both sides: cards four to a
  //           sheet (2 x 2; on letter at 75%), or two big ones to a letter
  //           sheet (duplex-letter-2), the hole page on the front and the next
  //           hole's green on the back; cut apart, stack, bind at the top.
  //  single - one 4 1/4 x 7 page per sheet
  // A new key, so everyone starts on fold · letter: one cut, then fold.
  let layout = getLayout();
  const layoutSel = h('select', { 'aria-label': 'Print layout', onchange: e => { layout = e.target.value; setLayout(layout); } },
    LAYOUTS.map(([v, t]) => h('option', { value: v, selected: v === layout }, t)));
  const pdfBar = h('div', { class: 'bookpdf', hidden: true });
  let pdfUrl = null;
  async function makePdf(all) {
    pdfBar.hidden = true;
    if (pdfUrl) { URL.revokeObjectURL(pdfUrl); pdfUrl = null; }
    const holes = all ? course.holes.map(c => c.n) : [hole];
    try {
      status.textContent = 'Getting the PDF maker…';
      await loadScript('vendor/jspdf/jspdf.umd.min.js');
      const css = await bookFontCss();
      // Fold layouts: the pages are as tall as half the strip, as wide as it.
      const MARGIN = 0.25, fold = layout === 'letter' || layout === 'legal';
      const sheetH = layout === 'legal' || layout === 'duplex-legal' ? 14 : 11;
      const pageWIn = 4.25 - 2 * MARGIN, pageHIn = sheetH / 2 - MARGIN;
      const pageH = fold ? Math.round((W * pageHIn) / pageWIn) : PAGE_H;
      const pagesFor = async k => {
        try { return await drawHoleParts(k, prefs, pageH); } catch (e) { console.error('yardage book', e); return drawHoleParts(k, { ...prefs, contours: false, greenContours: false, slopes: false, deltas: false }, pageH); }
      };
      const parts = {};
      for (const k of holes) { status.textContent = `Drawing hole ${k}${all ? ` of ${holes.length}` : ''}…`; parts[k] = await pagesFor(k); }
      // Leaves (flip book): a top page over a bottom page. In a book the
      // spread for hole k is the back of leaf k-1 (its top page) over the
      // front of leaf k (its bottom page), so each leaf carries hole k's hole
      // page and hole k+1's green; the first leaf is the cover.
      const blank = () => blankPage(pageH);
      let leaves;
      if (!all) leaves = [[parts[hole].green || blank(), parts[hole].hole]];
      else {
        leaves = [[parts[holes[0]].green || blank(), coverPage(teeName, layout.startsWith('duplex') ? 'Printed two-sided: flip on short edge' : '', pageH)]];
        holes.forEach((k, i) => leaves.push([i + 1 < holes.length ? parts[holes[i + 1]].green || blank() : notesPage(pageH), parts[k].hole]));
      }
      status.textContent = 'Making the PDF…';
      const { jsPDF } = window.jspdf;
      const DPI = 200;
      let doc = null;
      const sheet = async (wIn, hIn, place) => {
        const cv = document.createElement('canvas'); cv.width = Math.round(wIn * DPI); cv.height = Math.round(hIn * DPI);
        const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        await place(ctx);
        if (!doc) doc = new jsPDF({ unit: 'in', format: [wIn, hIn], orientation: wIn > hIn ? 'landscape' : 'portrait' });
        else doc.addPage([wIn, hIn], wIn > hIn ? 'landscape' : 'portrait');
        doc.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, wIn, hIn, undefined, 'FAST');
      };
      // A card's or strip's place in the stack (1 on top): a numbered dot.
      const numberAt = (ctx, cxN, cyN, r, num) => {
        ctx.setLineDash([]); ctx.fillStyle = '#1c2a22'; ctx.beginPath(); ctx.arc(cxN, cyN, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(r * 1.25)}px 'Barlow Condensed', Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(num), cxN, cyN + r * 0.06);
      };
      // Printers (and print shops) can't print the outer edge of a sheet,
      // so everything sits inside a quarter-inch margin: the cards shrink a
      // little to fit (still within the USGA's size and green-scale limits),
      // and the dashed cut lines go round every card.
      const cutBox = (ctx, xs, ys, wPx, hPx) => {
        ctx.strokeStyle = '#aaa'; ctx.lineWidth = 2; ctx.setLineDash([18, 12]); ctx.beginPath();
        for (const x of xs) { ctx.moveTo(x, 0); ctx.lineTo(x, hPx); }
        for (const y of ys) { ctx.moveTo(0, y); ctx.lineTo(wPx, y); }
        ctx.stroke(); ctx.setLineDash([]);
      };
      if (layout.startsWith('duplex')) {
        // Fronts (hole pages) then backs (greens) for each sheet. Printed
        // two-sided flipping on the short edge, a card's back sits in the
        // same column and the mirrored row, and reads the right way up when
        // the card is flipped up over the top, like a tour book. The cards
        // are centred on the sheet, so the two sides line up.
        const legal = layout === 'duplex-legal', sw = 8.5, sh = legal ? 14 : 11, rows = layout === 'duplex-letter-2' ? 1 : 2, per = 2 * rows; // four cards a sheet (two big ones on letter-2)
        const k = Math.min((sw - 2 * MARGIN) / 8.5, (sh - 2 * MARGIN) / (7 * rows), 1);
        const cw = 4.25 * k * DPI, chh = 7 * k * DPI, half = (sw / 2) * DPI, cx0 = (half - cw) / 2, y0 = (sh * DPI - rows * chh) / 2; // each card centred in its half
        const nSheets = Math.ceil(leaves.length / per);
        for (let i = 0; i < leaves.length; i += per) {
          const group = leaves.slice(i, i + per);
          status.textContent = `Making sheet ${i / per + 1} of ${nSheets}…`;
          await sheet(sw, sh, async ctx => {
            for (const [j, [, front]] of group.entries()) {
              const x = (j % 2) * half + cx0, y = y0 + Math.floor(j / 2) * chh;
              await drawSvg(ctx, front, x, y, cw, chh, css);
              if (leaves.length > 1) numberAt(ctx, x + cw / 2, y + chh - 0.2 * k * DPI, 0.12 * k * DPI, i + j + 1);
            }
            cutBox(ctx, [half], rows > 1 ? [y0 + chh] : [], sw * DPI, sh * DPI);
          });
          await sheet(sw, sh, async ctx => {
            for (const [j, [back]] of group.entries()) {
              const x = (j % 2) * half + cx0, y = y0 + (rows - 1 - Math.floor(j / 2)) * chh;
              await drawSvg(ctx, back, x, y, cw, chh, css);
            }
          });
        }
      } else if (layout === 'single') {
        const flat = all ? holes.flatMap(k => [parts[k].green, parts[k].hole].filter(Boolean)) : [parts[hole].green, parts[hole].hole].filter(Boolean);
        const k = Math.min((4.25 - 2 * MARGIN) / 4.25, (7 - 2 * MARGIN) / 7);
        const pw = 4.25 * k * DPI, ph = 7 * k * DPI, x0 = (4.25 * DPI - pw) / 2, y0 = (7 * DPI - ph) / 2;
        for (const [i, svg] of flat.entries()) { status.textContent = `Making page ${i + 1} of ${flat.length}…`; await sheet(4.25, 7, ctx => drawSvg(ctx, svg, x0, y0, pw, ph, css)); }
      } else {
        // One cut down the middle; each strip centred in its half, its two
        // pages meeting at the sheet's middle, where it folds.
        const sw = 8.5, sh = sheetH, half = (sw / 2) * DPI, pw = pageWIn * DPI, ph = pageHIn * DPI;
        const px0 = (half - pw) / 2, fy = (sh / 2) * DPI;
        for (let i = 0; i < leaves.length; i += 2) {
          status.textContent = `Making sheet ${i / 2 + 1} of ${Math.ceil(leaves.length / 2)}…`;
          await sheet(sw, sh, async ctx => {
            for (let j = 0; j < 2 && i + j < leaves.length; j++) {
              const [top, bottom] = leaves[i + j], x = j * half + px0;
              await drawSvg(ctx, top, x, fy - ph, pw, ph, css);
              await drawSvg(ctx, bottom, x, fy, pw, ph, css);
              // Its place in the stack (1 on top), at the foot of the strip.
              if (leaves.length > 1) numberAt(ctx, x + pw / 2, fy + ph - 0.18 * DPI, 0.11 * DPI, i + j + 1);
              // Fold marks at the strip's edges.
              ctx.strokeStyle = '#999'; ctx.lineWidth = 2; ctx.setLineDash([]);
              ctx.beginPath(); ctx.moveTo(j * half + 0.04 * DPI, fy); ctx.lineTo(j * half + 0.2 * DPI, fy); ctx.moveTo((j + 1) * half - 0.04 * DPI, fy); ctx.lineTo((j + 1) * half - 0.2 * DPI, fy); ctx.stroke();
            }
            cutBox(ctx, [half], [], sw * DPI, sh * DPI);
          });
        }
      }
      const blob = doc.output('blob');
      pdfUrl = URL.createObjectURL(blob);
      const name = `${course.name.replace(/[^\w\s-]/g, '').trim()} ${all ? 'yardage book' : `hole ${hole}`}.pdf`;
      const file = (() => { try { return new File([blob], name, { type: 'application/pdf' }); } catch { return null; } })();
      const canShare = file && navigator.canShare?.({ files: [file] });
      pdfBar.replaceChildren(...[
        h('b', {}, `PDF ready · ${{ 'duplex-legal': 'double-sided, legal paper, 4 cards per sheet', 'duplex-letter': 'double-sided, letter paper, 4 cards per sheet', 'duplex-letter-2': 'double-sided, letter paper, 2 big cards per sheet', legal: 'fold, legal paper, 2 strips per sheet', letter: 'fold, letter paper, 2 strips per sheet', single: '4¼ × 7 pages' }[layout]}`),
        canShare ? h('button', { class: 'bookbtn primary', onclick: () => navigator.share({ files: [file], title: name }).catch(() => {}) }, 'Share / Print') : null,
        h('a', { class: 'bookbtn', href: pdfUrl, target: '_blank', download: name }, 'Open PDF'),
        h('small', {}, layout === 'single' ? 'Print at 100% (actual size, not “fit to page”).'
          : layout.startsWith('duplex') ? `Print at 100% on ${layout === 'duplex-legal' ? 'legal (8½ × 14)' : 'letter (8½ × 11)'} paper (at a print shop, ask for ${layout === 'duplex-legal' ? 'legal 8½ × 14' : 'letter 8½ × 11'}, actual size), two-sided, flip on short edge. Cut along the dashed lines (trimming off the margin)${all ? ', stack them by the number at the foot of each (1 on top)' : ''} and staple or clip along the top.`
          : `Print at 100% on ${layout === 'legal' ? 'legal (8½ × 14)' : 'letter (8½ × 11)'} paper, one side. Cut once down the dashed line, fold each strip in half at the marks with the printing outside (${layout === 'legal' ? '4¼ × 7' : '4¼ × 5½'}), stack them${all ? ' by the number at the foot of each (1 on top)' : ''} with the folds at the top, and staple along the folds.`)].filter(Boolean));
      pdfBar.hidden = false;
      status.textContent = '';
    } catch (e) {
      console.error('yardage book pdf', e);
      status.textContent = `Couldn’t make the PDF: ${e.message || e}`;
    }
  }
  async function drawHoleParts(k, p, pageH = PAGE_H) {
    const o = { ...opts, pageH };
    const hp = await holePage(k, teeName, p, helpers, { ...o, satellite: style === 'sat' });
    const gp = p.greenPage ? await greenPage(k, teeName, p, helpers, { ...o, satellite: style === 'sat' }) : null;
    return { hole: hp, green: gp };
  }
  const coverPage = (tn, note = '', H = PAGE_H) => {
    const fy = y => (y * H) / PAGE_H; // laid out for a 658-high page
    const t = course.tees.find(x => x.name === tn) || course.tees[0];
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, xmlns: SVGNS, 'font-family': FONT });
    const yds = t ? t.yards.slice(0, course.holes.length).reduce((a, b) => a + b, 0) : '';
    const par = course.holes.reduce((a, c) => a + c.par, 0);
    svg.append(el('rect', { width: W, height: H, fill: '#fff' }),
      txt(W / 2, fy(200), course.name.toUpperCase(), { 'font-size': 26, 'font-weight': 900, 'text-anchor': 'middle', fill: INK }),
      course.location ? txt(W / 2, fy(226), course.location.toUpperCase(), { 'font-size': 12, 'text-anchor': 'middle', fill: SOFT, 'letter-spacing': 1 }) : null,
      txt(W / 2, fy(300), 'YARDAGE BOOK', { 'font-size': 34, 'font-weight': 700, 'text-anchor': 'middle', fill: INK, 'letter-spacing': 3 }),
      txt(W / 2, fy(336), `${(t?.name || tn).toUpperCase()} TEES · ${yds} YDS · PAR ${par}`, { 'font-size': 13, 'text-anchor': 'middle', fill: SOFT, 'letter-spacing': 1 }),
      txt(W / 2, fy(600), 'Red: yards to the front of the green · Black: yards from the tee', { 'font-size': 10, 'text-anchor': 'middle', fill: SOFT }),
      txt(W / 2, fy(616), 'Blue: yards uphill (+) or downhill (−)', { 'font-size': 10, 'text-anchor': 'middle', fill: SOFT }),
      note ? txt(W / 2, fy(460), note.toUpperCase(), { 'font-size': 11, 'font-weight': 700, 'text-anchor': 'middle', fill: INK, 'letter-spacing': 1 }) : null);
    return svg;
  };
  const blankPage = (H = PAGE_H) => el('svg', { viewBox: `0 0 ${W} ${H}`, xmlns: SVGNS }, el('rect', { width: W, height: H, fill: '#fff' }));
  const notesPage = (H = PAGE_H) => {
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, xmlns: SVGNS, 'font-family': FONT }, el('rect', { width: W, height: H, fill: '#fff' }),
      txt(16, 40, 'NOTES', { 'font-size': 14, 'font-weight': 700, fill: INK, 'letter-spacing': 1.5 }));
    for (let y = 80; y < H - 30; y += 26) svg.append(el('line', { x1: 16, x2: W - 16, y1: y, y2: y, stroke: '#d6dcd8', 'stroke-width': 0.8 }));
    return svg;
  };
  const ov = h('div', { class: 'bookov' },
    h('div', { class: 'booktop' },
      h('button', { class: 'bookbtn', 'aria-label': 'Close', onclick: close }, '✕'),
      h('button', { class: 'bookbtn', 'aria-label': 'Previous hole', onclick: () => go(-1) }, '‹'), title,
      h('button', { class: 'bookbtn', 'aria-label': 'Next hole', onclick: () => go(1) }, '›'),
      teeSel, styleSel,
      h('button', { class: 'bookbtn', onclick: () => { opts_.hidden = !opts_.hidden; } }, '☰ Show'),
      layoutSel,
      h('button', { class: 'bookbtn', onclick: () => makePdf(false) }, '⎙ Hole'),
      h('button', { class: 'bookbtn', onclick: () => makePdf(true) }, '⎙ Book'),
      status),
    pdfBar, opts_, pages);
  document.body.append(ov);
  document.body.classList.add('bookopen');
  draw();
  if (opts.autoPdf) makePdf(true); // from the setup page's Make PDF: the whole book
  return ov;
}

// GEN BOOK's first page: pick everything, then preview the book or make the PDF.
// opts: as openBook's (teeName is the one to start on).
export function openBookSetup(opts) {
  const prefs = loadPrefs();
  let style = getStyle(), layout = getLayout(), teeName = opts.teeName || course.tees[0]?.name;
  const radios = (name, list, get, set) => h('div', { class: 'setupchoices' }, list.map(([v, label, note]) => {
    const input = h('input', { type: 'radio', name, value: v, onchange: () => set(v) });
    input.checked = get() === v;
    return h('label', { class: 'bookopt' }, input, h('span', {}, label, note ? h('small', { class: 'muted' }, ` ${note}`) : null));
  }));
  const tees = radios('setuptee', course.tees.map(t => {
    const yds = t.yards ? t.yards.slice(0, course.holes.length).reduce((a, b) => a + b, 0) : 0;
    return [t.name, `${t.name} tees`, yds ? `· ${yds} yds` : ''];
  }), () => teeName, v => { teeName = v; });
  const styles = radios('setupstyle', STYLES.map(([v, t]) => [v, t, v === 'sat' ? '· the satellite picture with the outlines and numbers' : '· drawn like a tour book']), () => style, v => { style = v; setStyle(v); });
  const formats = radios('setupformat', LAYOUTS, () => layout, v => { layout = v; setLayout(v); });
  const elevOk = !opts.tourney;
  const inputs = {};
  const optRows = [];
  let group = '';
  // Zoomed view (from the fairway, with the tees in a box) or the entire hole.
  const zoom = radios('setupzoom', [['zoom', 'Zoomed view', '· starts at the fairway, tees in a box (par 4s and 5s)'], ['whole', 'Entire hole', '· tee to green']],
    () => (prefs.teeInset ? 'zoom' : 'whole'), v => { prefs.teeInset = v === 'zoom'; savePrefs(prefs); });
  for (const [k, label, grp, , needsElev] of BOOK_OPTIONS) {
    if ((needsElev && !elevOk) || HIDDEN.has(k)) continue;
    if (grp !== group) {
      group = grp; optRows.push(h('div', { class: 'bookgroup' }, grp));
      if (grp === 'Hole overview page') optRows.push(h('div', { class: 'setupwide' }, zoom));
    }
    const input = inputs[k] = h('input', { type: 'checkbox', onchange: e => { prefs[k] = e.target.checked; savePrefs(prefs); } });
    input.checked = prefs[k];
    optRows.push(h('label', { class: 'bookopt' }, input, h('span', {}, label)));
  }
  const setAll = v => {
    for (const [k] of BOOK_OPTIONS) if (!HIDDEN.has(k)) prefs[k] = v;
    if (!v) prefs.fairway = prefs.bunkers = prefs.water = true;
    savePrefs(prefs);
    for (const [k, inp] of Object.entries(inputs)) inp.checked = prefs[k];
  };
  const close = () => { ov.remove(); document.body.classList.remove('bookopen'); };
  const go = autoPdf => { ov.remove(); openBook(1, { ...opts, teeName, autoPdf }); };
  const section = (title, ...kids) => h('section', { class: 'setupsec' }, h('div', { class: 'bookgroup' }, title), ...kids);
  const ov = h('div', { class: 'bookov setupov' },
    h('div', { class: 'booktop' },
      h('button', { class: 'bookbtn', 'aria-label': 'Close', onclick: close }, '✕'),
      h('b', {}, 'Yardage book'), h('small', { class: 'muted' }, course.name)),
    h('div', { class: 'booksetup' },
      section('Style', styles),
      section('Tee box', tees),
      section('Format', formats, h('small', { class: 'muted' }, 'Double-sided: print at 100%, two-sided, flip on short edge, then cut the cards apart and stack them.')),
      section('Show', h('div', { class: 'bookrow' }, h('button', { class: 'bookbtn', onclick: () => setAll(true) }, 'All on'), h('button', { class: 'bookbtn', onclick: () => setAll(false) }, 'Basic')),
        h('div', { class: 'setupopts' }, ...optRows),
        opts.tourney ? h('small', { class: 'muted' }, 'Tournament: no green page or contours (Rules of Golf 4.3)') : null),
      h('div', { class: 'setupgo' },
        h('button', { class: 'bookbtn', onclick: () => go(false) }, 'Preview'),
        h('button', { class: 'bookbtn primary', onclick: () => go(true) }, 'Make PDF'))));
  document.body.append(ov);
  document.body.classList.add('bookopen');
  return ov;
}

// The yardage book as a map (GPS Overview > View > Yardage book view): the
// whole hole page (no tees box), as a picture with its four corners on the
// ground [lng, lat] (top left, top right, bottom right, bottom left) and the
// bearing that's up the page (degrees).
// opts.lines: outlines and numbers only, on a see-through picture (to lay over the satellite map).
export async function bookMapImage(n, teeName, helpers, opts = {}, scale = 6) {
  const prefs = { ...loadPrefs(), teeInset: false };
  let svg;
  try { svg = await holePage(n, teeName, prefs, helpers, opts); } catch (e) {
    console.error('yardage book map', e);
    svg = await holePage(n, teeName, { ...prefs, contours: false, deltas: false }, helpers, opts);
  }
  const [l, t, r, b] = svg.geo.rect, H = +svg.getAttribute('viewBox').split(' ')[3];
  const cv = document.createElement('canvas');
  cv.width = Math.round((r - l) * scale); cv.height = Math.round((b - t) * scale);
  const ctx = cv.getContext('2d'); if (!opts.lines) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); }
  await drawSvg(ctx, svg, -l * scale, -t * scale, W * scale, H * scale, await bookFontCss());
  const url = await new Promise(ok => cv.toBlob(bl => ok(URL.createObjectURL(bl)), 'image/png'));
  const corners = [[l, t], [r, t], [r, b], [l, b]].map(([u, v]) => { const [la, lo] = svg.geo.at(u, v); return [lo, la]; });
  return { url, corners, bearing: (svg.geo.up * 180) / Math.PI };
}
// The green page by itself (tapping the green in the map view).
export async function bookGreenPage(n, teeName, helpers, opts = {}) {
  const prefs = { ...loadPrefs() };
  try { return await greenPage(n, teeName, prefs, helpers, opts); } catch (e) {
    console.error('yardage book green', e);
    return greenPage(n, teeName, { ...prefs, greenContours: false, slopes: false }, helpers, opts);
  }
}

// For tests and tools: draw a hole's pages without the screen.
export const bookPages = async (n, teeName, prefs, helpers, opts = {}) => {
  const p = { ...loadPrefs(), ...prefs };
  return [await holePage(n, teeName, p, helpers, opts), p.greenPage ? await greenPage(n, teeName, p, helpers, opts) : null].filter(Boolean);
};

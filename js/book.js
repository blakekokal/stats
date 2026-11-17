// Yardage book (GPS Overview > View > Yardage book): a clean, printable page
// per hole drawn from the course file, laid out like a tour player's book.
// Laid out like a tour book flipped open: the green page on top, the hole
// page below the fold. The hole page runs tee (bottom) to green (top); the green page shows the
// green as it's approached, with a grid, contours and slope arrows. Every
// number on the pages is yards to the FRONT of the green. What's drawn is
// picked with switches (kept on this device); Print makes a PDF / paper copy
// of this hole or of the whole course.

import { h, course, teePosition, teeBoxFor, boxCentre, partOf } from './app.js';
import { elevIndex, heightAt } from './elev.js';

const M_PER_DEG = 111320, M_PER_YD = 0.9144, FT_PER_M = 3.28084, IN_PER_M = 39.3701;
const SVGNS = 'http://www.w3.org/2000/svg';
// One page, in SVG units: 4 1/4 x 7 inches at 100% (the USGA's size limit for
// a yardage book, Rule 4.3 / Interpretation 4.3a(1)/1).
const W = 400, H = 658;
// The USGA's scale limit for any picture of a putting green: 3/8 inch to 5
// yards (1:480). At W units = 4.25 in that's 400 / 4.25 * 0.075 = 7.06 units a
// yard; every page stays under it.
const MAX_UNITS_PER_YD = 7;

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
  ['layup', 'Yardage dots (100 · 150 · 200 · 250 · 300) & key', 'Hole page', true],
  ['edges', 'Fairway edge numbers', 'Hole page', true],
  ['hazards', 'Bunker & water numbers (start and end)', 'Hole page', true],
  ['contours', 'Contours & slope arrows', 'Hole page', true, true],
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

// Heights (inches) on a grid over area [x0, y0, x1, y1] of frame f (yards),
// every `step` yards, smoothed over `r` cells: { at(x, y), lines(levels), lo, hi }.
async function reliefGrid(elevId, info, f, [x0, y0, x1, y1], step, r) {
  const nx = Math.ceil((x1 - x0) / step) + 1, ny = Math.ceil((y1 - y0) / step) + 1;
  const pts = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pts.push(f.back([x0 + i * step, y0 + j * step]));
  const hs = await heightsAt(elevId, info, pts);
  // The lidar is about 2 m a pixel: smoothing shows the ground's shape, not the pixels.
  let grid = hs.map(v => (v == null ? null : v * IN_PER_M));
  for (let k = 0; k < 2; k++) grid = blur(grid, nx, ny, r);
  const vals = grid.filter(v => v != null);
  const at = (x, y) => { const i = Math.round((x - x0) / step), j = Math.round((y - y0) / step); return i >= 0 && j >= 0 && i < nx && j < ny ? grid[j * nx + i] : null; };
  return { at, lo: Math.min(...vals), hi: Math.max(...vals), ok: vals.length > 0,
    lines: levels => isolines(grid, nx, ny, x0, y0, step, levels) };
}
// Contour levels every `iv` inches between lo and hi.
const levelsOf = (lo, hi, iv) => { const out = []; for (let v = Math.ceil(lo / iv) * iv; v <= hi; v += iv) out.push(v); return out; };
// Small downhill arrows, yardage-book style: one per `gap` yards where
// keep(x, y) says so, longer where it's steeper. Returns an SVG path.
function slopeArrows(R, [x0, y0, x1, y1], gap, P, keep, scale = 1) {
  let d = '';
  const b = Math.max(1, gap / 2);
  for (let y = y0 + gap / 2; y < y1; y += gap) for (let x = x0 + gap / 2; x < x1; x += gap) {
    if (!keep(x, y)) continue;
    const e = R.at(x + b, y), w = R.at(x - b, y), nn = R.at(x, y + b), ss = R.at(x, y - b);
    if ([e, w, nn, ss].some(v => v == null)) continue;
    const gx = (e - w) / (2 * b) / 36, gy = (nn - ss) / (2 * b) / 36; // rise per yard
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

async function holePage(n, teeName, prefs, helpers, opts) {
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
  minX = Math.min(minX - 32, -45); maxX = Math.max(maxX + 32, 45); minY -= 14; maxY += 18;
  const top = 86, bottom = H - 72, left = 14, right = W - 14;
  const s = Math.min((right - left) / (maxX - minX), (bottom - top) / (maxY - minY), 4.2, MAX_UNITS_PER_YD);
  const cx = (left + right) / 2 - ((minX + maxX) / 2) * s, cy = (top + bottom) / 2 + ((minY + maxY) / 2) * s;
  const P = ([x, y]) => [cx + x * s, cy - y * s];
  const viewYd = [(left - cx) / s, (cx - right) / -s, (cy - bottom) / s, (cy - top) / s]; // minX, maxX, minY, maxY in yards
  const inView = pts => pts.some(([x, y]) => x > viewYd[0] - 20 && x < viewYd[1] + 20 && y > viewYd[2] - 20 && y < viewYd[3] + 20);

  const id = `bk${n}p${Math.random().toString(36).slice(2, 7)}`;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bookpage', xmlns: SVGNS, 'font-family': FONT });
  svg.append(defs(id), el('clipPath', { id: `${id}-clip` }, el('rect', { x: left, y: top, width: right - left, height: bottom - top })));
  svg.append(el('rect', { width: W, height: H, fill: '#fff' }));
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
  const draw = (o, attrs) => mapG.append(el('path', { d: pathD(o.r.map(P), true), ...attrs }));
  const faint = o => (!own(o) ? { opacity: 0.45 } : {});
  const others = prefs.otherHoles;
  if (prefs.water) for (const o of feats.filter(o => o.x.t === 'water')) draw(o, { fill: `url(#${id}-water)`, stroke: '#4f97c7', 'stroke-width': 0.9 });
  if (prefs.fairway) for (const o of feats.filter(o => o.x.t === 'fairway' && (own(o) || others))) draw(o, { fill: '#d9f0cf', stroke: '#6aa65a', 'stroke-width': 0.9, ...faint(o) });
  if (prefs.trees) for (const o of feats.filter(o => o.x.t === 'trees')) draw(o, { fill: '#cfe5c4', stroke: '#7fae70', 'stroke-width': 0.6, 'fill-opacity': 0.9 });
  for (const o of feats.filter(o => o.x.t === 'tee' && (own(o) || others))) {
    if (own(o) && !prefs.allTees && o.x !== F.teeBox) continue;
    draw(o, { fill: o.x === F.teeBox ? '#9fd18b' : '#e4f3dc', stroke: '#5f9a50', 'stroke-width': 0.9, ...faint(o) });
  }
  if (prefs.bunkers) for (const o of feats.filter(o => o.x.t === 'bunker')) draw(o, { fill: `url(#${id}-sand)`, stroke: '#b8954e', 'stroke-width': 0.9 });
  for (const o of feats.filter(o => o.x.t === 'green' && (own(o) || others))) draw(o, { fill: own(o) ? '#a6dc94' : '#cdeac2', stroke: '#3f8a3a', 'stroke-width': own(o) ? 1.3 : 0.8, ...faint(o) });
  if (prefs.ob) {
    for (const x of course.features.filter(x => x.t === 'ob')) {
      for (const r of x.p.length > 1 ? x.p.slice(1) : x.p) {
        const pts = r.map(f.fwd);
        if (!inView(pts)) continue;
        mapG.append(el('path', { d: pathD(pts.map(P)), fill: 'none', stroke: INK, 'stroke-width': 1.1, 'stroke-dasharray': '1.2 4.5', 'stroke-linecap': 'round' }));
      }
    }
  }

  // Contour lines and a field of small downhill arrows over the whole hole,
  // like a tour book (not in bunkers, water or on the green: that's the green page).
  if (prefs.contours && info) {
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

  // Centre line, tee to the middle of the green.
  if (prefs.centre) {
    const end = greenL ? centroid(greenL) : L.at(-1);
    mapG.append(el('path', { d: pathD([...L.slice(0, -1), end].map(P)), fill: 'none', stroke: SOFT, 'stroke-width': 0.8, 'stroke-dasharray': '3 3' }));
    for (const p of L.slice(1, -1)) { const [x, y] = P(p); mapG.append(el('circle', { cx: x, cy: y, r: 1.8, fill: '#fff', stroke: SOFT, 'stroke-width': 0.8 })); }
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

  // Yardage dots down the middle at 100, 150, 200, 250 and 300 to the front
  // of the green, coloured like a course's yardage markers, with a key at the
  // bottom right.
  const layupYds = [100, 150, 200, 250, 300];
  const DOT = { 100: '#d93a3a', 150: '#ffffff', 200: '#2e6fd0', 250: '#f2c40f', 300: '#222222' };
  const dotsShown = [];
  if (prefs.layup) {
    for (const yd of layupYds) {
      const w = spotAt(yd);
      if (!w || w.fromTee < 40) continue;
      const [x, y] = P(w.p);
      labG.append(el('circle', { cx: x, cy: y, r: 4.2, fill: DOT[yd], stroke: '#222', 'stroke-width': 0.9, 'paint-order': 'normal' }));
      lab.block([x - 5, y - 5, x + 5, y + 5]);
      dotsShown.push(yd);
    }
    if (dotsShown.length) {
      const kw = 62, kh = 14 + dotsShown.length * 12, kx = right - kw - 4, ky = bottom - kh - 4;
      lab.block([kx, ky, kx + kw, ky + kh]);
      svg.append(el('rect', { x: kx, y: ky, width: kw, height: kh, rx: 3, fill: '#fff', 'fill-opacity': 0.95, stroke: '#c9d0cb', 'stroke-width': 0.8 }),
        txt(kx + 6, ky + 10, 'TO FRONT', { 'font-size': 7.5, 'font-weight': 700, fill: SOFT, 'letter-spacing': 0.6 }),
        ...dotsShown.flatMap((yd, i) => [el('circle', { cx: kx + 10, cy: ky + 19 + i * 12, r: 3.6, fill: DOT[yd], stroke: '#222', 'stroke-width': 0.8 }),
          txt(kx + 19, ky + 22.5 + i * 12, `${yd} yds`, { 'font-size': 9, fill: INK })]));
    }
  }

  // Bunkers and water: a dot at the start and the end of each, with the yards
  // to the front of the green above (red) and the yards from the tee to that
  // spot below (black).
  const RED = '#c62f2f';
  const pair = (q, front, tee, side) => {
    const [x, y] = P(q), wdt = Math.max(textW(front, 10), textW(tee, 9.5)) + 2, hgt = 21;
    labG.append(el('circle', { cx: x, cy: y, r: 1.8, fill: INK }));
    const a = side > 0 ? 'start' : 'end';
    // The pair is drawn from 16 above its spot's y to 5 below, as the labeller boxes it.
    const spot = lab.place([[x + side * 4, y + 6, a], [x + side * 4, y - 2, a], [x + side * 4, y + 14, a], [x - side * 4, y + 6, side > 0 ? 'end' : 'start'],
      [x + side * 4, y - 10, a], [x + side * 4, y + 22, a]], wdt, hgt, bounds);
    if (!spot) return;
    const [sx, sy, anc] = spot;
    labG.append(txt(sx, sy - 8, front, { 'font-size': 10, 'font-weight': 700, fill: RED, 'text-anchor': anc }),
      txt(sx, sy + 2.5, tee, { 'font-size': 9.5, fill: INK, 'text-anchor': anc }));
  };
  if (prefs.hazards) {
    const hz = F.own.filter(x => (x.t === 'bunker' && prefs.bunkers) || (x.t === 'water' && prefs.water));
    for (const x of hz) {
      // Only the part near the line of play (a lake can be huge).
      const pts = ringOf(x).map(f.fwd).filter(p => walk.some(w => Math.abs(w.p[1] - p[1]) < 3 && Math.abs(w.p[0] - p[0]) < 45));
      if (pts.length < 2) continue;
      const fr = pts.map(toFront);
      const iS = fr.indexOf(Math.max(...fr)), iE = fr.indexOf(Math.min(...fr));
      if (fr[iS] > 440 || dist(pts[iS], [0, 0]) < 25) continue; // behind or beside the tee
      const c = centroid(pts);
      const nearLine = walk.reduce((b, w) => (dist(w.p, c) < dist(b.p, c) ? w : b), walk[0]);
      const side = (c[0] - nearLine.p[0]) * nearLine.d[1] - (c[1] - nearLine.p[1]) * nearLine.d[0] >= 0 ? 1 : -1;
      pair(pts[iS], Math.round(fr[iS]), Math.round(dist(pts[iS], [0, 0])), side);
      if (fr[iS] - fr[iE] >= 3) pair(pts[iE], Math.round(fr[iE]), Math.round(dist(pts[iE], [0, 0])), side);
    }
  }

  // Fairway edge numbers: a dot on each edge every 20 yards, with its own
  // yards to the front (the left and right edge read a little differently).
  if (prefs.edges) {
    for (let yd = 40; yd <= 340; yd += 20) {
      const w = spotAt(yd);
      if (!w || w.fromTee < 60) continue;
      const e = edgesAt(w);
      if (!e) continue;
      for (const [q, side] of [[e.l, -1], [e.r, 1]]) {
        const v = Math.round(toFront(q)), [x, y] = P(q);
        const spot = lab.place([[x + side * 4, y + 3, side > 0 ? 'start' : 'end'], [x + side * 4, y - 3, side > 0 ? 'start' : 'end'], [x + side * 4, y + 9, side > 0 ? 'start' : 'end']], textW(v, 9.5), 9.5, bounds);
        if (!spot) continue;
        labG.append(el('circle', { cx: x, cy: y, r: 1.4, fill: INK }), txt(spot[0], spot[1], v, { 'font-size': 9.5, 'font-weight': 700, fill: RED, 'text-anchor': spot[2] }));
      }
    }
  }

  // Tee boxes: the chosen one marked, each with its yards to the front.
  const teeFront = Math.round(toFront(f.fwd(tee)));
  for (const { b, r } of teeBoxesL) {
    const chosen = b === F.teeBox;
    if (!chosen && !prefs.allTees) continue;
    const c = P(centroid(r));
    const names = course.tees.filter(t => teeBoxFor(t.name, ch, F.boxes) === b).map(t => t.name);
    const v = Math.round(toFront(f.fwd(boxCentre(b))));
    const label = chosen ? `${names.length ? names.join('/') : teeName} ${v}` : `${names.join('/') || 'Tee'} ${v}`;
    const size = chosen ? 10 : 8.5;
    const spot = lab.place([[c[0] + 9, c[1] + 3, 'start'], [c[0] - 9, c[1] + 3, 'end'], [c[0] + 9, c[1] + 12, 'start'], [c[0] - 9, c[1] + 12, 'end']], textW(label, size), size, bounds);
    if (spot) labG.append(txt(spot[0], spot[1], label, { 'font-size': size, 'font-weight': chosen ? 700 : 400, fill: chosen ? INK : SOFT, 'text-anchor': spot[2] }));
  }
  if (!F.teeBox) { const [x, y] = P(f.fwd(tee)); labG.append(el('circle', { cx: x, cy: y, r: 3, fill: INK })); }

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

  // Plays-like: the height change tee to green, as yards.
  let plays = null;
  if (prefs.playsLike && info && greenRing) {
    const [a, b] = await heightsAt(elevId, info, [tee, centroid(greenRing)]);
    if (a != null && b != null) plays = { ft: Math.round((b - a) * FT_PER_M), yd: Math.round((b - a) / M_PER_YD) };
  }

  // Header and footer.
  svg.append(
    txt(16, 54, n, { 'font-size': 54, 'font-weight': 900, fill: INK }),
    txt(16 + textW(n, 54) + 10, 32, `PAR ${ch.par}`, { 'font-size': 15, 'font-weight': 700, fill: INK, 'letter-spacing': 1 }),
    txt(16 + textW(n, 54) + 10, 49, ch.hcp ? `HCP ${ch.hcp}` : '', { 'font-size': 12, fill: SOFT, 'letter-spacing': 1 }),
    txt(W - 16, 44, card ?? teeFront, { 'font-size': 36, 'font-weight': 900, fill: INK, 'text-anchor': 'end' }),
    txt(W - 16, 60, `${(teeSet?.name || teeName).toUpperCase()} TEES · ${teeFront} TO FRONT`, { 'font-size': 10.5, fill: SOFT, 'text-anchor': 'end', 'letter-spacing': 0.6 }),
    plays ? txt(W - 16, 74, `PLAYS ${plays.yd >= 0 ? '+' : '−'}${Math.abs(plays.yd)} · ${Math.abs(plays.ft)} FT ${plays.ft >= 0 ? 'UP' : 'DOWN'}HILL`, { 'font-size': 10.5, 'font-weight': 700, fill: plays.ft >= 0 ? '#a0522d' : '#2f6f9a', 'text-anchor': 'end', 'letter-spacing': 0.6 }) : null,
    el('line', { x1: 14, x2: W - 14, y1: top - 4, y2: top - 4, stroke: '#d6dcd8', 'stroke-width': 0.8 }),
    el('line', { x1: 14, x2: W - 14, y1: bottom + 4, y2: bottom + 4, stroke: '#d6dcd8', 'stroke-width': 0.8 }),
    txt(16, bottom + 20, 'RED: YARDS TO THE FRONT OF THE GREEN', { 'font-size': 9, fill: RED, 'letter-spacing': 0.8, 'font-weight': 700 }),
    prefs.hazards ? txt(16, bottom + 32, 'Black, under a red number: yards from the tee to that spot', { 'font-size': 9, fill: SOFT }) : null,
    reliefNote ? txt(16, bottom + 44, reliefNote, { 'font-size': 9, fill: SOFT }) : null,
    txt(16, H - 12, course.name.toUpperCase(), { 'font-size': 9, fill: '#9aa59e', 'letter-spacing': 1 }),
    txt(W - 16, H - 12, `HOLE ${n} OF ${course.holes.length}`, { 'font-size': 9, fill: '#9aa59e', 'text-anchor': 'end', 'letter-spacing': 1 }));
  return svg;
}

// ---------- the green page ----------

// The front of a green (turned so play is up the page): where the line up its middle first meets it.
const frontY0 = g => { const d = crossings([0, 0], [0, 1], g, 200); return d.length ? d[0] : Math.min(...g.map(p => p[1])); };

async function greenPage(n, teeName, prefs, helpers, opts) {
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

  const top = 86, bottom = prefs.notes ? 450 : H - 70, left = 30, right = W - 30;
  // The map takes in the fairway leading up to the green as well (up to 40
  // yards short of it), not just the ground around it.
  const approach = F.own.filter(x => x.t === 'fairway').flatMap(x => ringOf(x).map(f.fwd)).filter(([x, y]) => y < frontY0(g) && y > frontY0(g) - 40 && Math.abs(x) < 40);
  const vx0 = Math.min(minX, ...approach.map(p => p[0])), vx1 = Math.max(maxX, ...approach.map(p => p[0]));
  const vy0 = Math.min(minY, ...approach.map(p => p[1])), vy1 = maxY;
  const pad = 7;
  const s = Math.min((right - left) / (vx1 - vx0 + pad * 2), (bottom - top) / (vy1 - vy0 + pad * 2), MAX_UNITS_PER_YD);
  const cx = (left + right) / 2 - ((vx0 + vx1) / 2) * s, cy = (top + bottom) / 2 + ((vy0 + vy1) / 2) * s;
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
  mapG.append(el('path', { d: gPath, fill: 'none', stroke: '#e6f4e6', 'stroke-width': 3 * s, 'stroke-linejoin': 'round' }));
  mapG.append(el('path', { d: gPath, fill: '#d7f0dc' }));

  // The yard grid, lined up on the front of the green and its middle.
  const inner = el('g', { 'clip-path': `url(#${id}-green)` });
  if (prefs.grid) {
    const step = prefs.gridYd;
    let d = '';
    for (let y = frontY; y <= maxY + step; y += step) { const a = P([minX - 2, y]), b = P([maxX + 2, y]); d += `M${a[0].toFixed(1)},${a[1].toFixed(1)}H${b[0].toFixed(1)}`; }
    for (let x = 0; x <= maxX + step; x += step) { const a = P([x, minY - 2]), b = P([x, maxY + 2]); d += `M${a[0].toFixed(1)},${a[1].toFixed(1)}V${b[1].toFixed(1)}`; }
    for (let x = -step; x >= minX - step; x -= step) { const a = P([x, minY - 2]), b = P([x, maxY + 2]); d += `M${a[0].toFixed(1)},${a[1].toFixed(1)}V${b[1].toFixed(1)}`; }
    inner.append(el('path', { d, stroke: '#8fa597', 'stroke-width': 0.6, opacity: 0.8 }));
  }

  // Heights over the whole map, tour-book style: thin contour lines a few
  // inches apart and a field of small downhill arrows (longer = steeper).
  const elevId = partOf(course, n);
  const info = opts.tourney ? null : (await elevIndex())[elevId] || null;
  let slopeNote = '', relief = null;
  const reliefG = el('g', {});
  if (info && (prefs.greenContours || prefs.slopes)) {
    const area = [view[0], view[2], view[1], view[3]];
    const R = await reliefGrid(elevId, info, f, area, 0.5, 3);
    if (R.ok) {
      const onG = [];
      for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) if (inside([x, y], g)) { const v = R.at(x, y); if (v != null) onG.push(v); }
      const lo = onG.length ? Math.min(...onG) : R.lo, hi = onG.length ? Math.max(...onG) : R.hi;
      relief = hi - lo;
      if (prefs.greenContours) {
        // On the green, a line every few inches; around it (which can drop a
        // long way) fewer, so the page doesn't go black.
        const iv = [1, 2, 3, 4, 6, 12].find(v => relief / v <= 12) || 24;
        let ivOut = iv;
        while ((R.hi - R.lo) / ivOut > 28) ivOut *= 2;
        const lineD = v => R.lines(levelsOf(R.lo, R.hi, v)).map(sg => pathD(sg.map(P))).join('');
        reliefG.append(el('path', { d: lineD(ivOut), ...RELIEF_LINE, 'stroke-width': 0.5 }));
        if (ivOut !== iv) inner.append(el('path', { d: lineD(iv), ...RELIEF_LINE, 'stroke-width': 0.5, stroke: '#3d4a42' }));
        slopeNote = ivOut !== iv ? `Contours every ${iv}" on the green, ${ivOut}" around it` : `Contours every ${iv}" of height`;
      }
      if (prefs.slopes) {
        const no = course.features.filter(x => x.t === 'water' || x.t === 'bunker').map(x => ringOf(x).map(f.fwd)).filter(inView);
        reliefG.append(el('path', { d: slopeArrows(R, area, 3.6, P, (x, y) => !no.some(r => inside([x, y], r)), 0.7), ...RELIEF_ARROW, 'stroke-width': 0.6 }));
        slopeNote += `${slopeNote ? ' · ' : ''}arrows point downhill, longer = steeper`;
      }
    }
  }
  mapG.append(inner, reliefG);
  mapG.append(el('path', { d: gPath, fill: 'none', stroke: '#1f3a28', 'stroke-width': 1.6 }));
  // Front and back of the green, with the depth at the back.
  if (depth.length >= 2) {
    const [ax, ay] = P([0, depth[0]]), [bx, by] = P([0, depth.at(-1)]);
    mapG.append(el('circle', { cx: ax, cy: ay, r: 3, fill: '#f3c623', stroke: '#6e5a10', 'stroke-width': 0.7 }),
      el('circle', { cx: bx, cy: by, r: 3, fill: '#f3c623', stroke: '#6e5a10', 'stroke-width': 0.7 }),
      el('rect', { x: bx - 11, y: by - 19, width: 22, height: 13, rx: 2, fill: '#fff', 'fill-opacity': 0.9 }),
      txt(bx, by - 8, depthYd, { 'font-size': 12, 'font-weight': 700, fill: '#c62f2f', 'text-anchor': 'middle' }));
  }

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
    txt(16, bottom + 42, `USGA Rule 4.3: green at 3/8" to 5 yd or smaller, page 4¼ × 7" when printed at 100%`, { 'font-size': 8, fill: SOFT }),
    slopeNote ? txt(16, bottom + 30, `${slopeNote} · USGS lidar`, { 'font-size': 8.5, fill: SOFT }) : null,
    txt(16, H - 12, course.name.toUpperCase(), { 'font-size': 9, fill: '#9aa59e', 'letter-spacing': 1 }),
    txt(W - 16, H - 12, `HOLE ${n} · GREEN`, { 'font-size': 9, fill: '#9aa59e', 'text-anchor': 'end', 'letter-spacing': 1 }));
  if (prefs.notes) {
    svg.append(txt(16, bottom + 64, 'NOTES', { 'font-size': 10, 'font-weight': 700, fill: INK, 'letter-spacing': 1.2 }));
    for (let y = bottom + 84; y < H - 28; y += 22) svg.append(el('line', { x1: 16, x2: W - 16, y1: y, y2: y, stroke: '#d6dcd8', 'stroke-width': 0.8 }));
  }
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
    // Like a tour book flipped open: the green page on top, the hole below the fold.
    pages.replaceChildren(h('div', { class: 'flipbook' }, ...(gp ? [gp] : []), hp));
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
      if (prefs.greenPage) { const gp = await greenPage(k, teeName, prefs, helpers, opts); if (gp) sheet.append(gp); }
      sheet.append(await holePage(k, teeName, prefs, helpers, opts));
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

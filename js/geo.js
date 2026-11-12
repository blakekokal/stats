// Geometry helpers. Points are [lat, lng].

const M_PER_DEG = 111320;
export const YD_PER_M = 1.09361;

export function meters(a, b) {
  const k = Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180);
  return Math.hypot((a[0] - b[0]) * M_PER_DEG, (a[1] - b[1]) * M_PER_DEG * k);
}
export const yards = (a, b) => meters(a, b) * YD_PER_M;

function inRing(p, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [y1, x1] = ring[i], [y2, x2] = ring[j];
    if ((y1 > p[0]) !== (y2 > p[0]) && p[1] < ((x2 - x1) * (p[0] - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
}

// A polygon is [outerRing, ...holeRings].
export function inPolygon(p, poly) {
  if (!inRing(p, poly[0])) return false;
  for (let i = 1; i < poly.length; i++) if (inRing(p, poly[i])) return false;
  return true;
}

// When outlines overlap (a bunker inside a fairway, a green inside a fairway),
// the more specific surface wins.
const PRIORITY = ['ob', 'green', 'bunker', 'water', 'tee', 'fairway']; // out of bounds beats everything

// Returns the lie at a point: ob | green | bunker | water | tee | fairway | rough.
export function lieAt(p, features) {
  let best = PRIORITY.length;
  for (const f of features) {
    const rank = PRIORITY.indexOf(f.t);
    if (rank < 0 || rank >= best) continue;
    if (inPolygon(p, f.p)) best = rank;
  }
  return best === PRIORITY.length ? 'rough' : PRIORITY[best];
}

export function boundsOf(points, padMeters = 0) {
  let s = 90, w = 180, n = -90, e = -180;
  for (const [la, lo] of points) { s = Math.min(s, la); n = Math.max(n, la); w = Math.min(w, lo); e = Math.max(e, lo); }
  const dLat = padMeters / M_PER_DEG, dLng = dLat / Math.cos(s * Math.PI / 180);
  return [[s - dLat, w - dLng], [n + dLat, e + dLng]];
}

// Shortest distance in metres from point p to a line of [lat, lng] points.
export function distToLine(p, line) {
  const k = Math.cos((p[0] * Math.PI) / 180);
  const xy = q => [(q[1] - p[1]) * M_PER_DEG * k, (q[0] - p[0]) * M_PER_DEG];
  let best = Infinity, a = xy(line[0]);
  if (line.length === 1) return Math.hypot(a[0], a[1]);
  for (let i = 1; i < line.length; i++) {
    const b = xy(line[i]);
    const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(a[0] + t * dx, a[1] + t * dy));
    a = b;
  }
  return best;
}

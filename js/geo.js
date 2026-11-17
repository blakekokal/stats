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
// A drawn rough area beats fairway and recovery, so rough can be carved out of them.
const PRIORITY = ['ob', 'green', 'bunker', 'water', 'tee', 'rough', 'fairway', 'recovery']; // out of bounds beats everything

// A ball in the trees plays as a recovery shot, so trees count as recovery here
// (and, like recovery, give way to any other outline drawn over them).
// Returns the lie at a point: ob | green | bunker | water | tee | fairway | recovery | rough.
export function lieAt(p, features) {
  let best = PRIORITY.length;
  for (const f of features) {
    const rank = PRIORITY.indexOf(f.t === 'trees' ? 'recovery' : f.t);
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

// A ring drawn as a smooth, rounded curve instead of straight edges: each
// corner is replaced by a curve between the middles of its two edges (a
// quadratic B-spline), so the line stays inside the corners and never
// overshoots. For drawing only: lies are still decided by the ring itself.
// Returns a closed ring (first point repeated at the end).
export function smoothRing(ring) {
  // Without repeated points (the closing one included): a doubled point would stay a sharp corner.
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const pts = ring.filter((p, i) => !same(p, ring[(i + 1) % ring.length]) || ring.length === 1);
  const n = pts.length;
  if (n < 3) return ring;
  const steps = n <= 8 ? 10 : n <= 40 ? 5 : 3;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
    const s = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], e = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
    for (let k = 0; k < steps; k++) {
      const t = k / steps, u = 1 - t;
      out.push([u * u * s[0] + 2 * u * t * b[0] + t * t * e[0], u * u * s[1] + 2 * u * t * b[1] + t * t * e[1]]);
    }
  }
  out.push(out[0]);
  return out;
}
// OB and the course boundary keep their hard corners; everything else is rounded.
export const drawnRing = (ring, t) => (t === 'ob' || t === 'course' ? ring : smoothRing(ring));

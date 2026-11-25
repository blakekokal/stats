// Test rounds (Settings, admin only): made-up but realistic finished rounds on
// real courses, so the dashboards and history have something to show without
// playing. Each shot is placed on the course map (drives down the hole line,
// approaches at the pin with a miss that grows with distance, putts in feet)
// and its lie read from the course's shapes. They're marked `test: true` so
// Remove test rounds takes away only these. No coach is notified.

import { store, sync } from './store.js';
import { courseById } from './app.js';
import { yards, lieAt } from './geo.js';
import { roundKeyOf, historyRounds } from './rounds.js';

const PLAN = [ // course, tee: a spread of DFW courses
  ['texasstar', 'Blue'], ['lakepark', 'White'], ['cedarcrest', 'Silver'], ['stevenspark', 'Blue'],
  ['tierraverde', 'Silver'], ['bridlewood', 'Blue'], ['texasstar', 'White'], ['lakepark', 'Blue'],
];

// Seeded random numbers, so each test round comes out the same every time.
function rng(seed) {
  let s = seed >>> 0;
  const u = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const n = (m = 0, sd = 1) => m + sd * Math.sqrt(-2 * Math.log(u() || 1e-9)) * Math.cos(2 * Math.PI * u());
  return { u, n };
}

// Move a point `east` and `north` metres.
const move = ([lat, lng], east, north) => [lat + north / 111320, lng + east / (111320 * Math.cos(lat * Math.PI / 180))];
// Unit vector (east, north) from a to b, in metres.
function dir(a, b) {
  const e = (b[1] - a[1]) * 111320 * Math.cos(a[0] * Math.PI / 180), n = (b[0] - a[0]) * 111320, l = Math.hypot(e, n) || 1;
  return [e / l, n / l];
}
// The point `yd` yards along a polyline.
function along(line, yd) {
  for (let i = 1; i < line.length; i++) {
    const seg = yards(line[i - 1], line[i]);
    if (yd <= seg) { const [e, n] = dir(line[i - 1], line[i]); return { p: move(line[i - 1], e * yd / 1.09361, n * yd / 1.09361), d: [e, n] }; }
    yd -= seg;
  }
  const a = line[line.length - 2], b = line[line.length - 1];
  return { p: b, d: dir(a, b) };
}
// From `from`, `yd` yards towards `to`, then `side` yards to the right.
function shotTo(from, to, yd, side) {
  const [e, n] = dir(from, to), m = yd / 1.09361, s = side / 1.09361;
  return move(from, e * m + n * s, n * m - e * s);
}

function playHole(ch, features, r, skill) {
  const pin = ch.pin, shots = [];
  let pos = ch.tee, lie = 'tee';
  const lieOf = p => {
    const l = lieAt(p, features);
    if (l === 'green') return yards(p, pin) < 35 ? 'green' : 'fairway'; // another hole's green: short grass
    if (l === 'tee') return 'fairway';
    if (l === 'ob' || l === 'water') return 'rough'; // test rounds keep out of penalties
    return l;
  };
  for (let k = 0; k < 10; k++) {
    const d = yards(pos, pin);
    if (lie === 'green') {
      let ft = Math.max(1, Math.round(d * 3));
      for (let j = 0; j < 4; j++) {
        shots.push({ pos, lie: 'green', ft });
        const make = ft <= 2 ? 0.99 : Math.min(0.95, Math.exp(-(ft - 2) / (7 + 3 * skill)));
        if (r.u() < make || j === 3) return shots;
        ft = Math.max(1, Math.round(Math.abs(r.n(ft * 0.08 + 1.5, 1.5))));
        pos = shotTo(pin, pos, ft / 3, 0);
      }
      return shots;
    }
    shots.push({ pos, lie });
    let next;
    if (k === 0 && ch.par >= 4) {
      const drive = Math.min(d - 30, r.n(250 + 15 * skill, 14));
      const a = along(ch.line, drive), side = r.n(0, 16 - 3 * skill);
      next = move(a.p, a.d[1] * side / 1.09361, -a.d[0] * side / 1.09361);
    } else if (d > 250) { // lay up
      next = shotTo(pos, pin, Math.min(d - 90, r.n(215, 12)), r.n(0, 12));
    } else {
      const spread = d <= 30 ? 2.5 + d * 0.08 : d * (0.075 - 0.01 * skill);
      const sand = lie === 'bunker' ? 1.6 : lie === 'rough' || lie === 'recovery' ? 1.3 : 1;
      next = shotTo(pos, pin, d + r.n(-2, spread * sand), r.n(0, spread * sand * 0.8));
    }
    pos = next; lie = lieOf(pos);
  }
  shots.push({ pos: pin, lie: 'green', ft: 1 });
  return shots;
}

function makeRound(i) {
  const [cid, teeName] = PLAN[i % PLAN.length];
  const c = courseById(cid);
  if (!c || c.id !== cid) return null;
  const tee = c.tees.find(t => t.name === teeName) || c.tees[Math.min(1, c.tees.length - 1)];
  const r = rng(1000 + i * 7919);
  const skill = r.n(0, 0.6); // a good day or a bad one
  const day = new Date(); day.setDate(day.getDate() - 18 - i * 9); day.setHours(12, 0, 0, 0);
  const date = day.toISOString().slice(0, 10);
  const holes = {};
  c.holes.slice(0, 18).forEach(ch => { holes[ch.n] = { pin: null, done: true, shots: playHole(ch, c.features, r, skill) }; });
  return { id: 'test' + i + date.replace(/-/g, ''), test: true, date, course: c.id, courseName: c.name, tee: tee.name,
    player: sync.name || '', level: sync.level || 'Scratch', type: 'Casual', place: null, holeCount: Math.min(18, c.holes.length),
    submitted: true, updated: day.getTime(), holes };
}

export const testRounds = () => historyRounds().filter(r => r.test);

export function addTestRounds(n = 8) {
  let added = 0;
  for (let i = 0; i < n; i++) {
    const r = makeRound(i);
    if (!r || store.get(roundKeyOf(r.id))) continue;
    store.set(roundKeyOf(r.id), r); added++;
  }
  return added;
}

export function removeTestRounds() {
  const list = testRounds();
  list.forEach(r => store.remove(roundKeyOf(r.id)));
  return list.length;
}

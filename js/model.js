// Round data model and the stats derived from it.
//
// round = { id, date, course, tee, updated, holes: { [n]: hole } }
// hole  = { pin: [lat,lng] | null, done: bool, shots: [shot] }
// shot  = one stroke, described by where it was played from:
//   { pos: [lat,lng] | null, lie, ft: number | null, pen: 0.. }
//   - ft: distance to the hole in feet, used instead of the map distance on the green
//   - pen: extra penalty strokes this stroke incurred (water or out of bounds:
//     1 for a re-hit, 1 for a water drop, 2 for an OB drop); penKind says which.
//     The next shot has `replay` (from the same spot) or `drop`, and `penalty`.
//   - lie 'water': the previous shot found water. That costs a penalty stroke,
//     charged to the shot that went in; the next stroke is played as from the rough.
//
// Strokes gained for a shot = expected strokes before it - expected strokes
// after it - 1 (- any penalty). Expected strokes come from the tables in
// expected-data.js for the chosen handicap level.

import { yards } from './geo.js';
import { expected } from './sg.js';

export const CATS = ['ott', 'app', 'arg', 'putt'];
export const CAT_LABEL = { ott: 'Off the tee', app: 'Approach', arg: 'Around green', putt: 'Putting' };
export const LIES = ['tee', 'fairway', 'rough', 'bunker', 'recovery', 'green'];
export const LIE_LABEL = { tee: 'Tee', fairway: 'Fairway', rough: 'Rough', bunker: 'Bunker', recovery: 'Recovery', green: 'Green' };

export function pinOf(hole, courseHole) { return (hole && hole.pin) || courseHole.pin; }

// Distance to the hole for a shot: feet on the green, yards elsewhere.
export function distOf(shot, pin) {
  if (shot.lie === 'green') {
    if (shot.ft != null) return shot.ft;
    return shot.pos ? Math.max(1, Math.round(yards(shot.pos, pin) * 3)) : 3;
  }
  return shot.pos ? yards(shot.pos, pin) : 0;
}

export function category(shot, index, par, dist) {
  if (shot.lie === 'green') return 'putt';
  if (index === 0 && par >= 4) return 'ott';
  if (dist <= 30) return 'arg';
  return 'app';
}

// Per-shot analysis for one hole. Strokes gained are only known once the next
// position is known, so the last shot of an unfinished hole has sg = null.
const isWater = s => s.lie === 'water';
const expLie = lie => (lie === 'tee' ? 'tee' : lie === 'water' ? 'rough' : lie);

export function analyzeHole(hole, courseHole, level = 'Pro') {
  const pin = pinOf(hole, courseHole);
  const shots = (hole && hole.shots) || [];
  const rows = shots.map((s, i) => {
    const dist = distOf(s, pin);
    return { i, shot: s, dist, exp: expected(expLie(s.lie), dist, level), cat: category(s, i, courseHole.par, dist), sg: null, len: null };
  });
  rows.forEach((r, i) => {
    const next = rows[i + 1];
    const water = next && isWater(next.shot) ? 1 : 0;
    const after = next ? next.exp + water : (hole.done ? 0 : null);
    if (after != null) r.sg = r.exp - after - 1 - (r.shot.pen || 0);
    if (next && r.shot.pos && next.shot.pos && !r.shot.pen) r.len = yards(r.shot.pos, next.shot.pos);
  });
  const pens = shots.reduce((a, s) => a + (s.pen || 0) + (isWater(s) ? 1 : 0), 0);
  return { rows, score: hole && hole.done ? shots.length + pens : null, strokes: shots.length + pens, pens };
}

export function analyzeRound(round, course, level = 'Pro') {
  const out = {
    sg: { ott: 0, app: 0, arg: 0, putt: 0, total: 0 }, shots: [],
    score: 0, par: 0, holes: 0, putts: 0, pens: 0,
    fir: 0, firN: 0, gir: 0, girN: 0,
  };
  for (const ch of course.holes) {
    const hole = round.holes[ch.n];
    if (!hole || !hole.done) continue;
    const a = analyzeHole(hole, ch, level);
    out.holes++; out.score += a.score; out.par += ch.par; out.pens += a.pens;
    for (const r of a.rows) {
      out.sg[r.cat] += r.sg; out.sg.total += r.sg;
      out.shots.push({ hole: ch.n, ...r });
      if (r.cat === 'putt') out.putts++;
    }
    if (ch.par >= 4) {
      out.firN++;
      const second = hole.shots[1];
      if (second && !hole.shots[0].pen && (second.lie === 'fairway' || second.lie === 'green')) out.fir++;
      else if (!second && hole.done) out.fir++; // holed from the tee
    }
    // Green in regulation: on the green (or holed) with at least two strokes left for par.
    out.girN++;
    let used = 0, hit = false;
    for (const s of hole.shots) {
      if (s.lie === 'green') { hit = used <= ch.par - 2; break; }
      used += 1 + (s.pen || 0) + (isWater(s) ? 1 : 0);
    }
    if (!hole.shots.some(s => s.lie === 'green')) hit = used <= ch.par - 2;
    if (hit) out.gir++;
  }
  return out;
}

export function newRound(course, tee, date) {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date, course: course.id, tee, updated: Date.now(), holes: {} };
}

export const fmtSg = v => (v == null ? '–' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export const fmtPar = d => (d === 0 ? 'E' : d > 0 ? '+' + d : '−' + Math.abs(d));

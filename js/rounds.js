// The round being played and round summaries, shared by the hole screen and
// the New Round / Round History pages.
//
// round = { id, date, course, courseName, tee, player, level, type, place,
//           holeCount, updated, holes: { [n]: { pin, done, shots } } }

import { store } from './store.js';
import { analyzeRound } from './model.js';

// Round History starts fresh from this date; older rounds are kept but hidden.
export const HISTORY_FROM = '2026-11-12';

const CURRENT_KEY = 'gs:currentRound';
export const roundKeyOf = id => 'round:' + id;
export function currentRound() {
  let id = null;
  try { id = localStorage.getItem(CURRENT_KEY); } catch { /* ignore */ }
  return id ? store.get(roundKeyOf(id)) : null;
}
export function setCurrentRound(id) {
  try { id ? localStorage.setItem(CURRENT_KEY, id) : localStorage.removeItem(CURRENT_KEY); } catch { /* ignore */ }
}

export const holeCountOf = r => (r && r.holeCount) || 18;

// Score, par and progress over the holes finished so far.
export function summarize(r, course, level) {
  const a = analyzeRound(r, course, level);
  const count = holeCountOf(r);
  const firstOpen = Array.from({ length: count }, (_, i) => i + 1).find(n => !r.holes?.[n]?.done) || null;
  return { a, count, done: a.holes, incomplete: a.holes < count, firstOpen, score: a.score, toPar: a.score - a.par };
}

export const historyRounds = () => store.list('round:').filter(r => r && r.date >= HISTORY_FROM);

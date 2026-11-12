// The round being played and round summaries, shared by the hole screen and
// the New Round / Round History pages.
//
// round = { id, date, course, courseName, tee, player, level, type, place,
//           holeCount, updated, holes: { [n]: { pin, done, shots } } }

import { store } from './store.js';
import { analyzeRound } from './model.js';


const CURRENT_KEY = 'gs:currentRound';
export const roundKeyOf = id => 'round:' + id;
// GPS Scouting: a throwaway round held only in memory — nothing is ever saved.
let scoutRound = null;
export const isScouting = () => { try { return sessionStorage.getItem('gs:scouting') === '1'; } catch { return false; } };
const newScout = tee => ({ id: 'scout', scouting: true, holeCount: 18, holes: {}, updated: Date.now(), ...(tee ? { tee } : {}) });
export function startScouting(tee) { try { sessionStorage.setItem('gs:scouting', '1'); } catch { /* ignore */ } scoutRound = newScout(tee); }
export function endScouting() { try { sessionStorage.removeItem('gs:scouting'); } catch { /* ignore */ } scoutRound = null; }

export function currentRound() {
  if (isScouting()) return scoutRound || (scoutRound = newScout());
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
  // A round is finished once every hole is holed or it was ended and submitted early.
  return { a, count, done: a.holes, incomplete: !r.submitted && a.holes < count, firstOpen, score: a.score, toPar: a.score - a.par };
}

// End a round where it is: it counts as finished with the holes played so far.
export function submitRound(id) {
  const r = store.get(roundKeyOf(id));
  if (r) store.set(roundKeyOf(id), { ...r, submitted: true, updated: Date.now() });
}

// Round History starts fresh with the New Round screen: rounds from before it
// (they have no course name) are kept but hidden. Not filtered by date, since a
// phone's clock can't be relied on.
export const historyRounds = () => store.list('round:').filter(r => r && r.courseName);

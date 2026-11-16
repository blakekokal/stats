// The round being played and round summaries, shared by the hole screen and
// the New Round / Round History pages.
//
// round = { id, date, course, courseName, tee, player, level, type, place,
//           holeCount, updated, holes: { [n]: { pin, done, shots } } }

import { store, notifyCoach } from './store.js';
import { analyzeRound } from './model.js';


const CURRENT_KEY = 'gs:currentRound';
export const roundKeyOf = id => 'round:' + id;
// GPS Scouting: a throwaway round held only in memory — nothing is ever saved.
let scoutRound = null;
export const isScouting = () => { try { return sessionStorage.getItem('gs:scouting') === '1'; } catch { return false; } };
const newScout = (tee, course) => ({ id: 'scout', scouting: true, holeCount: 18, holes: {}, updated: Date.now(), ...(tee ? { tee } : {}), ...(course ? { course } : {}) });
export function startScouting(tee, course) { endWatching(); try { sessionStorage.setItem('gs:scouting', '1'); } catch { /* ignore */ } scoutRound = newScout(tee, course); }
export function endScouting() { try { sessionStorage.removeItem('gs:scouting'); sessionStorage.removeItem('gs:scoutBag'); } catch { /* ignore */ } scoutRound = null; }

// Live view: someone else's round, opened from a share link. Held in memory
// only and never saved here; `watch` is what was fetched:
// { id, round, at (the hole being played), live, name }.
let watch = null;
export const watchingId = () => { try { return sessionStorage.getItem('gs:watch'); } catch { return null; } };
export const isWatching = () => !!watchingId();
export const watchInfo = () => (watch && watch.id === watchingId() ? watch : null);
export function startWatching(id, doc) {
  endScouting();
  try { sessionStorage.setItem('gs:watch', id); } catch { /* ignore */ }
  watch = { id, ...doc };
}
export function endWatching() { try { sessionStorage.removeItem('gs:watch'); sessionStorage.removeItem('gs:watchBack'); sessionStorage.removeItem('gs:replay'); } catch { /* ignore */ } watch = null; }

export function currentRound() {
  if (isWatching()) return watchInfo()?.round || null;
  if (isScouting()) return scoutRound || (scoutRound = newScout());
  let id = null;
  try { id = localStorage.getItem(CURRENT_KEY); } catch { /* ignore */ }
  return id ? store.get(roundKeyOf(id)) : null;
}
export function setCurrentRound(id) {
  try { id ? localStorage.setItem(CURRENT_KEY, id) : localStorage.removeItem(CURRENT_KEY); } catch { /* ignore */ }
}

export const holeCountOf = r => (r && r.holeCount) || 18;

// Only one round is played at a time. The active round is the unfinished one
// that hasn't been paused: the one open on this device, or one touched in the
// last 12 hours (e.g. after the app crashed or the phone's storage was cleared).
// Older unfinished rounds count as paused, as they were before pausing was recorded.
const isOpen = r => !!r && !r.submitted && Object.values(r.holes || {}).filter(x => x?.done).length < holeCountOf(r);
const currentKey = () => { try { return localStorage.getItem(CURRENT_KEY); } catch { return null; } };
const isActive = r => isOpen(r) && !r.paused && (r.id === currentKey() || Date.now() - (r.updated || 0) < 12 * 3600e3);
export const activeRound = () => historyRounds().filter(isActive).sort((a, b) => (b.updated || 0) - (a.updated || 0))[0] || null;
// Pausing keeps the round in Round History to resume later; it also stops it being live.
export function pauseRound(id) {
  const r = store.get(roundKeyOf(id));
  if (isOpen(r) && !r.paused) store.set(roundKeyOf(id), { ...r, paused: true, updated: Date.now() });
  if (currentKey() === id) setCurrentRound(null);
}
// Make this the round being played; any other active round is paused.
export function resumeRound(id) {
  historyRounds().filter(r => r.id !== id && isActive(r)).forEach(r => pauseRound(r.id));
  const r = store.get(roundKeyOf(id));
  if (r?.paused) { const { paused, ...rest } = r; store.set(roundKeyOf(id), { ...rest, updated: Date.now() }); }
  setCurrentRound(id);
}

// The hole a round started on: the finished hole with the longest run of
// unfinished holes before it (going round the course), e.g. 10 for a round
// played on the back nine. 1 when nothing is finished.
export function startHoleOf(r, count) {
  const done = i => !!r?.holes?.[i]?.done;
  let best = 1, bestGap = -1;
  for (let i = 1; i <= count; i++) {
    if (!done(i)) continue;
    let gap = 0;
    for (let j = i - 1; gap < count; j--, gap++) if (done(((j - 1 + count) % count) + 1)) break;
    if (gap > bestGap) { bestGap = gap; best = i; }
  }
  return best;
}
const countOf = (r, course) => Math.max(holeCountOf(r), course?.holes?.length || 0);
// The holes with shots on them, in the order they were played (from the start hole, round the course).
export function playOrder(r, course) {
  const count = countOf(r, course), start = startHoleOf(r, count);
  return Array.from({ length: count }, (_, i) => ((start - 1 + i) % count) + 1).filter(k => r?.holes?.[k]?.shots?.length);
}
// The hole to open a past round on: the first one played.
export const firstHoleOf = (r, course) => playOrder(r, course)[0] || startHoleOf(r, countOf(r, course));

// Score, par and progress over the holes finished so far.
export function summarize(r, course, level) {
  const a = analyzeRound(r, course, level);
  const count = holeCountOf(r);
  const firstOpen = Array.from({ length: count }, (_, i) => i + 1).find(n => !r.holes?.[n]?.done) || null;
  // A round is finished once every hole is holed or it was ended and submitted early.
  return { a, count, done: a.holes, incomplete: !r.submitted && a.holes < count, firstOpen, score: a.score, toPar: a.score - a.par };
}

// End a round where it is: it counts as finished with the holes played so far.
// Their coach gets a "new round" notification with the score.
export function submitRound(id, course) {
  const r = store.get(roundKeyOf(id));
  if (!r) return;
  store.set(roundKeyOf(id), { ...r, submitted: true, updated: Date.now() });
  if (r.submitted) return; // already posted
  let line = '';
  try {
    const s = summarize(r, course, r.level);
    if (s.done) line = ` · ${s.score} (${s.toPar === 0 ? 'E' : s.toPar > 0 ? '+' + s.toPar : '−' + -s.toPar}) over ${s.done} hole${s.done === 1 ? '' : 's'}`;
  } catch { /* no score line */ }
  notifyCoach({ type: 'new_round', title: 'New round from {name}', message: `{name} posted a round at ${r.courseName || course?.name || 'a course'}${line}`, round_id: r.id });
}

// Round History starts fresh with the New Round screen: rounds from before it
// (they have no course name) are kept but hidden. Not filtered by date, since a
// phone's clock can't be relied on.
export const historyRounds = () => store.list('round:').filter(r => r && r.courseName);

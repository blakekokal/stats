// Live view: sharing a round by link as it is played, and watching one.
//
// Scorer: every change to the round being played is copied to `live_rounds`
// (store.js) under the round's share id, so people with the link see it. The
// share id and the Live on/off choice are kept in their own document,
// 'live:<round id>' = { id, off }, so nothing that rewrites the round loses them.
// Live is on from the start of a round until it's turned off or the round ends.
// Off freezes what viewers see; the finished round is always posted at the end,
// so the link shows the whole round from then on.
//
// Viewer: #/live/<share id> fetches that copy and opens it read-only on the
// hole screen (rounds.js holds it in memory; nothing is saved on the device).

import { store, sync, pushLive, deleteLive, fetchLive } from './store.js';
import { roundKeyOf, startWatching, watchingId, watchInfo } from './rounds.js';

const infoKey = roundId => 'live:' + roundId;
const currentId = () => { try { return localStorage.getItem('gs:currentRound'); } catch { return null; } };
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => (b % 36).toString(36)).join('');

// ---------- scorer ----------

export const liveInfo = roundId => store.get(infoKey(roundId));
// The round's share id, made the first time it's needed.
function ensureInfo(roundId) {
  let info = liveInfo(roundId);
  if (!info?.id) { info = { ...info, id: newId() }; store.set(infoKey(roundId), info); }
  return info;
}
export const liveLink = roundId => `${location.origin}${location.pathname}#/live/${ensureInfo(roundId).id}`;
export const isLiveOn = r => !!r && !r.submitted && !liveInfo(r.id)?.off;
export function setLiveOn(roundId, on) {
  store.set(infoKey(roundId), { ...ensureInfo(roundId), off: !on });
  queue(roundId, true);
}

// What happened to the last update, for the Live box: { state: 'idle' | 'sending' | 'ok' | 'error' | 'signed-out', error }.
export const liveStatus = { state: 'idle', error: '' };
const statusListeners = new Set();
export function onLiveStatus(fn) { statusListeners.add(fn); return () => statusListeners.delete(fn); }
function setStatus(state, error = '') { liveStatus.state = state; liveStatus.error = error; statusListeners.forEach(fn => fn()); }

// Whether a change to this round goes to the people watching.
function shares(r) {
  if (!r || !r.courseName || r.scouting) return false;
  const info = liveInfo(r.id);
  if (r.submitted) return !!info?.id; // the finished round is posted even if Live was off
  return !info?.off && (!!info?.id || r.id === currentId());
}

const pending = new Set(); // round ids waiting to be sent
let timer = null, sending = false;
function queue(roundId, force = false) {
  const r = store.get(roundKeyOf(roundId));
  if (!r || !(force || shares(r))) return;
  pending.add(roundId);
  clearTimeout(timer); timer = setTimeout(flush, 700);
}
async function flush() {
  clearTimeout(timer);
  if (!pending.size) return;
  if (sending) { timer = setTimeout(flush, 700); return; }
  if (!sync.user) { setStatus('signed-out'); return; } // sent once logged in
  sending = true; setStatus('sending');
  let failed = '';
  for (const roundId of [...pending]) {
    pending.delete(roundId);
    const r = store.get(roundKeyOf(roundId));
    if (!r) continue;
    const info = ensureInfo(roundId);
    const at = (r.id === currentId() && +sessionStorage.getItem('hole')) || null;
    try { await pushLive(info.id, { round: r, at, live: isLiveOn(r), name: r.player || sync.name || '', sent: Date.now() }); }
    catch (e) { pending.add(roundId); failed = e.message || String(e); break; }
  }
  sending = false;
  if (failed) { setStatus('error', failed); timer = setTimeout(flush, 15000); } // e.g. no signal: keep trying
  else { setStatus('ok'); if (pending.size) timer = setTimeout(flush, 700); }
}

store.onSet((key, data, prev) => {
  if (!key.startsWith('round:')) return;
  if (data) { queue(data.id); return; }
  // The round was deleted: take its shared copy down too.
  const info = prev && liveInfo(prev.id);
  if (info?.id) { pending.delete(prev.id); deleteLive(info.id).catch(() => {}); store.remove(infoKey(prev.id)); }
});
// Catch up after logging in, coming back online or reopening the app.
// Also run when the scorer opens a hole, so viewers follow them from hole to hole.
export const shareCurrent = () => catchUp();
const catchUp = () => { const id = currentId(); if (id) queue(id); else if (pending.size) flush(); };
let lastUser = null;
sync.onStatus(() => { const u = sync.user?.id || null; if (u !== lastUser) { lastUser = u; if (u) catchUp(); } });
window.addEventListener('online', catchUp);
document.addEventListener('visibilitychange', () => { if (!document.hidden && pending.size) flush(); });

// ---------- viewer ----------

// Fetch the shared round and hold it as the one being watched. Returns
// 'ok', 'missing' (no such round) or 'error' (couldn't reach it).
const loading = {};
export function loadWatch(id) {
  return (loading[id] ||= (async () => {
    try {
      const doc = await fetchLive(id);
      if (!doc?.round) return 'missing';
      // Only replace what's on screen if this is still the round being opened or watched.
      if (!watchingId() || watchingId() === id || location.hash.includes(id)) startWatching(id, doc);
      return 'ok';
    } catch { return 'error'; }
    finally { delete loading[id]; }
  })());
}
// The hole to open a watched round on: the one being played, else the first unfinished one.
export function watchHole() {
  const w = watchInfo();
  if (!w) return 1;
  const count = w.round.holeCount || 18;
  if (w.at >= 1 && w.at <= count && !w.round.submitted) return w.at;
  if (w.round.submitted) return 1;
  for (let n = 1; n <= count; n++) if (!w.round.holes?.[n]?.done) return n;
  return 1;
}

// Handicap index for the coaching pages, worked out from this app's rounds:
// the logged-in player's own (from the device) or a student's (for their coach).

import { sync } from '../store.js';
import { historyRounds } from '../rounds.js';
import { toCoachRound, calcHandicapIndex } from '../dashboard.js';
import { studentRounds } from './gps.js';

export { calcHandicapIndex };

export async function roundsFor(userId) {
  if (!userId || (sync.user && userId === sync.user.id)) {
    return historyRounds().map(toCoachRound).filter(r => r.holes > 0).sort((a, b) => (a.round_date < b.round_date ? 1 : -1));
  }
  return studentRounds(userId);
}

export async function loadHandicapIndex(userId, displayId, infoId, trendId) {
  var displayEl = document.getElementById(displayId || 'handicapIndexDisplay');
  var infoEl = document.getElementById(infoId || 'handicapIndexInfo');
  var trendEl = document.getElementById(trendId || 'handicapTrendChart');
  if (!displayEl) return null;
  displayEl.textContent = '--';
  if (infoEl) infoEl.textContent = 'Loading...';
  if (trendEl) trendEl.innerHTML = '';

  var rounds;
  try { rounds = (await roundsFor(userId)).slice(0, 20); } catch (e) { rounds = []; }
  if (!rounds.length) { if (infoEl) infoEl.textContent = 'No rounds to calculate handicap.'; return null; }

  var result = calcHandicapIndex(rounds);
  if (result.index === null) { if (infoEl) infoEl.textContent = result.msg; return null; }
  displayEl.textContent = result.index.toFixed(1);
  displayEl.style.color = result.index <= 5 ? '#00b87a' : result.index <= 15 ? '#f0c830' : '#d4706e';
  if (infoEl) infoEl.textContent = result.msg;

  if (trendEl && result.differentials && result.differentials.length > 1) {
    var vals = result.differentials.slice().reverse();
    var max = Math.max.apply(null, vals.map(function (d) { return d.diff; }));
    var min = Math.min.apply(null, vals.map(function (d) { return d.diff; }));
    var range = max - min || 1;
    trendEl.innerHTML = vals.map(function (d) {
      var h = Math.max(6, Math.round(((d.diff - min) / range) * 40 + 10));
      var isBest = (result.best || []).some(function (b) { return b.date === d.date && b.score === d.score; });
      return '<div style="width:' + Math.max(6, Math.floor(260 / vals.length)) + 'px;height:' + h + 'px;background:' + (isBest ? '#00b87a' : '#3d3d3d') + ';border-radius:2px;"></div>';
    }).join('');
  }
  return result;
}

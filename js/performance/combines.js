import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { activeUserId } from '../coaching/core.js';
import { _sb } from '../coaching/core.js';

// ── COMBINE SCORES ANALYSIS ────────────────────────────────────
// `userId`: whose combines (a coach's view of a student passes the student's; else the player's own).
export async function loadPerfCombineData(userId) {
  var loadEl  = document.getElementById('perfCombineLoading');
  var gridEl  = document.getElementById('perfCombineGrid');
  var footEl  = document.getElementById('perfCombineFooter');
  if (!loadEl || !S.currentUser) return;

  try {
    // Only pull true combine sessions (is_combine = true), NOT custom/past rounds
    var resp = await _sb
      .from('combine_scores')
      .select('combine_date, combine_type, is_combine, total_sg, avg_pts, holes_count, filled_count, row_data, score_mode')
      .eq('user_id', userId || activeUserId())
      .eq('is_combine', true)
      .order('combine_date', { ascending: false })
      .limit(40);

    if (resp.error) throw resp.error;
    var all = resp.data || [];

    var puttSessions  = all.filter(function(c){ return c.combine_type === 'Putting'; });
    var wedgeSessions = all.filter(function(c){ return c.combine_type === 'Wedge'; });

    loadEl.style.display = 'none';

    if (puttSessions.length === 0 && wedgeSessions.length === 0) {
      loadEl.style.display = 'block';
      loadEl.textContent = 'No combine data yet \u2014 complete a putting or wedge combine to see trends here.';
      return;
    }

    gridEl.style.display = 'grid';
    if (footEl) footEl.style.display = 'block';

    renderCombinePutt(puttSessions);
    renderCombineWedge(wedgeSessions);
  } catch(e) {
    if (loadEl) { loadEl.style.display = 'block'; loadEl.textContent = 'Could not load combine data.'; }
  }
}

// Opens a combine's detail below the tiles (closing the other one), as Past Rounds
// does, on whichever page the tap came from (this page, or a student's: svPerf*).
function toggleCombineDetail(key, from) {
  var root = (from && from.closest && from.closest('#perfPageCombines, #svPerfPageCombines')) || document.getElementById('perfPageCombines');
  if (!root) return;
  var detail = root.querySelector('[id$="Combine' + key + 'Detail"]');
  if (!detail) return;
  var opening = detail.style.display === 'none';
  ['Putt', 'Wedge'].forEach(function(k) {
    var d = root.querySelector('[id$="Combine' + k + 'Detail"]');
    var c = root.querySelector('.perfcaret[data-key="' + k + '"]');
    var on = opening && k === key;
    if (d) d.style.display = on ? 'block' : 'none';
    if (c) c.textContent = on ? 'Close \u25b2' : 'View detail \u2192';
  });
  if (opening) {
    var sc = root.closest('#studentViewScroll') || document.getElementById('performanceAnalysisPage');
    if (sc) setTimeout(function(){ sc.scrollTop += 140; }, 60);
  }
}
// The detail's heading, the same as Past Rounds' (perfTabHeader).
function combDetailHeader(key, title) {
  return '<div class="perfdetailhead">' +
    '<div style="font-size:14px;font-weight:800;color:#ffffff;">' + title + '</div>' +
    '<button class="perfclose" onclick="toggleCombineDetail(\'' + key + '\', this)">Close \u25b2</button></div>';
}

function parseCombineRows(session) {
  try { return JSON.parse(session.row_data || '{}'); } catch(e) { return {}; }
}

function combBucketFor_putt(dist) {
  if (dist <= 3)  return '0-3';
  if (dist <= 7)  return '4-7';
  if (dist <= 15) return '8-15';
  if (dist <= 25) return '15-25';
  return '25+';
}
function combBucketFor_wedge(dist) {
  if (dist <= 15)  return '0-15';
  if (dist <= 30)  return '15-30';
  if (dist <= 50)  return '30-50';
  if (dist <= 75)  return '50-75';
  if (dist <= 100) return '75-100';
  if (dist <= 125) return '100-125';
  return '125-150';
}

function renderCombinePutt(sessions) {
  var focusEl    = document.getElementById('perfCombinePuttFocus');
  var overviewEl = document.getElementById('perfCombinePuttOverview');
  var detailEl   = document.getElementById('perfCombinePuttDetail');
  if (!focusEl) return;

  if (sessions.length === 0) {
    focusEl.innerHTML = '<div style="background:#1e1e1e;border:1px solid #282828;border-radius:10px;padding:10px 11px;font-size:11px;color:#9a9a9a;text-align:center;">No putting combines yet</div>';
    overviewEl.innerHTML = '';
    detailEl.innerHTML = '';
    return;
  }

  var puttBucketDefs = ['0-3','4-7','8-15','15-25','25+'];
  var recent = sessions.slice(0, Math.min(3, sessions.length));
  var prior  = sessions.slice(3);

  function agg(sessionList) {
    var b = {};
    puttBucketDefs.forEach(function(k){ b[k] = {sgTotal:0, count:0}; });
    var totalPutts = 0, totalHoles = 0;
    sessionList.forEach(function(s) {
      totalHoles += (s.holes_count || s.filled_count || 0);
      var rows = parseCombineRows(s);
      Object.values(rows).forEach(function(r) {
        if (r.d === '' || r.d === undefined || r.v === '' || r.v === undefined) return;
        var dist = parseFloat(r.d); if (!dist) return;
        totalPutts += parseFloat(r.v) || 0;
        var bk = combBucketFor_putt(dist);
        if (b[bk]) { b[bk].sgTotal += (r.sg || 0); b[bk].count++; }
      });
    });
    return { buckets: b, totalPutts: totalPutts, totalHoles: totalHoles };
  }

  var rData  = agg(recent);
  var pData  = prior.length > 0 ? agg(prior) : null;
  var rBucks = rData.buckets;
  var pBucks = pData ? pData.buckets : null;

  // Overall SG/round from sessions
  var totalSg = 0, sgCount = 0;
  recent.forEach(function(s){ if (s.total_sg !== null && s.total_sg !== undefined) { totalSg += s.total_sg; sgCount++; } });
  var overallSg = sgCount > 0 ? totalSg / sgCount : null;

  var priorSg = 0, priorSgCount = 0;
  if (prior.length > 0) {
    prior.forEach(function(s){ if (s.total_sg !== null && s.total_sg !== undefined) { priorSg += s.total_sg; priorSgCount++; } });
  }
  var priorOverallSg = priorSgCount > 0 ? priorSg / priorSgCount : null;

  var avgPuttsPerHole = rData.totalHoles > 0 ? (rData.totalPutts / rData.totalHoles).toFixed(2) : null;
  var totalHolesAll = 0;
  sessions.forEach(function(s){ totalHolesAll += (s.holes_count || s.filled_count || 0); });

  // Trend
  var trendDiff = (overallSg !== null && priorOverallSg !== null) ? (overallSg - priorOverallSg) : null;
  var trendStr = trendDiff === null ? '' : (trendDiff >= 0
    ? '<span style="color:#00b87a;">\u25b2 improving</span>'
    : '<span style="color:#d4706e;">\u25bc declining</span>');

  // Worst bucket (focus area)
  var worst = null;
  puttBucketDefs.forEach(function(k) {
    var rb = rBucks[k]; if (rb.count === 0) return;
    var avg = rb.sgTotal / rb.count;
    if (worst === null || avg < worst.avg) worst = { key: k, avg: avg };
  });

  var focusIsBad = worst && worst.avg < 0;
  var focusBg    = focusIsBad ? 'linear-gradient(135deg,#3a1515,#3a1515)' : 'linear-gradient(135deg,#0a3020,#0a3020)';
  var focusBord  = focusIsBad ? '#3d1515' : '#0a3020';
  var focusEye   = focusIsBad ? '<span style="color:#d4706e;">\u26a0 Focus Area</span>' : '<span style="color:#00b87a;">\u2713 Strong Area</span>';
  var focusSub   = worst ? (worst.avg >= 0 ? '+' : '') + worst.avg.toFixed(2) + ' SG avg' : '';
  var focusRange = worst ? (worst.key + (worst.key.indexOf('yds') === -1 ? ' ft' : '')) : '\u2014';

  focusEl.innerHTML = combFocusCard(focusEye, focusRange, focusSub, focusIsBad, focusBg, focusBord);

  var sgCol = overallSg === null ? '#9a9a9a' : overallSg >= 0 ? '#00b87a' : '#d4706e';
  var ovBg   = overallSg === null ? '#1e1e1e' : overallSg >= 0 ? '#0a3020' : '#3a1515';
  var ovBord = overallSg === null ? '#282828' : overallSg >= 0 ? '#0a3020' : '#3d1515';
  var sgStr  = overallSg !== null ? (overallSg >= 0 ? '+' : '') + overallSg.toFixed(2) : 'N/A';

  overviewEl.innerHTML = combOverviewCard('Putt', 'SG / Round', overallSg, sgStr, sgCol, trendStr, (avgPuttsPerHole !== null ? avgPuttsPerHole + ' putts/hole \u00b7 ' : '') + sessions.length + ' combines', ovBg, ovBord);

  // Build bucket detail (hidden)
  var dHtml = '';
  puttBucketDefs.forEach(function(bk) {
    var rb = rBucks[bk]; if (rb.count === 0) return;
    var avgSg = rb.sgTotal / rb.count;
    var trendH = '';
    if (pBucks) {
      var pb = pBucks[bk];
      if (pb.count > 0) {
        var diff = avgSg - (pb.sgTotal / pb.count);
        var tc = diff >= 0 ? '#00b87a' : '#d4706e';
        trendH = ' <span style="color:' + tc + ';">' + (diff >= 0 ? '\u25b2' : '\u25bc') + ' ' + (diff >= 0 ? '+' : '') + diff.toFixed(2) + '</span>';
      }
    }
    var isWorst = worst && worst.key === bk;
    var col  = avgSg >= 0 ? '#00b87a' : '#d4706e';
    var bg   = avgSg >= 0 ? '#0a3020' : '#3a1515';
    var bord = avgSg >= 0 ? '#0a3020' : '#3d1515';
    var info = (isWorst ? '<span style="color:#d4706e;">\u26a0 Needs work</span> \u00b7 ' : '') + rb.count + ' shots' + trendH;
    dHtml += combStatCard(bk + ' ft', col, bg, bord, (avgSg >= 0 ? '+' : '') + avgSg.toFixed(2) + ' SG', info);
  });
  detailEl.innerHTML = combDetailHeader('Putt', 'Putting \u00b7 Detail') + dHtml;
}

function renderCombineWedge(sessions) {
  var focusEl    = document.getElementById('perfCombineWedgeFocus');
  var overviewEl = document.getElementById('perfCombineWedgeOverview');
  var detailEl   = document.getElementById('perfCombineWedgeDetail');
  if (!focusEl) return;

  if (sessions.length === 0) {
    focusEl.innerHTML = '<div style="background:#1e1e1e;border:1px solid #282828;border-radius:10px;padding:10px 11px;font-size:11px;color:#9a9a9a;text-align:center;">No wedge combines yet</div>';
    overviewEl.innerHTML = '';
    detailEl.innerHTML = '';
    return;
  }

  var wedgeBucketDefs = ['0-15','15-30','30-50','50-75','75-100','100-125','125-150'];
  var recent = sessions.slice(0, Math.min(3, sessions.length));
  var prior  = sessions.slice(3);

  function agg(sessionList) {
    var b = {};
    wedgeBucketDefs.forEach(function(k){ b[k] = {sgTotal:0, ptsTotal:0, count:0}; });
    sessionList.forEach(function(s) {
      var rows = parseCombineRows(s);
      Object.values(rows).forEach(function(r) {
        if (r.d === '' || r.d === undefined || r.v === '' || r.v === undefined) return;
        var dist = parseFloat(r.d); if (!dist) return;
        var bk = combBucketFor_wedge(dist);
        if (b[bk]) {
          b[bk].sgTotal  += (r.sg || 0);
          // pts: 0-100 score — use r.pts if available, else derive from prox
          var pts = (r.pts !== undefined && r.pts !== '') ? parseFloat(r.pts) : Math.max(0, 100 - Math.abs(dist - parseFloat(r.v || dist)) * 3);
          b[bk].ptsTotal += pts;
          b[bk].count++;
        }
      });
    });
    return b;
  }

  var rBucks = agg(recent);
  var pBucks = prior.length > 0 ? agg(prior) : null;

  // Overall avg SG per shot
  var totalSg = 0, sgCount = 0;
  recent.forEach(function(s){ if (s.total_sg !== null && s.total_sg !== undefined) { totalSg += s.total_sg; sgCount++; } });
  var overallSg = sgCount > 0 ? totalSg / sgCount : null;

  var priorSg = 0, priorSgCount = 0;
  if (prior.length > 0) prior.forEach(function(s){ if (s.total_sg !== null && s.total_sg !== undefined) { priorSg += s.total_sg; priorSgCount++; } });
  var priorOverallSg = priorSgCount > 0 ? priorSg / priorSgCount : null;

  // Avg 0-100 score across recent sessions
  var totalPts = 0, ptsCount = 0;
  recent.forEach(function(s){ if (s.avg_pts !== null && s.avg_pts !== undefined) { totalPts += s.avg_pts; ptsCount++; } });
  var avgScore = ptsCount > 0 ? Math.round(totalPts / ptsCount) : null;

  var totalShotsAll = 0;
  sessions.forEach(function(s){ totalShotsAll += (s.filled_count || s.holes_count || 0); });

  var trendDiff = (overallSg !== null && priorOverallSg !== null) ? (overallSg - priorOverallSg) : null;
  var trendStr = trendDiff === null ? '' : (trendDiff >= 0
    ? '<span style="color:#00b87a;">\u25b2 improving</span>'
    : '<span style="color:#d4706e;">\u25bc declining</span>');

  // Worst bucket
  var worst = null;
  wedgeBucketDefs.forEach(function(k) {
    var rb = rBucks[k]; if (rb.count === 0) return;
    var avg = rb.sgTotal / rb.count;
    if (worst === null || avg < worst.avg) worst = { key: k, avg: avg };
  });

  var focusIsBad = worst && worst.avg < 0;
  var focusBg    = focusIsBad ? 'linear-gradient(135deg,#3a1515,#3a1515)' : 'linear-gradient(135deg,#0a3020,#0a3020)';
  var focusBord  = focusIsBad ? '#3d1515' : '#0a3020';
  var focusEye   = focusIsBad ? '<span style="color:#d4706e;">\u26a0 Focus Area</span>' : '<span style="color:#00b87a;">\u2713 Strong Area</span>';
  var focusSub   = worst ? (worst.avg >= 0 ? '+' : '') + worst.avg.toFixed(2) + ' SG avg' : '';
  var focusRange = worst ? worst.key + ' yds' : '\u2014';

  focusEl.innerHTML = combFocusCard(focusEye, focusRange, focusSub, focusIsBad, focusBg, focusBord);

  var sgCol  = overallSg === null ? '#9a9a9a' : overallSg >= 0 ? '#00b87a' : '#d4706e';
  var ovBg   = overallSg === null ? '#1e1e1e' : overallSg >= 0 ? '#0a3020' : '#3a1515';
  var ovBord = overallSg === null ? '#282828' : overallSg >= 0 ? '#0a3020' : '#3d1515';
  var sgStr  = overallSg !== null ? (overallSg >= 0 ? '+' : '') + overallSg.toFixed(2) : 'N/A';

  overviewEl.innerHTML = combOverviewCard('Wedge', 'SG / Shot', overallSg, sgStr, sgCol, trendStr, (avgScore !== null ? 'Avg score ' + avgScore + ' \u00b7 ' : totalShotsAll + ' shots \u00b7 ') + sessions.length + ' combines', ovBg, ovBord);

  var dHtml = '';
  wedgeBucketDefs.forEach(function(bk) {
    var rb = rBucks[bk]; if (rb.count === 0) return;
    var avgSg  = rb.sgTotal  / rb.count;
    var avgPts = rb.ptsTotal / rb.count;
    var trendH = '';
    if (pBucks) {
      var pb = pBucks[bk];
      if (pb.count > 0) {
        var diff = avgSg - (pb.sgTotal / pb.count);
        var tc = diff >= 0 ? '#00b87a' : '#d4706e';
        trendH = ' <span style="color:' + tc + ';">' + (diff >= 0 ? '\u25b2' : '\u25bc') + ' ' + (diff >= 0 ? '+' : '') + diff.toFixed(2) + '</span>';
      }
    }
    var isWorst = worst && worst.key === bk;
    var col  = avgSg >= 0 ? '#00b87a' : '#d4706e';
    var bg   = avgSg >= 0 ? '#0a3020' : '#3a1515';
    var bord = avgSg >= 0 ? '#0a3020' : '#3d1515';
    var info = (isWorst ? '<span style="color:#d4706e;">\u26a0 Needs work</span> \u00b7 ' : '') + rb.count + ' shots \u00b7 ' + Math.round(avgPts) + ' avg score' + trendH;
    dHtml += combStatCard(bk + ' yds', col, bg, bord, (avgSg >= 0 ? '+' : '') + avgSg.toFixed(2) + ' SG', info);
  });
  detailEl.innerHTML = combDetailHeader('Wedge', 'Wedge \u00b7 Detail') + dHtml;
}

// The tiles, laid out like Past Rounds' strokes-gained cards (same size, padding and type).
function combFocusCard(eye, range, sub, bad, bg, bord) {
  return '<div style="border-radius:11px;padding:12px;margin-bottom:8px;border:1px solid ' + bord + ';background:' + bg + ';text-align:center;">' +
    '<div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">' + eye + '</div>' +
    '<div style="font-size:22px;font-weight:800;color:#ffffff;line-height:1.1;margin-bottom:4px;">' + range + '</div>' +
    '<div style="font-size:11px;font-weight:700;color:' + (bad ? '#d4706e' : '#00b87a') + ';">' + sub + '</div></div>';
}
function combOverviewCard(key, title, val, valStr, col, trendStr, stat, bg, bord) {
  var w = val === null ? 5 : Math.max(5, Math.min(100, (val + 2) / 4 * 100));
  return '<div style="border-radius:11px;padding:12px;border:1px solid ' + bord + ';background:' + bg + ';cursor:pointer;user-select:none;margin-bottom:8px;" onclick="toggleCombineDetail(\'' + key + '\', this)">' +
    '<div style="font-size:10px;color:#ffffff;font-weight:800;margin-bottom:6px;text-align:center;letter-spacing:0.3px;">' + title + '</div>' +
    '<div style="text-align:center;margin-bottom:6px;">' +
    '<div style="font-size:26px;font-weight:800;color:' + col + ';line-height:1;">' + valStr + '</div>' +
    '<div style="font-size:10px;margin-top:3px;">' + (trendStr || '<span style="color:#9a9a9a;">\u2014 steady</span>') + '</div></div>' +
    '<div style="font-size:10px;text-align:center;color:#9a9a9a;">' + stat + '</div>' +
    '<div style="height:3px;background:rgba(255,255,255,0.08);border-radius:2px;margin-top:8px;">' +
    '<div style="width:' + w + '%;height:3px;background:' + col + ';border-radius:2px;"></div></div>' +
    '<div style="font-size:9px;color:#9a9a9a;margin-top:6px;text-align:right;" class="perfcaret" data-key="' + key + '">View detail \u2192</div></div>';
}

function combStatCard(label, col, bg, border, badgeText, infoLine) {
  return '<div style="background:' + bg + ';border:1px solid ' + border + ';border-radius:11px;padding:12px 14px;margin-bottom:7px;min-height:62px;display:flex;flex-direction:column;justify-content:center;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">' +
    '<div style="font-size:14px;font-weight:700;color:#ffffff;">' + label + '</div>' +
    '<div style="font-size:12px;color:' + col + ';border:1px solid ' + border + ';border-radius:5px;padding:3px 10px;font-weight:700;white-space:nowrap;">' + badgeText + '</div></div>' +
    '<div style="font-size:11px;color:#9a9a9a;line-height:1.5;">' + infoLine + '</div></div>';
}

// Functions called from inline HTML handlers
expose({ toggleCombineDetail });

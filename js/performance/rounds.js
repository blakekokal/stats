import { onEnter } from '../coaching/core.js';
import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { _viewingAsStudent, activeUserId } from '../coaching/core.js';
import { _sb } from '../coaching/core.js';
import { loadPerfCombineData } from './combines.js';
import { historyRounds } from '../rounds.js';
import { toCoachRound } from '../dashboard.js';
import { isDriver } from '../model.js';
import { getExpectedPutts, getExpectedStrokes } from '../coaching/sg-calc.js';
import { ic } from '../icons.js';

// ═══════════════════════════════════════════════════════════════
// PERFORMANCE ANALYSIS ENGINE  v4.0.0
// ═══════════════════════════════════════════════════════════════

var _perfActiveTabs = {};  // Cache fetched rounds so hcp change doesn't re-fetch

function onPerfHcpChange() {
  // No-op — hcp is now read from user profile only
}

function perfHcpLabel(hcp) {
  if (hcp === 'pro') return 'Tour Pro averages';
  if (hcp === '0')   return 'Scratch (0 HCP) averages';
  return hcp + ' HCP averages';
}

function togglePerfTab(tab) {
  var el = document.getElementById('perfTab-' + tab);
  if (!el) return;
  var isOpen = el.style.display !== 'none';
  // Close all
  ['ott','app','arg','putt'].forEach(function(t) {
    var e = document.getElementById('perfTab-' + t);
    if (e) e.style.display = 'none';
  });
  // If it was closed, open it
  if (!isOpen) {
    el.style.display = 'block';
    var page = document.getElementById('performanceAnalysisPage');
    if (page) setTimeout(function(){ page.scrollTop += 140; }, 60);
  }
}

export function setPerfPage(page) {
  var isRounds   = page === 'rounds';
  document.getElementById('perfPageRounds').style.display   = isRounds ? '' : 'none';
  document.getElementById('perfPageCombines').style.display = isRounds ? 'none' : '';
  var btnR = document.getElementById('perfTabBtnRounds');
  var btnC = document.getElementById('perfTabBtnCombines');
  if (btnR) { btnR.style.background = isRounds ? '#2d7abc' : 'transparent'; btnR.style.color = isRounds ? '#ffffff' : '#9a9a9a'; }
  if (btnC) { btnC.style.background = isRounds ? 'transparent' : '#2d7abc'; btnC.style.color = isRounds ? '#9a9a9a' : '#ffffff'; }
  if (!isRounds && !S.perfCombineLoaded) {
    S.perfCombineLoaded = true;
    loadPerfCombineData();
  }
}

export async function loadPerformanceAnalysis() {
  var subtitle  = document.getElementById('perfAnalysisSubtitle');
  var noRounds  = document.getElementById('perfNoRounds');
  var content   = document.getElementById('perfContent');

  subtitle.textContent = 'Loading...';
  noRounds.style.display = 'none';
  content.style.display  = 'none';

  if (!S.currentUser) {
    subtitle.textContent = 'Log in to see your analysis';
    noRounds.style.display = 'block';
    document.getElementById('perfNoRounds').textContent = 'Log in to see your performance analysis.';
    return;
  }

  try {
    // The last 10 rounds played in this app, in the coaching app's round format.
    var resp = { data: historyRounds().map(toCoachRound).filter(function(r){ return r.holes > 0; })
      .sort(function(a, b){ return a.round_date < b.round_date ? 1 : a.round_date > b.round_date ? -1 : 0; }).slice(0, 10) };

    if (resp.error) throw resp.error;
    var rounds = (resp.data || []).filter(function(r){ return r.round_data && r.round_data.allHoles; });

    if (rounds.length === 0) {
      subtitle.textContent = 'No rounds saved yet';
      noRounds.style.display = 'block';
      return;
    }

    subtitle.textContent = 'Last ' + rounds.length + ' round' + (rounds.length > 1 ? 's' : '');
    content.style.display = 'block';

    // Cache rounds for re-use
    S.perfCachedRounds = rounds;

    // Read hcp from user's saved profile setting — read-only, matches their profile
    var profileHcp;
    if (_viewingAsStudent) {
      try {
        var { data: _shcp } = await _sb.from('profiles').select('hcp_preference').eq('id', _viewingAsStudent.id).single();
        profileHcp = (_shcp && _shcp.hcp_preference) || 'pro';
      } catch(e) { profileHcp = 'pro'; }
    } else {
      profileHcp = (S.currentUser && S.currentUser.user_metadata && S.currentUser.user_metadata.hcp_preference) || 'pro';
    }

    // Show the hcp badge so user can confirm it matches their profile
    var badge = document.getElementById('perfHcpBadge');
    if (badge) badge.style.display = 'flex';
    var hcpLabelEl = document.getElementById('perfHcpLabel');
    if (hcpLabelEl) hcpLabelEl.textContent = perfHcpLabel(profileHcp).replace(' averages', '');

    var analysis = computePerfAnalysis(rounds, profileHcp);
    analysis.displayHcp = profileHcp;
    renderPerfAnalysis(analysis);

  } catch(e) {
    subtitle.textContent = 'Error loading data';
    noRounds.style.display = 'block';
    document.getElementById('perfNoRounds').textContent = 'Could not load rounds: ' + e.message;
  }
}

export function computePerfAnalysis(rounds, displayHcp) {
  // hcp alias used throughout SG recalculation
  var hcp = displayHcp || 'pro';
  // Aggregate totals across all rounds
  var totals = {
    sgOTT: 0, sgAPP: 0, sgARG: 0, sgPutt: 0, roundCount: rounds.length,
    // OTT
    fwHit: 0, fwOpp: 0, fwLeft: 0, fwRight: 0,
    driveDistTotal: 0, driveCount: 0,
    recentDriveTotal: 0, recentDriveCount: 0,
    priorDriveTotal: 0,  priorDriveCount: 0,
    longestDrive: 0, longestDriveHole: null, longestDriveCourse: null,
    // Driver only (tee shots hit with Driver on par 4s and 5s)
    drDistTotal: 0, drCount: 0, drRecentTotal: 0, drRecentCount: 0, drPriorTotal: 0, drPriorCount: 0,
    drLongest: 0, drLongestHole: null, drLongestCourse: null,
    // Recent 3 vs prior OTT miss
    recentFwLeft: 0, recentFwRight: 0, recentFwOpp: 0,
    priorFwLeft: 0,  priorFwRight: 0,  priorFwOpp: 0,
    // Approach by bucket (over 30 yards; 30 or less is around the green)
    appBuckets: {},
    // ARG by bucket
    argBuckets: { '1-15': {upDown:0,opp:0}, '15-30': {upDown:0,opp:0}, 'lt15rough': {upDown:0,opp:0}, '15-30rough': {upDown:0,opp:0}, bunker: {saves:0,opp:0} },
    scrMade: 0, scrOpp: 0,
    totalPutts: 0, totalHoles: 0,
    // Putting by bucket
    puttBuckets: { '0-3':{makes:0,att:0}, '4-7':{makes:0,att:0}, '8-15':{makes:0,att:0}, '15-25':{makes:0,att:0}, '25+':{threePutts:0,att:0} },
    // Trend: SG last 3 vs prior
    recentSgOTT:0, recentSgAPP:0, recentSgARG:0, recentSgPutt:0,
    priorSgOTT:0,  priorSgAPP:0,  priorSgARG:0,  priorSgPutt:0,
    recentCount: 0, priorCount: 0
  };

  // Init approach buckets
  var appBucketDefs = ['30-75','75-100','100-125','125-150','150-175','175-200','200-225','225+'];
  appBucketDefs.forEach(function(b){ totals.appBuckets[b] = {gir:0, opp:0, missLeft:0, missRight:0, missShort:0, missLong:0, proxTotal:0, proxCount:0}; });

  rounds.forEach(function(round, roundIdx) {
    var isRecent = roundIdx < 3;
    var rd = round.round_data;
    var holes = rd.allHoles || [];
    var isSimple = rd.entryMode === 'simple';

    // Simple rounds only contribute scoring stats — skip shot-level analysis
    if (isSimple) {
      totals.totalHoles += holes.length;
      if (isRecent) totals.recentCount += holes.length;
      else totals.priorCount += holes.length;
      return;
    }

    holes.forEach(function(h) {
      // Recompute SG live from raw shots against the selected hcp baseline
      var holeSgOTT = 0, holeSgAPP = 0, holeSgARG = 0, holeSgPutt = 0;
      var holeShots = h.shots || [];
      holeShots.forEach(function(s, idx) {
        if (!s.lie || s.lie === 'PENALTY') return;
        var db = s.distanceBefore || 0, da = s.distanceAfter || 0;
        var isTeeShotPar45 = s.shotNum === 1 && (h.par === 4 || h.par === 5);
        var isTeeShotPar3  = s.shotNum === 1 && h.par === 3;
        var isPutt = s.isPutt;
        var isShortGame = !isPutt && db <= 30 && !isTeeShotPar45; // around the green: 30 yards or less
        var prevLie = idx > 0 ? (holeShots[idx-1].lie || 'FAIRWAY') : 'FAIRWAY';
        var sg = 0;
        if (isPutt) {
          var eb = getExpectedPutts(db, hcp);
          var ea = (s.lie === 'HOLED' || da === 0) ? 0 : getExpectedPutts(da, hcp);
          sg = eb - ea - 1;
          holeSgPutt += sg;
        } else if (s.lie === 'HOLED') {
          if (isTeeShotPar45)     { sg = getExpectedStrokes(h.yards, 'TEE', hcp) - 1; holeSgOTT += sg; }
          else if (isTeeShotPar3) { sg = getExpectedStrokes(h.yards, 'TEE', hcp) - 1; holeSgAPP += sg; }
          else if (isShortGame)   { sg = getExpectedStrokes(db, prevLie, hcp) - 1;     holeSgARG += sg; }
          else                    { sg = getExpectedStrokes(db, prevLie, hcp) - 1;     holeSgAPP += sg; }
        } else if (isTeeShotPar45) {
          var eb = getExpectedStrokes(h.yards, 'TEE', hcp);
          var ea = s.lie === 'GREEN' ? getExpectedPutts(da, hcp) : (da > 0 ? getExpectedStrokes(da, s.lie, hcp) : 2.5);
          sg = eb - ea - 1; holeSgOTT += sg;
        } else if (isTeeShotPar3) {
          var eb = getExpectedStrokes(h.yards, 'TEE', hcp);
          var ea = s.lie === 'GREEN' ? getExpectedPutts(da, hcp) : (da > 0 ? getExpectedStrokes(da, s.lie, hcp) : 2.5);
          sg = eb - ea - 1; holeSgAPP += sg;
        } else if (isShortGame) {
          var eb = getExpectedStrokes(db, prevLie, hcp);
          var ea = s.lie === 'GREEN' ? getExpectedPutts(da, hcp) : (da > 0 ? getExpectedStrokes(da, s.lie, hcp) : 2.5);
          sg = eb - ea - 1; holeSgARG += sg;
        } else {
          var eb = getExpectedStrokes(db, prevLie, hcp);
          var ea = s.lie === 'GREEN' ? getExpectedPutts(da, hcp) : (da > 0 ? getExpectedStrokes(da, s.lie, hcp) : 2.5);
          sg = eb - ea - 1; holeSgAPP += sg;
        }
      });

      totals.sgOTT  += holeSgOTT;  totals.sgAPP  += holeSgAPP;
      totals.sgARG  += holeSgARG;  totals.sgPutt += holeSgPutt;

      if (isRecent) {
        totals.recentSgOTT += holeSgOTT; totals.recentSgAPP += holeSgAPP;
        totals.recentSgARG += holeSgARG; totals.recentSgPutt += holeSgPutt;
      } else {
        totals.priorSgOTT += holeSgOTT; totals.priorSgAPP += holeSgAPP;
        totals.priorSgARG += holeSgARG; totals.priorSgPutt += holeSgPutt;
      }

      var shots = h.shots || [];
      var holePutts = h.putts || 0;
      var holeGIR   = false;
      var firstPuttDist = h.firstPuttDist || 0;

      shots.forEach(function(s, idx) {
        var db = s.distanceBefore || 0;
        var da = s.distanceAfter  || 0;
        var lie = s.lie || '';
        var prevLie = idx > 0 ? (shots[idx - 1].lie || 'FAIRWAY') : 'FAIRWAY';
        var isPar45TeeShot = s.shotNum === 1 && (h.par === 4 || h.par === 5);
        var isPar3TeeShot  = s.shotNum === 1 && h.par === 3;
        // Approach: par3 tee shots + any non-putt shot into green from >30 yds
        var isApproachShot = !s.isPutt && (isPar3TeeShot || (!isPar45TeeShot && s.shotNum > 1 && db > 30));
        // ARG: chip/pitch shots close to the green, excludes all tee shots
        var isARG = !s.isPutt && !isPar45TeeShot && !isPar3TeeShot && s.shotNum > 1 && db <= 30;

        // ── OTT ─ drive distance only (fw/opp/left/right come from rd.stats) ──
        if (isPar45TeeShot && h.par >= 4) {
          // Track recent vs prior miss direction from shots (rd.stats has totals not per-round split)
          if (lie === 'LEFT ROUGH' || (lie === 'RECOVERY' && s.recoveryDirection === 'LEFT')) {
            if (isRecent) totals.recentFwLeft++; else totals.priorFwLeft++;
          } else if (lie === 'RIGHT ROUGH' || (lie === 'RECOVERY' && s.recoveryDirection === 'RIGHT')) {
            if (isRecent) totals.recentFwRight++; else totals.priorFwRight++;
          }
          if (isRecent) totals.recentFwOpp++; else totals.priorFwOpp++;
          // Drive distance
          if (da > 0 && lie !== 'OB' && lie !== 'PENALTY' && lie !== 'WATER') {
            var driveDist = db - da;
            totals.driveDistTotal += driveDist;
            totals.driveCount++;
            if (isRecent) { totals.recentDriveTotal += driveDist; totals.recentDriveCount++; }
            else          { totals.priorDriveTotal  += driveDist; totals.priorDriveCount++;  }
            if (driveDist > totals.longestDrive) {
              totals.longestDrive     = driveDist;
              totals.longestDriveHole = h.hole || null;
              totals.longestDriveCourse = round.course_name || null;
            }
            if (isDriver(s.club)) {
              totals.drDistTotal += driveDist; totals.drCount++;
              if (isRecent) { totals.drRecentTotal += driveDist; totals.drRecentCount++; }
              else          { totals.drPriorTotal  += driveDist; totals.drPriorCount++;  }
              if (driveDist > totals.drLongest) {
                totals.drLongest = driveDist;
                totals.drLongestHole = h.hole || null;
                totals.drLongestCourse = round.course_name || null;
              }
            }
          }
        }

        // ── APPROACH ─────────────────────────────────────
        if (isApproachShot && db > 30) {
          var bucket = appBucketFor(db);
          if (bucket && totals.appBuckets[bucket]) {
            totals.appBuckets[bucket].opp++;
            if (lie === 'GREEN' || lie === 'HOLED') {
              totals.appBuckets[bucket].gir++;
              holeGIR = true;
              // Track proximity (distanceAfter in feet when on green)
              if (da > 0) { totals.appBuckets[bucket].proxTotal += da; totals.appBuckets[bucket].proxCount++; }
            } else if (lie === 'MISS LEFT')  totals.appBuckets[bucket].missLeft++;
            else if (lie === 'MISS RIGHT') totals.appBuckets[bucket].missRight++;
            else if (lie === 'MISS SHORT') totals.appBuckets[bucket].missShort++;
            else if (lie === 'MISS LONG')  totals.appBuckets[bucket].missLong++;
          }
        }

        // ── ARG ─────────────────────────────────────────────
        // Only count the first ARG shot per hole (the chip/pitch itself),
        // not subsequent recovery shots. Use idx to find first non-putt off-green shot.
        if (isARG && db > 0) {
          // Up-and-down = scored par or better on hole that missed GIR
          var upAndDown = h.score <= h.par;
          var fromRough = (prevLie === 'LEFT ROUGH' || prevLie === 'RIGHT ROUGH' || prevLie === 'ROUGH');
          if (db <= 15) {
            totals.argBuckets['1-15'].opp++;
            if (upAndDown) totals.argBuckets['1-15'].upDown++;
            if (fromRough) {
              totals.argBuckets['lt15rough'].opp++;
              if (upAndDown) totals.argBuckets['lt15rough'].upDown++;
            }
          } else if (db <= 30) {
            totals.argBuckets['15-30'].opp++;
            if (upAndDown) totals.argBuckets['15-30'].upDown++;
            if (fromRough) {
              totals.argBuckets['15-30rough'].opp++;
              if (upAndDown) totals.argBuckets['15-30rough'].upDown++;
            }
          }
          // Bunker saves come from rd.stats — handled below
        }

        // ── PUTTING ─────────────────────────────────────────
        if (s.isPutt && db > 0) {
          var made = (da === 0 || lie === 'HOLED' || s.distanceAfter === 0);
          if (db <= 3) {
            totals.puttBuckets['0-3'].att++;
            if (made) totals.puttBuckets['0-3'].makes++;
          } else if (db <= 7) {
            totals.puttBuckets['4-7'].att++;
            if (made) totals.puttBuckets['4-7'].makes++;
          } else if (db <= 15) {
            totals.puttBuckets['8-15'].att++;
            if (made) totals.puttBuckets['8-15'].makes++;
          } else if (db <= 25) {
            totals.puttBuckets['15-25'].att++;
            if (made) totals.puttBuckets['15-25'].makes++;
          } else {
            // 25+ ft: track as opportunity for 3-putt
            if (s.shotNum === (shots.length > 0 ? shots.findIndex(function(x){ return x.isPutt; }) + 1 : 1)) {
              totals.puttBuckets['25+'].att++;
            }
          }
        }
      });

      // 3-putt detection post-hole: if first putt was > 25ft and they took 3+ putts
      if (firstPuttDist > 25 && holePutts >= 3) {
        totals.puttBuckets['25+'].threePutts++;
        // Ensure att is counted (may have been counted in loop above; avoid double)
      }
    });

    // Count 3-putts from round stats if available
    if (rd.stats && rd.stats.threePutts) {
      // These are total 3-putts for the round — approximation
    }

    if (isRecent) totals.recentCount += holes.length;
    else totals.priorCount += holes.length;

    // ── Pull aggregates from saved rd.stats — matches dashboard exactly ────
    var st = round.round_data.stats || {};
    totals.fwHit   += st.fwHit   || 0;
    totals.fwOpp   += st.fwOpp   || 0;
    totals.fwLeft  += st.fwLeft  || 0;
    totals.fwRight += st.fwRight || 0;
    totals.scrMade += st.scrMade || 0;
    totals.scrOpp  += st.scrOpp  || 0;
    totals.totalPutts += st.totalPutts || 0;
    totals.totalHoles += holes.length;
    totals.argBuckets.bunker.saves += st.bunMade || 0;
    totals.argBuckets.bunker.opp  += st.bunOpp  || 0;
  });

  // Normalize SG per round (exclude simple rounds from SG counts)
  var detailedRounds = rounds.filter(function(r) { return r.round_data && r.round_data.entryMode !== 'simple'; });
  var n = detailedRounds.length || 1;
  var r3 = Math.min(3, n);
  var prior = n - r3;

  totals.sgOTTperRound  = totals.sgOTT  / n;
  totals.sgAPPperRound  = totals.sgAPP  / n;
  totals.sgARGperRound  = totals.sgARG  / n;
  totals.sgPuttperRound = totals.sgPutt / n;

  totals.recentSgOTTper  = r3   > 0 ? totals.recentSgOTT  / r3   : null;
  totals.recentSgAPPper  = r3   > 0 ? totals.recentSgAPP  / r3   : null;
  totals.recentSgARGper  = r3   > 0 ? totals.recentSgARG  / r3   : null;
  totals.recentSgPuttper = r3   > 0 ? totals.recentSgPutt / r3   : null;
  totals.priorSgOTTper   = prior > 0 ? totals.priorSgOTT  / prior : null;
  totals.priorSgAPPper   = prior > 0 ? totals.priorSgAPP  / prior : null;
  totals.priorSgARGper   = prior > 0 ? totals.priorSgARG  / prior : null;
  totals.priorSgPuttper  = prior > 0 ? totals.priorSgPutt / prior : null;

  totals.avgDrive      = totals.driveCount      > 0 ? Math.round(totals.driveDistTotal      / totals.driveCount)      : 0;
  totals.recentAvgDrive = totals.recentDriveCount > 0 ? Math.round(totals.recentDriveTotal / totals.recentDriveCount) : 0;
  totals.priorAvgDrive  = totals.priorDriveCount  > 0 ? Math.round(totals.priorDriveTotal  / totals.priorDriveCount)  : 0;
  totals.drAvg       = totals.drCount       > 0 ? Math.round(totals.drDistTotal   / totals.drCount)       : 0;
  totals.drRecentAvg = totals.drRecentCount > 0 ? Math.round(totals.drRecentTotal / totals.drRecentCount) : 0;
  totals.drPriorAvg  = totals.drPriorCount  > 0 ? Math.round(totals.drPriorTotal  / totals.drPriorCount)  : 0;
  totals.fwPct    = totals.fwOpp > 0 ? Math.round(100 * totals.fwHit   / totals.fwOpp) : 0;
  totals.fwLeftPct  = totals.fwOpp > 0 ? Math.round(100 * totals.fwLeft  / totals.fwOpp) : 0;
  totals.fwRightPct = totals.fwOpp > 0 ? Math.round(100 * totals.fwRight / totals.fwOpp) : 0;
  totals.recentFwRightPct = totals.recentFwOpp > 0 ? Math.round(100 * totals.recentFwRight / totals.recentFwOpp) : 0;
  totals.recentFwLeftPct  = totals.recentFwOpp > 0 ? Math.round(100 * totals.recentFwLeft  / totals.recentFwOpp) : 0;
  totals.priorFwRightPct  = totals.priorFwOpp  > 0 ? Math.round(100 * totals.priorFwRight  / totals.priorFwOpp)  : 0;
  totals.priorFwLeftPct   = totals.priorFwOpp  > 0 ? Math.round(100 * totals.priorFwLeft   / totals.priorFwOpp)  : 0;

  // Overall GIR
  var totalGir = 0, totalGirOpp = 0;
  Object.values(totals.appBuckets).forEach(function(b){ totalGir += b.gir; totalGirOpp += b.opp; });
  totals.girPct = totalGirOpp > 0 ? Math.round(100 * totalGir / totalGirOpp) : 0;

  // Scramble %
  totals.scrPct = totals.scrOpp > 0 ? Math.round(100 * totals.scrMade / totals.scrOpp) : null;

  // Putts per hole
  totals.puttsPerHole = totals.totalHoles > 0 ? (totals.totalPutts / totals.totalHoles).toFixed(2) : null;

  // Determine priority category
  var sgCats = [
    { key: 'ott',  val: totals.sgOTTperRound,  label: 'SG: Off the Tee' },
    { key: 'app',  val: totals.sgAPPperRound,  label: 'SG: Approach' },
    { key: 'arg',  val: totals.sgARGperRound,  label: 'SG: Around Green' },
    { key: 'putt', val: totals.sgPuttperRound, label: 'SG: Putting' }
  ];
  sgCats.sort(function(a,b){ return a.val - b.val; });
  totals.priorityCat = sgCats[0];

  return totals;
}

function appBucketFor(dist) {
  if (dist >  30 && dist < 75)   return '30-75';
  if (dist >= 75  && dist < 100) return '75-100';
  if (dist >= 100 && dist < 125) return '100-125';
  if (dist >= 125 && dist < 150) return '125-150';
  if (dist >= 150 && dist < 175) return '150-175';
  if (dist >= 175 && dist < 200) return '175-200';
  if (dist >= 200 && dist < 225) return '200-225';
  if (dist >= 225)               return '225+';
  return null;
}

function sgColor(val) {
  if (val >= 0) return '#00b87a';
  return '#d4706e';
}

function sgTrend(recent, prior) {
  if (recent === null || prior === null) return { icon: '— steady', color: '#9a9a9a' };
  var diff = recent - prior;
  if (diff > 0.15)  return { icon: '▲ improving', color: '#00b87a' };
  if (diff < -0.15) return { icon: '▼ declining', color: '#d4706e' };
  return { icon: '— steady', color: '#9a9a9a' };
}

function pct(makes, att) {
  return att > 0 ? Math.round(100 * makes / att) : null;
}

function pctStr(makes, att, suffix) {
  var p = pct(makes, att);
  return p !== null ? p + (suffix || '%') : 'N/A';
}

function bucketGirColor(girPct) {
  if (girPct === null) return '#606060';
  if (girPct >= 55) return '#00b87a';
  if (girPct >= 35) return '#f0c830';

  return '#d4706e';
}

function bucketGirBg(girPct) {
  if (girPct === null) return '#1e1e1e';
  if (girPct >= 55) return '#0a3020';
  if (girPct >= 35) return '#2a2508';
  if (girPct >= 20) return '#2a1510';
  return '#3a1515';
}

export function renderPerfAnalysis(a) {
  // ── Priority card ──────────────────────────────────────────
  var pc = a.priorityCat;
  var pcColor = sgColor(pc.val);
  var pcBadge = pc.val < 0 ? ic('warn') + ' Priority Area' : '✓ Your Focus';
  var hcpCtx = perfHcpLabel(a.displayHcp || 'pro');
  var pcMsg = pc.val < 0
    ? 'Averaging <strong style="color:' + pcColor + ';">' + pc.val.toFixed(1) + ' per round</strong> vs ' + hcpCtx
    : 'Weakest category vs ' + hcpCtx + '. Room to improve.';
  document.getElementById('perfPriorityCard').innerHTML =
    '<div style="background:linear-gradient(135deg,#3a1515,#3a1515);border:1px solid #3d1515;border-radius:12px;padding:16px;">' +
    '<div style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:' + pcColor + ';margin-bottom:8px;">' + pcBadge + '</div>' +
    '<div style="font-size:17px;font-weight:800;color:#ffffff;margin-bottom:4px;">' + pc.label + '</div>' +
    '<div style="font-size:12px;color:#ffffff;margin-bottom:10px;">' + pcMsg + '</div>' +
    '<div style="display:flex;gap:6px;">' +
    '<div style="flex:1;background:rgba(255,255,255,0.05);border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:800;color:' + pcColor + ';">' + (pc.val >= 0 ? '+' : '') + pc.val.toFixed(2) + '</div><div style="font-size:9px;color:#606060;margin-top:2px;">SG/Round</div></div>' +
    (pc.key === 'app' ? '<div style="flex:1;background:rgba(255,255,255,0.05);border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#ffffff;">' + a.girPct + '%</div><div style="font-size:9px;color:#606060;margin-top:2px;">GIR Rate</div></div>' : '') +
    (pc.key === 'ott' ? '<div style="flex:1;background:rgba(255,255,255,0.05);border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#ffffff;">' + a.fwPct + '%</div><div style="font-size:9px;color:#606060;margin-top:2px;">FW Hit</div></div>' : '') +
    '</div></div>';

  // ── SG Cards ───────────────────────────────────────────────
  function sgCard(key, label, val, recentPer, priorPer, stat1, stat2) {
    var color  = sgColor(val);
    var trend  = sgTrend(recentPer, priorPer);
    var active = document.getElementById('perfTab-' + key).style.display !== 'none';
    var stat2Html = stat2 ? '<span style="color:#9a9a9a;margin:0 4px;">·</span><span style="color:#9a9a9a;">' + stat2 + '</span>' : '';
    return '<div style="font-size:10px;color:#ffffff;font-weight:800;margin-bottom:6px;text-align:center;letter-spacing:0.3px;">' + label + '</div>' +
      '<div style="text-align:center;margin-bottom:6px;">' +
      '<div style="font-size:26px;font-weight:800;color:' + color + ';line-height:1;">' + (val >= 0 ? '+' : '') + val.toFixed(2) + '</div>' +
      '<div style="font-size:10px;color:' + trend.color + ';margin-top:3px;">' + trend.icon + '</div>' +
      '</div>' +
      '<div style="font-size:10px;text-align:center;color:#9a9a9a;">' + stat1 + stat2Html + '</div>' +
      '<div style="height:3px;background:rgba(255,255,255,0.08);border-radius:2px;margin-top:8px;">' +
      '<div style="width:' + Math.max(5, Math.min(100, (val + 2) / 4 * 100)) + '%;height:3px;background:' + color + ';border-radius:2px;"></div></div>' +
      '<div style="font-size:9px;color:#9a9a9a;margin-top:6px;text-align:right;">' + (active ? 'Close ▲' : 'View detail →') + '</div>';
  }

  var ottCard  = document.getElementById('perfCardOtt');
  var appCard  = document.getElementById('perfCardApp');
  var argCard  = document.getElementById('perfCardArg');
  var puttCard = document.getElementById('perfCardPutt');

  var cardBgPos = 'background:#0a3020;border:1px solid #0a3020;border-radius:11px;padding:12px;cursor:pointer;';
  var cardBgNeg = 'background:#3a1515;border:1px solid #3d1515;border-radius:11px;padding:12px;cursor:pointer;';
  ottCard.style.cssText  = a.sgOTTperRound  >= 0 ? cardBgPos : cardBgNeg;
  appCard.style.cssText  = a.sgAPPperRound  >= 0 ? cardBgPos : cardBgNeg;
  argCard.style.cssText  = a.sgARGperRound  >= 0 ? cardBgPos : cardBgNeg;
  puttCard.style.cssText = a.sgPuttperRound >= 0 ? cardBgPos : cardBgNeg;

  ottCard.innerHTML  = sgCard('ott',  'SG: Off the Tee',  a.sgOTTperRound,  a.recentSgOTTper,  a.priorSgOTTper,
    'FW ' + a.fwPct + '%', a.avgDrive > 0 ? a.avgDrive + ' yds avg' : null);
  appCard.innerHTML  = sgCard('app',  'SG: Approach',     a.sgAPPperRound,  a.recentSgAPPper,  a.priorSgAPPper,
    'GIR ' + a.girPct + '%', null);
  argCard.innerHTML  = sgCard('arg',  'SG: Around the Green', a.sgARGperRound,  a.recentSgARGper,  a.priorSgARGper,
    a.scrPct !== null ? 'Scrambling ' + a.scrPct + '%' : 'Scrambling', null);
  puttCard.innerHTML = sgCard('putt', 'SG: Putting',      a.sgPuttperRound, a.recentSgPuttper, a.priorSgPuttper,
    a.puttsPerHole !== null ? a.puttsPerHole + ' putts/hole' : 'Putting', null);

  // ── OTT Detail ─────────────────────────────────────────────
  var ottTrend = '';
  if (a.recentFwRightPct > a.priorFwRightPct + 8)
    ottTrend = '<div style="font-size:11px;color:#d4706e;margin-top:8px;line-height:1.5;">' + ic('warn') + ' Missing right more in last 3 rounds (' + a.recentFwRightPct + '%) vs prior avg (' + a.priorFwRightPct + '%)</div>';
  else if (a.recentFwLeftPct > a.priorFwLeftPct + 8)
    ottTrend = '<div style="font-size:11px;color:#d4706e;margin-top:8px;line-height:1.5;">' + ic('warn') + ' Missing left more in last 3 rounds (' + a.recentFwLeftPct + '%) vs prior avg (' + a.priorFwLeftPct + '%)</div>';

  document.getElementById('perfTab-ott').innerHTML =
    perfTabHeader('ott', 'Off the Tee · Detail', '#ffffff') +
    '<div style="background:#1e1e1e;border:1px solid #282828;border-radius:12px;padding:14px;margin-bottom:8px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
    '<div style="font-size:14px;font-weight:700;color:#ffffff;">Fairways Hit</div>' +
    '<div style="font-size:14px;font-weight:800;color:#00b87a;">' + a.fwPct + '%</div></div>' +
    '<div style="display:flex;gap:2px;height:28px;border-radius:8px;overflow:hidden;margin-bottom:4px;">' +
    '<div style="flex:0 0 ' + a.fwLeftPct + '%;background:#3a1515;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#d4706e;flex-direction:column;min-width:' + (a.fwLeftPct > 0 ? '28px' : '0') + '"><div>◀L</div><div>' + a.fwLeftPct + '%</div></div>' +
    '<div style="flex:1;background:#0a3a20;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#00b87a;gap:4px;"><div>FW ' + a.fwPct + '%</div></div>' +
    '<div style="flex:0 0 ' + a.fwRightPct + '%;background:#3a1515;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#ffffff;flex-direction:column;min-width:' + (a.fwRightPct > 0 ? '28px' : '0') + '"><div>R▶</div><div>' + a.fwRightPct + '%</div></div>' +
    '</div>' + ottTrend + '</div>' +
    driveCard('Avg Drive · Driver', a.drAvg, a.drCount, a.drRecentAvg, a.drPriorAvg, a.drLongest, a.drLongestHole, a.drLongestCourse, 'Longest Drive', 'No tee shots logged with Driver yet.') +
    driveCard('Avg Drive · All Clubs', a.avgDrive, a.driveCount, a.recentAvgDrive, a.priorAvgDrive, a.longestDrive, a.longestDriveHole, a.longestDriveCourse, 'Longest Tee Shot', null);

  // A driving-distance card: tee shots on par 4s and 5s (never par 3s).
  function driveCard(title, avg, n, recent, prior, longest, ldHoleN, ldCourseName, longestLabel, emptyText) {
      if (!(avg > 0)) return emptyText ? '<div style="background:#1e1e1e;border:1px solid #282828;border-radius:12px;padding:14px;margin-bottom:8px;">' +
        '<div style="font-size:14px;font-weight:700;color:#ffffff;">' + title + '</div>' +
        '<div style="font-size:11px;color:#9a9a9a;margin-top:4px;">' + emptyText + '</div></div>' : '';
      var trendDiff = (recent > 0 && prior > 0) ? (recent - prior) : null;
      var trendHtml = '';
      if (trendDiff !== null) {
        var trendCol = trendDiff >= 0 ? '#00b87a' : '#d4706e';
        var trendIcon = trendDiff >= 0 ? '▲' : '▼';
        trendHtml = '<div style="font-size:11px;color:' + trendCol + ';margin-top:4px;">' + trendIcon + ' ' + (trendDiff >= 0 ? '+' : '') + trendDiff + ' yds vs prior (last 3: ' + recent + ' · prior: ' + prior + ')</div>';
      }
      var longestHtml = '';
      if (longest > 0) {
        var ldCourse = ldCourseName ? ldCourseName : 'Unknown';
        var ldHole   = ldHoleN   ? ' Hole ' + ldHoleN : '';
        longestHtml = '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #282828;display:flex;justify-content:space-between;align-items:center;">' +
          '<div>' +
          '<div style="font-size:11px;color:#606060;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:2px;">' + longestLabel + '</div>' +
          '<div style="font-size:11px;color:#9a9a9a;">' + ldCourse + ldHole + '</div>' +
          '</div>' +
          '<div style="font-size:22px;font-weight:800;color:#f0c830;">' + longest + ' yds</div>' +
          '</div>';
      }
      return '<div style="background:#0a3020;border:1px solid #0a3020;border-radius:12px;padding:14px;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<div><div style="font-size:14px;font-weight:700;color:#ffffff;">' + title + '</div>' +
        '<div style="font-size:11px;color:#9a9a9a;">' + n + ' tee shot' + (n === 1 ? '' : 's') + ', par 4s and 5s</div></div>' +
        '<div style="font-size:22px;font-weight:800;color:#00b87a;">' + avg + ' yds</div></div>' +
        trendHtml + longestHtml + '</div>';
  }

  // ── Shared stat card renderer ───────────────────────────────
  // col = badge text color, bg = card background, border, badgeText, infoLine
  function statCard(label, col, bg, border, badgeText, infoLine) {
    return '<div style="background:' + bg + ';border:1px solid ' + border + ';border-radius:11px;padding:12px 14px;margin-bottom:7px;min-height:62px;display:flex;flex-direction:column;justify-content:center;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">' +
      '<div style="font-size:14px;font-weight:700;color:#ffffff;">' + label + '</div>' +
      '<div style="font-size:12px;color:' + col + ';border:1px solid ' + border + ';border-radius:5px;padding:3px 10px;font-weight:700;white-space:nowrap;">' + badgeText + '</div></div>' +
      '<div style="font-size:11px;color:#9a9a9a;line-height:1.5;">' + infoLine + '</div></div>';
  }

  // ── APP Detail ─────────────────────────────────────────────
  var appBucketDefs = ['30-75','75-100','100-125','125-150','150-175','175-200','200-225','225+'];
  var appHtml = perfTabHeader('app', 'Approach · Detail', '#ffffff');
  var worstBucket = appBucketDefs.reduce(function(worst, k){ var bk = a.appBuckets[k]; if(!bk.opp) return worst; var g=Math.round(100*bk.gir/bk.opp); return (!worst || g < worst.gir) ? {key:k,gir:g} : worst; }, null);
  appBucketDefs.forEach(function(bKey) {
    var b = a.appBuckets[bKey];
    if (b.opp === 0) {
      // The short buckets always show, so there's a place for wedge approaches.
      if (bKey === '30-75' || bKey === '75-100') appHtml += statCard(bKey + ' yds', '#9a9a9a', '#1e1e1e', '#282828', 'No shots', 'No approach shots from this distance yet');
      return;
    }
    var girP  = Math.round(100 * b.gir / b.opp);
    var col   = bucketGirColor(girP);
    var bg    = bucketGirBg(girP);
    var border = girP >= 55 ? '#0a3020' : girP >= 35 ? '#3a3010' : girP >= 20 ? '#3d1515' : '#3d1515';
    var misses = [{dir:'Short',count:b.missShort},{dir:'Left',count:b.missLeft},{dir:'Right',count:b.missRight},{dir:'Long',count:b.missLong}];
    misses.sort(function(x,y){return y.count-x.count;});
    var topMiss = misses[0].count > 0 ? ' <span style="color:#9a9a9a;">·</span> ' + misses[0].dir + ' ' + Math.round(100*misses[0].count/b.opp) + '% of misses' : '';
    var proxPart = b.proxCount > 0 ? ' <span style="color:#9a9a9a;">·</span> ' + Math.round(b.proxTotal / b.proxCount) + ' ft avg proximity' : '';
    var isWorst = worstBucket && worstBucket.key === bKey;
    var infoLine = (isWorst ? '<span style="color:#d4706e;">' + ic('warn') + ' Weakest</span> <span style="color:#9a9a9a;">·</span> ' : '') + girP + '% GIR' + topMiss + proxPart;
    appHtml += statCard(bKey + ' yds', col, bg, border, 'GIR ' + girP + '%', infoLine);
  });
  document.getElementById('perfTab-app').innerHTML = appHtml;

  // ── ARG Detail ─────────────────────────────────────────────
  var ab = a.argBuckets;
  function argRow(label, makes, opp) {
    var p    = opp > 0 ? Math.round(100 * makes / opp) : null;
    var col  = p === null ? '#9a9a9a' : p >= 40 ? '#00b87a' : '#d4706e';
    var bg   = p === null ? '#1e1e1e' : p >= 40 ? '#0a3020' : '#3a1515';
    var bord = p === null ? '#282828' : p >= 40 ? '#0a3020' : '#3d1515';
    var badge = p !== null ? p + '%' : 'N/A';
    var info  = p !== null ? p + '% up & down · ' + opp + ' opp' : 'No data';
    return statCard(label, col, bg, bord, badge, info);
  }
  document.getElementById('perfTab-arg').innerHTML =
    perfTabHeader('arg', 'Around the Green · Detail', '#ffffff') +
    argRow('< 15 yds',            ab['1-15'].upDown,       ab['1-15'].opp) +
    argRow('15 – 30 yds',         ab['15-30'].upDown,      ab['15-30'].opp) +
    argRow('< 15 yds (Rough)',    ab['lt15rough'].upDown,   ab['lt15rough'].opp) +
    argRow('15 – 30 yds (Rough)', ab['15-30rough'].upDown,  ab['15-30rough'].opp) +
    argRow('Bunker Saves',        ab.bunker.saves,          ab.bunker.opp);

  // ── PUTT Detail ────────────────────────────────────────────
  function puttRow(label, makes, att, is3putt) {
    var p = att > 0 ? Math.round(100 * makes / att) : null;
    var col, bg, bord, badge, info;
    if (is3putt) {
      col   = p === null ? '#9a9a9a' : p >= 20 ? '#d4706e' : '#00b87a';
      bg    = p === null ? '#1e1e1e' : p >= 20 ? '#3a1515' : '#0a3020';
      bord  = p === null ? '#282828' : p >= 20 ? '#3d1515' : '#0a3020';
      badge = p !== null ? p + '%' : 'N/A';
      info  = p !== null ? p + '% 3-putt rate · ' + att + ' opp' : 'No data';
    } else {
      col   = p === null ? '#9a9a9a' : p >= 50 ? '#00b87a' : '#d4706e';
      bg    = p === null ? '#1e1e1e' : p >= 50 ? '#0a3020' : '#3a1515';
      bord  = p === null ? '#282828' : p >= 50 ? '#0a3020' : '#3d1515';
      badge = p !== null ? p + '%' : 'N/A';
      info  = p !== null ? p + '% make rate · ' + makes + '/' + att : 'No data';
    }
    return statCard(label, col, bg, bord, badge, info);
  }
  var pb = a.puttBuckets;
  document.getElementById('perfTab-putt').innerHTML =
    perfTabHeader('putt', 'Putting · Detail', '#ffffff') +
    puttRow('0 – 3 ft',           pb['0-3'].makes,  pb['0-3'].att,  false) +
    puttRow('4 – 7 ft',           pb['4-7'].makes,  pb['4-7'].att,  false) +
    puttRow('8 – 15 ft',          pb['8-15'].makes, pb['8-15'].att, false) +
    puttRow('15 – 25 ft',         pb['15-25'].makes,pb['15-25'].att,false) +
    puttRow('25+ ft (3-putts)',    pb['25+'].threePutts || 0, pb['25+'].att || 0, true);
}

function perfTabHeader(key, title, color) {
  return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
    '<div style="font-size:14px;font-weight:800;color:' + color + ';">' + title + '</div>' +
    '<button onclick="togglePerfTab(\'' + key + '\')" style="background:transparent;border:none;color:#9a9a9a;font-size:12px;cursor:pointer;height:auto;max-width:none;width:auto;padding:0;">✕ Close</button>' +
    '</div>';
}

onEnter('performanceAnalysisPage', function() {
  // Reset cache so navigating away and back re-fetches fresh data
  S.perfCachedRounds = null;
  S.perfCombineLoaded = false;
  setPerfPage('rounds');
  setTimeout(loadPerformanceAnalysis, 50);
});

// Functions called from inline HTML handlers
expose({ togglePerfTab, setPerfPage });

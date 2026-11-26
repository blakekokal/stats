// Stats Dashboard, ported from the coaching app's dashboard (same tabs and
// tables, with strokes-gained sliders). This app's GPS rounds are converted into the coaching
// app's shot-by-shot round format first, then the ported code renders them.

import { goBack, h, courseById } from './app.js';
import { store, sync, levelFromPref } from './store.js';
import { expected } from './sg.js';
import { yards } from './geo.js';
import { isDriver } from './model.js';
import { historyRounds, setCurrentRound, firstHoleOf } from './rounds.js';
import { icEl } from './icons.js';

const S = {}; // shared state for the ported dashboard code
var hcpLabels = { 'pro': 'Tour Pro', '0': 'Scratch', '5': '5 HCP', '10': '10 HCP', '15': '15 HCP', '20': '20 HCP', '25': '25 HCP', '30': '30 HCP' };
const lvl = hcp => levelFromPref(hcp) || 'Pro';
// Also Performance Analysis's, so the two pages give the same strokes gained.
export function getExpectedPutts(ft, hcp) { return ft <= 0 ? 0 : expected('green', ft, lvl(hcp)); }
export function getExpectedStrokes(dist, lie, hcp) {
  const l = lie === 'TEE' ? 'tee' : lie === 'FAIRWAY' || lie === 'GREEN' ? 'fairway' : /BUNKER|SAND/.test(lie || '') ? 'bunker' : lie === 'RECOVERY' ? 'recovery' : 'rough';
  return expected(l, dist, lvl(hcp));
}

// ---------- convert a GPS round to the coaching app's format ----------
// GPS shots are the spots each stroke was played from; a coaching shot is
// described by where it ended (lie), with distances before and after.

const M_PER_DEG = 111320;
function localXY(from, p) { // metres east, north of `from`
  const k = Math.cos((from[0] * Math.PI) / 180);
  return [(p[1] - from[1]) * M_PER_DEG * k, (p[0] - from[0]) * M_PER_DEG];
}
// Along (+ past the target) and lateral (+ right) of `p` on the line from `a` to `b`.
function relTo(a, b, p) {
  const [bx, by] = localXY(a, b), [px, py] = localXY(a, p), len = Math.hypot(bx, by) || 1;
  const ux = bx / len, uy = by / len;
  return { along: px * ux + py * uy - len, lateral: px * uy - py * ux };
}
const feetOf = (s, pin) => Math.max(1, s.ft != null ? s.ft : Math.round(yards(s.pos, pin) * 3));

function endLie(from, to, pin, isTeeShot) {
  const lie = to.lie;
  if (from.pen) return from.penKind === 'water' ? 'WATER' : 'OB';
  if (lie === 'green') return 'GREEN';
  if (lie === 'water' && !to.drop && !to.replay) return 'WATER';
  if (lie === 'recovery') return 'RECOVERY';
  const near = yards(to.pos, pin) <= 30;
  if (lie === 'bunker') return near ? 'GS BUNKER' : 'FW BUNKER';
  if (lie === 'fairway' || lie === 'tee') return 'FAIRWAY';
  // Rough: around the green, the side the approach missed on; otherwise left/right of the line.
  const r = relTo(from.pos, pin, to.pos);
  if (near && !isTeeShot) {
    if (Math.abs(r.along) >= Math.abs(r.lateral)) return r.along < 0 ? 'MISS SHORT' : 'MISS LONG';
    return r.lateral < 0 ? 'MISS LEFT' : 'MISS RIGHT';
  }
  return r.lateral < 0 ? 'LEFT ROUGH' : 'RIGHT ROUGH';
}

export function toCoachRound(r) {
  const course = courseById(r.course);
  const allHoles = [];
  const st = { fwHit: 0, fwOpp: 0, fwLeft: 0, fwRight: 0, girHit: 0, scrMade: 0, scrOpp: 0, bunMade: 0, bunOpp: 0, onePutts: 0, threePutts: 0, totalPutts: 0 };
  let score = 0, par = 0;
  for (const ch of course.holes) {
    const hl = r.holes && r.holes[ch.n];
    const P = (hl && hl.shots) || [];
    if (!hl || !hl.done || !P.length) continue;
    const pin = hl.pin || ch.pin;
    const shots = [];
    let num = 0;
    P.forEach((s, i) => {
      const nxt = P[i + 1], isPutt = s.lie === 'green';
      const lie = nxt ? endLie(s, nxt, pin, i === 0) : 'HOLED';
      shots.push({ shotNum: ++num, lie, isPutt, club: s.club || null,
        distanceBefore: isPutt ? feetOf(s, pin) : Math.round(yards(s.pos, pin)),
        distanceAfter: !nxt ? 0 : nxt.lie === 'green' ? feetOf(nxt, pin) : Math.round(yards(nxt.pos, pin)) });
      // Penalty strokes (water or OB): one entry each, so the next shot's number is right.
      for (let k = s.pen || (lie === 'WATER' ? 1 : 0); k > 0; k--) shots.push({ shotNum: ++num, lie: 'PENALTY' });
    });
    const putts = shots.filter(s => s.isPutt);
    const hole = { hole: ch.n, par: ch.par, yards: Math.round(yards(P[0].pos, pin)), score: num, putts: putts.length,
      firstPuttDist: putts.length ? putts[0].distanceBefore : 0, shots };
    allHoles.push(hole);
    score += num; par += ch.par;
    // Fairways (par 4s and 5s)
    if (ch.par >= 4) {
      st.fwOpp++;
      const t = shots[0].lie;
      if (t === 'FAIRWAY' || t === 'GREEN' || t === 'HOLED') st.fwHit++;
      else if (t === 'LEFT ROUGH') st.fwLeft++;
      else if (t === 'RIGHT ROUGH') st.fwRight++;
    }
    // Greens in regulation, scrambling, sand saves, putts
    const toGreen = shots.findIndex(s => s.isPutt);
    const gir = (toGreen < 0 ? num : toGreen) <= ch.par - 2;
    if (gir) st.girHit++;
    else { st.scrOpp++; if (num <= ch.par) st.scrMade++; }
    const gsb = shots.find(s => s.lie === 'GS BUNKER');
    if (gsb) { st.bunOpp++; if (num - gsb.shotNum <= 2) st.bunMade++; }
    st.totalPutts += putts.length;
    if (putts.length === 1) st.onePutts++;
    if (putts.length >= 3) st.threePutts++;
  }
  const tee = course.tees.find(t => t.name === r.tee);
  return { id: r.id, round_date: r.date, course_name: r.courseName || course.name, round_type: r.type || 'Casual',
    score, par, to_par: score - par, holes: allHoles.length,
    round_data: { allHoles, stats: st, _selectedTee: tee ? { rm: tee.rating, sm: tee.slope } : null } };
}

// ---------- page ----------

// 2026-11-08 -> 11/8/2026.
const mdy = d => { const [y, m, dd] = String(d || '').split('-').map(Number); return y && m && dd ? `${m}/${dd}/${y}` : String(d || ''); };

// With `roundId`, shows the stats for that one round (from Round History).
export function renderStatsDashboard(view, renderLogin, roundId) {
  if (!sync.user) return renderLogin(view);
  const only = roundId ? historyRounds().find(r => r.id === roundId) : null;
  const prefOf = l => (l === 'Pro' ? 'pro' : l === 'Scratch' ? '0' : l);
  // What's shown: the level to compare with (beside "Strokes gained"), and Filter's round type and time.
  const st = { hcp: sync.level ? prefOf(sync.level) : 'pro', type: 'all', time: 'all' };
  setDashControls('dashContent', { filters: !only, get: () => st, set: (k, v) => {
    st[k] = v; draw();
    if (k === 'hcp') sync.setLevel(levelFromPref(v)).catch(() => { /* keep the local choice */ });
  } });
  const content = h('div', { id: 'dashContent', style: 'text-align:left;' });
  const back = h('button', { class: 'back-btn-top', 'aria-label': 'Back', onclick: () => { if (!dashBack()) goBack(); } });
  back.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>';
  // Only Past rounds scrolls (and a category's detail page, which is long); the rest stays put.
  view.replaceChildren(h('div', { class: 'cx top fixedpage' }, back,
    h('div', { class: 'fixedcol', style: 'width:100%;max-width:360px;' },
      h('div', { style: 'font-size:20px;font-weight:800;text-align:center;margin-bottom:6px;' }, icEl('bars', 'tint-blue'), only ? ' Round Stats' : ' Stats Dashboard'),
      only ? h('div', { style: 'font-size:12px;color:#9a9a9a;text-align:center;margin-bottom:6px;' }, `${only.courseName || courseById(only.course).name} · ${mdy(only.date)}${only.player ? ' · ' + only.player : ''}`) : null,
      content)));

  function draw() {
    const all = (only ? [only] : historyRounds()).map(toCoachRound).filter(r => r.holes > 0)
      .sort((a, b) => (a.round_date < b.round_date ? 1 : a.round_date > b.round_date ? -1 : 0));
    if (!all.length) { content.innerHTML = '<div style="text-align:center;color:#606060;padding:20px;">No rounds saved yet. Finish at least one hole to see stats.</div>'; return; }
    const data = all.filter(r => {
      if (st.type !== 'all' && r.round_type !== st.type) return false;
      if (st.time !== 'all') { const c = new Date(); c.setMonth(c.getMonth() - +st.time); if (new Date(r.round_date + 'T12:00:00') < c) return false; }
      return true;
    });
    if (!data.length) { content.innerHTML = '<div style="text-align:center;color:#606060;padding:20px;">No rounds match these filters.</div>'; return; }
    renderDashboard(data, st.hcp);
  }
  draw();
}

// Scorecard for one round as a CSV file (opens in Excel / Numbers / Sheets).
export function downloadRoundCsv(r) {
  const c = toCoachRound(r);
  const desc = s => (s.lie === 'PENALTY' ? 'penalty' : `${s.distanceBefore}${s.isPutt ? 'ft' : 'yd'}→${s.lie === 'HOLED' ? 'holed' : s.lie.toLowerCase()}`);
  const rows = [['Hole', 'Par', 'Yards', 'Score', 'To par', 'Putts', 'Fairway', 'GIR', 'Shots']];
  for (const hl of c.round_data.allHoles) {
    const toGreen = hl.shots.findIndex(s => s.isPutt);
    const gir = (toGreen < 0 ? hl.score : toGreen) <= hl.par - 2;
    const fw = hl.par >= 4 ? (['FAIRWAY', 'GREEN', 'HOLED'].includes(hl.shots[0].lie) ? 'Hit' : 'Missed') : '';
    rows.push([hl.hole, hl.par, hl.yards, hl.score, hl.score - hl.par, hl.putts, fw, gir ? 'Yes' : 'No', hl.shots.map(desc).join(' | ')]);
  }
  rows.push(['Total', c.par, '', c.score, c.to_par, c.round_data.allHoles.reduce((a, x) => a + x.putts, 0), '', '', '']);
  const head = [['Course', c.course_name], ['Date', c.round_date], ['Player', r.player || ''], ['Tees', r.tee || ''], ['Type', c.round_type], []];
  const csv = [...head, ...rows].map(row => row.map(v => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }).join(',')).join('\n');
  const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `round-${c.round_date}.csv` });
  document.body.append(a); a.click(); a.remove();
}

// ---------- ported from the coaching app (js/stats/dashboard.js, handicap-index.js) ----------

// With `opts.single`, `data` is one round picked from SG by round: the page
// shows "← All rounds" instead of the filter button and the round list.
var escapeHtml = function(t) { return String(t).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var _dash = null; // the full set last shown: { data, hcp, targetId }
export function renderDashboard(data, hcp, targetId, opts) {
  opts = opts || {};
  var content = document.getElementById(targetId || 'dashContent');
  if (!opts.single) _dash = { data: data, hcp: hcp, targetId: targetId };
  _dash.single = !!opts.single;
  _dash.index = opts.single ? opts.index : null;
  
  // ===== AGGREGATE ALL DATA =====
  var A = { n: data.length, holes: 0, totScore: 0, totPar: 0, totPutts: 0,
    fwHit:0, fwOpp:0, fwLeft:0, fwRight:0,
    girHit:0, girFirstPuttDist:0, girPutts:0,
    scrMade:0, scrOpp:0, bunMade:0, bunOpp:0,
    onePutt:0, threePutt:0,
    p3:0, c3:0, p4:0, c4:0, p5:0, c5:0,
    eagles:0, birdies:0, pars:0, bogeys:0, dblPlus:0,
    r18s:[], r18tp:[], r9s:[], r9tp:[],
    drives:[], longestDrive:0, shortestDrive:999,
    drDrives:[], drLongest:0, drShortest:999,
    par3TeePen:0, par45TeePen:0, appPen:0, sgPen:0,
    missShort:0, missLong:0, missLeft:0, missRight:0,
    allPuttRanges: [{min:0,max:3,m:0,t:0,l:'0-3 ft'},{min:4,max:7,m:0,t:0,l:'4-7 ft'},{min:8,max:11,m:0,t:0,l:'8-11 ft'},{min:12,max:15,m:0,t:0,l:'12-15 ft'},{min:16,max:20,m:0,t:0,l:'16-20 ft'},{min:21,max:30,m:0,t:0,l:'21-30 ft'},{min:31,max:40,m:0,t:0,l:'31-40 ft'},{min:41,max:50,m:0,t:0,l:'41-50 ft'},{min:51,max:999,m:0,t:0,l:'50+ ft'}],
    // Approach: over 30 yards (30 or less is around the green). 30-75 and 75-100 always show.
    appRanges: [{min:31,max:75,s:[],total:0,l:'30-75',keep:true},{min:76,max:100,s:[],total:0,l:'75-100',keep:true},{min:101,max:125,s:[],total:0,l:'100-125'},{min:126,max:150,s:[],total:0,l:'125-150'},{min:151,max:175,s:[],total:0,l:'150-175'},{min:176,max:200,s:[],total:0,l:'175-200'},{min:201,max:225,s:[],total:0,l:'200-225'},{min:226,max:250,s:[],total:0,l:'225-250'},{min:251,max:275,s:[],total:0,l:'250-275'},{min:276,max:999,s:[],total:0,l:'275+'}],
    shortRanges: [{min:0,max:15,s:[],l:'0-15'},{min:16,max:30,s:[],l:'15-30'}],
    par3AppDist:[], par4AppDist:[], par5AppDist:[],
    par3AppProx:[], par4AppProx:[], par5AppProx:[],
    bunkerProx:[], firstPuttDists:[], longestMadePutt:0,
    bestRound: null, bestToPar: 999,
    sgOTT:0, sgAPP:0, sgARG:0, sgPutt:0,
    roundSGs: [], playByPlay: []
  };
  
  data.forEach(function(r) {
    var rd = r.round_data || {};
    var holes = rd.allHoles || [];
    var st = rd.stats || {};
    var isSimple = rd.entryMode === 'simple';
    // Simple rounds from a scorecard photo carry fairway / green / putt counts but no shots
    var hasStats = !isSimple || rd.basicStats === true;
    A.holes += holes.length;
    A.totScore += r.score; A.totPar += r.par;
    if (r.to_par < A.bestToPar) { A.bestToPar = r.to_par; A.bestRound = r; }
    if (holes.length >= 14) { A.r18s.push(r.score); A.r18tp.push(r.to_par); }
    else { A.r9s.push(r.score); A.r9tp.push(r.to_par); }

    // Score-only rounds: only count scoring, skip fairway / green / putt stats
    if (hasStats) {
      A.fwHit += st.fwHit||0; A.fwOpp += st.fwOpp||0; A.fwLeft += st.fwLeft||0; A.fwRight += st.fwRight||0;
      A.girHit += st.girHit||0;
      A.scrMade += st.scrMade||0; A.scrOpp += st.scrOpp||0;
      A.bunMade += st.bunMade||0; A.bunOpp += st.bunOpp||0;
      A.onePutt += st.onePutts||0; A.threePutt += st.threePutts||0;
    }

    var rOTT=0, rAPP=0, rARG=0, rPutt=0;
    var roundPBP = [];

    holes.forEach(function(h) {
      if (hasStats) A.totPutts += h.putts||0;
      var diff = h.score - h.par;
      if (diff <= -2) A.eagles++; else if (diff === -1) A.birdies++; else if (diff === 0) A.pars++; else if (diff === 1) A.bogeys++; else A.dblPlus++;
      if (h.par===3) { A.c3++; A.p3+=h.score; } if (h.par===4) { A.c4++; A.p4+=h.score; } if (h.par===5) { A.c5++; A.p5+=h.score; }

      // Simple rounds have no shot data — skip shot-level analysis
      if (isSimple) return;

      // Check if this was a GIR (hit green in par - 2 shots)
      var shotsToGreen = 0;
      for (var sti = 0; sti < (h.shots || []).length; sti++) {
        if (h.shots[sti].isPutt) break;
        shotsToGreen++;
      }
      var wasGIR = shotsToGreen <= (h.par - 2);
      
      if (wasGIR && h.firstPuttDist > 0) { A.firstPuttDists.push(h.firstPuttDist); A.girFirstPuttDist += h.firstPuttDist; A.girPutts += h.putts||0; }
      if ((h.putts||0) === 1 && h.firstPuttDist > 0) { if (h.firstPuttDist > A.longestMadePutt) A.longestMadePutt = h.firstPuttDist; }
      
      // Recalculate SG for this handicap
      var hOTT=0, hAPP=0, hARG=0, hPutt=0;
      var shots = h.shots||[];
      var holePBP = { hole: h.hole, par: h.par, yards: h.yards, score: h.score, shots: [] };
      
      shots.forEach(function(s, idx) {
        var sgVal = 0;
        if (s.lie && s.lie !== 'PENALTY') {
          var db = s.distanceBefore||0;
          var da = s.distanceAfter||0;
          var isTeePar45 = s.shotNum===1 && (h.par===4||h.par===5);
          var isTeePar3 = s.shotNum===1 && h.par===3;
          var isShort = !s.isPutt && db <= 30 && !isTeePar45; // around the green: 30 yards or less
          
          if (s.isPutt) {
            var eb = getExpectedPutts(db, hcp);
            var ea = 0;
            if (s.lie !== 'HOLED' && s.distanceAfter) ea = getExpectedPutts(s.distanceAfter, hcp);
            sgVal = eb - ea - 1;
            hPutt += sgVal;
          } else if (s.lie === 'HOLED') {
            if (isTeePar45) { sgVal = getExpectedStrokes(h.yards, 'TEE', hcp) - 1; hOTT += sgVal; }
            else if (isTeePar3) { sgVal = getExpectedStrokes(h.yards, 'TEE', hcp) - 1; hAPP += sgVal; }
            else if (isShort) { var prev = shots[idx-1]; sgVal = getExpectedStrokes(db, prev?prev.lie:'FAIRWAY', hcp) - 1; hARG += sgVal; }
            else { var prev2 = shots[idx-1]; sgVal = getExpectedStrokes(db, prev2?prev2.lie:'FAIRWAY', hcp) - 1; hAPP += sgVal; }
          } else if (isTeePar45) {
            var ebS = getExpectedStrokes(h.yards, 'TEE', hcp);
            var eaS = s.lie==='GREEN' ? getExpectedPutts(da, hcp) : (da>0 ? getExpectedStrokes(da, s.lie, hcp) : 2.5);
            sgVal = ebS - eaS - 1; hOTT += sgVal;
          } else if (isTeePar3) {
            var ebS2 = getExpectedStrokes(h.yards, 'TEE', hcp);
            var eaS2 = s.lie==='GREEN' ? getExpectedPutts(da, hcp) : (da>0 ? getExpectedStrokes(da, s.lie, hcp) : 2.5);
            sgVal = ebS2 - eaS2 - 1; hAPP += sgVal;
          } else if (isShort) {
            var prev3 = shots[idx-1]; var pLie = prev3?prev3.lie:'FAIRWAY';
            var ebS3 = getExpectedStrokes(db, pLie, hcp);
            var eaS3 = s.lie==='GREEN' ? getExpectedPutts(da, hcp) : (da>0 ? getExpectedStrokes(da, s.lie, hcp) : 2.5);
            sgVal = ebS3 - eaS3 - 1; hARG += sgVal;
          } else {
            var prev4 = shots[idx-1]; var pLie2 = prev4?prev4.lie:'FAIRWAY';
            var ebS4 = getExpectedStrokes(db, pLie2, hcp);
            var eaS4 = s.lie==='GREEN' ? getExpectedPutts(da, hcp) : (da>0 ? getExpectedStrokes(da, s.lie, hcp) : 2.5);
            sgVal = ebS4 - eaS4 - 1; hAPP += sgVal;
          }
        }
        
        // Build play-by-play description
        var nextShot = shots[idx+1];
        
        // Special handling for PENALTY shots
        if (s.lie==='PENALTY') {
          holePBP.shots.push({ desc: 'Shot '+s.shotNum+' - Penalty stroke', sg: 0 });
          return;
        }
        
        var endLie = s.lie||'Unknown';
        if (endLie==='HOLED') endLie='in the hole';
        else if (endLie==='WATER') endLie='water';
        else if (endLie==='OB') endLie='out of bounds';
        else if (endLie==='LEFT ROUGH'||endLie==='RIGHT ROUGH') endLie=endLie.toLowerCase();
        else if (endLie==='GS BUNKER'||endLie==='FW BUNKER') endLie=endLie.toLowerCase().replace('gs ','greenside ').replace('fw ','fairway ');
        else if (endLie==='MISS LEFT') endLie='left of green';
        else if (endLie==='MISS RIGHT') endLie='right of green';
        else if (endLie==='MISS SHORT') endLie='short of green';
        else if (endLie==='MISS LONG') endLie='long of green';
        else endLie=endLie.toLowerCase();
        
        var shotDist = '';
        if (s.isPutt) { if (s.distanceBefore!=null) shotDist=s.distanceBefore+' ft'; }
        else if (s.shotNum===1&&(h.par===4||h.par===5)) {
          // For water/OB tee shots, calc drive from next real shot's distance
          if (s.lie==='WATER'||s.lie==='OB') {
            var nextReal=null; for(var ni=idx+1;ni<shots.length;ni++){if(shots[ni].lie!=='PENALTY'){nextReal=shots[ni];break;}}
            if(nextReal&&nextReal.distanceBefore!=null) shotDist=(h.yards-nextReal.distanceBefore)+' yds';
            else shotDist=h.yards+' yds';
          } else if (s.distanceAfter!=null) { shotDist=(h.yards-s.distanceAfter)+' yds'; }
          else { shotDist=h.yards+' yds'; }
        }
        else if (s.shotNum===1) { shotDist=h.yards+' yds'; }
        else if (s.distanceBefore!=null) { shotDist=s.distanceBefore+' yds'; }
        
        var desc = '';
        if (s.lie==='HOLED') {
          desc = 'Shot '+s.shotNum+' - '+shotDist+(s.isPutt?' putt':'')+', in the hole';
        } else {
          var rem = '';
          // For water/OB, show remaining distance from next real shot
          if (s.lie==='WATER'||s.lie==='OB') {
            var nextReal2=null; for(var ni2=idx+1;ni2<shots.length;ni2++){if(shots[ni2].lie!=='PENALTY'){nextReal2=shots[ni2];break;}}
            if(nextReal2&&nextReal2.distanceBefore!=null) rem=nextReal2.distanceBefore+' yds';
          } else if (s.distanceAfter!=null) {
            if ((nextShot&&nextShot.isPutt)||s.isPutt) rem=s.distanceAfter+' ft';
            else rem=s.distanceAfter+' yds';
          } else if (nextShot) {
            if (nextShot.isPutt) rem=nextShot.distanceBefore!=null?nextShot.distanceBefore+' ft':'';
            else rem=nextShot.distanceBefore!=null?nextShot.distanceBefore+' yds':'';
          }
          if (s.isPutt) desc='Shot '+s.shotNum+' - '+shotDist+' putt to '+rem+' from hole';
          else desc='Shot '+s.shotNum+' - '+shotDist+' to '+endLie+', '+rem+' to hole';
        }
        
        holePBP.shots.push({ desc: desc, sg: sgVal });
        
        // Non-SG aggregations
        if ((h.par===4||h.par===5)&&s.shotNum===1&&s.distanceAfter!=null&&s.lie!=='PENALTY'&&s.lie!=='OB'&&s.lie!=='WATER'&&s.lie!=='RECOVERY') {
          var dd=h.yards-s.distanceAfter; A.drives.push(dd);
          if (dd>A.longestDrive) A.longestDrive=dd; if (dd<A.shortestDrive) A.shortestDrive=dd;
          if (isDriver(s.club)) { A.drDrives.push(dd); if (dd>A.drLongest) A.drLongest=dd; if (dd<A.drShortest) A.drShortest=dd; }
        }
        if (s.lie==='PENALTY') { var prev5=shots[idx-1]; if(prev5){ if(prev5.shotNum===1){if(h.par===3)A.par3TeePen++;else A.par45TeePen++;}else if(prev5.distanceBefore>30)A.appPen++;else A.sgPen++;} }
        var _db=s.distanceBefore||0;var _isPar45Tee=s.shotNum===1&&(h.par===4||h.par===5);var _isAppAttempt=!s.isPutt&&_db>30&&!_isPar45Tee&&s.lie!=='PENALTY';
        function _gp(sh,i,st){if(st.lie==='HOLED')return 0;var nx=sh[i+1];if(nx&&nx.isPutt&&nx.distanceBefore>0)return nx.distanceBefore;return st.distanceAfter||0;}
        if(_isAppAttempt){A.appRanges.forEach(function(rr){if(_db>=rr.min&&_db<=rr.max){rr.total++;if(s.lie==='GREEN'||s.lie==='HOLED')rr.s.push(_gp(shots,idx,s));}});}
        if (!s.isPutt&&(s.distanceBefore||0)>0&&(s.distanceBefore||0)<=30&&s.lie==='GREEN') { A.shortRanges.forEach(function(rr){if((s.distanceBefore||0)>=rr.min&&(s.distanceBefore||0)<=rr.max)rr.s.push(_gp(shots,idx,s));}); }
        if (s.lie&&s.lie.includes('BUNKER')&&shots[idx+1]&&shots[idx+1].lie==='GREEN') { A.bunkerProx.push(_gp(shots,idx+1,shots[idx+1])); }
        if (s.isPutt&&(s.distanceBefore||0)>0) { A.allPuttRanges.forEach(function(rr){if((s.distanceBefore||0)>=rr.min&&(s.distanceBefore||0)<=rr.max){rr.t++;if(s.lie==='HOLED'||s.distanceAfter===0)rr.m++;}}); }
        if (!s.isPutt&&s.shotNum>0) { if(s.lie==='MISS SHORT')A.missShort++;if(s.lie==='MISS LONG')A.missLong++;if(s.lie==='MISS LEFT')A.missLeft++;if(s.lie==='MISS RIGHT')A.missRight++; }
      });
      
      rOTT+=hOTT; rAPP+=hAPP; rARG+=hARG; rPutt+=hPutt;
      
      function _gp2(sh,i,st){if(st.lie==='HOLED')return 0;var nx=sh[i+1];if(nx&&nx.isPutt&&nx.distanceBefore>0)return nx.distanceBefore;return st.distanceAfter||0;}
      if (h.par===3&&shots.length>=1) { A.par3AppDist.push(h.yards); if(shots[0].lie==='GREEN')A.par3AppProx.push(_gp2(shots,0,shots[0])); }
      if (h.par===4&&shots.length>=2&&!shots[1].isPutt) { A.par4AppDist.push(shots[1].distanceBefore||0); if(shots[1].lie==='GREEN')A.par4AppProx.push(_gp2(shots,1,shots[1])); }
      if (h.par===5&&shots.length>=2&&!shots[1].isPutt) { A.par5AppDist.push(shots[1].distanceBefore||0); if(shots[1].lie==='GREEN')A.par5AppProx.push(_gp2(shots,1,shots[1])); }
      
      roundPBP.push(holePBP);
    });
    
    A.sgOTT+=rOTT; A.sgAPP+=rAPP; A.sgARG+=rARG; A.sgPutt+=rPutt;
    var d2 = new Date(r.round_date+'T12:00:00');
    A.roundSGs.push({ i:data.indexOf(r), date:(d2.getMonth()+1)+'/'+d2.getDate(), course:r.course_name, score:r.score, toPar:r.to_par, ott:rOTT, app:rAPP, arg:rARG, putt:rPutt, tot:rOTT+rAPP+rARG+rPutt });
    A.playByPlay.push({ date:(d2.getMonth()+1)+'/'+d2.getDate()+'/'+d2.getFullYear(), course:r.course_name, score:r.score, toPar:r.to_par, holes:roundPBP });
  });
  if (A.drives.length===0) A.shortestDrive=0;
  
  // ===== HELPERS =====
  function ftp(v){if(v===null||v===undefined)return'\u2013';v=Math.round(v*10)/10;return v>0?'+'+v:v===0?'E':''+v;}
  function ftpC(v){return v>0?'#d4706e':v<0?'#00b87a':'#9a9a9a';}
  function pct(nn,dd){return dd>0?Math.round(nn/dd*100)+'%':'\u2013';}
  function davg(arr){return arr.length>0?Math.round(arr.reduce(function(a,b){return a+b;},0)/arr.length):0;}
  function avgF(arr){return arr.length>0?(arr.reduce(function(a,b){return a+b;},0)/arr.length).toFixed(1):'\u2013';}
  function sgFmt(v){return v>=0?'+'+v.toFixed(2):v.toFixed(2);}
  function sgC(v){return v>=0?'#00b87a':'#d4706e';}
  function row(l,v,s){return'<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #282828;"><span style="color:#9a9a9a;">'+l+'</span><span style="font-weight:700;">'+v+(s?' <span style="font-size:11px;color:#606060;">'+s+'</span>':'')+'</span></div>';}
  function hdr(t){return'<div style="font-size:14px;font-weight:800;color:#00b87a;margin:14px 0 4px;border-bottom:2px solid #007a52;padding-bottom:2px;">'+t+'</div>';}
  function tbl(headers,rows){var h='<div style="overflow-x:auto;margin:4px 0;"><table style="width:100%;font-size:12px;border-collapse:collapse;"><tr>';headers.forEach(function(c){h+='<td style="padding:4px 6px;font-weight:700;color:#9a9a9a;border-bottom:1px solid #3d3d3d;">'+c+'</td>';});h+='</tr>';rows.forEach(function(r){h+='<tr>';r.forEach(function(c){h+='<td style="padding:3px 6px;border-bottom:1px solid #282828;">'+c+'</td>';});h+='</tr>';});return h+'</table></div>';}
  // A strokes-gained slider: 0 in the middle, red to the left for strokes lost,
  // green to the right for strokes gained. Title above the bar, number below.
  // A strokes-gained slider: 0 in the middle, red to the left for strokes lost,
  // green to the right for strokes gained. Compact, so all five fit on a small
  // screen: the title and number on one line, the bar under them. With `go`,
  // the bar is a button that opens that category's detailed stats.
  // small: one of the four categories in the 2x2 grid under SG: Total.
  function sgBar(l,v,R,big,go,small){
    var p=Math.max(-R,Math.min(R,v))/R*50, c=sgC(v), ht=big?10:small?6:8;
    // One you can tap (it opens that category) is a glass bubble.
    return '<div'+(go!=null?' role="button" class="sgtap" onclick="showDashSub('+go+')" style="cursor:pointer;'+(small?'padding:8px 10px 10px;margin:0;':'padding:8px 14px 10px;margin:0 0 8px;')+'">':' style="padding:7px 0 8px;border-bottom:1px solid #282828;">')
      // SG: Total has its number in the middle; the others keep theirs on the right.
      +'<div style="'+(big?'display:grid;grid-template-columns:1fr auto 1fr;':'display:flex;justify-content:space-between;')+'align-items:baseline;gap:4px;margin-bottom:'+(small?5:6)+'px;">'
      +'<span style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'+(big?'font-size:15px;font-weight:700;color:#ffffff;':small?'font-size:12.5px;color:#c4c4c4;':'font-size:14px;color:#c4c4c4;')+'">'+l+(go!=null&&!small?' <span style="color:#606060;font-weight:700;">›</span>':'')+'</span>'
      +'<span style="font-weight:800;font-variant-numeric:tabular-nums;font-size:'+(big?19:small?14:16)+'px;color:'+c+';">'+sgFmt(v)+'</span></div>'
      +'<div style="position:relative;height:'+ht+'px;border-radius:'+(ht/2)+'px;background:#282828;">'
      +'<div style="position:absolute;top:0;bottom:0;border-radius:'+(ht/2)+'px;background:'+c+';left:'+(v>=0?50:50+p)+'%;width:'+Math.abs(p)+'%;"></div>'
      +'<div style="position:absolute;left:50%;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:#9a9a9a;"></div></div></div>';
  }
  function sgScale(R,inset){
    var f=function(x){return (x>0?'+':x<0?'\u2212':'')+Math.abs(x);};
    return '<div style="display:flex;justify-content:space-between;font-size:11px;color:#606060;margin-top:'+(inset?'0':'6px')+';'+(inset?'padding:0 14px;':'')+'"><span>'+f(-R)+'</span><span>'+f(-R/2)+'</span><span>0</span><span>'+f(R/2)+'</span><span>'+f(R)+'</span></div>';
  }
  function sgRow(l,v,s){return'<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #282828;"><span style="color:#9a9a9a;">'+l+'</span><span style="font-weight:700;color:'+sgC(v)+';">'+sgFmt(v)+(s?' <span style="font-size:11px;color:#606060;">'+s+'</span>':'')+'</span></div>';}
  
  var n=A.n;
  // For SG and non-scoring stats, only count detailed (non-simple) rounds
  var nDetailed = data.filter(function(r){ return !r.round_data || r.round_data.entryMode !== 'simple'; }).length || 1;
  var avg18=A.r18s.length>0?avgF(A.r18s):'\u2013';
  var avg18tp=A.r18tp.length>0?A.r18tp.reduce(function(a,b){return a+b;},0)/A.r18tp.length:null;
  var avg9=A.r9s.length>0?avgF(A.r9s):'\u2013';
  var avg9tp=A.r9tp.length>0?A.r9tp.reduce(function(a,b){return a+b;},0)/A.r9tp.length:null;
  var bestStr=A.bestRound?A.bestRound.score+' ('+ftp(A.bestRound.to_par)+') \u2014 '+A.bestRound.course_name:'\u2013';
  var avgDrv=davg(A.drives), avgDr=davg(A.drDrives);
  var avgFirstPutt=davg(A.firstPuttDists);
  // Rounds and holes that have fairway / green / putt stats (everything except score-only rounds)
  var nWithStats = data.filter(function(r){ var rd = r.round_data; return !rd || rd.entryMode !== 'simple' || rd.basicStats === true; }).length || 1;
  var detailedHoles = data.reduce(function(sum, r) { return sum + (r.round_data && r.round_data.entryMode === 'simple' && r.round_data.basicStats !== true ? 0 : (r.round_data && r.round_data.allHoles ? r.round_data.allHoles.length : 0)); }, 0);
  var twoPutts=detailedHoles-A.onePutt-A.threePutt;
  var sgTot=A.sgOTT+A.sgAPP+A.sgARG+A.sgPutt;
  
  // Handicap label
  var hcpLabel=hcpLabels[hcp]||hcp;

  // ===== STROKES GAINED BARS =====
  // Just the bars (per round, one shared scale). Tapping one opens its detailed
  // stats: Total -> scoring, then Off the tee, Approach, Around green, Putting.
  var html='';
  var back=''; // the page's Back button returns to the bars (dashBack)
  html+='<div id="dsub_0" class="dsubContent">';
  var nd=nDetailed||1, sgPer={tot:sgTot/nd,ott:A.sgOTT/nd,app:A.sgAPP/nd,arg:A.sgARG/nd,putt:A.sgPutt/nd};
  var sgMax=Math.max(Math.abs(sgPer.tot),Math.abs(sgPer.ott),Math.abs(sgPer.app),Math.abs(sgPer.arg),Math.abs(sgPer.putt));
  var sgR=[3,5,10,20,40].filter(function(x){return x>=sgMax;})[0]||Math.ceil(sgMax/10)*10;
  // Heading (a coach's view of a student has Filter beside "per round": round type, time and the level to compare with),
  // or, for one round picked from the list, which round it is (Back returns to all rounds).
  var top=opts.single&&data[0]?'<div style="display:flex;align-items:center;gap:8px;margin:2px 0 6px;">'
    +'<div style="font-size:13px;color:#9a9a9a;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escapeHtml(data[0].course_name||'')+' \u00b7 '+mdy(data[0].round_date)+'</div></div>':'';
  // The heading, then the level to compare with and Filter (round type and time, in a box
  // over the page): the same on the Stats Dashboard and in a coach's view of a student.
  var ctl=CTL[targetId||'dashContent'], cv=ctl?ctl.get():null;
  var opt=function(pairs,v){return pairs.map(function(p){return '<option value="'+p[0]+'"'+(String(p[0])===String(v)?' selected':'')+'>'+p[1]+'</option>';}).join('');};
  html+=top+'<div class="dashsghead">'
    +'<div style="font-size:12.5px;font-weight:800;color:#00b87a;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis;">STROKES GAINED \u00b7 '+(opts.single?'this round':'per round')+'</div>'
    +(cv?'<select class="minisel dashhcpsel" aria-label="Compare to" onchange="dashSet(\'hcp\',this.value)">'+opt(HCP_OPTS,cv.hcp)+'</select>':'')
    +(cv&&ctl.filters&&!opts.single?'<button class="dashfilterbtn" aria-label="Filter" onclick="toggleDashFilters(this)">Filter</button>'
      +'<div class="dashfilterbox" style="display:none;">'
      +'<div class="lab">Rounds</div><select class="minisel" onchange="dashSet(\'type\',this.value)">'+opt(TYPE_OPTS,cv.type)+'</select>'
      +'<div class="lab">Time</div><select class="minisel" onchange="dashSet(\'time\',this.value)">'+opt(TIME_OPTS,cv.time)+'</select></div>':'')
    +'</div>';
  html+=sgBar('SG: Total', sgPer.tot, sgR, true, 1);
  // The four categories two by two, so more of Past rounds fits below.
  html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
  html+=sgBar('Off The Tee', sgPer.ott, sgR, false, 2, true);
  html+=sgBar('Approach', sgPer.app, sgR, false, 3, true);
  html+=sgBar('Around Green', sgPer.arg, sgR, false, 4, true);
  html+=sgBar('Putting', sgPer.putt, sgR, false, 5, true);
  html+='</div>';
  // One round: View round opens it on the hole screen (the shots on the map).
  if(opts.single&&opts.index!=null)html+='<button onclick="dashViewRound('+opts.index+')" style="width:100%;max-width:none;height:46px;margin:16px 0 4px;font-size:15px;font-weight:800;background:#007a52;color:#ffffff;border:none;border-radius:12px;">\u26f3 View round</button>';
  // Past rounds: every round, newest first (scroll for these): the date, course and
  // score on top, the SG total and each category under them. Tap one to see
  // the strokes gained for just that round.
  if(!opts.single&&A.roundSGs.length){
    html+=hdr('PAST ROUNDS');
    html+='<div class="dashpast">';
    A.roundSGs.forEach(function(sr){
      var cat=function(l,v){return '<span>'+l+' <b style="color:'+sgC(v)+';font-weight:700;">'+sgFmt(v)+'</b></span>';};
      html+='<div role="button" onclick="dashOneRound('+sr.i+')" style="cursor:pointer;padding:8px 0;border-bottom:1px solid #282828;">'
        +'<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">'
        +'<span style="font-size:14px;font-weight:700;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+sr.date+' · '+escapeHtml(String(sr.course||''))+'</span>'
        +'<span style="white-space:nowrap;font-size:14px;font-weight:700;">'+sr.score+' <span style="color:'+ftpC(sr.toPar)+';">('+ftp(sr.toPar)+')</span> <span style="color:#606060;">›</span></span></div>'
        // One line: the five spread across, shrinking a little on narrow screens.
        +'<div style="display:flex;justify-content:space-between;gap:4px;white-space:nowrap;font-size:clamp(9.5px,3.1vw,11.5px);color:#7a7a7a;margin-top:3px;">'+[cat('SG',sr.tot),cat('OTT',sr.ott),cat('APP',sr.app),cat('ARG',sr.arg),cat('Putt',sr.putt)].join('')+'</div></div>';
    });
    html+='</div>';
  }
  html+='</div>';
  
  // ===== TAB 1: SCORING =====
  html+='<div id="dsub_1" class="dsubContent" style="display:none;">'+back;
  html+=hdr('SG: TOTAL');
  html+=sgBar('SG: Total \u00b7 per round',sgPer.tot,sgR);
  html+=sgScale(sgR);
  html+='<div class="dashdetail">'; // below the category's bar: scrolls on its own
  // Inline handicap calculation from the data we already have
  var hcpResult = calcHandicapIndex(data);
  var hcpDisplay = hcpResult.index !== null ? hcpResult.index.toFixed(1) : '--';
  var hcpColor = hcpResult.index === null ? '#606060' : hcpResult.index <= 5 ? '#00b87a' : hcpResult.index <= 15 ? '#f0c830' : '#d4706e';
  html+=hdr('HANDICAP INDEX');
  html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #282828;"><span style="color:#9a9a9a;">Handicap Index</span><span style="font-size:22px;font-weight:800;color:'+hcpColor+';">'+hcpDisplay+'</span></div>';
  html+=row('Calculation',hcpResult.msg);
  html+=hdr('SCORING AVERAGES');
  html+=row('Avg 18-Hole Score',avg18,avg18tp!==null?'<span style="color:'+ftpC(avg18tp)+'">'+ftp(avg18tp)+'</span>':'');
  html+=row('Avg 9-Hole Score',avg9,avg9tp!==null?'<span style="color:'+ftpC(avg9tp)+'">'+ftp(avg9tp)+'</span>':'');
  html+=row('Best Round',bestStr);
  html+=row('Avg Par 3',A.c3?(A.p3/A.c3).toFixed(1):'\u2013');
  html+=row('Avg Par 4',A.c4?(A.p4/A.c4).toFixed(1):'\u2013');
  html+=row('Avg Par 5',A.c5?(A.p5/A.c5).toFixed(1):'\u2013');
  html+=hdr('SCORE DISTRIBUTION');
  html+=row('Eagles',A.eagles,(A.eagles/n).toFixed(1)+'/rd');
  html+=row('Birdies',A.birdies,(A.birdies/n).toFixed(1)+'/rd');
  html+=row('Pars',A.pars,(A.pars/n).toFixed(1)+'/rd');
  html+=row('Bogeys',A.bogeys,(A.bogeys/n).toFixed(1)+'/rd');
  html+=row('Double+',A.dblPlus,(A.dblPlus/n).toFixed(1)+'/rd');
  html+=hdr('RECENT ROUNDS');
  var recentRows=[];var recent=data.slice(0,8);
  for(var ri=0;ri<recent.length;ri++){var rr=recent[ri];var d3=new Date(rr.round_date+'T12:00:00');recentRows.push([(d3.getMonth()+1)+'/'+d3.getDate(),rr.course_name,''+rr.score,'<span style="color:'+ftpC(rr.to_par)+'">'+ftp(rr.to_par)+'</span>']);}
  html+=tbl(['Date','Course','Score','\u00b1Par'],recentRows);
  html+='</div></div>'; // .dashdetail, then the section
  
  // ===== TAB 2: OFF THE TEE =====
  html+='<div id="dsub_2" class="dsubContent" style="display:none;">'+back;
  html+=hdr('SG: OFF THE TEE');
  html+=sgBar('SG: Off The Tee \u00b7 per round',sgPer.ott,sgR);
  html+=sgScale(sgR);
  html+='<div class="dashdetail">'; // below the category's bar: scrolls on its own
  html+=hdr('FAIRWAY ACCURACY');
  html+=row('Fairways Hit',pct(A.fwHit,A.fwOpp),A.fwHit+'/'+A.fwOpp);
  html+=row('Missed Left',A.fwLeft,pct(A.fwLeft,A.fwOpp));
  html+=row('Missed Right',A.fwRight,pct(A.fwRight,A.fwOpp));
  html+=hdr('DRIVING DISTANCE \u00b7 DRIVER');
  if (A.drDrives.length) {
    html+=row('Average',avgDr+' yds',A.drDrives.length+' drives');
    html+=row('Longest',A.drLongest+' yds');
    html+=row('Shortest',A.drShortest+' yds');
  } else html+=row('Average','\u2013','no tee shots logged with Driver');
  html+=hdr('DRIVING DISTANCE \u00b7 ALL CLUBS (PAR 4s & 5s)');
  html+=row('Average',(A.drives.length?avgDrv+' yds':'\u2013'),A.drives.length+' tee shots');
  if (A.drives.length) {
    html+=row('Longest',A.longestDrive+' yds');
    html+=row('Shortest',A.shortestDrive+' yds');
  }
  html+=hdr('PENALTIES OFF THE TEE');
  html+=row('Par 3 Tee Penalties',A.par3TeePen);
  html+=row('Par 4/5 Tee Penalties',A.par45TeePen);
  html+='</div></div>'; // .dashdetail, then the section
  
  // ===== TAB 3: APPROACH =====
  html+='<div id="dsub_3" class="dsubContent" style="display:none;">'+back;
  html+=hdr('SG: APPROACH');
  html+=sgBar('SG: Approach \u00b7 per round',sgPer.app,sgR);
  html+=sgScale(sgR);
  html+='<div class="dashdetail">'; // below the category's bar: scrolls on its own
  html+=hdr('GREENS IN REGULATION');
  html+=row('GIR',pct(A.girHit,detailedHoles),A.girHit+'/'+detailedHoles);
  html+=row('Proximity when GIR',A.girHit>0?Math.round(A.girFirstPuttDist/A.girHit)+' ft':'\u2013');
  html+=hdr('MISSED GREENS');
  var totalMiss=A.missShort+A.missLong+A.missLeft+A.missRight;
  html+=row('Short',A.missShort,totalMiss>0?pct(A.missShort,totalMiss):'');
  html+=row('Long',A.missLong,totalMiss>0?pct(A.missLong,totalMiss):'');
  html+=row('Left',A.missLeft,totalMiss>0?pct(A.missLeft,totalMiss):'');
  html+=row('Right',A.missRight,totalMiss>0?pct(A.missRight,totalMiss):'');
  html+=hdr('APPROACH BY DISTANCE');
  var appRows=[];A.appRanges.forEach(function(r){if(r.total>0||r.keep)appRows.push([r.l+' yds',r.total+' shots',r.s.length>0?davg(r.s)+' ft':'\u2013']);});
  html+=tbl(['Distance','Shots','Avg Proximity'],appRows);
  html+=hdr('APPROACH BY PAR');
  html+=row('Par 3 Avg Distance',davg(A.par3AppDist)+' yds',A.par3AppDist.length+' holes');
  html+=row('Par 3 Avg Proximity',A.par3AppProx.length>0?davg(A.par3AppProx)+' ft':'\u2013',A.par3AppProx.length+' GIR');
  html+=row('Par 4 Avg Distance',davg(A.par4AppDist)+' yds',A.par4AppDist.length+' holes');
  html+=row('Par 4 Avg Proximity',A.par4AppProx.length>0?davg(A.par4AppProx)+' ft':'\u2013',A.par4AppProx.length+' GIR');
  html+=row('Par 5 Avg Distance',davg(A.par5AppDist)+' yds',A.par5AppDist.length+' holes');
  html+=row('Par 5 Avg Proximity',A.par5AppProx.length>0?davg(A.par5AppProx)+' ft':'\u2013',A.par5AppProx.length+' GIR');
  html+=hdr('PENALTIES ON APPROACH');
  html+=row('Approach Penalties',A.appPen);
  html+='</div></div>'; // .dashdetail, then the section
  
  // ===== TAB 4: SHORT GAME =====
  html+='<div id="dsub_4" class="dsubContent" style="display:none;">'+back;
  html+=hdr('SG: AROUND THE GREEN');
  html+=sgBar('SG: Around Green \u00b7 per round',sgPer.arg,sgR);
  html+=sgScale(sgR);
  html+='<div class="dashdetail">'; // below the category's bar: scrolls on its own
  html+=hdr('SCRAMBLING');
  html+=row('Scrambling',pct(A.scrMade,A.scrOpp),A.scrMade+'/'+A.scrOpp);
  html+=row('Bunker Saves',pct(A.bunMade,A.bunOpp),A.bunMade+'/'+A.bunOpp);
  html+=row('Avg Bunker Proximity',A.bunkerProx.length>0?davg(A.bunkerProx)+' ft':'\u2013',A.bunkerProx.length+' shots');
  html+=hdr('SHORT GAME BY DISTANCE');
  var sgRows2=[];A.shortRanges.forEach(function(r){if(r.s.length>0)sgRows2.push([r.l+' yds',r.s.length+' shots',davg(r.s)+' ft']);});
  html+=tbl(['Distance','Shots','Avg Proximity'],sgRows2);
  html+=hdr('PENALTIES AROUND GREEN');
  html+=row('Short Game Penalties',A.sgPen);
  html+='</div></div>'; // .dashdetail, then the section
  
  // ===== TAB 5: PUTTING =====
  html+='<div id="dsub_5" class="dsubContent" style="display:none;">'+back;
  html+=hdr('SG: PUTTING');
  html+=sgBar('SG: Putting \u00b7 per round',sgPer.putt,sgR);
  html+=sgScale(sgR);
  html+='<div class="dashdetail">'; // below the category's bar: scrolls on its own
  html+=hdr('PUTTING SUMMARY');
  html+=row('Total Putts',A.totPutts,detailedHoles>0?(A.totPutts/detailedHoles).toFixed(1)+'/hole':'');
  html+=row('Putts per GIR',A.girHit>0?(A.girPutts/A.girHit).toFixed(1):'\u2013');
  html+=row('Avg First Putt Distance',avgFirstPutt+' ft');
  html+=hdr('PUTTING PERFORMANCE');
  html+=row('One-Putts',A.onePutt,pct(A.onePutt,detailedHoles));
  html+=row('Two-Putts',twoPutts,pct(twoPutts,detailedHoles));
  html+=row('Three-Putts',A.threePutt,pct(A.threePutt,detailedHoles));
  html+=row('Longest Made Putt',A.longestMadePutt+' ft');
  html+=hdr('MAKE % BY DISTANCE');
  var puttRows=[];A.allPuttRanges.forEach(function(r){puttRows.push([r.l,r.t>0?r.m+'/'+r.t:'0/0',r.t>0?Math.round(r.m/r.t*100)+'%':'\u2013']);});
  html+=tbl(['Distance','Made/Total','Make %'],puttRows);
  html+='</div></div>'; // .dashdetail, then the section
  
  content.innerHTML=html;
}

// SG by round: one round's dashboard, and back to all of them.
function dashOneRound(i) {
  if (!_dash || !_dash.data[i]) return;
  renderDashboard([_dash.data[i]], _dash.hcp, _dash.targetId, { single: true, index: i });
  document.getElementById(_dash.targetId || 'dashContent')?.scrollIntoView({ block: 'start' });
}
// View round: a coach's student round opens as in Student View (View round);
// your own opens like View/Edit in Round History, on the first hole played.
function dashViewRound(i) {
  var r = _dash && _dash.data[i];
  if (!r) return;
  if (r._gps) {
    document.getElementById('coachSgOverlay')?.style.setProperty('display', 'none');
    if (r._name && window.coachViewRound) window.coachViewRound(r._gps, r._name); else if (window.svViewRound) window.svViewRound(r.id);
    return;
  }
  var own = historyRounds().find(function(x) { return x.id === r.id; });
  if (!own) return;
  setCurrentRound(own.id); localStorage.setItem('gs:viewOnly', '1'); localStorage.removeItem('gs:editingPast'); sessionStorage.removeItem('gs:level');
  store.set('settings', Object.assign({}, store.get('settings') || {}, { tee: own.tee }));
  location.hash = '#/hole/' + firstHoleOf(own, courseById(own.course));
}
window.dashViewRound = dashViewRound;
function dashAllRounds() { if (_dash) renderDashboard(_dash.data, _dash.hcp, _dash.targetId); }
// Filter (beside the title, or beside "per round" in a coach's view of a student): shows or hides the page's filters (round type, time, and the level to compare with).
function toggleDashFilters(btn) {
  var box = btn && btn.parentElement.querySelector('.dashfilterbox');
  if (box) box.style.display = box.style.display === 'none' ? 'flex' : 'none';
}
// A Filter box closes on a tap anywhere outside it.
document.addEventListener('click', function (e) {
  document.querySelectorAll('.dashfilterbox').forEach(function (box) {
    if (box.style.display !== 'none' && !box.contains(e.target) && !box.parentElement.contains(e.target.closest('.dashfilterbtn'))) box.style.display = 'none';
  });
});
// The heading's controls for each dashboard (by its target id): get() gives
// { hcp, type, time }; set(key, value) applies a change and redraws.
var CTL = {};
var HCP_OPTS = ['pro', '0', '5', '10', '15', '20', '25', '30'].map(function (v) { return [v, 'vs ' + hcpLabels[v]]; });
var TYPE_OPTS = [['all', 'All Rounds'], ['Casual', 'Casual'], ['Tournament', 'Tournament']];
var TIME_OPTS = [['all', 'All Time'], ['1', 'Last Month'], ['3', 'Last 3 Mo'], ['6', 'Last 6 Mo'], ['12', 'Last Year']];
export function setDashControls(targetId, ctl) { CTL[targetId] = ctl; }
function dashSet(key, v) {
  var c = CTL[(_dash && _dash.targetId) || 'dashContent']; if (!c) return;
  var one = _dash && _dash.single && _dash.index != null ? _dash.index : null; // one round picked from Past rounds
  c.set(key, v);
  if (key === 'hcp' && one != null) dashOneRound(one); // stays on that round, with the new level
}
window.dashSet = dashSet;
window.dashOneRound = dashOneRound; window.dashAllRounds = dashAllRounds; window.toggleDashFilters = toggleDashFilters;

// Shows one part of the dashboard: 0 the SG bars, 1-5 a category's detailed stats.
function showDashSub(idx) {
  for(var i=0;i<6;i++){
    var el=document.getElementById('dsub_'+i);
    if(el)el.style.display=i===idx?'':'none';
  }
  var top=document.getElementById('dsub_'+idx);
  if(top&&top.scrollIntoView)top.scrollIntoView({block:'nearest'});
}


function calcHandicapDifferential(score, rating, slope) {
  // Standard formula: (Score - Rating) * 113 / Slope
  if (!rating || !slope) return null;
  return Math.round(((score - rating) * 113 / slope) * 10) / 10;
}

export function calcHandicapIndex(rounds) {
  // Get 18-hole rounds with scores, sorted by date desc
  var eligible = rounds.filter(function(r) {
    var holes = r.round_data && r.round_data.allHoles ? r.round_data.allHoles.length : r.holes;
    return holes >= 14 && r.score > 0;
  });

  if (eligible.length < 3) return { index: null, differentials: [], msg: 'Need at least 3 rounds (have ' + eligible.length + ')' };

  // Calculate differentials
  var diffs = eligible.slice(0, 20).map(function(r) {
    var rd = r.round_data || {};
    var tee = rd._selectedTee;
    var rating = tee ? tee.rm : null;
    var slope = tee ? tee.sm : null;
    var diff = calcHandicapDifferential(r.score, rating, slope);
    // Fallback: use par-based estimate if no rating/slope
    if (diff === null) {
      // Approximate: rating ~ par, slope ~ 113 (standard)
      diff = Math.round((r.score - r.par) * 10) / 10;
    }
    return { diff: diff, date: r.round_date, course: r.course_name, score: r.score };
  });

  // How many best differentials to use based on USGA table
  var n = diffs.length;
  var useCount;
  if (n <= 3) useCount = 1;
  else if (n <= 5) useCount = 1;
  else if (n <= 6) useCount = 2;
  else if (n <= 8) useCount = 2;
  else if (n <= 11) useCount = 3;
  else if (n <= 14) useCount = 4;
  else if (n <= 16) useCount = 5;
  else if (n <= 18) useCount = 6;
  else if (n <= 19) useCount = 7;
  else useCount = 8;

  // Sort differentials ascending to pick best
  var sorted = diffs.slice().sort(function(a, b) { return a.diff - b.diff; });
  var best = sorted.slice(0, useCount);
  var avg = best.reduce(function(s, d) { return s + d.diff; }, 0) / useCount;

  // Apply adjustment for small sample
  var adjustment = 0;
  if (n <= 3) adjustment = -2;
  else if (n <= 5) adjustment = -1;
  else if (n <= 6) adjustment = -0.5;

  var index = Math.round((avg + adjustment) * 10) / 10;
  if (index < 0) index = 0; // Floor at 0

  return { index: index, differentials: diffs, useCount: useCount, best: best, msg: 'Best ' + useCount + ' of ' + n + ' rounds' };
}

window.showDashSub = showDashSub;
// The page's Back button, while a dashboard is on screen: out of a category's
// stats to the bars, then out of a single round to all rounds. False when
// there's nothing to step out of, so Back leaves the page.
export function dashBack() {
  var t = _dash && document.getElementById(_dash.targetId || 'dashContent');
  if (!t || !t.offsetParent) return false;
  for (var i = 1; i < 6; i++) { var el = document.getElementById('dsub_' + i); if (el && el.style.display !== 'none') { showDashSub(0); return true; } }
  if (_dash.single) { dashAllRounds(); return true; }
  return false;
}
window.dashBack = dashBack;

// Stats Dashboard, ported from the coaching app's dashboard (same tabs, tables
// and radar charts). This app's GPS rounds are converted into the coaching
// app's shot-by-shot round format first, then the ported code renders them.

import { h, courseById } from './app.js';
import { sync, levelFromPref } from './store.js';
import { expected } from './sg.js';
import { yards } from './geo.js';
import { historyRounds } from './rounds.js';

const S = {}; // shared state for the ported dashboard and radar code
var hcpLabels = { 'pro': 'Tour Pro', '0': 'Scratch', '5': '5 HCP', '10': '10 HCP', '15': '15 HCP', '20': '20 HCP', '25': '25 HCP', '30': '30 HCP' };
const lvl = hcp => levelFromPref(hcp) || 'Pro';
function getExpectedPutts(ft, hcp) { return ft <= 0 ? 0 : expected('green', ft, lvl(hcp)); }
function getExpectedStrokes(dist, lie, hcp) {
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
  if (lie === 'water') return 'WATER';
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
  const st = { fwHit: 0, fwOpp: 0, fwLeft: 0, fwRight: 0, girHit: 0, scrMade: 0, scrOpp: 0, bunMade: 0, bunOpp: 0, onePutts: 0, threePutts: 0 };
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
      shots.push({ shotNum: ++num, lie, isPutt,
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
    if (putts.length === 1) st.onePutts++;
    if (putts.length >= 3) st.threePutts++;
  }
  const tee = course.tees.find(t => t.name === r.tee);
  return { id: r.id, round_date: r.date, course_name: r.courseName || course.name, round_type: r.type || 'Casual',
    score, par, to_par: score - par, holes: allHoles.length,
    round_data: { allHoles, stats: st, _selectedTee: tee ? { rm: tee.rating, sm: tee.slope } : null } };
}

// ---------- page ----------

// With `roundId`, shows the stats for that one round (from Round History).
export function renderStatsDashboard(view, renderLogin, roundId) {
  if (!sync.user) return renderLogin(view);
  const only = roundId ? historyRounds().find(r => r.id === roundId) : null;
  const prefOf = l => (l === 'Pro' ? 'pro' : l === 'Scratch' ? '0' : l);
  const sel = (opts, def, onchange) => h('select', { class: 'minisel', style: 'flex:1;min-width:0;', onchange }, opts.map(([v, l]) => h('option', { value: v, selected: v === def }, l)));
  const fType = sel([['all', 'All Rounds'], ['Casual', 'Casual'], ['Tournament', 'Tournament']], 'all', () => draw());
  const fTime = sel([['all', 'All Time'], ['1', 'Last Month'], ['3', 'Last 3 Mo'], ['6', 'Last 6 Mo'], ['12', 'Last Year']], 'all', () => draw());
  const fHcp = sel(['pro', '0', '5', '10', '15', '20', '25', '30'].map(v => [v, 'vs ' + hcpLabels[v]]), sync.level ? prefOf(sync.level) : 'pro', async () => {
    draw();
    try { await sync.setLevel(levelFromPref(fHcp.value)); } catch { /* keep the local choice */ }
  });
  const content = h('div', { id: 'dashContent', style: 'text-align:left;' });
  const back = h('button', { class: 'back-btn-top', 'aria-label': 'Back', onclick: () => { location.hash = only ? '#/history' : '#/'; } });
  back.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>';
  view.replaceChildren(h('div', { class: 'cx top' }, back,
    h('div', { style: 'width:100%;max-width:360px;' },
      h('div', { style: 'font-size:20px;font-weight:800;text-align:center;margin-bottom:6px;' }, only ? '📊 Round Stats' : '📊 Stats Dashboard'),
      only ? h('div', { style: 'font-size:12px;color:#9a9a9a;text-align:center;margin-bottom:6px;' }, `${only.courseName || courseById(only.course).name} · ${only.date}${only.player ? ' · ' + only.player : ''}`) : null,
      h('div', { style: 'display:flex;gap:4px;justify-content:center;margin-bottom:8px;flex-wrap:nowrap;' }, only ? [fHcp] : [fType, fTime, fHcp]),
      content)));

  function draw() {
    const all = (only ? [only] : historyRounds()).map(toCoachRound).filter(r => r.holes > 0)
      .sort((a, b) => (a.round_date < b.round_date ? 1 : a.round_date > b.round_date ? -1 : 0));
    if (!all.length) { content.innerHTML = '<div style="text-align:center;color:#606060;padding:20px;">No rounds saved yet. Finish at least one hole to see stats.</div>'; return; }
    const data = all.filter(r => {
      if (fType.value !== 'all' && r.round_type !== fType.value) return false;
      if (fTime.value !== 'all') { const c = new Date(); c.setMonth(c.getMonth() - +fTime.value); if (new Date(r.round_date + 'T12:00:00') < c) return false; }
      return true;
    });
    if (!data.length) { content.innerHTML = '<div style="text-align:center;color:#606060;padding:20px;">No rounds match these filters.</div>'; return; }
    renderDashboard(data, fHcp.value);
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

// ---------- ported from the coaching app (js/stats/dashboard.js, radar.js, handicap-index.js) ----------

export function renderDashboard(data, hcp, targetId) {
  var content = document.getElementById(targetId || 'dashContent');
  
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
    par3TeePen:0, par45TeePen:0, appPen:0, sgPen:0,
    missShort:0, missLong:0, missLeft:0, missRight:0,
    allPuttRanges: [{min:0,max:3,m:0,t:0,l:'0-3 ft'},{min:4,max:7,m:0,t:0,l:'4-7 ft'},{min:8,max:11,m:0,t:0,l:'8-11 ft'},{min:12,max:15,m:0,t:0,l:'12-15 ft'},{min:16,max:20,m:0,t:0,l:'16-20 ft'},{min:21,max:30,m:0,t:0,l:'21-30 ft'},{min:31,max:40,m:0,t:0,l:'31-40 ft'},{min:41,max:50,m:0,t:0,l:'41-50 ft'},{min:51,max:999,m:0,t:0,l:'50+ ft'}],
    appRanges: [{min:101,max:125,s:[],total:0,l:'101-125'},{min:126,max:150,s:[],total:0,l:'126-150'},{min:151,max:175,s:[],total:0,l:'151-175'},{min:176,max:200,s:[],total:0,l:'176-200'},{min:201,max:225,s:[],total:0,l:'201-225'},{min:226,max:250,s:[],total:0,l:'226-250'},{min:251,max:275,s:[],total:0,l:'251-275'},{min:276,max:999,s:[],total:0,l:'276+'}],
    shortRanges: [{min:0,max:25,s:[],l:'0-25'},{min:26,max:50,s:[],l:'26-50'},{min:51,max:75,s:[],l:'51-75'},{min:76,max:100,s:[],l:'76-100'}],
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
          var isShort = !s.isPutt && db <= 50 && !isTeePar45;
          
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
        }
        if (s.lie==='PENALTY') { var prev5=shots[idx-1]; if(prev5){ if(prev5.shotNum===1){if(h.par===3)A.par3TeePen++;else A.par45TeePen++;}else if(prev5.distanceBefore>100)A.appPen++;else A.sgPen++;} }
        var _db=s.distanceBefore||0;var _isPar45Tee=s.shotNum===1&&(h.par===4||h.par===5);var _isAppAttempt=!s.isPutt&&_db>100&&!_isPar45Tee&&s.lie!=='PENALTY';
        function _gp(sh,i,st){if(st.lie==='HOLED')return 0;var nx=sh[i+1];if(nx&&nx.isPutt&&nx.distanceBefore>0)return nx.distanceBefore;return st.distanceAfter||0;}
        if(_isAppAttempt){A.appRanges.forEach(function(rr){if(_db>=rr.min&&_db<=rr.max){rr.total++;if(s.lie==='GREEN'||s.lie==='HOLED')rr.s.push(_gp(shots,idx,s));}});}
        if (!s.isPutt&&(s.distanceBefore||0)>0&&(s.distanceBefore||0)<=100&&s.lie==='GREEN') { A.shortRanges.forEach(function(rr){if((s.distanceBefore||0)>=rr.min&&(s.distanceBefore||0)<=rr.max)rr.s.push(_gp(shots,idx,s));}); }
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
    A.roundSGs.push({ date:(d2.getMonth()+1)+'/'+d2.getDate(), course:r.course_name, score:r.score, toPar:r.to_par, ott:rOTT, app:rAPP, arg:rARG, putt:rPutt, tot:rOTT+rAPP+rARG+rPutt });
    A.playByPlay.push({ date:(d2.getMonth()+1)+'/'+d2.getDate()+'/'+d2.getFullYear(), course:r.course_name, score:r.score, toPar:r.to_par, holes:roundPBP });
  });
  if (A.drives.length===0) A.shortestDrive=0;
  
  // ===== HELPERS =====
  function ftp(v){if(v===null||v===undefined)return'\u2013';v=Math.round(v*10)/10;return v>0?'+'+v:v===0?'E':''+v;}
  function ftpC(v){return v>0?'#d4706e':v<0?'#00a06d':'#9a9a9a';}
  function pct(nn,dd){return dd>0?Math.round(nn/dd*100)+'%':'\u2013';}
  function davg(arr){return arr.length>0?Math.round(arr.reduce(function(a,b){return a+b;},0)/arr.length):0;}
  function avgF(arr){return arr.length>0?(arr.reduce(function(a,b){return a+b;},0)/arr.length).toFixed(1):'\u2013';}
  function sgFmt(v){return v>=0?'+'+v.toFixed(2):v.toFixed(2);}
  function sgC(v){return v>=0?'#00a06d':'#d4706e';}
  function row(l,v,s){return'<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #282828;"><span style="color:#9a9a9a;">'+l+'</span><span style="font-weight:700;">'+v+(s?' <span style="font-size:11px;color:#606060;">'+s+'</span>':'')+'</span></div>';}
  function hdr(t){return'<div style="font-size:14px;font-weight:800;color:#00b87a;margin:14px 0 4px;border-bottom:2px solid #007a52;padding-bottom:2px;">'+t+'</div>';}
  function tbl(headers,rows){var h='<div style="overflow-x:auto;margin:4px 0;"><table style="width:100%;font-size:12px;border-collapse:collapse;"><tr>';headers.forEach(function(c){h+='<td style="padding:4px 6px;font-weight:700;color:#9a9a9a;border-bottom:1px solid #3d3d3d;">'+c+'</td>';});h+='</tr>';rows.forEach(function(r){h+='<tr>';r.forEach(function(c){h+='<td style="padding:3px 6px;border-bottom:1px solid #282828;">'+c+'</td>';});h+='</tr>';});return h+'</table></div>';}
  function sgRow(l,v,s){return'<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #282828;"><span style="color:#9a9a9a;">'+l+'</span><span style="font-weight:700;color:'+sgC(v)+';">'+sgFmt(v)+(s?' <span style="font-size:11px;color:#606060;">'+s+'</span>':'')+'</span></div>';}
  
  var n=A.n;
  // For SG and non-scoring stats, only count detailed (non-simple) rounds
  var nDetailed = data.filter(function(r){ return !r.round_data || r.round_data.entryMode !== 'simple'; }).length || 1;
  var avg18=A.r18s.length>0?avgF(A.r18s):'\u2013';
  var avg18tp=A.r18tp.length>0?A.r18tp.reduce(function(a,b){return a+b;},0)/A.r18tp.length:null;
  var avg9=A.r9s.length>0?avgF(A.r9s):'\u2013';
  var avg9tp=A.r9tp.length>0?A.r9tp.reduce(function(a,b){return a+b;},0)/A.r9tp.length:null;
  var bestStr=A.bestRound?A.bestRound.score+' ('+ftp(A.bestRound.to_par)+') \u2014 '+A.bestRound.course_name:'\u2013';
  var avgDrv=davg(A.drives);
  var avgFirstPutt=davg(A.firstPuttDists);
  // Rounds and holes that have fairway / green / putt stats (everything except score-only rounds)
  var nWithStats = data.filter(function(r){ var rd = r.round_data; return !rd || rd.entryMode !== 'simple' || rd.basicStats === true; }).length || 1;
  var detailedHoles = data.reduce(function(sum, r) { return sum + (r.round_data && r.round_data.entryMode === 'simple' && r.round_data.basicStats !== true ? 0 : (r.round_data && r.round_data.allHoles ? r.round_data.allHoles.length : 0)); }, 0);
  var twoPutts=detailedHoles-A.onePutt-A.threePutt;
  var sgTot=A.sgOTT+A.sgAPP+A.sgARG+A.sgPutt;
  
  // Store SG data for radar chart (per round averages, exclude simple rounds)
  S.dashSGData = {
    tot: sgTot/nDetailed,
    ott: A.sgOTT/nDetailed,
    app: A.sgAPP/nDetailed,
    arg: A.sgARG/nDetailed,
    putt: A.sgPutt/nDetailed
  };
  
  // Store all radar chart data
  S.dashRadarData = {
    // Scoring
    birdieAvg: A.birdies/n,
    scoringAvg: avg18 || (A.totScore/n),
    par5Avg: A.c5 ? A.p5/A.c5 : 5,
    par4Avg: A.c4 ? A.p4/A.c4 : 4,
    par3Avg: A.c3 ? A.p3/A.c3 : 3,
    // Driving
    sgOTT: A.sgOTT/nDetailed,
    missRight: A.fwOpp > 0 ? Math.round(A.fwRight/A.fwOpp*100) : 0,
    accuracy: A.fwOpp > 0 ? Math.round(A.fwHit/A.fwOpp*100) : 0,
    avgDistance: avgDrv,
    missLeft: A.fwOpp > 0 ? Math.round(A.fwLeft/A.fwOpp*100) : 0,
    // Approach
    girPct: detailedHoles > 0 ? Math.round(A.girHit/detailedHoles*100) : 0,
    sgAPP: A.sgAPP/nDetailed,
    proxOutside100: A.appRanges.filter(function(r){return r.min>=100;}).reduce(function(sum,r){return sum.concat(r.s);},[]).length > 0 ? davg(A.appRanges.filter(function(r){return r.min>=100;}).reduce(function(sum,r){return sum.concat(r.s);},[])) : 30,
    proxInside100: A.shortRanges.reduce(function(sum,r){return sum.concat(r.s);},[]).length > 0 ? davg(A.shortRanges.reduce(function(sum,r){return sum.concat(r.s);},[])) : 20,
    proximity: A.girHit > 0 ? Math.round(A.girFirstPuttDist/A.girHit) : 30,
    // ARG
    scrambling: A.scrOpp > 0 ? Math.round(A.scrMade/A.scrOpp*100) : 0,
    sgARG: A.sgARG/nDetailed,
    scrFromRough: A.scrOpp > 0 ? Math.round(A.scrMade/A.scrOpp*100) : 0,
    sandSave: A.bunOpp > 0 ? Math.round(A.bunMade/A.bunOpp*100) : 0,
    scr30In: A.scrOpp > 0 ? Math.round(A.scrMade/A.scrOpp*100) : 0,
    // Putting
    puttsPerRound: A.totPutts/nWithStats,
    make9ft: A.allPuttRanges[0].t + A.allPuttRanges[1].t + A.allPuttRanges[2].t > 0 ? Math.round((A.allPuttRanges[0].m + A.allPuttRanges[1].m + A.allPuttRanges[2].m) / (A.allPuttRanges[0].t + A.allPuttRanges[1].t + A.allPuttRanges[2].t) * 100) : 70,
    sgPutt: A.sgPutt/nDetailed,
    avgMadeDist: A.longestMadePutt > 0 ? Math.min(A.longestMadePutt/2, 15) : 5,
    threePuttAvoid: A.holes > 0 ? Math.round((1 - A.threePutt/A.holes) * 100) : 90,
    onePuttPct: A.holes > 0 ? Math.round(A.onePutt/A.holes*100) : 30
  };
  
  // Handicap label
  var hcpLabel=hcpLabels[hcp]||hcp;

  // ===== COACHING-STYLE TABS =====
  var html='';
  var tabNames=['SG','Scoring','OTT','Approach','ARG','Putting'];
  html+='<div style="display:flex;gap:0;width:100%;flex-shrink:0;border-radius:10px;overflow:hidden;margin-bottom:12px;">';
  for(var ti=0;ti<tabNames.length;ti++){
    var isActive=ti===0;
    html+='<button onclick="showDashSub('+ti+')" id="dashTab_'+ti+'" style="flex:1;height:36px;font-size:10px;font-weight:700;background:'+(isActive?'#2d7abc':'#282828')+';border-radius:0;border:none;color:'+(isActive?'#ffffff':'#606060')+';max-width:none;width:auto;padding:0 2px;margin:0;cursor:pointer;">'+tabNames[ti]+'</button>';
  }
  html+='</div>';
  
  // ===== TAB 0: STROKES GAINED =====
  html+='<div id="dsub_0" class="dsubContent">';
  html+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
     + '<canvas id="sgRadarDash" style="display:block; margin:0 auto;"></canvas>'
     + '</div>';
  html+=hdr('STROKES GAINED vs '+hcpLabel);
  html+=sgRow('SG: Total', sgTot/n, '/round');
  html+=sgRow('SG: Off The Tee', A.sgOTT/n, '/round');
  html+=sgRow('SG: Approach', A.sgAPP/n, '/round');
  html+=sgRow('SG: Around Green', A.sgARG/n, '/round');
  html+=sgRow('SG: Putting', A.sgPutt/n, '/round');
  html+=hdr('TOTALS ('+n+' rounds)');
  html+=sgRow('SG: Total', sgTot);
  html+=sgRow('SG: Off The Tee', A.sgOTT);
  html+=sgRow('SG: Approach', A.sgAPP);
  html+=sgRow('SG: Around Green', A.sgARG);
  html+=sgRow('SG: Putting', A.sgPutt);
  html+=hdr('SG BY ROUND');
  var sgRR=[];
  for(var si=0;si<Math.min(A.roundSGs.length,15);si++){var sr=A.roundSGs[si];sgRR.push([sr.date,sr.course.substring(0,12),'<span style="color:'+sgC(sr.tot)+'">'+sgFmt(sr.tot)+'</span>','<span style="color:'+sgC(sr.ott)+'">'+sgFmt(sr.ott)+'</span>','<span style="color:'+sgC(sr.app)+'">'+sgFmt(sr.app)+'</span>','<span style="color:'+sgC(sr.arg)+'">'+sgFmt(sr.arg)+'</span>','<span style="color:'+sgC(sr.putt)+'">'+sgFmt(sr.putt)+'</span>']);}
  html+=tbl(['Date','Course','Tot','OTT','APP','ARG','Putt'],sgRR);
  html+='</div>';
  
  // ===== TAB 1: SCORING =====
  html+='<div id="dsub_1" class="dsubContent" style="display:none;">';
  html+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
     + '<canvas id="scoringRadarDash" style="display:block; margin:0 auto;"></canvas>'
     + '</div>';
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
  html+='</div>';
  
  // ===== TAB 2: OFF THE TEE =====
  html+='<div id="dsub_2" class="dsubContent" style="display:none;">';
  html+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
     + '<canvas id="drivingRadarDash" style="display:block; margin:0 auto;"></canvas>'
     + '</div>';
  html+=hdr('SG: OFF THE TEE vs '+hcpLabel);
  html+=sgRow('Total',A.sgOTT,nDetailed+' rounds');
  html+=sgRow('Per Round',A.sgOTT/nDetailed);
  html+=hdr('FAIRWAY ACCURACY');
  html+=row('Fairways Hit',pct(A.fwHit,A.fwOpp),A.fwHit+'/'+A.fwOpp);
  html+=row('Missed Left',A.fwLeft,pct(A.fwLeft,A.fwOpp));
  html+=row('Missed Right',A.fwRight,pct(A.fwRight,A.fwOpp));
  html+=hdr('DRIVING DISTANCE');
  html+=row('Average',avgDrv+' yds',A.drives.length+' drives');
  html+=row('Longest',A.longestDrive+' yds');
  html+=row('Shortest',A.shortestDrive+' yds');
  html+=hdr('PENALTIES OFF THE TEE');
  html+=row('Par 3 Tee Penalties',A.par3TeePen);
  html+=row('Par 4/5 Tee Penalties',A.par45TeePen);
  html+='</div>';
  
  // ===== TAB 3: APPROACH =====
  html+='<div id="dsub_3" class="dsubContent" style="display:none;">';
  html+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
     + '<canvas id="approachRadarDash" style="display:block; margin:0 auto;"></canvas>'
     + '</div>';
  html+=hdr('SG: APPROACH vs '+hcpLabel);
  html+=sgRow('Total',A.sgAPP,nDetailed+' rounds');
  html+=sgRow('Per Round',A.sgAPP/nDetailed);
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
  var appRows=[];A.appRanges.forEach(function(r){if(r.total>0)appRows.push([r.l+' yds',r.total+' shots',r.s.length>0?davg(r.s)+' ft':'\u2013']);});
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
  html+='</div>';
  
  // ===== TAB 4: SHORT GAME =====
  html+='<div id="dsub_4" class="dsubContent" style="display:none;">';
  html+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
     + '<canvas id="argRadarDash" style="display:block; margin:0 auto;"></canvas>'
     + '</div>';
  html+=hdr('SG: AROUND THE GREEN vs '+hcpLabel);
  html+=sgRow('Total',A.sgARG,nDetailed+' rounds');
  html+=sgRow('Per Round',A.sgARG/nDetailed);
  html+=hdr('SCRAMBLING');
  html+=row('Scrambling',pct(A.scrMade,A.scrOpp),A.scrMade+'/'+A.scrOpp);
  html+=row('Bunker Saves',pct(A.bunMade,A.bunOpp),A.bunMade+'/'+A.bunOpp);
  html+=row('Avg Bunker Proximity',A.bunkerProx.length>0?davg(A.bunkerProx)+' ft':'\u2013',A.bunkerProx.length+' shots');
  html+=hdr('SHORT GAME BY DISTANCE');
  var sgRows2=[];A.shortRanges.forEach(function(r){if(r.s.length>0)sgRows2.push([r.l+' yds',r.s.length+' shots',davg(r.s)+' ft']);});
  html+=tbl(['Distance','Shots','Avg Proximity'],sgRows2);
  html+=hdr('PENALTIES AROUND GREEN');
  html+=row('Short Game Penalties',A.sgPen);
  html+='</div>';
  
  // ===== TAB 5: PUTTING =====
  html+='<div id="dsub_5" class="dsubContent" style="display:none;">';
  html+='<div style="background:#222222; border-radius:12px; padding:10px; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">'
     + '<canvas id="puttingRadarDash" style="display:block; margin:0 auto;"></canvas>'
     + '</div>';
  html+=hdr('SG: PUTTING vs '+hcpLabel);
  html+=sgRow('Total',A.sgPutt,nDetailed+' rounds');
  html+=sgRow('Per Round',A.sgPutt/nDetailed);
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
  html+='</div>';
  
  content.innerHTML=html;
  
  // Render radar chart on initial load
  setTimeout(function(){
    var canvas=document.getElementById('sgRadarDash');
    if(canvas && S.dashSGData) renderSGRadarDash(canvas, S.dashSGData);
  },50);
}

function showDashSub(idx) {
  for(var i=0;i<6;i++){
    var el=document.getElementById('dsub_'+i);
    if(el)el.style.display=i===idx?'block':'none';
    var tab=document.getElementById('dashTab_'+i);
    if(tab){tab.style.background=i===idx?'#2d7abc':'#282828';tab.style.color=i===idx?'#ffffff':'#606060';}
  }
  
  setTimeout(function(){
    if(idx===0){
      var canvas=document.getElementById('sgRadarDash');
      if(canvas && S.dashSGData) renderSGRadarDash(canvas, S.dashSGData);
    } else if(idx===1 && S.dashRadarData){
      renderScoringRadar();
    } else if(idx===2 && S.dashRadarData){
      renderDrivingRadar();
    } else if(idx===3 && S.dashRadarData){
      renderApproachRadar();
    } else if(idx===4 && S.dashRadarData){
      renderARGRadar();
    } else if(idx===5 && S.dashRadarData){
      renderPuttingRadar();
    }
  },50);
}


var _sgRadarChartFullInstance = null;
var _sgRadarDashInstance = null;
var _sgRadarSummaryInstance = null;

function renderSGRadar(canvas, values, instance) {
  if (instance && instance.destroy) instance.destroy();
  
  var size = 300;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  var cx = size / 2;
  var cy = size / 2;
  var radius = 95;
  var rings = 4;
  var n = values.length;
  var startAngle = -Math.PI / 2;
  var rawLabels = ['SG:TOTAL', 'SG:OTT', 'SG:APP', 'SG:ARG', 'SG:PUTT'];
  
  // Find scale range
  var absMax = 0.5;
  for (var i = 0; i < n; i++) { absMax = Math.max(absMax, Math.abs(values[i])); }
  absMax = Math.ceil(absMax * 2) / 2;
  if (absMax < 1) absMax = 1;
  var scaleMax = absMax;
  
  ctx.clearRect(0, 0, size, size);
  
  // Draw rings
  for (var r = 1; r <= rings; r++) {
    var rr = (radius / rings) * r;
    ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var angle = startAngle + (2 * Math.PI / n) * (i % n);
      var x = cx + rr * Math.cos(angle);
      var y = cy + rr * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#3d3d3d';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  
  // Draw angle lines
  for (var i = 0; i < n; i++) {
    var angle = startAngle + (2 * Math.PI / n) * i;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  
  // Draw zero ring (middle circle) 
  var zeroR = radius / 2;
  ctx.beginPath();
  for (var i = 0; i <= n; i++) {
    var angle = startAngle + (2 * Math.PI / n) * (i % n);
    var x = cx + zeroR * Math.cos(angle);
    var y = cy + zeroR * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = '#606060';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw data polygon - map values from [-scaleMax, +scaleMax] to [0, radius]
  ctx.beginPath();
  for (var i = 0; i < n; i++) {
    var angle = startAngle + (2 * Math.PI / n) * i;
    var normalized = ((values[i] + scaleMax) / (2 * scaleMax));
    normalized = Math.max(0, Math.min(1, normalized));
    var dr = normalized * radius;
    var x = cx + dr * Math.cos(angle);
    var y = cy + dr * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(46, 125, 50, 0.15)';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Draw data points and labels
  for (var i = 0; i < n; i++) {
    var angle = startAngle + (2 * Math.PI / n) * i;
    var normalized = ((values[i] + scaleMax) / (2 * scaleMax));
    normalized = Math.max(0, Math.min(1, normalized));
    var dr = normalized * radius;
    var px = cx + dr * Math.cos(angle);
    var py = cy + dr * Math.sin(angle);
    
    var color = values[i] >= 0 ? '#007a52' : '#e06060';
    
    // Point dot
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Label
    var labelR = radius + 22;
    var lx = cx + labelR * Math.cos(angle);
    var ly = cy + labelR * Math.sin(angle);
    
    var sign = values[i] >= 0 ? '+' : '';
    var labelColor = values[i] >= 0 ? '#00a06d' : '#d4706e';
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = labelColor;
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillText(rawLabels[i], lx, ly - 7);
    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.fillText('(' + sign + values[i].toFixed(1) + ')', lx, ly + 7);
  }
  
  return { destroy: function() { ctx.clearRect(0, 0, canvas.width, canvas.height); } };
}

export function renderSGRadarChartFull(canvas) {
  var sgTot = S.sgOTTTotal + S.sgAPPTotal + S.sgARGTotal + S.sgPuttingTotal;
  var values = [sgTot, S.sgOTTTotal, S.sgAPPTotal, S.sgARGTotal, S.sgPuttingTotal];
  _sgRadarChartFullInstance = renderSGRadar(canvas, values, _sgRadarChartFullInstance);
}

export function renderSGRadarDash(canvas, data) {
  var values = [data.tot, data.ott, data.app, data.arg, data.putt];
  _sgRadarDashInstance = renderSGRadar(canvas, values, _sgRadarDashInstance);
}

export function renderSGRadarSummary() {
  var canvas = document.getElementById('sgRadarSummary');
  if (!canvas) return;
  var sgTot = S.sgOTTTotal + S.sgAPPTotal + S.sgARGTotal + S.sgPuttingTotal;
  var values = [sgTot, S.sgOTTTotal, S.sgAPPTotal, S.sgARGTotal, S.sgPuttingTotal];
  _sgRadarSummaryInstance = renderSGRadar(canvas, values, _sgRadarSummaryInstance);
}

// ===== NEW CATEGORY RADAR CHARTS =====
var _scoringRadarInstance = null;
var _drivingRadarInstance = null;
var _approachRadarInstance = null;
var _argRadarInstance = null;
var _puttingRadarInstance = null;

function normalizeValue(val, min, max, higherIsBetter) {
  var clamped = Math.max(min, Math.min(max, val));
  var pct = (clamped - min) / (max - min) * 100;
  return higherIsBetter ? pct : (100 - pct);
}

function getRadarColor(normalizedVal) {
  if (normalizedVal >= 60) return '#00b87a';  // Green - good
  if (normalizedVal >= 40) return '#ffffff';  // White - average
  return '#d4706e';  // Red - bad
}

function createCategoryRadar(canvasId, labels, rawData, units, scales, instanceVar) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  
  if (instanceVar && instanceVar.destroy) instanceVar.destroy();
  
  // Fixed dimensions
  var size = 300;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  var cx = size / 2;
  var cy = size / 2;
  var radius = 95;
  var rings = 4;
  var n = labels.length;
  var startAngle = -Math.PI / 2;
  
  var normalizedData = rawData.map(function(val, i) {
    var s = scales[i];
    return normalizeValue(val, s.min, s.max, s.higher);
  });
  var colorData = normalizedData.map(function(v, i) {
    return scales[i].invertColor ? (100 - v) : v;
  });
  
  ctx.clearRect(0, 0, size, size);
  
  // Draw rings
  for (var r = 1; r <= rings; r++) {
    var rr = (radius / rings) * r;
    ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var angle = startAngle + (2 * Math.PI / n) * (i % n);
      var x = cx + rr * Math.cos(angle);
      var y = cy + rr * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#3d3d3d';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  
  // Draw angle lines
  for (var i = 0; i < n; i++) {
    var angle = startAngle + (2 * Math.PI / n) * i;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  
  // Draw data polygon
  ctx.beginPath();
  for (var i = 0; i < n; i++) {
    var angle = startAngle + (2 * Math.PI / n) * i;
    var val = Math.max(0, Math.min(100, normalizedData[i]));
    var dr = (val / 100) * radius;
    var x = cx + dr * Math.cos(angle);
    var y = cy + dr * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(46, 125, 50, 0.15)';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Draw data points and labels
  for (var i = 0; i < n; i++) {
    var angle = startAngle + (2 * Math.PI / n) * i;
    var val = Math.max(0, Math.min(100, normalizedData[i]));
    var dr = (val / 100) * radius;
    var px = cx + dr * Math.cos(angle);
    var py = cy + dr * Math.sin(angle);
    
    // Point dot
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, 2 * Math.PI);
    ctx.fillStyle = getRadarColor(colorData[i]);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Label
    var labelR = radius + 22;
    var lx = cx + labelR * Math.cos(angle);
    var ly = cy + labelR * Math.sin(angle);
    
    var displayVal = typeof rawData[i] === 'number' ? (Number.isInteger(rawData[i]) ? rawData[i] : rawData[i].toFixed(1)) : rawData[i];
    var labelText = labels[i];
    var valueText = '(' + displayVal + (units[i] || '') + ')';
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = getRadarColor(colorData[i]);
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillText(labelText, lx, ly - 7);
    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.fillText(valueText, lx, ly + 7);
  }
  
  return { destroy: function() { ctx.clearRect(0, 0, canvas.width, canvas.height); } };
}

export function renderScoringRadar() {
  var d = S.dashRadarData;
  if (!d) return;
  _scoringRadarInstance = createCategoryRadar('scoringRadarDash',
    ['Birdie Avg', 'Scoring Avg', 'Par 5 Avg', 'Par 4 Avg', 'Par 3 Avg'],
    [d.birdieAvg, d.scoringAvg, d.par5Avg, d.par4Avg, d.par3Avg],
    ['/rd', '', '', '', ''],
    [
      {min: 0, max: 5, higher: true},
      {min: 65, max: 120, higher: false},
      {min: 4, max: 8, higher: false},
      {min: 3, max: 7, higher: false},
      {min: 2, max: 6, higher: false}
    ],
    _scoringRadarInstance
  );
}

export function renderDrivingRadar() {
  var d = S.dashRadarData;
  if (!d) return;
  _drivingRadarInstance = createCategoryRadar('drivingRadarDash',
    ['SG: OTT', 'Miss Right', 'Accuracy', 'Avg Distance', 'Miss Left'],
    [d.sgOTT, d.missRight, d.accuracy, d.avgDistance, d.missLeft],
    ['', '%', '%', ' yds', '%'],
    [
      {min: -5, max: 5, higher: true},
      {min: 5, max: 50, higher: true, invertColor: true},
      {min: 30, max: 80, higher: true},
      {min: 150, max: 320, higher: true},
      {min: 5, max: 50, higher: true, invertColor: true}
    ],
    _drivingRadarInstance
  );
}

export function renderApproachRadar() {
  var d = S.dashRadarData;
  if (!d) return;
  _approachRadarInstance = createCategoryRadar('approachRadarDash',
    ['GIR %', 'SG: APP', 'Outside 100', 'Inside 100', 'Proximity'],
    [d.girPct, d.sgAPP, d.proxOutside100, d.proxInside100, d.proximity],
    ['', '', ' ft', ' ft', ' ft'],
    [
      {min: 20, max: 80, higher: true},
      {min: -5, max: 5, higher: true},
      {min: 15, max: 50, higher: false},
      {min: 5, max: 30, higher: false},
      {min: 10, max: 45, higher: false}
    ],
    _approachRadarInstance
  );
}

export function renderARGRadar() {
  var d = S.dashRadarData;
  if (!d) return;
  _argRadarInstance = createCategoryRadar('argRadarDash',
    ['Scrambling', 'SG: ARG', 'From Rough', 'Sand Save', '30 Yds & In'],
    [d.scrambling, d.sgARG, d.scrFromRough, d.sandSave, d.scr30In],
    ['%', '', '%', '%', '%'],
    [
      {min: 20, max: 70, higher: true},
      {min: -5, max: 5, higher: true},
      {min: 20, max: 70, higher: true},
      {min: 10, max: 60, higher: true},
      {min: 10, max: 60, higher: true}
    ],
    _argRadarInstance
  );
}

export function renderPuttingRadar() {
  var d = S.dashRadarData;
  if (!d) return;
  _puttingRadarInstance = createCategoryRadar('puttingRadarDash',
    ['Putts/Round', 'Make %<9ft', 'SG: Putt', 'Avg Made Dist', '3-Putt Avoid', 'One-Putt %'],
    [d.puttsPerRound, d.make9ft, d.sgPutt, d.avgMadeDist, d.threePuttAvoid, d.onePuttPct],
    ['', '%', '', ' ft', '%', ''],
    [
      {min: 26, max: 38, higher: false},
      {min: 50, max: 95, higher: true},
      {min: -5, max: 5, higher: true},
      {min: 3, max: 15, higher: true},
      {min: 80, max: 100, higher: true},
      {min: 20, max: 50, higher: true}
    ],
    _puttingRadarInstance
  );
}

// ===== FULL STATS RADAR CHART FUNCTIONS =====
var _scoringRadarFullInstance = null;
var _drivingRadarFullInstance = null;
var _approachRadarFullInstance = null;
var _argRadarFullInstance = null;
var _puttingRadarFullInstance = null;


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

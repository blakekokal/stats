import { errText } from '../store.js';
import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { showAuthPage } from '../coaching/core.js';
import { showStudentTab } from '../coaching/student-view.js';
import { _evalState, evalCaptureResult, evalRender } from './eval-test.js';
import { show } from '../coaching/core.js';
import { activeUserId } from '../coaching/core.js';
import { _sb } from '../coaching/core.js';
import { getTodayCentral } from '../coaching/core.js';
import { combChipScenarios, combPutDistances } from '../coaching/data-combines.js';
import { setPracticeHubTab } from '../practice/hub.js';
import { ppHideAllViews } from '../practice/plans.js';
import { getExpectedPutts, getExpectedStrokes } from '../coaching/sg-calc.js';
import { ic } from '../icons.js';

/* ── State ── */
let combCurMode='custom', combCurType='', combWedgeMode='sg', combState={};

function combVis(id,show){
  var el=document.getElementById(id);
  if(el){ el.style.display=show?(id==='comb-wedge-score-grp'||id==='comb-wedge-range-grp'||id==='comb-putting-type-grp'||id==='comb-wedge-type-grp'?'flex':''):'none'; }
}

var _combHcpToSgKey = {'Tour Pro':'pro','Scratch':'0','5':'5','10':'10','15':'15','20':'20','25':'25','30':'30'};
var _combLieToSgLie = {'Fairway':'FAIRWAY','Rough':'ROUGH','Sand':'SAND'};

function combGetE(t,d,l,h){
  var sgKey = _combHcpToSgKey[h] || 'pro';
  if(t==='putting'){
    return getExpectedPutts(d, sgKey);
  }
  // Chipping — use full sg data tables via getExpectedStrokes
  var sgLie = _combLieToSgLie[l] || 'FAIRWAY';
  return getExpectedStrokes(d, sgLie, sgKey);
}

function combFmt(v){
  return v>0 ? '<span class="comb-pos">+'+v.toFixed(2)+'</span>' : '<span class="comb-neg">'+v.toFixed(2)+'</span>';
}

function combGenPuttBreaks(n){
  var slopes=['Uphill','Flat','Downhill'];
  var dirs=['Straight','L to R','R to L'];
  var combos=[];
  for(var s=0;s<slopes.length;s++)
    for(var d=0;d<dirs.length;d++)
      combos.push(dirs[d]==='Straight'?slopes[s]:slopes[s]+', '+dirs[d]);
  var result=[], pool=[];
  for(var i=0;i<n;i++){
    if(!pool.length) pool=combos.slice().sort(function(){return Math.random()-.5;});
    result.push(pool.pop());
  }
  return result;
}

function combGenUnique(n,min,max,gap){
  var res=[],pool=Array.from({length:max-min+1},(_,i)=>i+min);
  for(var i=0;i<n;i++){
    var ok=pool.filter(x=>res.length===0||Math.abs(x-res[res.length-1])>=gap);
    if(!ok.length) ok=pool;
    var p=ok[Math.floor(Math.random()*ok.length)];
    res.push(p); pool=pool.filter(x=>x!==p);
  }
  return res;
}
var _combFromDriverTab = false; // which practice view to return to

function combHeaderBack() {
  var trackerVisible = document.getElementById('comb-tracker-view').style.display !== 'none';
  var modeSelectVisible = document.getElementById('comb-mode-select').style.display !== 'none';
  var shortGameVisible = document.getElementById('comb-shortgame-select').style.display !== 'none';
  // During an Evaluation Test, any combine sub-screen returns to the Eval checklist
  if (_evalState && _evalState.active && (trackerVisible || modeSelectVisible || shortGameVisible)) {
    combGoHome();
    show('evalCombinePage');
    evalRender();
    return;
  }
  if ((_combFromDriverTab || S.combFromPracticeHub) && (trackerVisible || modeSelectVisible || shortGameVisible)) {
    var returnView = S.combReturnToView;
    _combFromDriverTab = false;
    S.combFromPracticeHub = false;
    S.combReturnToView = null;
    combGoHome();
    show('practiceHubPage');
    if (returnView) {
      setPracticeHubTab('plan');
      ppHideAllViews();
      var el = document.getElementById(returnView);
      if (el) el.style.display = '';
    } else {
      setPracticeHubTab('combines');
    }
    return;
  }
  if (trackerVisible) {
    combGoHome();
    // Players land on the Practice Hub combines list, not the legacy type grid
    if (!S.combSaveForStudent) {
      show('practiceHubPage');
      setPracticeHubTab('combines');
    }
  } else if (modeSelectVisible) {
    combModeBack();
  } else if (shortGameVisible) {
    combShortGameBack();
  } else if (S.combSaveForStudent) {
    // Coach was running combine for student — go back to student profile
    var banner = document.getElementById('combStudentBanner');
    if (banner) banner.style.display = 'none';
    S.combSaveForStudent = null;
    show('studentViewPage');
    showStudentTab('combines');
  } else {
    show('practiceHubPage');
  }
}

function combShowShortGameSelect() {
  document.getElementById('comb-practice-sub').style.display = 'none';
  document.getElementById('comb-shortgame-select').style.display = '';
}

function combShortGameBack() {
  document.getElementById('comb-shortgame-select').style.display = 'none';
  document.getElementById('comb-practice-sub').style.display = '';
}

// The page heading: which combine this is.
export function combSetPageTitle(type) {
  var t = { putting: 'Putting', wedge: 'Wedge', driver: 'Driver', 'chip-prox': 'Short Game', 'chip-hole': 'Short Game', shortgame: 'Short Game' }[type];
  var el = document.getElementById('comb-page-title');
  if (el) el.textContent = t ? t + ' Combine' : 'Combines';
}

export function combShowModeSelect(type) {
  combSetPageTitle(type);
  // During an Evaluation Test, skip the Combine/Custom prompt — open a 9-hole combine directly
  if (_evalState && _evalState.active) {
    combOpen(type, 'combine');
    var hsel = document.getElementById('comb-holes-combine');
    if (hsel) { hsel.value = '9'; combSetup(); }
    return;
  }
  S.combPendingType = type;
  var names = {putting:'Putting','chip-prox':'Proximity Based','chip-hole':'Up & Downs',wedge:'Wedge',driver:'Driver'};
  document.getElementById('comb-mode-type-label').textContent = names[type];
  S.combFromShortGame = (type === 'chip-prox' || type === 'chip-hole');
  document.getElementById('comb-practice-sub').style.display = 'none';
  document.getElementById('comb-shortgame-select').style.display = 'none';
  document.getElementById('comb-mode-select').style.display = '';
}

function combModeBack() {
  document.getElementById('comb-mode-select').style.display = 'none';
  if (S.combFromShortGame) {
    document.getElementById('comb-shortgame-select').style.display = '';
  } else {
    document.getElementById('comb-practice-sub').style.display = '';
  }
  S.combPendingType = null;
  S.combFromShortGame = false;
}

function combOpenFromModeSelect(mode) {
  document.getElementById('comb-mode-select').style.display = 'none';
  combOpen(S.combPendingType, mode);
}

export function combOpen(type, mode) {
  combCurType=type; combCurMode=mode;
  combSetPageTitle(type);
  document.getElementById('comb-home-view').style.display='none';
  document.getElementById('comb-tracker-view').style.display='block';

  var isCombine = mode==='combine', isWedge = type==='wedge', isPut = type==='putting', isDriver = type==='driver';

  // holes selector
  document.getElementById('comb-holes-custom').style.display  = isCombine ? 'none' : '';
  document.getElementById('comb-holes-combine').style.display = isCombine ? '' : 'none';
  document.getElementById('comb-opt-6').style.display = isWedge ? 'none' : '';
  if(isDriver && isCombine) document.getElementById('comb-holes-combine').value = '6';
  if(isDriver && !isCombine) document.getElementById('comb-holes-custom').value = 6;

  // extra controls
  combVis('comb-wedge-score-grp', isWedge);
  combVis('comb-wedge-range-grp', isWedge && !isCombine);
  combVis('comb-putting-type-grp', isPut && isCombine);
  combVis('comb-wedge-type-grp', isWedge && isCombine);

  // title
  var names={putting:'Putting','chip-prox':'Chipping (Prox)','chip-hole':'Chip Hole Out',wedge:'Wedge',driver:'Driver'};
  document.getElementById('comb-title').textContent = names[type] + (isCombine ? ' Combine' : '');

  // strokes box
  document.getElementById('comb-strokes-box').style.display = (type==='putting'||type==='chip-hole') ? '' : 'none';

  // HCP dim for wedge pts mode; hide HCP + expected for driver
  if(isDriver){
    document.getElementById('comb-hcp-group').classList.add('comb-dimmed');
    document.getElementById('comb-exp-box').style.display='none';
    document.getElementById('comb-total-label').textContent = 'Avg Score';
  } else if(isWedge) combSetWedge(combWedgeMode, false);
  else {
    document.getElementById('comb-hcp-group').classList.remove('comb-dimmed');
    document.getElementById('comb-exp-box').style.display='';
    document.getElementById('comb-total-label').textContent = 'Total SG';
  }

  // reset save
  document.getElementById('comb-save-msg').textContent='';
  document.getElementById('comb-save-btn').disabled=false;
  document.getElementById('comb-save-btn').innerHTML=ic('save')+' Save to Profile';

  // Set HCP — use student's HCP if coach is running for a student
  var userHcp;
  if (S.combSaveForStudent && S.combSaveForStudent.hcp) {
    userHcp = S.combSaveForStudent.hcp;
  } else {
    userHcp = (S.currentUser && S.currentUser.user_metadata && S.currentUser.user_metadata.hcp_preference) || 'pro';
  }
  var hcpMap = { 'pro': 'Tour Pro', '0': 'Scratch', '5': '5', '10': '10', '15': '15', '20': '20', '25': '25', '30': '30' };
  var hcpVal = hcpMap[userHcp] || 'Scratch';
  var hcpSel = document.getElementById('comb-handicap');
  if (hcpSel) { for(var oi=0;oi<hcpSel.options.length;oi++) { if(hcpSel.options[oi].value===hcpVal) { hcpSel.selectedIndex=oi; break; } } }

  // Update save button text for student combines
  if (S.combSaveForStudent) {
    var csb = document.getElementById('comb-save-btn'); csb.innerHTML = ic('save'); csb.append(' Save to ' + S.combSaveForStudent.name + "'s Profile");
  }

  combSetup();
}

function combGoHome(){
  document.getElementById('comb-home-view').style.display='';
  document.getElementById('comb-tracker-view').style.display='none';
  // reset all sub-screens
  document.getElementById('comb-mode-select').style.display='none';
  document.getElementById('comb-shortgame-select').style.display='none';
  document.getElementById('comb-practice-sub').style.display='';
  S.combPendingType = null;
  S.combFromShortGame = false;
  // reset meta panel
  document.getElementById('comb-meta-panel').style.display='none';
  document.getElementById('comb-meta-toggle').textContent='＋ Add Date & Note';
  document.getElementById('comb-meta-toggle').style.borderColor='#3d3d3d';
  document.getElementById('comb-meta-toggle').style.color='#606060';
  document.getElementById('comb-date').value='';
  document.getElementById('comb-note').value='';
  document.getElementById('comb-save-msg').textContent='';
}

function combToggleMeta(){
  var panel = document.getElementById('comb-meta-panel');
  var btn   = document.getElementById('comb-meta-toggle');
  var open  = panel.style.display === 'block';
  panel.style.display = open ? 'none' : 'block';
  btn.textContent = open ? '＋ Add Date & Note' : '✕ Hide Date & Note';
  btn.style.borderColor = open ? '#3d3d3d' : '#00b87a';
  btn.style.color = open ? '#606060' : '#ffffff';
}

function combSetup(){
  var isCombine = combCurMode==='combine';
  var holes = isCombine ? +document.getElementById('comb-holes-combine').value
                        : +document.getElementById('comb-holes-custom').value;
  var head = document.getElementById('comb-head');
  var body = document.getElementById('comb-body');
  head.innerHTML=''; body.innerHTML=''; combState={};

  // Build header
  var h = '<tr><th class="comb-hnum">#</th>';
  if(combCurType==='putting')       h+='<th>Dist ft</th><th>Break</th><th>Putts</th><th>Exp</th><th>SG</th>';
  else if(combCurType==='wedge')    h+='<th>Target</th><th>Carry</th><th>Prox ft</th><th class="comb-wsg">Exp S</th><th class="comb-wsg">Exp P</th><th class="comb-wsg">Total</th><th id="comb-w-last">SG</th>';
  else if(combCurType==='chip-prox') h+='<th class="comb-col-dist">Dist yd</th><th class="comb-col-lie">Lie</th><th class="comb-col-score">Prox ft</th><th>Exp S</th><th>Exp P</th><th>Total</th><th>SG</th>';
  else if(combCurType==='driver')   h+='<th>Drive yds</th><th>Offline yds</th><th>Score</th>';
  else h+='<th class="comb-col-dist">Dist yd</th><th class="comb-col-lie">Lie</th><th class="comb-col-score">Score</th><th>Exp</th><th>SG</th>';
  head.innerHTML = h + '<th></th></tr>';

  // Prepare combine data
  var pD=[], wD=[], cS=[];
  var coachOverride = S.coachCombineOverride || null;
  
  // If coach assigned custom shots, use those
  if(coachOverride && coachOverride.shots && coachOverride.shots.length > 0) {
    holes = coachOverride.shots.length;
    // Update the holes selector to match
    if(isCombine) {
      var hsel = document.getElementById('comb-holes-combine');
      // Add custom option if needed
      var hasOpt = false;
      for(var oi=0;oi<hsel.options.length;oi++) if(+hsel.options[oi].value===holes) hasOpt=true;
      if(!hasOpt) { var no=document.createElement('option'); no.value=holes; no.textContent=holes; hsel.appendChild(no); }
      hsel.value = holes;
    } else {
      document.getElementById('comb-holes-custom').value = holes;
    }
    
    if(combCurType==='putting') {
      pD = coachOverride.shots.map(function(s){ return s.dist; });
    } else if(combCurType==='wedge') {
      wD = coachOverride.shots.map(function(s){ return s.dist; });
    } else {
      cS = coachOverride.shots.map(function(s){ return { d: s.dist, l: s.lie || 'Fairway' }; });
    }
    // Show coach info banner
    var titleEl = document.getElementById('comb-title');
    if(titleEl) titleEl.textContent = '[COACH] ' + (coachOverride.coachName || 'Coach') + ' Combine';
    // Clear override so subsequent setups are normal
    S.coachCombineOverride = null;
  } else if(isCombine){
    if(combCurType==='putting'){
      var ptype = document.getElementById('comb-p-type').value;
      pD = combPutDistances[ptype].slice(0,holes).sort(()=>Math.random()-.5);
    }
    if(combCurType==='wedge'){
      var pool9  = [40,50,60,70,80,90,100,110,120];
      var pool18 = [40,45,50,55,60,65,70,75,80,85,90,95,100,105,110,115,120,125];
      wD = (holes<=9 ? [...pool9] : [...pool18]).sort(()=>Math.random()-.5).slice(0,holes);
    }
    var src = combChipScenarios[holes] || combChipScenarios[18].slice(0,holes);
    cS = [...src].sort(()=>Math.random()-.5);
  } else if(combCurType==='wedge'){
    wD = combGenUnique(holes, +document.getElementById('comb-w-min').value, +document.getElementById('comb-w-max').value, 5);
  }

  // Generate putt breaks
  var pBreaks = combCurType==='putting' ? combGenPuttBreaks(holes) : [];

  // Build rows
  var rows='';
  for(var i=1;i<=holes;i++){
    combState[i]={d:'',l:'Fairway',v:'',sg:0,pts:0,exp1:0};
    var r='<tr><td class="comb-hnum">'+i+'</td>';

    if(combCurType==='putting'){
      var pd = isCombine ? pD[i-1] : '';
      combState[i].d = pd;
      combState[i].brk = pBreaks[i-1];
      r += isCombine
        ? '<td class="comb-ro">'+pd+'</td>'
        : '<td class="comb-tap"><input type="number" inputmode="numeric" pattern="[0-9]*" placeholder="–" onchange="combUpd('+i+',\'d\',+this.value)"></td>';
      r += '<td class="comb-ro" style="font-size:.78em;white-space:nowrap;">'+pBreaks[i-1]+'</td>';
      r += '<td><div class="comb-putt-grp" id="cpg-'+i+'"><button class="comb-pbtn" onclick="combSetPutts('+i+',1)">1</button><button class="comb-pbtn" onclick="combSetPutts('+i+',2)">2</button><button class="comb-pbtn" onclick="combSetPutts('+i+',3)">3</button></div></td>';
      r += '<td class="comb-ro" id="ce1-'+i+'">–</td><td class="comb-ro" id="csg-'+i+'">–</td>';

    } else if(combCurType==='wedge'){
      combState[i].d = wD[i-1];
      r += '<td class="comb-ro">'+(wD[i-1]||'')+'</td>';
      r += '<td class="comb-tap"><input type="number" inputmode="numeric" pattern="[0-9]*" placeholder="–" onchange="combUpd('+i+',\'v\',+this.value)"></td>';
      r += '<td class="comb-ro" id="cpx-'+i+'">–</td>';
      r += '<td class="comb-ro comb-wsg" id="ce1-'+i+'">–</td><td class="comb-ro comb-wsg" id="ce2-'+i+'">–</td><td class="comb-ro comb-wsg" id="cts-'+i+'">–</td>';
      r += '<td class="comb-ro" id="csg-'+i+'">–</td>';

    } else if(combCurType==='chip-prox'){
      var cd = isCombine ? cS[i-1].d : '', cl = isCombine ? cS[i-1].l : 'Fairway';
      combState[i].d=cd; combState[i].l=cl;
      r += isCombine
        ? '<td class="comb-ro comb-col-dist">'+cd+'</td><td class="comb-ro comb-col-lie">'+cl+'</td>'
        : '<td class="comb-tap comb-col-dist"><input type="number" inputmode="numeric" pattern="[0-9]*" placeholder="–" onchange="combUpd('+i+',\'d\',+this.value)"></td>'
          +'<td class="comb-col-lie"><select class="comb-sel-cell" onchange="combUpd('+i+',\'l\',this.value)"><option>Fairway</option><option>Rough</option><option>Sand</option></select></td>';
      r += '<td class="comb-tap comb-col-score"><input type="number" inputmode="decimal" placeholder="–" onchange="combUpd('+i+',\'v\',+this.value)"></td>';
      r += '<td class="comb-ro" id="ce1-'+i+'">–</td><td class="comb-ro" id="ce2-'+i+'">–</td><td class="comb-ro" id="cts-'+i+'">–</td><td class="comb-ro" id="csg-'+i+'">–</td>';

    } else if(combCurType==='driver'){
      r += '<td class="comb-tap"><input type="number" inputmode="numeric" pattern="[0-9]*" placeholder="–" onchange="combUpd('+i+',\'d\',+this.value)"></td>';
      r += '<td class="comb-tap"><input type="number" inputmode="numeric" pattern="[0-9]*" placeholder="–" onchange="combUpd('+i+',\'v\',+this.value)"></td>';
      r += '<td class="comb-ro" id="csg-'+i+'">–</td>';

    } else { // chip-hole
      var cd = isCombine ? cS[i-1].d : '', cl = isCombine ? cS[i-1].l : 'Fairway';
      combState[i].d=cd; combState[i].l=cl;
      r += isCombine
        ? '<td class="comb-ro comb-col-dist">'+cd+'</td><td class="comb-ro comb-col-lie">'+cl+'</td>'
        : '<td class="comb-tap comb-col-dist"><input type="number" inputmode="numeric" pattern="[0-9]*" placeholder="–" onchange="combUpd('+i+',\'d\',+this.value)"></td>'
          +'<td class="comb-col-lie"><select class="comb-sel-cell" onchange="combUpd('+i+',\'l\',this.value)"><option>Fairway</option><option>Rough</option><option>Sand</option></select></td>';
      r += '<td class="comb-tap comb-col-score"><input type="number" inputmode="numeric" pattern="[0-9]*" placeholder="–" onchange="combUpd('+i+',\'v\',+this.value)"></td>';
      r += '<td class="comb-ro" id="ce1-'+i+'">–</td><td class="comb-ro" id="csg-'+i+'">–</td>';
    }

    r += '<td><button class="comb-xbtn" onclick="combDelRow('+i+')">✕</button></td></tr>';
    rows += r;
  }
  body.innerHTML = rows;

  if(combCurType==='wedge') combSetWedge(combWedgeMode, false);
  combRecalcAll();
}

function combSetPutts(i,val){
  document.getElementById('cpg-'+i).querySelectorAll('.comb-pbtn').forEach(function(b,idx){
    b.classList.toggle('comb-on', idx+1===val);
  });
  combUpd(i,'v',val);
}

function combDelRow(i){
  delete combState[i];
  document.querySelectorAll('#comb-body tr').forEach(function(row){
    var hn = row.querySelector('.comb-hnum');
    if(hn && +hn.textContent===i) row.remove();
  });
  combUpdateTotals();
}

function combUpd(i,f,v){ combState[i][f]=v; combCalcRow(i); }

function combCalcRow(i){
  var r = combState[i]; if(!r) return;
  var h = document.getElementById('comb-handicap').value;
  if(r.d==='' || r.v==='') return;

  if(combCurType==='putting'){
    r.exp1 = combGetE('putting',r.d,null,h);
    r.sg   = r.exp1 - r.v;
    document.getElementById('ce1-'+i).textContent = r.exp1.toFixed(2);
    document.getElementById('csg-'+i).innerHTML   = combFmt(r.sg);

  } else if(combCurType==='wedge'){
    var px = Math.abs(r.d - r.v) * 3;
    document.getElementById('cpx-'+i).textContent = px.toFixed(1);
    // Always calculate both SG and pts for wedge
    r.pts = Math.max(0, 100-px);
    r.exp1 = combGetE('chipping',r.d,'Fairway',h);
    // Floor proximity at 1 ft for SG: an exact-yardage strike is hit to 1 ft, not holed
    var sgPx = Math.max(1, px);
    var e2 = combGetE('putting',sgPx,null,h), ts = 1+e2;
    r.sg   = r.exp1 - ts;
    if(combWedgeMode==='sg'){
      document.getElementById('ce1-'+i).textContent = r.exp1.toFixed(2);
      document.getElementById('ce2-'+i).textContent = e2.toFixed(2);
      document.getElementById('cts-'+i).textContent = ts.toFixed(2);
      document.getElementById('csg-'+i).innerHTML   = combFmt(r.sg);
    } else {
      document.getElementById('csg-'+i).textContent = r.pts.toFixed(0);
    }

  } else if(combCurType==='chip-prox'){
    r.exp1 = combGetE('chipping',r.d,r.l,h);
    var e2 = combGetE('putting',r.v,null,h), ts = 1+e2;
    r.sg   = r.exp1 - ts;
    document.getElementById('ce1-'+i).textContent = r.exp1.toFixed(2);
    document.getElementById('ce2-'+i).textContent = e2.toFixed(2);
    document.getElementById('cts-'+i).textContent = ts.toFixed(2);
    document.getElementById('csg-'+i).innerHTML   = combFmt(r.sg);

  } else if(combCurType==='driver'){
    r.exp1 = 0;
    r.sg   = r.d - r.v;
    document.getElementById('csg-'+i).textContent = r.sg.toFixed(0);

  } else { // chip-hole
    r.exp1 = combGetE('chipping',r.d,r.l,h);
    r.sg   = r.exp1 - r.v;
    document.getElementById('ce1-'+i).textContent = r.exp1.toFixed(2);
    document.getElementById('csg-'+i).innerHTML   = combFmt(r.sg);
  }
  combUpdateTotals();
}

function combRecalcAll(){ for(var k in combState) combCalcRow(k); }

function combUpdateTotals(){
  var sg=0, e=0, strokes=0, c=0;
  for(var k in combState){
    var r=combState[k];
    if(r.v!==''){
      sg += (combCurType==='wedge' && combWedgeMode==='pts') ? r.pts : r.sg;
      e  += r.exp1;
      strokes += parseFloat(r.v)||0;
      c++;
    }
  }
  document.getElementById('comb-total-exp').textContent = e.toFixed(2);
  var totalEl = document.getElementById('comb-total-val');
  if(combCurType==='driver'){
    totalEl.textContent = c ? (sg/c).toFixed(0) : '0';
  } else if(combCurType==='wedge' && combWedgeMode==='pts'){
    totalEl.textContent = c ? (sg/c).toFixed(1) : '0.0';
  } else {
    totalEl.innerHTML = combFmt(sg);
  }
  if(combCurType==='putting'||combCurType==='chip-hole'){
    document.getElementById('comb-total-strokes').textContent = strokes;
  }
}

function combSetWedge(m, recalc){
  if(recalc===undefined) recalc=true;
  combWedgeMode = m;
  // Toggle SG/pts buttons
  var sgBtn  = document.getElementById('comb-tbtn-sg');
  var ptsBtn = document.getElementById('comb-tbtn-pts');
  if(sgBtn)  { sgBtn.style.background=m==='sg'?'#00b87a':'transparent'; sgBtn.style.color=m==='sg'?'#ffffff':'#606060'; }
  if(ptsBtn) { ptsBtn.style.background=m==='pts'?'#00b87a':'transparent'; ptsBtn.style.color=m==='pts'?'#ffffff':'#606060'; }
  // Dim HCP when in pts mode (layout stays stable)
  document.getElementById('comb-hcp-group').classList.toggle('comb-dimmed', m==='pts');
  // Show/hide wsg columns
  document.querySelectorAll('.comb-wsg').forEach(function(el){ el.style.display = m==='sg' ? '' : 'none'; });
  document.getElementById('comb-exp-box').style.display = m==='sg' ? '' : 'none';
  var wl = document.getElementById('comb-w-last');
  if(wl) wl.textContent = m==='sg' ? 'SG' : 'Score';
  document.getElementById('comb-total-label').textContent = m==='sg' ? 'Total SG' : 'Avg Pts';
  if(recalc) combRecalcAll();
}

/* ── Grade 0-100 calculation ── */
function calcCombGrade(type, wedgeMode, totalSg, filled, totalExp) {
  if (!filled || filled === 0) return null;
  if (type === 'driver') {
    var avgScore = totalSg / filled;
    var grade = (avgScore - 100) / 2;
    return Math.round(Math.max(0, Math.min(100, grade)));
  }
  if (type === 'wedge' && wedgeMode === 'pts') return Math.round(totalSg / filled);
  // SG-based grading: 50 = benchmark (0 SG), scale by SG per shot
  // +0.1 SG/shot = 60, +0.2 = 70, +0.3 = 80, +0.5 = 100
  // -0.1 SG/shot = 40, -0.3 = 20, -0.5 = 0
  var sgPerShot = totalSg / filled;
  var grade = 50 + (sgPerShot * 100);
  return Math.round(Math.max(0, Math.min(100, grade)));
}

export function getCombGradeFromCard(c) {
  // Evaluation Test stores its final 0-100 score directly
  if (c.combine_type === 'Evaluation Test' && c.grade_100 !== null && c.grade_100 !== undefined) {
    return Math.round(c.grade_100);
  }
  // For Line Drill, grade by avg yards offline per shot (lower is better)
  if (c.combine_type === 'Line Drill') {
    if (c.grade_100 !== null && c.grade_100 !== undefined) return Math.round(c.grade_100);
    if (c.avg_pts !== null && c.avg_pts !== undefined) {
      var g = 100 - (c.avg_pts - 2) * 12;
      return Math.round(Math.max(0, Math.min(100, g)));
    }
    return null;
  }
  // For driver combines, grade based on avg score per shot
  if (c.combine_type === 'Driver' && c.avg_pts !== null && c.avg_pts !== undefined) {
    var grade = (c.avg_pts - 100) / 2;
    return Math.round(Math.max(0, Math.min(100, grade)));
  }
  // For wedge combines with avg_pts, use that as the grade (already 0-100)
  if (c.avg_pts !== null && c.avg_pts !== undefined) return Math.round(c.avg_pts);
  // For all other types, calculate from SG
  if (c.total_sg !== null && c.total_sg !== undefined && c.filled_count > 0) {
    var sgPerShot = c.total_sg / c.filled_count;
    var grade = 50 + (sgPerShot * 100);
    return Math.round(Math.max(0, Math.min(100, grade)));
  }
  return null;
}

export function gradeColor(g) {
  if (g >= 80) return '#00b87a';
  if (g >= 60) return '#00b87a';
  if (g >= 40) return '#f0c830';
  if (g >= 20) return '#d4706e';
  return '#d4706e';
}

/* ── SAVE to Supabase ── */
async function combSave(){
  if(!S.currentUser){ showAuthPage(); return; }
  var btn = document.getElementById('comb-save-btn');
  var msg = document.getElementById('comb-save-msg');

  // Gather scores
  var holes=0, totalSg=0, totalExp=0, totalStrokes=0, totalPts=0, filled=0;
  for(var k in combState){
    var r=combState[k];
    holes++;
    if(r.v!==''){
      totalSg      += r.sg || 0;
      totalExp     += r.exp1;
      totalStrokes += parseFloat(r.v)||0;
      totalPts     += r.pts || 0;
      filled++;
    }
  }
  if(filled===0){ msg.style.color='#d4706e'; msg.textContent='Enter at least one score first.'; return; }

  var isCombine = combCurMode==='combine';
  var typeNames = {putting:'Putting','chip-prox':'Chipping (Prox)','chip-hole':'Chip Hole Out',wedge:'Wedge',driver:'Driver'};
  var combineType = typeNames[combCurType] || combCurType;
  var hcp      = document.getElementById('comb-handicap').value;
  var dateVal  = document.getElementById('comb-date').value || getTodayCentral();
  var noteVal  = document.getElementById('comb-note').value || '';

  // If coach is running this for a student, tag the note
  if (S.combSaveForStudent) {
    var coachTag = '[Coach-entered]';
    if (noteVal && noteVal.indexOf(coachTag) === -1) noteVal = coachTag + ' ' + noteVal;
    else if (!noteVal) noteVal = coachTag;
  }

  btn.disabled=true; btn.textContent='Saving...'; msg.textContent='';

  // If coach is running this for a student, save to student's profile
  var saveUserId = (S.combSaveForStudent && S.combSaveForStudent.id) ? S.combSaveForStudent.id : activeUserId();

  var payload = {
    user_id:       saveUserId,
    combine_date:  dateVal,
    combine_type:  combineType,
    is_combine:    isCombine,
    holes_count:   holes,
    filled_count:  filled,
    total_sg:      parseFloat(totalSg.toFixed(3)),
    avg_pts:       (combCurType==='wedge') ? parseFloat((filled?totalPts/filled:0).toFixed(1)) : (combCurType==='driver' ? parseFloat((filled?totalSg/filled:0).toFixed(1)) : null),
    total_exp:     parseFloat(totalExp.toFixed(3)),
    total_strokes: (combCurType==='putting'||combCurType==='chip-hole') ? totalStrokes : null,
    handicap:      hcp,
    score_mode:    combCurType==='driver' ? 'driver' : (combCurType==='wedge' ? combWedgeMode : 'sg'),
    note:          noteVal,
    row_data:      JSON.stringify(combState),
    grade_100:     calcCombGrade(combCurType, combWedgeMode, totalSg, filled, totalExp)
  };

  var resp = await _sb.from('combine_scores').insert(payload);
  if(resp.error){
    btn.disabled=false; btn.innerHTML=ic('save')+' Save to Profile';
    msg.style.color='#d4706e'; msg.textContent=errText(resp.error, 'Save failed: ');
    return;
  }
  btn.textContent='✓ Saved!';

  // Evaluation Test: capture this sub-combine's result
  if(_evalState && _evalState.active){
    var _evalKey = combCurType==='putting' ? 'putting'
      : ((combCurType==='chip-prox'||combCurType==='chip-hole') ? 'shortgame' : null);
    if(_evalKey) evalCaptureResult(_evalKey, payload.grade_100, totalSg);
  }

  // If coach saved for student, show link back
  if (S.combSaveForStudent) {
    msg.style.color='#00b87a'; msg.textContent='Saved to ' + S.combSaveForStudent.name + "'s profile!";
    return;
  }

  msg.style.color='#00b87a'; msg.textContent='Saved! View in History tab.';

  // Notify coach of new combine if student has a coach
  try {
    var { data: prof } = await _sb.from('profiles').select('coach_id, display_name').eq('id', S.currentUser.id).single();
    var coachId = prof && prof.coach_id ? prof.coach_id : null;
    // Fallback: check coach_students table if coach_id not on profile
    if (!coachId) {
      var { data: link } = await _sb.from('coach_students').select('coach_id').eq('student_id', S.currentUser.id).limit(1);
      if (link && link.length > 0) {
        coachId = link[0].coach_id;
        await _sb.from('profiles').update({ coach_id: coachId }).eq('id', S.currentUser.id);
      }
    }
    if (coachId) {
      var playerName = (prof && prof.display_name) || S.currentUser.email || 'A student';
      var { error: insertErr } = await _sb.from('notifications').insert({
        user_id: coachId,
        type: 'new_combine',
        title: 'New Combine from ' + playerName,
        message: playerName + ' completed a ' + combineType + ' ' + (isCombine ? 'combine' : 'practice') + ' (' + filled + ' shots)',
        student_id: S.currentUser.id,
        student_name: playerName,
        read: false,
        created_at: new Date().toISOString()
      });
      if (insertErr) {
        console.warn('[notify] Combine notification insert failed:', insertErr.message, '— retrying without student fields');
        var { error: retryErr } = await _sb.from('notifications').insert({
          user_id: coachId,
          type: 'new_combine',
          title: 'New Combine from ' + playerName,
          message: playerName + ' completed a ' + combineType + ' ' + (isCombine ? 'combine' : 'practice') + ' (' + filled + ' shots)',
          read: false,
          created_at: new Date().toISOString()
        });
        if (retryErr) console.error('[notify] Combine notification retry also failed:', retryErr.message);
      }
    } else {
      console.log('[notify] No coach found for combine notification');
    }
  } catch(e) { console.error('[notify] Combine notification exception:', e); }
}

// Functions called from inline HTML handlers
expose({ combHeaderBack, combShowShortGameSelect, combShowModeSelect, combModeBack, combOpenFromModeSelect, combToggleMeta, combSetup, combSetPutts, combDelRow, combUpd, combRecalcAll, combSetWedge, combSave });

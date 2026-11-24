import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { _evalState, evalCaptureResult } from './eval-test.js';
import { show } from '../coaching/core.js';
import { activeUserId } from '../coaching/core.js';
import { _sb } from '../coaching/core.js';
import { getTodayCentral } from '../coaching/core.js';

/* ============================================
   LINE DRILL — approach accuracy combine
   ============================================ */
var _ldState = {
  version: 'standard', // or 'short'
  totalShots: 20,
  minYds: 140,
  maxYds: 240,
  shots: [],           // [{target, offline, dir}]
  currentTarget: null,
  currentDir: null,
  currentShotIndex: 0, // 0-based
  pool: [],            // shuffled bucket queue, popped per shot, refilled when empty
  lastTarget: null     // remember last shot to avoid back-to-back repeats on refill
};

export function goToLineDrill(){
  show('lineDrillPage');
  lineDrillBackToSetup();
}

function lineDrillBack(){
  show('practiceHubPage');
}

function lineDrillBackToSetup(){
  document.getElementById('ld-setup-view').style.display = '';
  document.getElementById('ld-tracker-view').style.display = 'none';
  document.getElementById('ld-summary-view').style.display = 'none';
  _ldState.shots = [];
  _ldState.currentShotIndex = 0;
  _ldState.currentTarget = null;
  _ldState.currentDir = null;
  document.getElementById('ld-setup-msg').textContent = '';
  document.getElementById('ld-save-msg').textContent = '';
}

export function lineDrillSetVersion(v){
  _ldState.version = v;
  _ldState.totalShots = (v === 'short') ? 10 : 20;
  var stdBtn   = document.getElementById('ld-version-std');
  var shortBtn = document.getElementById('ld-version-short');
  var on  = '#00b87a', onTxt = '#ffffff';
  var off = '#282828', offTxt = '#606060';
  stdBtn.style.background   = v==='standard' ? on  : off;
  stdBtn.style.color        = v==='standard' ? onTxt : offTxt;
  shortBtn.style.background = v==='short' ? on : off;
  shortBtn.style.color      = v==='short' ? onTxt : offTxt;
}

function _ldBuildBuckets(min, max){
  var lo = Math.ceil(min/5)*5;
  var hi = Math.floor(max/5)*5;
  if (hi < lo) { var t=lo; lo=hi; hi=t; }
  var arr = [];
  for (var y = lo; y <= hi; y += 5) arr.push(y);
  return arr;
}

function _ldShuffle(arr){
  // Fisher-Yates
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function _ldRefillPool(){
  var pool = _ldBuildBuckets(_ldState.minYds, _ldState.maxYds);
  _ldShuffle(pool);
  // Avoid back-to-back repeat across cycles: if first equals last shot, swap with a different bucket
  if (pool.length > 1 && _ldState.lastTarget !== null && pool[0] === _ldState.lastTarget) {
    for (var k = 1; k < pool.length; k++) {
      if (pool[k] !== _ldState.lastTarget) {
        var tmp = pool[0]; pool[0] = pool[k]; pool[k] = tmp;
        break;
      }
    }
  }
  _ldState.pool = pool;
}

function _ldNextYardage(){
  if (!_ldState.pool || _ldState.pool.length === 0) _ldRefillPool();
  var y = _ldState.pool.shift();
  _ldState.lastTarget = y;
  return y;
}

function lineDrillStart(){
  var msg = document.getElementById('ld-setup-msg');
  var min = parseInt(document.getElementById('ld-pw-carry').value, 10);
  var max = parseInt(document.getElementById('ld-wood-carry').value, 10);
  if (!isFinite(min) || !isFinite(max)) { msg.textContent = 'Enter valid carry distances.'; return; }
  if (min < 30 || max > 400) { msg.textContent = 'Carries must be between 30 and 400 yards.'; return; }
  if (max - min < 5) { msg.textContent = 'Highest wood carry must be at least 5 yards greater than PW carry.'; return; }
  _ldState.minYds = min;
  _ldState.maxYds = max;
  _ldState.shots = [];
  _ldState.currentShotIndex = 0;
  _ldState.lastTarget = null;
  _ldRefillPool();
  document.getElementById('ld-setup-view').style.display = 'none';
  document.getElementById('ld-summary-view').style.display = 'none';
  document.getElementById('ld-tracker-view').style.display = '';
  document.getElementById('ld-shot-total').textContent = _ldState.totalShots;
  _ldNextShot();
}

function _ldNextShot(){
  if (_ldState.currentShotIndex >= _ldState.totalShots) {
    _ldShowSummary();
    return;
  }
  _ldState.currentTarget = _ldNextYardage();
  _ldState.currentDir = null;
  document.getElementById('ld-target-yds').textContent = _ldState.currentTarget;
  document.getElementById('ld-shot-num').textContent = _ldState.currentShotIndex + 1;
  var inp = document.getElementById('ld-offline-input');
  inp.value = '';
  inp.focus();
  // Reset direction buttons
  var L = document.getElementById('ld-dir-left');
  var R = document.getElementById('ld-dir-right');
  L.style.background = '#282828'; L.style.color = '#606060';
  R.style.background = '#282828'; R.style.color = '#606060';
  // Update progress
  var pct = (_ldState.currentShotIndex / _ldState.totalShots) * 100;
  document.getElementById('ld-progress-bar').style.width = pct + '%';
  _ldRenderShotsList();
}

function lineDrillSetDir(dir){
  _ldState.currentDir = dir;
  var L = document.getElementById('ld-dir-left');
  var R = document.getElementById('ld-dir-right');
  if (dir === 'L') {
    L.style.background = '#2d7abc'; L.style.color = '#ffffff';
    R.style.background = '#282828'; R.style.color = '#606060';
  } else {
    R.style.background = '#2d7abc'; R.style.color = '#ffffff';
    L.style.background = '#282828'; L.style.color = '#606060';
  }
}

function lineDrillRecordShot(){
  var inp = document.getElementById('ld-offline-input');
  var raw = inp.value.trim();
  var off = parseFloat(raw);
  if (!isFinite(off) || off < 0) { inp.style.borderColor = '#d4706e'; inp.focus(); return; }
  if (off > 0 && !_ldState.currentDir) {
    // Need direction unless dead straight (off === 0)
    var L = document.getElementById('ld-dir-left');
    var R = document.getElementById('ld-dir-right');
    L.style.borderColor = '#d4706e';
    R.style.borderColor = '#d4706e';
    setTimeout(function(){ L.style.borderColor=''; R.style.borderColor=''; }, 900);
    return;
  }
  inp.style.borderColor = '';
  _ldState.shots.push({
    target: _ldState.currentTarget,
    offline: off,
    dir: off === 0 ? '—' : _ldState.currentDir
  });
  _ldState.currentShotIndex++;
  // Update running total
  var total = _ldState.shots.reduce(function(s,x){ return s + x.offline; }, 0);
  document.getElementById('ld-running-total').textContent = total.toFixed(total % 1 === 0 ? 0 : 1);
  _ldNextShot();
}

function _ldRenderShotsList(){
  var list = document.getElementById('ld-shots-list');
  if (!_ldState.shots.length) { list.innerHTML = ''; return; }
  var rows = _ldState.shots.map(function(s, i){
    var dirCol = s.dir === 'L' ? '#44b8f0' : (s.dir === 'R' ? '#f0c830' : '#00b87a');
    var dirTxt = s.dir === 'L' ? 'Left' : (s.dir === 'R' ? 'Right' : 'Straight');
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-top:1px solid #282828;font-size:12px;">'
      + '<span style="color:#606060;width:24px;">'+(i+1)+'.</span>'
      + '<span style="color:#9a9a9a;flex:1;">'+s.target+' yds</span>'
      + '<span style="color:'+dirCol+';font-weight:700;width:60px;text-align:right;">'+dirTxt+'</span>'
      + '<span style="color:#ffffff;font-weight:700;width:50px;text-align:right;">'+s.offline+'</span>'
      + '</div>';
  }).join('');
  list.innerHTML = '<div style="background:#1e1e1e;border-radius:8px;overflow:hidden;">'
    + '<div style="padding:8px 10px;font-size:11px;color:#606060;text-transform:uppercase;letter-spacing:.5px;font-weight:700;">Shots so far</div>'
    + rows + '</div>';
}

function _ldGradeFromAvg(avgOffline){
  // 2 yds/shot ≈ 100, 4.75 yds/shot (pro avg) ≈ 67, 5.75 (AA junior) ≈ 55, 10 ≈ 4
  var g = 100 - (avgOffline - 2) * 12;
  return Math.round(Math.max(0, Math.min(100, g)));
}

function _ldGradeColor(g){
  if (g >= 80) return '#00b87a';
  if (g >= 60) return '#00b87a';
  if (g >= 40) return '#f0c830';
  return '#d4706e';
}

function _ldShowSummary(){
  document.getElementById('ld-tracker-view').style.display = 'none';
  document.getElementById('ld-summary-view').style.display = '';

  var shots = _ldState.shots;
  var n = shots.length;
  var total = 0, leftCount = 0, rightCount = 0, biggest = 0, biggestSide = '—';
  var leftYds = 0, rightYds = 0;
  shots.forEach(function(s){
    total += s.offline;
    if (s.dir === 'L') { leftCount++; leftYds += s.offline; }
    else if (s.dir === 'R') { rightCount++; rightYds += s.offline; }
    if (s.offline > biggest) {
      biggest = s.offline;
      biggestSide = s.dir === 'L' ? 'Left' : (s.dir === 'R' ? 'Right' : 'Straight');
    }
  });
  var avg = n ? total / n : 0;
  var grade = _ldGradeFromAvg(avg);

  document.getElementById('ld-final-score').textContent = total % 1 === 0 ? total : total.toFixed(1);

  document.getElementById('ld-stat-left').textContent = leftCount;
  document.getElementById('ld-stat-right').textContent = rightCount;
  document.getElementById('ld-stat-left-pct').textContent  = n ? Math.round(leftCount  / n * 100) + '%' : '0%';
  document.getElementById('ld-stat-right-pct').textContent = n ? Math.round(rightCount / n * 100) + '%' : '0%';
  var leftAvg  = leftCount  ? leftYds  / leftCount  : 0;
  var rightAvg = rightCount ? rightYds / rightCount : 0;
  document.getElementById('ld-stat-left-avg').textContent  = leftAvg.toFixed(1)  + ' yds avg';
  document.getElementById('ld-stat-right-avg').textContent = rightAvg.toFixed(1) + ' yds avg';
  document.getElementById('ld-stat-avg').textContent = avg.toFixed(1);
  document.getElementById('ld-stat-biggest').textContent = biggest % 1 === 0 ? biggest : biggest.toFixed(1);
  document.getElementById('ld-stat-biggest-side').textContent = biggestSide;

  // Shots table
  var hdr = '<div style="display:flex;padding:8px 10px;font-size:10px;color:#606060;text-transform:uppercase;letter-spacing:.5px;font-weight:700;background:#1e1e1e;">'
    + '<span style="width:24px;">#</span>'
    + '<span style="flex:1;">Target</span>'
    + '<span style="width:60px;text-align:right;">Side</span>'
    + '<span style="width:50px;text-align:right;">Off</span>'
    + '</div>';
  var body = shots.map(function(s, i){
    var dirCol = s.dir === 'L' ? '#44b8f0' : (s.dir === 'R' ? '#f0c830' : '#00b87a');
    var dirTxt = s.dir === 'L' ? 'Left' : (s.dir === 'R' ? 'Right' : 'Straight');
    return '<div style="display:flex;padding:6px 10px;font-size:12px;border-top:1px solid #282828;">'
      + '<span style="width:24px;color:#606060;">'+(i+1)+'</span>'
      + '<span style="flex:1;color:#9a9a9a;">'+s.target+' yds</span>'
      + '<span style="width:60px;text-align:right;color:'+dirCol+';font-weight:700;">'+dirTxt+'</span>'
      + '<span style="width:50px;text-align:right;color:#ffffff;font-weight:700;">'+s.offline+'</span>'
      + '</div>';
  }).join('');
  document.getElementById('ld-summary-shots').innerHTML = hdr + body;

  // Auto-save to profile
  lineDrillSave();
}

async function lineDrillSave(){
  var msg = document.getElementById('ld-save-msg');
  var shots = _ldState.shots;
  if (!shots.length) return;
  if (!S.currentUser) {
    if (msg) { msg.style.color = '#d4706e'; msg.textContent = 'Log in to save to your profile.'; }
    return;
  }

  var total = 0, leftCount = 0, rightCount = 0, biggest = 0;
  shots.forEach(function(s){
    total += s.offline;
    if (s.dir === 'L') leftCount++;
    else if (s.dir === 'R') rightCount++;
    if (s.offline > biggest) biggest = s.offline;
  });
  var n = shots.length;
  var avg = total / n;
  var grade = _ldGradeFromAvg(avg);

  // Build row_data keyed 1..n, matching the combine_scores format
  var rowData = {};
  shots.forEach(function(s, i){
    rowData[i+1] = { d: s.target, v: s.offline, l: s.dir, sg: 0, exp1: 0 };
  });

  var version = _ldState.version === 'short' ? 'Short (10)' : 'Standard (20)';
  var fullNote = '['+version+', '+_ldState.minYds+'-'+_ldState.maxYds+' yds, L:'+leftCount+' R:'+rightCount+', biggest:'+biggest+']';

  if (msg) { msg.style.color = '#9affc8'; msg.textContent = 'Saving...'; }

  var payload = {
    user_id:       activeUserId(),
    combine_date:  getTodayCentral(),
    combine_type:  'Line Drill',
    is_combine:    true,
    holes_count:   n,
    filled_count:  n,
    total_sg:      null,
    avg_pts:       parseFloat(avg.toFixed(2)),
    total_exp:     parseFloat(total.toFixed(2)),
    total_strokes: parseFloat(total.toFixed(2)),
    handicap:      'Tour Pro',
    score_mode:    'line-drill',
    note:          fullNote,
    row_data:      JSON.stringify(rowData),
    grade_100:     grade
  };

  var resp = await _sb.from('combine_scores').insert(payload);
  if (resp.error) {
    if (msg) { msg.style.color = '#d4706e'; msg.textContent = 'Save failed: ' + resp.error.message; }
    return;
  }
  if (msg) { msg.style.color = '#9affc8'; msg.textContent = '✓ Saved to your profile'; }

  // Evaluation Test: capture line drill result
  if(_evalState && _evalState.active) evalCaptureResult('linedrill', grade, 0);

  // Notify coach (best-effort)
  try {
    var { data: prof } = await _sb.from('profiles').select('coach_id, display_name').eq('id', S.currentUser.id).single();
    var coachId = prof && prof.coach_id ? prof.coach_id : null;
    if (!coachId) {
      var { data: link } = await _sb.from('coach_students').select('coach_id').eq('student_id', S.currentUser.id).limit(1);
      if (link && link.length > 0) coachId = link[0].coach_id;
    }
    if (coachId) {
      var playerName = (prof && prof.display_name) || S.currentUser.email || 'A student';
      await _sb.from('notifications').insert({
        user_id: coachId,
        type: 'new_combine',
        title: 'New Line Drill from ' + playerName,
        message: playerName + ' completed a Line Drill (' + n + ' shots, ' + total.toFixed(0) + ' yds total offline)',
        student_id: S.currentUser.id,
        student_name: playerName,
        read: false,
        created_at: new Date().toISOString()
      });
    }
  } catch(e) { console.error('[notify] Line drill notification error:', e); }
}

// Functions called from inline HTML handlers
expose({ goToLineDrill, lineDrillBack, lineDrillBackToSetup, lineDrillSetVersion, lineDrillStart, lineDrillSetDir, lineDrillRecordShot });

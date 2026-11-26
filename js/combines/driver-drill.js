import { errText } from '../store.js';
import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { _evalState, evalCaptureResult } from './eval-test.js';
import { show } from '../coaching/core.js';
import { activeUserId } from '../coaching/core.js';
import { _sb } from '../coaching/core.js';
import { getTodayCentral } from '../coaching/core.js';

/* ============================================
   DRIVER DRILL — one-shot-at-a-time driver combine
   ============================================ */
var _ddState = {
  totalShots: 6,
  versionTag: 'standard',  // 'standard' | 'long' | 'custom'
  shots: [],               // [{drive, offline, dir}]
  currentDir: null,
  currentShotIndex: 0
};

export function goToDriverDrill(){
  show('driverDrillPage');
  driverDrillBackToSetup();
}

function driverDrillBack(){
  show('practiceHubPage');
}

function driverDrillBackToSetup(){
  document.getElementById('dd-setup-view').style.display = '';
  document.getElementById('dd-tracker-view').style.display = 'none';
  document.getElementById('dd-summary-view').style.display = 'none';
  _ddState.shots = [];
  _ddState.currentShotIndex = 0;
  _ddState.currentDir = null;
  document.getElementById('dd-setup-msg').textContent = '';
  // In the Evaluation Test, only the fixed 6 or 12 shot options are allowed
  var evalMode = _evalState && _evalState.active;
  var customRow = document.getElementById('dd-custom-row');
  if (customRow) customRow.style.display = evalMode ? 'none' : '';
  if (evalMode && _ddState.totalShots !== 6 && _ddState.totalShots !== 12) driverDrillSetVersion(6);
}

function driverDrillSetVersion(v){
  var stdBtn  = document.getElementById('dd-version-std');
  var longBtn = document.getElementById('dd-version-long');
  var custom  = document.getElementById('dd-custom');
  var on  = '#00b87a', onTxt = '#ffffff';
  var off = '#282828', offTxt = '#606060';
  if (v === 6)  { _ddState.totalShots = 6;  _ddState.versionTag = 'standard'; custom.value = 6;  }
  else if (v === 12) { _ddState.totalShots = 12; _ddState.versionTag = 'long'; custom.value = 12; }
  else { /* custom */
    var cv = parseInt(custom.value, 10);
    if (!isFinite(cv) || cv < 1) cv = 1;
    if (cv > 50) cv = 50;
    _ddState.totalShots = cv;
    _ddState.versionTag = (cv === 6) ? 'standard' : (cv === 12 ? 'long' : 'custom');
  }
  stdBtn.style.background  = _ddState.totalShots === 6  ? on : off;
  stdBtn.style.color       = _ddState.totalShots === 6  ? onTxt : offTxt;
  longBtn.style.background = _ddState.totalShots === 12 ? on : off;
  longBtn.style.color      = _ddState.totalShots === 12 ? onTxt : offTxt;
}

function driverDrillStart(){
  var msg = document.getElementById('dd-setup-msg');
  if (_ddState.totalShots < 1) { msg.textContent = 'Pick at least 1 shot.'; return; }
  _ddState.shots = [];
  _ddState.currentShotIndex = 0;
  document.getElementById('dd-setup-view').style.display = 'none';
  document.getElementById('dd-summary-view').style.display = 'none';
  document.getElementById('dd-tracker-view').style.display = '';
  document.getElementById('dd-shot-total').textContent = _ddState.totalShots;
  _ddNextShot();
}

function _ddNextShot(){
  if (_ddState.currentShotIndex >= _ddState.totalShots) {
    _ddShowSummary();
    return;
  }
  _ddState.currentDir = null;
  document.getElementById('dd-shot-num').textContent = _ddState.currentShotIndex + 1;
  var di = document.getElementById('dd-drive-input');
  var oi = document.getElementById('dd-offline-input');
  di.value = ''; oi.value = '';
  di.focus();
  var L = document.getElementById('dd-dir-left');
  var R = document.getElementById('dd-dir-right');
  L.style.background = '#282828'; L.style.color = '#606060';
  R.style.background = '#282828'; R.style.color = '#606060';
  var pct = (_ddState.currentShotIndex / _ddState.totalShots) * 100;
  document.getElementById('dd-progress-bar').style.width = pct + '%';
  _ddRenderShotsList();
}

function driverDrillSetDir(dir){
  _ddState.currentDir = dir;
  var L = document.getElementById('dd-dir-left');
  var R = document.getElementById('dd-dir-right');
  if (dir === 'L') {
    L.style.background = '#2d7abc'; L.style.color = '#ffffff';
    R.style.background = '#282828'; R.style.color = '#606060';
  } else {
    R.style.background = '#2d7abc'; R.style.color = '#ffffff';
    L.style.background = '#282828'; L.style.color = '#606060';
  }
}

function driverDrillRecordShot(){
  var di = document.getElementById('dd-drive-input');
  var oi = document.getElementById('dd-offline-input');
  var drive = parseFloat(di.value);
  var off   = parseFloat(oi.value);
  if (!isFinite(drive) || drive <= 0) { di.style.borderColor = '#d4706e'; di.focus(); return; }
  if (!isFinite(off) || off < 0) { oi.style.borderColor = '#d4706e'; oi.focus(); return; }
  if (off > 0 && !_ddState.currentDir) {
    var L = document.getElementById('dd-dir-left');
    var R = document.getElementById('dd-dir-right');
    L.style.borderColor = '#d4706e';
    R.style.borderColor = '#d4706e';
    setTimeout(function(){ L.style.borderColor=''; R.style.borderColor=''; }, 900);
    return;
  }
  di.style.borderColor = ''; oi.style.borderColor = '';
  _ddState.shots.push({
    drive: drive,
    offline: off,
    dir: off === 0 ? '—' : _ddState.currentDir
  });
  _ddState.currentShotIndex++;
  // Update running avg net
  var n = _ddState.shots.length;
  var totalNet = _ddState.shots.reduce(function(s,x){ return s + (x.drive - x.offline); }, 0);
  var avgNet = n ? totalNet / n : 0;
  document.getElementById('dd-running-avg').textContent = avgNet.toFixed(0);
  _ddNextShot();
}

function _ddRenderShotsList(){
  var list = document.getElementById('dd-shots-list');
  if (!_ddState.shots.length) { list.innerHTML = ''; return; }
  var rows = _ddState.shots.map(function(s, i){
    var dirCol = s.dir === 'L' ? '#44b8f0' : (s.dir === 'R' ? '#f0c830' : '#00b87a');
    var dirTxt = s.dir === 'L' ? 'L' : (s.dir === 'R' ? 'R' : '—');
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-top:1px solid #282828;font-size:12px;">'
      + '<span style="color:#606060;width:24px;">'+(i+1)+'.</span>'
      + '<span style="color:#9a9a9a;flex:1;">'+s.drive+' yds drive</span>'
      + '<span style="color:'+dirCol+';font-weight:700;width:30px;text-align:right;">'+dirTxt+'</span>'
      + '<span style="color:#ffffff;font-weight:700;width:60px;text-align:right;">'+s.offline+' off</span>'
      + '</div>';
  }).join('');
  list.innerHTML = '<div style="background:#1e1e1e;border-radius:8px;overflow:hidden;">'
    + '<div style="padding:8px 10px;font-size:11px;color:#606060;text-transform:uppercase;letter-spacing:.5px;font-weight:700;">Shots so far</div>'
    + rows + '</div>';
}

function _ddShowSummary(){
  document.getElementById('dd-tracker-view').style.display = 'none';
  document.getElementById('dd-summary-view').style.display = '';

  var shots = _ddState.shots;
  var n = shots.length;
  var totalDrive = 0, totalOff = 0, leftCount = 0, rightCount = 0;
  var leftYds = 0, rightYds = 0, biggest = 0, biggestSide = '—';
  shots.forEach(function(s){
    totalDrive += s.drive;
    totalOff   += s.offline;
    if (s.dir === 'L') { leftCount++; leftYds += s.offline; }
    else if (s.dir === 'R') { rightCount++; rightYds += s.offline; }
    if (s.offline > biggest) {
      biggest = s.offline;
      biggestSide = s.dir === 'L' ? 'Left' : (s.dir === 'R' ? 'Right' : 'Straight');
    }
  });
  var avgDrive = n ? totalDrive / n : 0;
  var avgNet   = n ? (totalDrive - totalOff) / n : 0;

  document.getElementById('dd-final-score').textContent = avgNet.toFixed(0);
  document.getElementById('dd-stat-avg-drive').textContent = avgDrive.toFixed(0);
  document.getElementById('dd-stat-left').textContent = leftCount;
  document.getElementById('dd-stat-right').textContent = rightCount;
  document.getElementById('dd-stat-left-pct').textContent  = n ? Math.round(leftCount  / n * 100) + '%' : '0%';
  document.getElementById('dd-stat-right-pct').textContent = n ? Math.round(rightCount / n * 100) + '%' : '0%';
  var leftAvg  = leftCount  ? leftYds  / leftCount  : 0;
  var rightAvg = rightCount ? rightYds / rightCount : 0;
  document.getElementById('dd-stat-left-avg').textContent  = leftAvg.toFixed(1)  + ' yds avg';
  document.getElementById('dd-stat-right-avg').textContent = rightAvg.toFixed(1) + ' yds avg';
  document.getElementById('dd-stat-biggest').textContent = biggest % 1 === 0 ? biggest : biggest.toFixed(1);
  document.getElementById('dd-stat-biggest-side').textContent = biggestSide;

  // Shots table
  var hdr = '<div style="display:flex;padding:8px 10px;font-size:10px;color:#606060;text-transform:uppercase;letter-spacing:.5px;font-weight:700;background:#1e1e1e;">'
    + '<span style="width:24px;">#</span>'
    + '<span style="flex:1;">Drive</span>'
    + '<span style="width:60px;text-align:right;">Side</span>'
    + '<span style="width:50px;text-align:right;">Off</span>'
    + '<span style="width:50px;text-align:right;">Net</span>'
    + '</div>';
  var body = shots.map(function(s, i){
    var dirCol = s.dir === 'L' ? '#44b8f0' : (s.dir === 'R' ? '#f0c830' : '#00b87a');
    var dirTxt = s.dir === 'L' ? 'Left' : (s.dir === 'R' ? 'Right' : 'Straight');
    var net = s.drive - s.offline;
    return '<div style="display:flex;padding:6px 10px;font-size:12px;border-top:1px solid #282828;">'
      + '<span style="width:24px;color:#606060;">'+(i+1)+'</span>'
      + '<span style="flex:1;color:#9a9a9a;">'+s.drive+' yds</span>'
      + '<span style="width:60px;text-align:right;color:'+dirCol+';font-weight:700;">'+dirTxt+'</span>'
      + '<span style="width:50px;text-align:right;color:#ffffff;font-weight:700;">'+s.offline+'</span>'
      + '<span style="width:50px;text-align:right;color:#44b8f0;font-weight:700;">'+net.toFixed(0)+'</span>'
      + '</div>';
  }).join('');
  document.getElementById('dd-summary-shots').innerHTML = hdr + body;

  // Auto-save
  driverDrillSave();
}

async function driverDrillSave(){
  var msg = document.getElementById('dd-save-msg');
  var shots = _ddState.shots;
  if (!shots.length) return;
  if (!S.currentUser) {
    if (msg) { msg.style.color = '#d4706e'; msg.textContent = 'Log in to save to your profile.'; }
    return;
  }
  var n = shots.length;
  var totalDrive = 0, totalOff = 0, leftCount = 0, rightCount = 0, biggest = 0;
  shots.forEach(function(s){
    totalDrive += s.drive; totalOff += s.offline;
    if (s.dir === 'L') leftCount++; else if (s.dir === 'R') rightCount++;
    if (s.offline > biggest) biggest = s.offline;
  });
  var avgNet = n ? (totalDrive - totalOff) / n : 0;
  var avgDrive = n ? totalDrive / n : 0;
  var grade = Math.round(Math.max(0, Math.min(100, (avgNet - 100) / 2)));

  // row_data: keep d=drive, v=offline, l=L/R for compatibility with details renderer
  var rowData = {};
  shots.forEach(function(s, i){ rowData[i+1] = { d: s.drive, v: s.offline, l: s.dir, sg: s.drive - s.offline, exp1: 0 }; });

  var versionLabel = _ddState.totalShots === 6 ? 'Standard (6)' : (_ddState.totalShots === 12 ? 'Long (12)' : 'Custom (' + _ddState.totalShots + ')');
  var fullNote = '['+versionLabel+', avgDrive:'+avgDrive.toFixed(0)+' yds, L:'+leftCount+' R:'+rightCount+', biggest:'+biggest+']';

  if (msg) { msg.style.color = '#9affc8'; msg.textContent = 'Saving...'; }

  var payload = {
    user_id:       activeUserId(),
    combine_date:  getTodayCentral(),
    combine_type:  'Driver',
    is_combine:    true,
    holes_count:   n,
    filled_count:  n,
    total_sg:      parseFloat((totalDrive - totalOff).toFixed(2)),
    avg_pts:       parseFloat(avgNet.toFixed(2)),
    total_exp:     0,
    total_strokes: null,
    handicap:      'Tour Pro',
    score_mode:    'driver',
    note:          fullNote,
    row_data:      JSON.stringify(rowData),
    grade_100:     grade
  };

  var resp = await _sb.from('combine_scores').insert(payload);
  if (resp.error) {
    if (msg) { msg.style.color = '#d4706e'; msg.textContent = errText(resp.error, 'Save failed: '); }
    return;
  }
  if (msg) { msg.style.color = '#9affc8'; msg.textContent = '✓ Saved to your profile'; }

  // Evaluation Test: capture driver result
  if(_evalState && _evalState.active) evalCaptureResult('driver', grade, 0);

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
        title: 'New Driver Combine from ' + playerName,
        message: playerName + ' completed a Driver combine (' + n + ' shots, avg net ' + avgNet.toFixed(0) + ' yds)',
        student_id: S.currentUser.id,
        student_name: playerName,
        read: false,
        created_at: new Date().toISOString()
      });
    }
  } catch(e) { console.error('[notify] Driver drill notification error:', e); }
}

// Functions called from inline HTML handlers
expose({ driverDrillBack, driverDrillBackToSetup, driverDrillSetVersion, driverDrillStart, driverDrillSetDir, driverDrillRecordShot });

import { S } from './core.js';
import { expose } from './core.js';
import { _sb } from './core.js';
import { combChipScenarios, combPutDistances } from './data-combines.js';
import { drillsData } from './data-drills.js';

export function populateCoachDrillList() {
  var cat = (document.getElementById('coachDrillCategorySelect') || {}).value;
  var sel = document.getElementById('coachDrillSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select drill...</option>';
  if (!cat || !drillsData || !drillsData[cat]) return;
  drillsData[cat].forEach(function(d) {
    var opt = document.createElement('option');
    opt.value = d.title; opt.textContent = d.title;
    sel.appendChild(opt);
  });
}

async function sendCoachDrillAssignment() {
  var studentId = document.getElementById('coachDrillStudentSelect').value;
  var drillName = document.getElementById('coachDrillSelect').value;
  var drillCat = document.getElementById('coachDrillCategorySelect').value;
  var note = (document.getElementById('coachDrillNote').value || '').trim();
  var msg = document.getElementById('coachDrillMsg');

  if (!studentId) { msg.style.color = '#d4706e'; msg.textContent = 'Select a student'; return; }
  if (!drillName) { msg.style.color = '#d4706e'; msg.textContent = 'Select a drill'; return; }
  msg.style.color = '#606060'; msg.textContent = 'Assigning...';

  var { data: coachProfile } = await _sb.from('profiles').select('display_name').eq('id', S.currentUser.id).single();
  var coachName = (coachProfile && coachProfile.display_name) || 'Coach';

  var { error } = await _sb.from('coach_drill_assignments').insert({
    coach_id: S.currentUser.id, student_id: studentId, drill_name: drillName,
    drill_category: drillCat, note: note || null, coach_name: coachName,
    completed: false, created_at: new Date().toISOString()
  });
  if (error) { msg.style.color = '#d4706e'; msg.textContent = 'Error: ' + error.message; return; }

  await _sb.from('notifications').insert({
    user_id: studentId, type: 'drill_assigned', title: coachName + ' assigned you a drill',
    message: drillName + (note ? ' — ' + note : ''), read: false, created_at: new Date().toISOString()
  });

  msg.style.color = '#00b87a'; msg.textContent = '✓ Drill assigned!';
  document.getElementById('coachDrillStudentSelect').value = '';
  document.getElementById('coachDrillCategorySelect').value = '';
  document.getElementById('coachDrillSelect').innerHTML = '<option value="">Select drill...</option>';
  document.getElementById('coachDrillNote').value = '';
  setTimeout(function(){ msg.textContent = ''; }, 3000);
}

var _coachCombMode = 'combine';

function coachCombTypeChanged() {
  var type = document.getElementById('coachCombTypeSelect').value;
  var modeRow = document.getElementById('coachCombModeRow');
  var combOpts = document.getElementById('coachCombCombineOpts');
  var custOpts = document.getElementById('coachCombCustomOpts');
  var builder = document.getElementById('coachCombShotsBuilder');
  
  if (!type) {
    modeRow.style.display = 'none';
    combOpts.style.display = 'none';
    custOpts.style.display = 'none';
    builder.style.display = 'none';
    S.coachCombShots = [];
    return;
  }
  modeRow.style.display = 'block';
  var isPut = (type === 'Putting');
  var rangeRow = document.getElementById('coachCombRangeRow');
  document.getElementById('coachCombRangeUnit').textContent = isPut ? 'ft' : 'yds';
  if (isPut) {
    document.getElementById('coachCombCustomMin').value = 4;
    document.getElementById('coachCombCustomMax').value = 35;
  } else {
    document.getElementById('coachCombCustomMin').value = 50;
    document.getElementById('coachCombCustomMax').value = 120;
  }
  coachCombSetMode(_coachCombMode);
}

function coachCombSetMode(mode) {
  _coachCombMode = mode;
  var type = document.getElementById('coachCombTypeSelect').value;
  var isPut = (type === 'Putting');
  var isWedge = (type === 'Wedge');
  var combBtn = document.getElementById('coachCombModeBtn_combine');
  var custBtn = document.getElementById('coachCombModeBtn_custom');
  var combOpts = document.getElementById('coachCombCombineOpts');
  var custOpts = document.getElementById('coachCombCustomOpts');
  var desc = document.getElementById('coachCombModeDesc');
  var puttRow = document.getElementById('coachCombPuttTypeRow');
  var rangeRow = document.getElementById('coachCombRangeRow');
  
  if (mode === 'combine') {
    combBtn.style.background = '#1a4a8a'; combBtn.style.borderColor = '#2d7abc'; combBtn.style.color = '#ffffff';
    custBtn.style.background = '#282828'; custBtn.style.borderColor = '#3d3d3d'; custBtn.style.color = '#606060';
    desc.textContent = 'Fixed set of yardages, scrambled randomly';
    combOpts.style.display = 'block';
    custOpts.style.display = 'none';
    puttRow.style.display = isPut ? 'block' : 'none';
    coachCombBuildShots();
  } else {
    custBtn.style.background = '#00402c'; custBtn.style.borderColor = '#00b87a'; custBtn.style.color = '#ffffff';
    combBtn.style.background = '#282828'; combBtn.style.borderColor = '#3d3d3d'; combBtn.style.color = '#606060';
    desc.textContent = 'Enter your own range and # of shots';
    combOpts.style.display = 'none';
    custOpts.style.display = 'block';
    puttRow.style.display = 'none';
    rangeRow.style.display = (isWedge || isPut) ? 'block' : 'none';
    document.getElementById('coachCombShotsBuilder').style.display = 'none';
    S.coachCombShots = [];
  }
}

function coachCombBuildShots() {
  var type = document.getElementById('coachCombTypeSelect').value;
  var count = parseInt(document.getElementById('coachCombShotCount').value, 10);
  var builder = document.getElementById('coachCombShotsBuilder');
  builder.style.display = 'block';
  
  var shots = [];
  if (type === 'Putting') {
    var ptype = (document.getElementById('coachCombPuttType').value || 'normal');
    var pool = combPutDistances[ptype] ? combPutDistances[ptype].slice() : combPutDistances.normal.slice();
    var shuffled = pool.slice(0, count).sort(function(){ return Math.random() - 0.5; });
    for (var i = 0; i < count; i++) shots.push({ dist: shuffled[i] || 8, unit: 'ft' });
  } else if (type === 'Wedge') {
    var pool9 = [40,50,60,70,80,90,100,110,120];
    var pool18 = [40,45,50,55,60,65,70,75,80,85,90,95,100,105,110,115,120,125];
    var wPool = (count <= 9 ? pool9 : pool18).slice(0, count).sort(function(){ return Math.random() - 0.5; });
    for (var i = 0; i < count; i++) shots.push({ dist: wPool[i] || 80, unit: 'yds' });
  } else {
    var scenarios = combChipScenarios[count] || combChipScenarios[18].slice(0, count);
    var shuffled = scenarios.slice().sort(function(){ return Math.random() - 0.5; });
    for (var i = 0; i < count; i++) shots.push({ dist: shuffled[i].d, lie: shuffled[i].l, unit: 'yds' });
  }
  S.coachCombShots = shots;
  coachCombRenderShots();
}

function coachCombBuildCustom() {
  var type = document.getElementById('coachCombTypeSelect').value;
  var count = parseInt(document.getElementById('coachCombCustomHoles').value, 10) || 9;
  var min = parseInt(document.getElementById('coachCombCustomMin').value, 10);
  var max = parseInt(document.getElementById('coachCombCustomMax').value, 10);
  var builder = document.getElementById('coachCombShotsBuilder');
  builder.style.display = 'block';
  
  var isPut = (type === 'Putting');
  var isWedge = (type === 'Wedge');
  var shots = [];
  
  if (isPut || isWedge) {
    var step = isPut ? 1 : 5;
    var pool = [];
    for (var v = min; v <= max; v += step) pool.push(v);
    pool.sort(function(){ return Math.random() - 0.5; });
    for (var i = 0; i < count; i++) {
      shots.push({ dist: pool[i % pool.length] || Math.round((min+max)/2), unit: isPut ? 'ft' : 'yds' });
    }
  } else {
    var lies = ['Fairway','Rough','Sand'];
    for (var i = 0; i < count; i++) {
      shots.push({ dist: 5 + Math.floor(Math.random()*26), lie: lies[Math.floor(Math.random()*3)], unit: 'yds' });
    }
  }
  S.coachCombShots = shots;
  coachCombRenderShots();
}

function coachCombAddShot() {
  var type = document.getElementById('coachCombTypeSelect').value;
  if (!S.coachCombShots) S.coachCombShots = [];
  var isChip = (type === 'Chipping (Prox)' || type === 'Chip Hole Out');
  var s = { dist: type === 'Putting' ? 10 : type === 'Wedge' ? 80 : 20, unit: type === 'Putting' ? 'ft' : 'yds' };
  if (isChip) s.lie = 'Fairway';
  S.coachCombShots.push(s);
  coachCombRenderShots();
}

function coachCombRemoveShot(idx) {
  if (!S.coachCombShots) return;
  S.coachCombShots.splice(idx, 1);
  coachCombRenderShots();
}

function coachCombRenderShots() {
  var shots = S.coachCombShots || [];
  var type = document.getElementById('coachCombTypeSelect').value;
  var isChip = (type === 'Chipping (Prox)' || type === 'Chip Hole Out');
  var list = document.getElementById('coachCombShotsList');
  
  var html = shots.map(function(s, i) {
    var lieHtml = '';
    if (isChip) {
      lieHtml = '<select onchange="S.coachCombShots[' + i + '].lie=this.value" style="height:28px;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:6px;font-size:11px;padding:0 4px;width:70px;">'
        + '<option value="Fairway"' + (s.lie === 'Fairway' ? ' selected' : '') + '>Fairway</option>'
        + '<option value="Rough"' + (s.lie === 'Rough' ? ' selected' : '') + '>Rough</option>'
        + '<option value="Sand"' + (s.lie === 'Sand' ? ' selected' : '') + '>Sand</option></select>';
    }
    return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;' + (i > 0 ? 'border-top:1px solid #282828;' : '') + '">'
      + '<div style="font-size:11px;color:#2e2e2e;width:22px;text-align:center;font-weight:700;">' + (i+1) + '</div>'
      + '<input type="number" value="' + s.dist + '" onchange="S.coachCombShots[' + i + '].dist=+this.value" style="width:55px;height:28px;font-size:12px;text-align:center;background:#282828;color:#ffffff;border:1px solid #3d3d3d;border-radius:6px;padding:0;">'
      + '<span style="font-size:10px;color:#2e2e2e;">' + s.unit + '</span>' + lieHtml
      + '<button onclick="coachCombRemoveShot(' + i + ')" style="margin-left:auto;background:transparent;border:none;color:#2e2e2e;font-size:13px;cursor:pointer;padding:2px 6px;height:auto;width:auto;max-width:none;">✕</button></div>';
  }).join('');
  html += '<button onclick="coachCombAddShot()" style="width:100%;height:30px;margin-top:6px;font-size:11px;font-weight:700;background:#282828;border:1px dashed #3d3d3d;border-radius:6px;color:#606060;cursor:pointer;max-width:none;">+ Add Shot</button>';
  list.innerHTML = html;
}

async function sendCoachCombineAssignment() {
  var studentId = document.getElementById('coachCombStudentSelect').value;
  var combType  = document.getElementById('coachCombTypeSelect').value;
  var target    = (document.getElementById('coachCombTarget').value || '').trim();
  var dueDate   = (document.getElementById('coachCombDueDate').value || '').trim();
  var note      = (document.getElementById('coachCombNote').value || '').trim();
  var msg       = document.getElementById('coachCombMsg');

  if (!studentId) { msg.style.color = '#d4706e'; msg.textContent = 'Select a student'; return; }
  if (!combType)  { msg.style.color = '#d4706e'; msg.textContent = 'Select a combine type'; return; }
  msg.style.color = '#606060'; msg.textContent = 'Assigning...';

  var { data: coachProfile } = await _sb.from('profiles').select('display_name').eq('id', S.currentUser.id).single();
  var coachName = (coachProfile && coachProfile.display_name) || 'Coach';

  var insertData = {
    coach_id: S.currentUser.id, student_id: studentId, combine_type: combType,
    coach_name: coachName, completed: false, created_at: new Date().toISOString()
  };
  if (target)  insertData.target_score = parseInt(target, 10);
  if (dueDate) insertData.due_date = dueDate;
  if (note)    insertData.note = note;
  if (S.coachCombShots && S.coachCombShots.length > 0) {
    insertData.custom_shots = JSON.stringify(S.coachCombShots);
    insertData.shot_count = S.coachCombShots.length;
    insertData.combine_mode = _coachCombMode;
  }

  var { error } = await _sb.from('coach_combine_assignments').insert(insertData);
  if (error) { msg.style.color = '#d4706e'; msg.textContent = 'Error: ' + error.message; return; }

  var notifMsg = combType + (target ? ' — target: ' + target : '') + (note ? ' — ' + note : '');
  await _sb.from('notifications').insert({
    user_id: studentId, type: 'combine_assigned', title: coachName + ' assigned you a combine',
    message: notifMsg, read: false, created_at: new Date().toISOString()
  });

  msg.style.color = '#00b87a'; msg.textContent = '✓ Combine assigned!';
  document.getElementById('coachCombStudentSelect').value = '';
  document.getElementById('coachCombTypeSelect').value = '';
  document.getElementById('coachCombTarget').value = '';
  document.getElementById('coachCombDueDate').value = '';
  document.getElementById('coachCombNote').value = '';
  document.getElementById('coachCombModeRow').style.display = 'none';
  document.getElementById('coachCombCombineOpts').style.display = 'none';
  document.getElementById('coachCombCustomOpts').style.display = 'none';
  document.getElementById('coachCombShotsBuilder').style.display = 'none';
  S.coachCombShots = [];
  setTimeout(function(){ msg.textContent = ''; }, 3000);
}

// Functions called from inline HTML handlers
expose({ populateCoachDrillList, sendCoachDrillAssignment, coachCombTypeChanged, coachCombSetMode, coachCombBuildShots, coachCombBuildCustom, coachCombAddShot, coachCombRemoveShot, sendCoachCombineAssignment });

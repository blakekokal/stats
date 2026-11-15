import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { goToDriverDrill } from './driver-drill.js';
import { goToCombines, goToPuttingCombine } from './history.js';
import { goToLineDrill, lineDrillSetVersion } from './line-drill.js';
import { gradeColor } from './table.js';
import { show } from '../coaching/core.js';
import { activeUserId } from '../coaching/core.js';
import { _sb } from '../coaching/core.js';
import { getTodayCentral } from '../coaching/core.js';

/* ============================================
   EVAL COMBINE — baseline multi-combine
   ============================================ */
export var _evalState = { active:false, mode:null, step:0, results:{}, saved:false };
var _evalSteps = [
  { key:'putting',   label:'Putting Combine',    sub:'9 holes',                           launch:function(){ goToPuttingCombine(); } },
  { key:'shortgame', label:'Short Game Combine', sub:'9 holes — Proximity or Up & Downs',  launch:function(){ goToCombines(); } },
  { key:'linedrill', label:'Line Drill',         sub:'10 shots',                          launch:function(){ goToLineDrill(); lineDrillSetVersion('short'); } },
  { key:'driver',    label:'Driver Combine',     sub:'Standard',                          launch:function(){ goToDriverDrill(); } }
];

export function goToEvalCombine(){
  show('evalCombinePage');
  if(_evalState.active){ evalRender(); return; }  // resume an in-progress eval
  _evalState = { active:false, mode:null, step:0, results:{}, saved:false };
  document.getElementById('eval-mode-view').style.display = '';
  document.getElementById('eval-steps-view').style.display = 'none';
  document.getElementById('eval-results-view').style.display = 'none';
}

function evalCombineBack(){
  _evalState.active = false;
  show('practiceHubPage');
}

function evalCancel(){
  _evalState.active = false;
  goToEvalCombine();
}

function evalStart(mode){
  if(mode === 'nolm'){
    alert('The No Launch Monitor eval is coming soon.');
    return;
  }
  _evalState = { active:true, mode:'lm', step:0, results:{}, saved:false };
  evalRender();
}

export function evalRender(){
  if(!_evalState.active) return;
  if(_evalState.step >= _evalSteps.length){ evalShowResults(); return; }
  document.getElementById('eval-mode-view').style.display = 'none';
  document.getElementById('eval-results-view').style.display = 'none';
  document.getElementById('eval-steps-view').style.display = '';
  document.getElementById('eval-step-num').textContent = _evalState.step + 1;
  document.getElementById('eval-progress-bar').style.width = (_evalState.step / _evalSteps.length * 100) + '%';
  var html = '';
  _evalSteps.forEach(function(st, i){
    var done = !!_evalState.results[st.key];
    var current = i === _evalState.step;
    var bg   = done ? '#0f3024' : (current ? '#1a4a8a' : '#222222');
    var bord = done ? '#00b87a' : (current ? '#2d7abc' : '#333333');
    var dotBg = done ? '#00b87a' : (current ? '#2d7abc' : '#333333');
    var badge = done ? '<span style="font-size:13px;font-weight:800;color:#00b87a;">' + _evalState.results[st.key].grade + '/100</span>'
                     : (current ? '<span style="font-size:11px;font-weight:700;color:#aad4ff;">START &rarr;</span>'
                                : '<span style="font-size:14px;color:#606060;">&#128274;</span>');
    html += '<div' + (current ? ' onclick="evalRunStep()"' : '') + ' style="display:flex;align-items:center;gap:10px;background:' + bg + ';border:1px solid ' + bord + ';border-radius:10px;padding:13px 12px;margin-bottom:8px;' + (current ? 'cursor:pointer;' : '') + '">'
      + '<div style="width:24px;height:24px;border-radius:50%;background:' + dotBg + ';color:#ffffff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (done ? '&#10003;' : (i+1)) + '</div>'
      + '<div style="flex:1;"><div style="font-size:14px;font-weight:700;color:#ffffff;">' + st.label + '</div><div style="font-size:11px;color:#9a9a9a;margin-top:1px;">' + st.sub + '</div></div>'
      + badge + '</div>';
  });
  document.getElementById('eval-steps-list').innerHTML = html;
}

function evalRunStep(){
  if(!_evalState.active) return;
  var st = _evalSteps[_evalState.step];
  if(st) st.launch();
}

export function evalCaptureResult(key, grade, sg){
  if(!_evalState.active) return;
  var st = _evalSteps[_evalState.step];
  if(!st || st.key !== key || _evalState.results[key]) return;
  _evalState.results[key] = { grade: Math.round(grade || 0), sg: sg || 0 };
  _evalState.step++;
  setTimeout(function(){ show('evalCombinePage'); evalRender(); }, 800);
}

function evalHcpLabel(score){
  if(score >= 88) return 'Comparable to: Tour / professional';
  if(score >= 78) return 'Comparable to: scratch';
  if(score >= 68) return 'Comparable to: 5 handicap';
  if(score >= 58) return 'Comparable to: 5–10 handicap';
  if(score >= 48) return 'Comparable to: 10 handicap';
  if(score >= 38) return 'Comparable to: 15 handicap';
  if(score >= 28) return 'Comparable to: 20 handicap';
  return 'Comparable to: 25+ handicap';
}

function evalShowResults(){
  document.getElementById('eval-mode-view').style.display = 'none';
  document.getElementById('eval-steps-view').style.display = 'none';
  document.getElementById('eval-results-view').style.display = '';
  var keys = ['putting','shortgame','linedrill','driver'];
  var labels = { putting:'Putting', shortgame:'Short Game', linedrill:'Line Drill', driver:'Driver' };
  var totalGrade = 0, totalSg = 0;
  keys.forEach(function(k){
    var r = _evalState.results[k] || { grade:0, sg:0 };
    totalGrade += r.grade;
    totalSg += r.sg;
  });
  var score = Math.round(totalGrade / keys.length);
  document.getElementById('eval-total-score').textContent = score;
  document.getElementById('eval-total-sg').textContent = (totalSg >= 0 ? '+' : '') + totalSg.toFixed(1) + ' total SG';
  document.getElementById('eval-hcp-compare').textContent = evalHcpLabel(score);
  var html = '';
  keys.forEach(function(k){
    var r = _evalState.results[k] || { grade:0, sg:0 };
    html += '<div style="display:flex;align-items:center;gap:10px;background:#222222;border:1px solid #333333;border-radius:10px;padding:12px;margin-bottom:8px;">'
      + '<div style="flex:1;font-size:14px;font-weight:700;color:#ffffff;">' + labels[k] + '</div>'
      + '<div style="font-size:11px;color:#606060;">25% weight</div>'
      + '<div style="font-size:18px;font-weight:800;color:' + gradeColor(r.grade) + ';width:58px;text-align:right;">' + r.grade + '</div>'
      + '</div>';
  });
  document.getElementById('eval-breakdown').innerHTML = html;
  evalSaveSummary(score, totalSg);
}

async function evalSaveSummary(score, totalSg){
  if(_evalState.saved) return;
  _evalState.saved = true;
  var msg = document.getElementById('eval-save-msg');
  if(!S.currentUser){ if(msg){ msg.style.color='#d4706e'; msg.textContent='Log in to save your Evaluation Test.'; } return; }
  if(msg){ msg.style.color='#9affc8'; msg.textContent='Saving...'; }
  var payload = {
    user_id:       activeUserId(),
    combine_date:  getTodayCentral(),
    combine_type:  'Evaluation Test',
    is_combine:    true,
    holes_count:   4,
    filled_count:  4,
    total_sg:      parseFloat(totalSg.toFixed(2)),
    avg_pts:       null,
    total_exp:     0,
    total_strokes: null,
    handicap:      'Tour Pro',
    score_mode:    'eval',
    note:          '[Evaluation Test — Launch Monitor]',
    row_data:      JSON.stringify(_evalState.results),
    grade_100:     score
  };
  var resp = await _sb.from('combine_scores').insert(payload);
  if(resp.error){ if(msg){ msg.style.color='#d4706e'; msg.textContent='Save failed: '+resp.error.message; } return; }
  if(msg){ msg.style.color='#9affc8'; msg.textContent='✅ Evaluation Test saved to your profile'; }
}

// Functions called from inline HTML handlers
expose({ goToEvalCombine, evalCombineBack, evalCancel, evalStart, evalRunStep });

import { expose } from './core.js';
import { activeUserId } from './core.js';
import { _sb } from './core.js';

/* ══════════════════════════════════════════════════════════════
   GOAL SETTING & TRACKING
   ══════════════════════════════════════════════════════════════ */

var GOAL_LABELS = {
  handicap: 'Handicap Index',
  scoring_avg: 'Scoring Avg (18)',
  fairways: 'Fairway %',
  gir: 'GIR %',
  putts: 'Putts/Round',
  sg_total: 'SG: Total',
  sg_ott: 'SG: OTT',
  sg_app: 'SG: Approach',
  sg_arg: 'SG: ARG',
  sg_putt: 'SG: Putting',
  custom: 'Custom'
};

export function getGoals(userId) {
  var key = 'golf_goals_' + (userId || activeUserId());
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch(e) { return []; }
}

export function saveGoals(goals, userId) {
  var key = 'golf_goals_' + (userId || activeUserId());
  localStorage.setItem(key, JSON.stringify(goals));
  // Also save to profiles for cross-device sync
  _sb.from('profiles').update({ goals: goals }).eq('id', userId || activeUserId()).then(function(){}).catch(function(){});
}

export async function syncGoalsFromProfile(userId) {
  try {
    var { data } = await _sb.from('profiles').select('goals').eq('id', userId || activeUserId()).single();
    if (data && data.goals && Array.isArray(data.goals)) {
      var key = 'golf_goals_' + (userId || activeUserId());
      localStorage.setItem(key, JSON.stringify(data.goals));
      return data.goals;
    }
  } catch(e) { /* goals column may not exist yet */ }
  return getGoals(userId);
}


function deleteGoal(goalId) {
  var goals = getGoals().filter(function(g) { return g.id !== goalId; });
  saveGoals(goals);
  renderGoals();
}

function toggleGoalComplete(goalId) {
  var goals = getGoals();
  var goal = goals.find(function(g) { return g.id === goalId; });
  if (goal) goal.completed = !goal.completed;
  saveGoals(goals);
  renderGoals();
}

export function renderGoals(targetEl, goals, readOnly) {
  var container = targetEl || document.getElementById('goalsList');
  if (!container) return;
  var list = goals || getGoals();

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:12px;padding:8px;">No goals set yet.</div>';
    return;
  }

  container.innerHTML = list.map(function(g) {
    var label = GOAL_LABELS[g.category] || g.category;
    var deadlineStr = '';
    if (g.deadline) {
      var dl = new Date(g.deadline + 'T12:00:00');
      var now = new Date();
      var daysLeft = Math.ceil((dl - now) / (1000*60*60*24));
      if (daysLeft < 0) deadlineStr = '<span style="color:#d4706e;">Overdue by ' + Math.abs(daysLeft) + 'd</span>';
      else if (daysLeft <= 7) deadlineStr = '<span style="color:#f0c830;">' + daysLeft + 'd left</span>';
      else deadlineStr = '<span style="color:#606060;">' + (dl.getMonth()+1) + '/' + dl.getDate() + '/' + dl.getFullYear() + '</span>';
    }
    var completedStyle = g.completed ? 'opacity:0.5;text-decoration:line-through;' : '';
    var checkIcon = g.completed ? '✅' : '⬜';
    var actions = readOnly ? '' : '<div style="display:flex;gap:4px;margin-top:4px;">'
      + '<button onclick="toggleGoalComplete(\'' + g.id + '\')" style="background:transparent;border:none;color:#44b8f0;font-size:11px;cursor:pointer;padding:0;height:auto;text-decoration:underline;">' + (g.completed ? 'Undo' : 'Complete') + '</button>'
      + '<button onclick="deleteGoal(\'' + g.id + '\')" style="background:transparent;border:none;color:#d4706e;font-size:11px;cursor:pointer;padding:0;height:auto;text-decoration:underline;">Delete</button>'
      + '</div>';

    return '<div style="background:#222222;border-radius:10px;padding:10px 12px;margin-bottom:6px;' + completedStyle + '">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;">'
      + '<div style="font-size:13px;font-weight:700;">' + checkIcon + ' ' + label + '</div>'
      + '<div style="font-size:15px;font-weight:800;color:#44b8f0;">' + g.target + '</div>'
      + '</div>'
      + (g.note ? '<div style="font-size:11px;color:#9a9a9a;margin-top:2px;">' + g.note + '</div>' : '')
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">'
      + '<div style="font-size:10px;">' + deadlineStr + '</div>'
      + '</div>'
      + actions
      + '</div>';
  }).join('');
}

// Functions called from inline HTML handlers
expose({ deleteGoal, toggleGoalComplete });

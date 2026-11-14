import { S } from './core.js';
import { expose } from './core.js';
import { combOpen, setDrillCategory, setPracticeHubTab, escapeHtml, COACH_SITE } from './core.js';
import { onBack, show } from './core.js';
import { _sb } from './core.js';
import { drillsData } from './data-drills.js';

var _drillDetailBackPracticeTab = null; // track if we came from recommended practice
 // track which drill category to restore
 // skip ppBackToLanding when returning from drill detail
// A drill's details, in a box over the page (this app has no drill library pages).
function showDrillDetail(drillId, cat) {
  var drill = (drillsData[cat] || []).find(function(d) { return d.id === drillId; });
  var modal = document.getElementById('drillInfoModal');
  if (!drill || !modal) return;
  var html = '<div style="font-size:18px;font-weight:800;margin-bottom:4px;text-align:center;">' + escapeHtml(drill.title) + '</div>'
    + '<div style="font-size:11px;color:#888;text-align:center;margin-bottom:10px;">' + escapeHtml([drill.type === 'block' ? 'Block' : 'Random', drill.distance].concat(drill.subcategories || []).filter(Boolean).join(' \u00b7 ')) + '</div>';
  if (drill.description) html += '<div style="background:#282828;border-radius:10px;padding:14px;margin-bottom:10px;font-size:13px;color:#9a9a9a;line-height:1.5;text-align:left;">' + escapeHtml(drill.description) + '</div>';
  if (drill.image) html += '<img src="https://' + COACH_SITE + '/v6/' + drill.image + '" alt="" onerror="this.remove()" style="width:100%;border-radius:12px;display:block;margin:0 0 10px;">';
  document.getElementById('drillInfoBody').innerHTML = html;
  modal.style.display = 'flex';
}

export function drillDetailBack() {
  var target = S.drillDetailBackTarget;
  var practiceTab = _drillDetailBackPracticeTab;
  var backCat = S.drillDetailBackCategory;
  S.drillDetailBackTarget = 'drillsPage';
  _drillDetailBackPracticeTab = null;
  S.drillDetailBackCategory = null;
  if (practiceTab === 'plan') S.ppReturningFromDrill = true;
  show(target);
  // When returning from drill to recommended practice, show() already
  // called setPracticeHubTab via the practiceHubPage handler, and the
  // _ppReturningFromDrill flag prevented ppBackToLanding. Don't call
  // setPracticeHubTab again. Just restore the recommended view.
  if (target === 'practiceHubPage' && practiceTab === 'plan') {
    // Recommended view is already visible thanks to the flag
  } else if (target === 'practiceHubPage' && practiceTab) {
    setPracticeHubTab(practiceTab);
  } else if (target === 'practiceHubPage') {
    setPracticeHubTab('drills');
    if (backCat) setDrillCategory(backCat);
  } else if (target === 'drillsPage') {
    if (backCat) setDrillCategory(backCat);
  }
}

function ppOpenDrillFromPractice(drillId, drillCat) {
  S.drillDetailBackTarget = 'practiceHubPage';
  _drillDetailBackPracticeTab = 'plan';
  showDrillDetail(drillId, drillCat);
}

function openAssignedDrillDetail(idx) {
  var drill = S.assignedDrillsData && S.assignedDrillsData[idx];
  if (!drill) return;
  var drills = drillsData[drill.drill_category] || [];
  var drillObj = drills.find(function(d) { return d.title === drill.drill_name; });
  if (!drillObj) return;
  S.drillDetailBackTarget = 'coachingCornerPage';
  showDrillDetail(drillObj.id, drill.drill_category);
}

var _pendingDrillCompleteIdx = null;
var _pendingDrillCompleteBtn = null;

function toggleDrillComplete(btn, idx) {
  if (!S.assignedDrillsData || !S.assignedDrillsData[idx]) return;
  var drill = S.assignedDrillsData[idx];
  if (!drill.completed) {
    // Show note modal before marking done
    _pendingDrillCompleteIdx = idx;
    _pendingDrillCompleteBtn = btn;
    document.getElementById('drillCompleteNoteInput').value = '';
    document.getElementById('drillCompleteModal').style.display = 'flex';
    return;
  }
  // Marking as undone — no note needed
  _finalizeDrillToggle(btn, idx, false, null);
}

async function _finalizeDrillToggle(btn, idx, newVal, completionNote) {
  var drill = S.assignedDrillsData[idx];
  drill.completed = newVal;
  if (!newVal) drill.completion_note = null;
  btn.style.background = newVal ? '#007a52' : '#007a52';
  btn.style.color = newVal ? '#00b87a' : '#ffffff';
  btn.textContent = newVal ? '✓ Done' : 'Mark Done';

  // Show/hide completion note in the card
  var card = btn.closest ? btn.closest('div[style*="background:#222222"]') : null;
  if (card) {
    var noteEl = card.querySelector('.completion-note-row');
    if (newVal && completionNote) {
      if (!noteEl) {
        noteEl = document.createElement('div');
        noteEl.className = 'completion-note-row';
        noteEl.style.cssText = 'font-size:11px;color:#2e2e2e;margin-top:6px;padding-top:6px;border-top:1px solid #282828;';
        card.appendChild(noteEl);
      }
      noteEl.textContent = '\uD83D\uDCDD ' + completionNote;
    } else if (noteEl) {
      noteEl.remove();
    }
  }

  var updateObj = { completed: newVal, completion_note: newVal ? (completionNote || null) : null };
  var { error } = await _sb.from('coach_drill_assignments')
    .update(updateObj)
    .eq('student_id', S.currentUser.id)
    .eq('drill_name', drill.drill_name)
    .eq('created_at', drill.created_at);
  // If completion_note column doesn't exist yet, retry without it
  if (error) {
    await _sb.from('coach_drill_assignments')
      .update({ completed: newVal })
      .eq('student_id', S.currentUser.id)
      .eq('drill_name', drill.drill_name)
      .eq('created_at', drill.created_at);
  }

  if (newVal && drill.coach_id) {
    var { data: prof } = await _sb.from('profiles').select('display_name').eq('id', S.currentUser.id).single();
    var studentName = (prof && prof.display_name) || 'Student';
    await _sb.from('notifications').insert({
      user_id: drill.coach_id, type: 'drill_completed', title: studentName + ' completed a drill',
      message: studentName + ' completed: ' + drill.drill_name + (completionNote ? ' \u2014 ' + completionNote : ''),
      student_id: S.currentUser.id, student_name: studentName,
      read: false, created_at: new Date().toISOString()
    });
  }
}

function closeDrillCompleteModal() {
  document.getElementById('drillCompleteModal').style.display = 'none';
  _pendingDrillCompleteIdx = null;
  _pendingDrillCompleteBtn = null;
}

async function confirmDrillComplete() {
  var note = document.getElementById('drillCompleteNoteInput').value.trim();
  var idx = _pendingDrillCompleteIdx;
  var btn = _pendingDrillCompleteBtn;
  closeDrillCompleteModal();
  await _finalizeDrillToggle(btn, idx, true, note || null);
}

function startCoachCombine(idx) {
  var c = S.assignedCombinesData[idx];
  if (!c || !c.custom_shots) return;
  
  var shots;
  try { shots = typeof c.custom_shots === 'string' ? JSON.parse(c.custom_shots) : c.custom_shots; }
  catch(e) { alert('Error reading combine data'); return; }
  
  var typeMap = { 'Putting': 'putting', 'Chipping (Prox)': 'chip-prox', 'Chip Hole Out': 'chip-hole', 'Wedge': 'wedge' };
  var internalType = typeMap[c.combine_type] || 'putting';
  var mode = c.combine_mode === 'custom' ? 'custom' : 'combine';
  
  // Combines aren't part of this app yet: point to the coaching app.
  combOpen(internalType, mode);
}

async function toggleCombineComplete(btn, idx) {
  if (!S.assignedCombinesData || !S.assignedCombinesData[idx]) return;
  var c = S.assignedCombinesData[idx];
  var newVal = !c.completed;
  c.completed = newVal;
  btn.style.background = newVal ? '#007a52' : '#282828';
  btn.style.color = newVal ? '#00b87a' : '#606060';
  btn.textContent = newVal ? '✓ Done' : 'Mark Done';
  await _sb.from('coach_combine_assignments')
    .update({ completed: newVal })
    .eq('student_id', S.currentUser.id)
    .eq('created_at', c.created_at);
  // Notify coach when student completes a combine
  if (newVal && c.coach_id) {
    var { data: prof } = await _sb.from('profiles').select('display_name').eq('id', S.currentUser.id).single();
    var studentName = (prof && prof.display_name) || 'Student';
    await _sb.from('notifications').insert({
      user_id: c.coach_id, type: 'combine_completed', title: studentName + ' completed a combine',
      message: studentName + ' completed a combine drill', student_id: S.currentUser.id, student_name: studentName,
      read: false, created_at: new Date().toISOString()
    });
  }
}

// Back from a drill restores wherever the drill was opened from
onBack('drillDetailPage', drillDetailBack);

// Functions called from inline HTML handlers
expose({ drillDetailBack, ppOpenDrillFromPractice, openAssignedDrillDetail, toggleDrillComplete, closeDrillCompleteModal, confirmDrillComplete, startCoachCombine, toggleCombineComplete });

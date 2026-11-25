import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { setBagTab } from '../bag/clubs.js';
import { goToDriverDrill } from './driver-drill.js';
import { combShowModeSelect, getCombGradeFromCard, gradeColor } from './table.js';
import { show } from '../coaching/core.js';
import { activeUserId } from '../coaching/core.js';
import { _sb } from '../coaching/core.js';
import { escapeHtml } from '../coaching/core.js';
import { ic } from '../icons.js';

/* ── LOAD history on the Combines page ── */
async function combLoadHistory(){
  var msg  = document.getElementById('combHistMsg');
  var list = document.getElementById('combHistList');
  if(!msg||!list) return;

  if(!S.currentUser){
    msg.textContent='Log in to see your saved scores.'; list.innerHTML=''; return;
  }

  msg.textContent='Loading...'; list.innerHTML='';

  var typeF = document.getElementById('combHistFilterType').value;
  var modeF = document.getElementById('combHistFilterMode').value;

  var query = _sb.from('combine_scores')
    .select('*')
    .eq('user_id', activeUserId())
    .order('combine_date', {ascending:false})
    .order('created_at',   {ascending:false});

  if(typeF!=='all') query = query.eq('combine_type', typeF);
  if(modeF==='combine') query = query.eq('is_combine', true);
  if(modeF==='custom')  query = query.eq('is_combine', false);

  var {data,error} = await query;
  if(error){ msg.textContent='Error: '+error.message; return; }
  if(!data||data.length===0){ msg.textContent='No scores saved yet — complete a session and hit Save!'; return; }

  msg.textContent='';
  list.innerHTML = data.map(function(c){ return renderCombCard(c, true); }).join('');
  // Re-apply any active search
  combFilterBySearch();
}

function combFilterBySearch() {
  var searchEl  = document.getElementById('combHistSearch');
  var clearEl   = document.getElementById('combHistSearchClear');
  var noMatchEl = document.getElementById('combHistNoMatch');
  var listEl    = document.getElementById('combHistList');
  if (!searchEl || !listEl) return;

  var q = searchEl.value.trim().toLowerCase();
  if (clearEl) clearEl.style.display = q ? 'block' : 'none';

  var cards = listEl.querySelectorAll('.comb-hist-card');
  var visible = 0;
  cards.forEach(function(card) {
    var text = card.textContent.toLowerCase();
    var show = !q || text.indexOf(q) !== -1;
    card.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  if (noMatchEl) noMatchEl.style.display = (q && visible === 0) ? 'block' : 'none';
}
export async function loadMyCombines(){
  if(!S.currentUser) return;
  var msg  = document.getElementById('profileCombMsg');
  var list = document.getElementById('profileCombList');
  var typeF = document.getElementById('profileCombFilterType').value;
  var timeF = document.getElementById('profileCombFilterTime').value;
  msg.textContent='Loading...'; list.innerHTML='';

  var query = _sb.from('combine_scores').select('*').eq('user_id',activeUserId()).order('combine_date',{ascending:false}).order('created_at',{ascending:false});
  if(typeF!=='all') query=query.eq('combine_type',typeF);
  if(timeF!=='all'){
    var cutoff=new Date(); cutoff.setMonth(cutoff.getMonth()-parseInt(timeF));
    query=query.gte('combine_date',cutoff.toISOString().split('T')[0]);
  }
  var {data,error} = await query;
  if(error){msg.textContent='Error: '+error.message;return;}
  if(!data||data.length===0){msg.textContent='No combine scores saved yet.';return;}
  msg.textContent='';
  list.innerHTML = data.map(function(c){ return renderCombCard(c, true); }).join('');
}

/* ── Coach runs a combine for a student in-person ── */
function coachRunCombineForStudent() {
  if (!S.currentStudentId) return;
  var name = (document.getElementById('studentViewName') || {}).textContent || 'Student';
  S.combSaveForStudent = { id: S.currentStudentId, name: name, hcp: S.currentStudentHcp };
  show('combinesPage');
  combShowHomeTab('practice');
  // Show banner
  var banner = document.getElementById('combStudentBanner');
  if (banner) { banner.textContent = 'Scoring for: ' + name; banner.style.display = ''; }
}

/* ── LOAD student combines (coach view) ── */
export async function loadStudentCombines(){
  if(!S.currentStudentId) return;
  var msg  = document.getElementById('svCombMsg');
  var list = document.getElementById('svCombList');
  var typeF = document.getElementById('svCombFilterType').value;
  var timeF = document.getElementById('svCombFilterTime').value;
  msg.textContent='Loading...'; list.innerHTML='';

  var query = _sb.from('combine_scores').select('*').eq('user_id',S.currentStudentId).order('combine_date',{ascending:false}).order('created_at',{ascending:false});
  if(typeF!=='all') query=query.eq('combine_type',typeF);
  if(timeF!=='all'){
    var cutoff=new Date(); cutoff.setMonth(cutoff.getMonth()-parseInt(timeF));
    query=query.gte('combine_date',cutoff.toISOString().split('T')[0]);
  }
  var {data,error} = await query;
  if(error){msg.textContent='Error: '+error.message;return;}
  if(!data||data.length===0){msg.textContent='No combine scores found for this student.';return;}
  msg.textContent='';
  list.innerHTML = data.map(function(c){ return renderCombCard(c, false, true); }).join('');
}

export function renderCombCard(c, canDelete, canEditNote){
  if (canEditNote === undefined) canEditNote = canDelete;
  var sgLine = '';
  var gradeLine = '';
  var strokesLine = '';
  
  if(c.combine_type==='Line Drill' && c.total_strokes!==null && c.total_strokes!==undefined){
    sgLine='<span style="color:#44b8f0;font-size:15px;font-weight:700;">'+(+c.total_strokes).toFixed(0)+' yds offline · '+(+c.avg_pts).toFixed(1)+'/shot</span>';
  } else if(c.combine_type==='Driver' && c.avg_pts!==null && c.avg_pts!==undefined){
    sgLine='<span style="color:#44b8f0;font-size:15px;font-weight:700;">'+(+c.avg_pts).toFixed(0)+' avg score</span>';
  } else if(c.total_sg!==null && c.total_sg!==undefined){
    var s=parseFloat(c.total_sg);
    var col=s>=0?'#00b87a':'#d4706e';
    sgLine='<span style="color:'+col+';font-size:15px;font-weight:700;">'+(s>=0?'+':'')+s.toFixed(2)+' SG</span>';
  }
  
  var grade = getCombGradeFromCard(c);
  if(grade !== null) {
    gradeLine='<span style="color:'+gradeColor(grade)+';font-size:22px;font-weight:800;">'+grade+'<span style="font-size:14px;color:#606060;">/100</span></span>';
  }
  
  if(c.total_strokes!==null && c.total_strokes!==undefined){
    strokesLine=' · '+c.total_strokes+' strokes';
  }
  
  var scoreStr = '';
  if(gradeLine && sgLine) {
    scoreStr = '<div style="display:flex;align-items:baseline;gap:10px;margin-top:2px;">' + gradeLine + sgLine + '</div>';
  } else if(gradeLine) {
    scoreStr = gradeLine;
  } else if(sgLine) {
    scoreStr = sgLine;
  }
  var dateStr=c.combine_date?new Date(c.combine_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
  var combBadge = c.is_combine ? '<span style="font-size:10px;background:#2d7abc;color:#ffffff;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:600;">COMBINE</span>' : '';
  var delBtn = canDelete ? '<button class="comb-hist-del" onclick="deleteCombScore(\''+c.id+'\')" title="Delete" aria-label="Delete">' + ic('trash') + '</button>' : '';
  var noteHtml = c.note ? ' • <em style="color:#9a9a9a;">'+escapeHtml(c.note)+'</em>' : '';
  var metaStr = c.holes_count + '-hole • vs '+c.handicap+strokesLine+noteHtml;
  var editNoteBtn = canEditNote ? '<button onclick="editCombNote(\''+c.id+'\',\''+c.user_id+'\')" style="background:transparent;border:1px solid #333333;border-radius:6px;color:#606060;font-size:11px;font-weight:600;padding:3px 8px;cursor:pointer;height:auto;width:auto;max-width:none;margin-top:6px;">' + ic('pencil') + ' Note</button>' : '';
  var detailsBtn = c.row_data ? '<button onclick="toggleCombDetails(\''+c.id+'\')" style="background:transparent;border:1px solid #333333;border-radius:6px;color:#606060;font-size:11px;font-weight:600;padding:3px 8px;cursor:pointer;height:auto;width:auto;max-width:none;margin-top:6px;">' + ic('bars') + ' Details</button>' : '';
  // Store data globally for details/edit views
  if (!S.combRowDataMap) S.combRowDataMap = {};
  if (c.row_data) S.combRowDataMap[c.id] = { data: c.row_data, type: c.combine_type };
  if (!S.combNoteMap) S.combNoteMap = {};
  S.combNoteMap[c.id] = c.note || '';
  return '<div class="comb-hist-card" id="combcard-'+c.id+'">'
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">'
    +'<div><span style="font-weight:700;color:#00b87a;font-size:14px;">'+escapeHtml(c.combine_type||'')+combBadge+'</span></div>'
    +'<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:11px;color:#606060;">'+dateStr+'</span>'+delBtn+'</div>'
    +'</div>'
    +scoreStr
    +'<div style="font-size:11px;color:#9a9a9a;margin-top:3px;">'+metaStr+'</div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap;">'+editNoteBtn+detailsBtn+'</div>'
    +'<div id="combnote-'+c.id+'" style="display:none;margin-top:8px;"></div>'
    +'<div id="combdetail-'+c.id+'" style="display:none;margin-top:8px;"></div>'
    +'</div>';
}



function toggleCombDetails(id) {
  var detail = document.getElementById('combdetail-' + id);
  if (!detail) return;
  if (detail.style.display !== 'none') { detail.style.display = 'none'; return; }
  
  var info = (S.combRowDataMap || {})[id];
  if (!info || !info.data) { detail.innerHTML = '<div style="color:#9a9a9a;font-size:12px;">No shot data available.</div>'; detail.style.display = 'block'; return; }
  
  var combType = info.type || '';
  var rows;
  try { rows = typeof info.data === 'string' ? JSON.parse(info.data) : info.data; } catch(e) { detail.innerHTML = '<div style="color:#9a9a9a;font-size:12px;">Could not parse data.</div>'; detail.style.display = 'block'; return; }
  
  var isPut = combType === 'Putting';
  var isWedge = combType === 'Wedge';
  var isChipProx = combType === 'Chipping (Prox)';
  var isChipHole = combType === 'Chip Hole Out';
  var isDriver = combType === 'Driver';
  var isLineDrill = combType === 'Line Drill';
  var isEval = combType === 'Evaluation Test';

  // Build header
  var hdr = '<tr style="font-size:10px;color:#606060;text-transform:uppercase;">';
  hdr += isEval ? '<th style="padding:3px 4px;text-align:left;">Category</th>'
                : '<th style="padding:3px 4px;text-align:center;">#</th>';
  if (isEval) hdr += '<th style="padding:3px 4px;">Score</th><th style="padding:3px 4px;">SG</th>';
  else if (isPut) hdr += '<th style="padding:3px 4px;">Dist</th><th style="padding:3px 4px;">Putts</th><th style="padding:3px 4px;">SG</th>';
  else if (isWedge) hdr += '<th style="padding:3px 4px;">Target</th><th style="padding:3px 4px;">Carry</th><th style="padding:3px 4px;">SG</th>';
  else if (isChipProx) hdr += '<th style="padding:3px 4px;">Dist</th><th style="padding:3px 4px;">Lie</th><th style="padding:3px 4px;">Prox</th><th style="padding:3px 4px;">SG</th>';
  else if (isDriver) hdr += '<th style="padding:3px 4px;">Drive</th><th style="padding:3px 4px;">Offline</th><th style="padding:3px 4px;">Score</th>';
  else if (isLineDrill) hdr += '<th style="padding:3px 4px;">Target</th><th style="padding:3px 4px;">Side</th><th style="padding:3px 4px;">Offline</th>';
  else hdr += '<th style="padding:3px 4px;">Dist</th><th style="padding:3px 4px;">Lie</th><th style="padding:3px 4px;">Score</th><th style="padding:3px 4px;">SG</th>';
  hdr += '</tr>';
  
  // Build rows
  var keys = Object.keys(rows).sort(function(a,b){ return parseInt(a)-parseInt(b); });
  var tbody = keys.map(function(k) {
    var r = rows[k];
    var sgVal = (r.sg !== undefined && r.sg !== '') ? parseFloat(r.sg) : null;
    var sgStr = sgVal !== null ? '<span style="color:'+(sgVal>=0?'#00b87a':'#d4706e')+';font-weight:700;">'+(sgVal>=0?'+':'')+sgVal.toFixed(2)+'</span>' : '–';
    var distStr = r.d !== '' && r.d !== undefined ? r.d : '–';
    var valStr = r.v !== '' && r.v !== undefined ? r.v : '–';
    var lieStr = r.l || '';
    
    var row = '<tr style="font-size:12px;border-top:1px solid #282828;">';
    if (isEval) {
      var evalLabels = { putting:'Putting', shortgame:'Short Game', linedrill:'Line Drill', driver:'Driver' };
      row += '<td style="padding:3px 4px;color:#9a9a9a;font-weight:700;">'+(evalLabels[k]||k)+'</td>';
      row += '<td style="padding:3px 4px;font-weight:700;">'+(r.grade!==undefined?r.grade:'–')+'</td><td style="padding:3px 4px;">'+sgStr+'</td>';
      row += '</tr>';
      return row;
    }
    row += '<td style="padding:3px 4px;color:#9a9a9a;text-align:center;font-weight:700;">'+k+'</td>';
    if (isPut) row += '<td style="padding:3px 4px;">'+distStr+' ft</td><td style="padding:3px 4px;">'+valStr+'</td><td style="padding:3px 4px;">'+sgStr+'</td>';
    else if (isWedge) row += '<td style="padding:3px 4px;">'+distStr+' yds</td><td style="padding:3px 4px;">'+valStr+'</td><td style="padding:3px 4px;">'+sgStr+'</td>';
    else if (isChipProx) row += '<td style="padding:3px 4px;">'+distStr+' yds</td><td style="padding:3px 4px;font-size:10px;">'+lieStr+'</td><td style="padding:3px 4px;">'+valStr+' ft</td><td style="padding:3px 4px;">'+sgStr+'</td>';
    else if (isDriver) {
      var scoreVal = (r.d!==''&&r.v!=='') ? (parseFloat(r.d)-parseFloat(r.v)).toFixed(0) : '–';
      var dirCol = r.l === 'L' ? '#44b8f0' : (r.l === 'R' ? '#f0c830' : '#9a9a9a');
      var dirTxt = r.l === 'L' ? 'L' : (r.l === 'R' ? 'R' : (r.l ? r.l : '—'));
      row += '<td style="padding:3px 4px;">'+distStr+' yds</td><td style="padding:3px 4px;">'+valStr+' yds <span style="color:'+dirCol+';font-weight:700;">'+dirTxt+'</span></td><td style="padding:3px 4px;font-weight:700;color:#44b8f0;">'+scoreVal+'</td>';
    }
    else if (isLineDrill) {
      var sideTxt = lieStr === 'L' ? 'Left' : (lieStr === 'R' ? 'Right' : 'Straight');
      var sideCol = lieStr === 'L' ? '#44b8f0' : (lieStr === 'R' ? '#f0c830' : '#00b87a');
      row += '<td style="padding:3px 4px;">'+distStr+' yds</td><td style="padding:3px 4px;color:'+sideCol+';font-weight:700;">'+sideTxt+'</td><td style="padding:3px 4px;font-weight:700;">'+valStr+' yds</td>';
    }
    else row += '<td style="padding:3px 4px;">'+distStr+' yds</td><td style="padding:3px 4px;font-size:10px;">'+lieStr+'</td><td style="padding:3px 4px;">'+valStr+'</td><td style="padding:3px 4px;">'+sgStr+'</td>';
    row += '</tr>';
    return row;
  }).join('');
  
  detail.innerHTML = '<table style="width:100%;border-collapse:collapse;background:#1e1e1e;border-radius:8px;overflow:hidden;">' + hdr + tbody + '</table>';
  detail.style.display = 'block';
}

async function deleteCombScore(id){
  if(!confirm('Delete this combine score?')) return;
  var {error} = await _sb.from('combine_scores').delete().eq('id',id).eq('user_id',activeUserId());
  if(error){ alert('Delete failed: '+error.message); return; }
  var card = document.getElementById('combcard-'+id);
  if(card) card.remove();
}

function editCombNote(id, userId) {
  var panel = document.getElementById('combnote-' + id);
  if (!panel) return;
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  var curNote = (S.combNoteMap || {})[id] || '';
  var ownerId = userId || activeUserId();
  panel.innerHTML = '<div style="background:#222222;border:1px solid #3d3d3d;border-radius:8px;padding:10px;">'
    + '<input type="text" id="combnote-input-'+id+'" value="'+escapeHtml(curNote)+'" placeholder="Add a note..." style="width:100%;box-sizing:border-box;background:#282828;color:#9a9a9a;border:1px solid #333333;border-radius:6px;padding:7px 10px;font-size:0.9rem;margin-bottom:8px;">'
    + '<div style="display:flex;gap:6px;">'
    + '<button onclick="saveCombNote(\''+id+'\',\''+ownerId+'\')" style="flex:1;height:34px;background:#007a52;border:none;border-radius:6px;color:#ffffff;font-size:12px;font-weight:700;cursor:pointer;max-width:none;">Save</button>'
    + '<button onclick="document.getElementById(\'combnote-'+id+'\').style.display=\'none\'" style="height:34px;background:#333333;border:none;border-radius:6px;color:#9a9a9a;font-size:12px;cursor:pointer;padding:0 14px;max-width:none;">Cancel</button>'
    + '</div>'
    + '<div id="combnote-msg-'+id+'" style="font-size:11px;min-height:14px;margin-top:4px;"></div>'
    + '</div>';
  panel.style.display = 'block';
  document.getElementById('combnote-input-' + id).focus();
}

async function saveCombNote(id, userId) {
  var input = document.getElementById('combnote-input-' + id);
  var msgEl = document.getElementById('combnote-msg-' + id);
  if (!input) return;
  var newNote = input.value.trim();
  var ownerId = userId || activeUserId();
  msgEl.style.color = '#606060'; msgEl.textContent = 'Saving...';
  var { data: updatedRows, error } = await _sb.from('combine_scores').update({ note: newNote }).eq('id', id).eq('user_id', ownerId).select();
  if (error) { msgEl.style.color = '#d4706e'; msgEl.textContent = 'Error: ' + error.message; return; }
  if (!updatedRows || updatedRows.length === 0) { msgEl.style.color = '#d4706e'; msgEl.textContent = 'Error: Could not update note'; return; }
  // Update cached data
  if (S.combNoteMap) S.combNoteMap[id] = newNote;
  // Update the note display in the card directly
  var card = document.getElementById('combcard-' + id);
  if (card) {
    var metaDiv = card.querySelector('div[style*="font-size:11px;color:#9a9a9a"]');
    if (metaDiv) {
      var existingNote = metaDiv.querySelector('em');
      if (existingNote) {
        if (newNote) { existingNote.textContent = newNote; }
        else { existingNote.remove(); }
      } else if (newNote) {
        metaDiv.innerHTML += ' \u2022 <em style="color:#9a9a9a;">' + escapeHtml(newNote) + '</em>';
      }
    }
  }
  msgEl.style.color = '#00b87a'; msgEl.textContent = '\u2713 Saved!';
  setTimeout(function(){ var panel = document.getElementById('combnote-' + id); if (panel) panel.style.display = 'none'; }, 1000);
}

/* ── Navigation helpers ── */
function _combDetectReturnView() {
  var views = ['ppRecommendedView','ppGeneratorView','ppTourView','ppCustomUseView','ppWarmUpView'];
  for (var i = 0; i < views.length; i++) {
    var el = document.getElementById(views[i]);
    if (el && el.style.display !== 'none') return views[i];
  }
  return null;
}

export function goToCombines(){
  // Clear any coach-for-student state
  S.combSaveForStudent = null;
  S.combFromPracticeHub = true;
  S.combReturnToView = _combDetectReturnView();
  var banner = document.getElementById('combStudentBanner');
  if (banner) banner.style.display = 'none';
  show('combinesPage');
  // Go directly to short game select (Proximity / Up & Downs)
  document.getElementById('comb-home-view').style.display = '';
  document.getElementById('comb-tracker-view').style.display = 'none';
  document.getElementById('comb-mode-select').style.display = 'none';
  document.getElementById('comb-practice-sub').style.display = 'none';
  document.getElementById('comb-shortgame-select').style.display = '';
}

export function goToPuttingCombine(){
  S.combSaveForStudent = null;
  S.combFromPracticeHub = true;
  S.combReturnToView = _combDetectReturnView();
  var banner = document.getElementById('combStudentBanner');
  if (banner) banner.style.display = 'none';
  show('combinesPage');
  combShowModeSelect('putting');
}

function goToWedgeCombine(){
  S.combSaveForStudent = null;
  S.combFromPracticeHub = true;
  S.combReturnToView = _combDetectReturnView();
  var banner = document.getElementById('combStudentBanner');
  if (banner) banner.style.display = 'none';
  show('combinesPage');
  combShowModeSelect('wedge');
}

function goToWedgeGapping(){
  show('myBagPage');
  setBagTab('wedgeGap');
}

function goToDriverCombinePicker(){
  // New one-shot-at-a-time Driver flow (UI matches Line Drill).
  goToDriverDrill();
}

function combShowHomeTab(tab){
  // always reset all sub-screens when switching tabs
  document.getElementById('comb-mode-select').style.display = 'none';
  document.getElementById('comb-shortgame-select').style.display = 'none';
  S.combPendingType = null;
  S.combFromShortGame = false;
  document.getElementById('comb-practice-sub').style.display = '';
}

// Functions called from inline HTML handlers
expose({ loadMyCombines, coachRunCombineForStudent, loadStudentCombines, toggleCombDetails, deleteCombScore, editCombNote, saveCombNote, goToCombines, goToPuttingCombine, goToWedgeCombine, goToDriverCombinePicker });

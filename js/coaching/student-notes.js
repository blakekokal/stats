import { S } from './core.js';
import { expose } from './core.js';
import { _sb } from './core.js';
import { escapeHtml } from './core.js';

// ── STUDENT VIEWER: NOTES TAB ────────────────────────────────────────────────

export async function loadSvNotes() {
  var list = document.getElementById('svNotesList');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">Loading...</div>';

  var { data, error } = await _sb.from('coach_notes')
    .select('id, note_text, created_at, lesson_date, note_type')
    .eq('coach_id', S.currentUser.id)
    .eq('student_id', S.currentStudentId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data || data.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">No notes for this student yet.</div>';
    S.svAllNotes = [];
    document.getElementById('svNotesCount').textContent = '';
    return;
  }

  S.svAllNotes = data;
  renderSvNotes(data);
}

function filterSvNotes() {
  var query  = (document.getElementById('svNotesSearch').value || '').toLowerCase().trim();
  var type   = document.getElementById('svNotesFilterType').value;
  var months = document.getElementById('svNotesFilterDate').value;
  var notes  = S.svAllNotes || [];

  var cutoff = null;
  if (months !== 'all') {
    cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - parseInt(months, 10));
  }

  var filtered = notes.filter(function(n) {
    if (query && (n.note_text || '').toLowerCase().indexOf(query) === -1) return false;
    if (type !== 'all') {
      var isLesson = !!n.lesson_date || n.note_type === 'lesson';
      if (type === 'lesson'  && !isLesson) return false;
      if (type === 'general' &&  isLesson) return false;
    }
    if (cutoff && new Date(n.created_at) < cutoff) return false;
    return true;
  });

  var countEl = document.getElementById('svNotesCount');
  if (countEl) {
    countEl.textContent = filtered.length === notes.length
      ? notes.length + ' note' + (notes.length !== 1 ? 's' : '')
      : filtered.length + ' of ' + notes.length + ' notes';
  }

  renderSvNotes(filtered);
}

function renderSvNotes(data) {
  var list = document.getElementById('svNotesList');
  if (!list) return;

  if (!data || data.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">No notes match your filters.</div>';
    return;
  }

  var query = (document.getElementById('svNotesSearch') || {}).value || '';

  list.innerHTML = data.map(function(n, idx) {
    var sentDate = new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var isLesson = !!n.lesson_date || n.note_type === 'lesson';

    var typeBadge = '<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:6px;background:'
      + (isLesson ? '#2d7abc' : '#00402c') + ';color:' + (isLesson ? '#44b8f0' : '#00b87a') + ';">'
      + (isLesson ? 'Lesson' : 'General') + '</span>';

    var lessonLine = '';
    if (n.lesson_date) {
      var ld = new Date(n.lesson_date + 'T12:00:00');
      lessonLine = '<div style="font-size:11px;color:#44b8f0;font-weight:700;margin-bottom:4px;">📅 Lesson: '
        + ld.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '</div>';
    }

    var noteText = escapeHtml(n.note_text);
    // Render bullet points: lines starting with "- " or "• " become styled bullets
    noteText = noteText.replace(/^[-•]\s+(.*)$/gm, '<div style="display:flex;gap:6px;align-items:flex-start;"><span style="color:#44b8f0;">•</span><span>$1</span></div>');
    if (query.trim()) {
      var re = new RegExp('(' + query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      noteText = noteText.replace(re, '<mark style="background:#1a4a8a;color:#44b8f0;border-radius:3px;padding:0 2px;">$1</mark>');
    }
    // Preserve newlines that aren't already bullet divs
    noteText = noteText.replace(/\n/g, '<br>');

    var editBtn = n.id ? '<button onclick="editSvNote(\'' + n.id + '\')" style="background:transparent;border:none;color:#2e2e2e;font-size:14px;cursor:pointer;padding:2px 4px;height:auto;width:auto;max-width:none;" title="Edit note">✏️</button>' : '';

    return '<div id="svNote_' + (n.id || idx) + '" style="border-bottom:1px solid #282828;padding:12px 0;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;flex-wrap:wrap;gap:4px;">'
      + '<div style="display:flex;align-items:center;"><div style="font-size:11px;font-weight:700;color:#44b8f0;">'
      + escapeHtml(document.getElementById('studentViewName').textContent || 'Student')
      + '</div>' + typeBadge + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      + '<div style="font-size:10px;color:#2e2e2e;">' + sentDate + '</div>'
      + editBtn
      + (n.id ? '<button onclick="deleteSvNote(\'' + n.id + '\')" style="background:transparent;border:none;color:#2e2e2e;font-size:14px;cursor:pointer;padding:2px 4px;height:auto;width:auto;max-width:none;" title="Delete note">🗑</button>' : '')
      + '</div></div>'
      + lessonLine
      + '<div style="font-size:13px;color:#9a9a9a;line-height:1.6;">' + noteText + '</div></div>';
  }).join('');
}

var _editingSvNoteId = null;

function editSvNote(noteId) {
  var note = (S.svAllNotes || []).find(function(n){ return n.id === noteId; });
  if (!note) return;
  _editingSvNoteId = noteId;
  document.getElementById('svNoteText').value = note.note_text || '';
  document.getElementById('svNoteLessonDate').value = note.lesson_date || '';
  document.getElementById('svNoteType').value = note.note_type || 'general';
  var sendBtn = document.getElementById('svNoteSendBtn');
  if (sendBtn) { sendBtn.textContent = 'Update'; sendBtn.style.background = '#d49a10'; }
  var cancelBtn = document.getElementById('svNoteCancelBtn');
  if (cancelBtn) cancelBtn.style.display = '';
  var msg = document.getElementById('svNoteMsg');
  msg.style.color = '#f0c830'; msg.textContent = 'Editing note';
  document.getElementById('svNoteText').focus();
}

function cancelSvNoteEdit() {
  _editingSvNoteId = null;
  document.getElementById('svNoteText').value = '';
  document.getElementById('svNoteLessonDate').value = '';
  var sendBtn = document.getElementById('svNoteSendBtn');
  if (sendBtn) { sendBtn.textContent = 'Send'; sendBtn.style.background = '#2d7abc'; }
  var cancelBtn = document.getElementById('svNoteCancelBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
  document.getElementById('svNoteMsg').textContent = '';
}

async function sendSvNote() {
  var text = (document.getElementById('svNoteText').value || '').trim();
  var lessonDate = (document.getElementById('svNoteLessonDate').value || '').trim();
  var noteType = (document.getElementById('svNoteType').value || 'general');
  var msg = document.getElementById('svNoteMsg');
  if (!text) { msg.style.color = '#d4706e'; msg.textContent = 'Write a note first'; return; }
  if (!S.currentStudentId) { msg.style.color = '#d4706e'; msg.textContent = 'No student selected'; return; }
  msg.style.color = '#606060'; msg.textContent = _editingSvNoteId ? 'Updating...' : 'Sending...';

  // EDIT existing note
  if (_editingSvNoteId) {
    var updateData = { note_text: text, note_type: noteType, lesson_date: lessonDate || null };
    var { data: updatedRows, error } = await _sb.from('coach_notes').update(updateData).eq('id', _editingSvNoteId).eq('coach_id', S.currentUser.id).select();
    if (error) { msg.style.color = '#d4706e'; msg.textContent = 'Error: ' + error.message; return; }
    if (!updatedRows || updatedRows.length === 0) { msg.style.color = '#d4706e'; msg.textContent = 'Error: Could not update note'; return; }
    // Update local cache immediately so UI reflects changes
    if (S.svAllNotes) {
      var cached = S.svAllNotes.find(function(n){ return n.id === _editingSvNoteId; });
      if (cached) { cached.note_text = text; cached.note_type = noteType; cached.lesson_date = lessonDate || null; }
    }
    msg.style.color = '#00b87a'; msg.textContent = '✓ Updated!';
    _editingSvNoteId = null;
    var sendBtn = document.getElementById('svNoteSendBtn');
    if (sendBtn) { sendBtn.textContent = 'Send'; sendBtn.style.background = '#2d7abc'; }
    var cancelBtn = document.getElementById('svNoteCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    document.getElementById('svNoteText').value = '';
    document.getElementById('svNoteLessonDate').value = '';
    await loadSvNotes();
    filterSvNotes();
    setTimeout(function(){ msg.textContent = ''; }, 3000);
    return;
  }

  // NEW note
  var { data: coachProfile } = await _sb.from('profiles').select('display_name').eq('id', S.currentUser.id).single();
  var coachName = (coachProfile && coachProfile.display_name) || 'Coach';

  var insertData = { coach_id: S.currentUser.id, student_id: S.currentStudentId, note_text: text, coach_name: coachName, created_at: new Date().toISOString(), note_type: noteType };
  if (lessonDate) insertData.lesson_date = lessonDate;

  var { error } = await _sb.from('coach_notes').insert(insertData);
  if (error) { msg.style.color = '#d4706e'; msg.textContent = 'Error: ' + error.message; return; }

  var notifMsg = (lessonDate ? 'Lesson ' + lessonDate + ': ' : '') + (text.length > 70 ? text.slice(0,70) + '…' : text);
  await _sb.from('notifications').insert({
    user_id: S.currentStudentId, type: 'coach_note', title: 'New feedback from ' + coachName,
    message: notifMsg, read: false, created_at: new Date().toISOString()
  });

  msg.style.color = '#00b87a'; msg.textContent = '✓ Sent!';
  document.getElementById('svNoteText').value = '';
  document.getElementById('svNoteLessonDate').value = '';
  loadSvNotes();
  setTimeout(function(){ msg.textContent = ''; }, 3000);
}

async function deleteSvNote(noteId) {
  if (!confirm('Delete this note?')) return;
  var { error } = await _sb.from('coach_notes').delete().eq('id', noteId).eq('coach_id', S.currentUser.id);
  if (error) { alert('Error deleting: ' + error.message); return; }
  var el = document.getElementById('svNote_' + noteId);
  if (el) el.remove();
  // Update stored data
  if (S.svAllNotes) {
    S.svAllNotes = S.svAllNotes.filter(function(n){ return n.id !== noteId; });
    var countEl = document.getElementById('svNotesCount');
    if (countEl) countEl.textContent = S.svAllNotes.length + ' note' + (S.svAllNotes.length !== 1 ? 's' : '');
  }
}

// Functions called from inline HTML handlers
expose({ filterSvNotes, editSvNote, cancelSvNoteEdit, sendSvNote, deleteSvNote });

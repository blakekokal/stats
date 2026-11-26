import { errText } from '../store.js';
import { S } from '../coaching/core.js';
import { expose } from '../coaching/core.js';
import { _viewingAsStudent, activeUserId } from '../coaching/core.js';
import { _sb } from '../coaching/core.js';
import { escHtml } from '../coaching/core.js';
import { ppHideAllViews } from './plans.js';

var _SWING_JOURNAL_KEY = 'swingJournal_v1'; // legacy localStorage fallback

// Supabase table:
// CREATE TABLE swing_journal_entries (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
//   entry_date DATE NOT NULL,
//   text TEXT NOT NULL,
//   created_at TIMESTAMPTZ DEFAULT now()
// );
// ALTER TABLE swing_journal_entries ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users manage own swing journal" ON swing_journal_entries FOR ALL USING (auth.uid() = user_id);
// CREATE POLICY "Coaches read student swing journal" ON swing_journal_entries FOR SELECT USING (
//   EXISTS (SELECT 1 FROM coach_students WHERE coach_id = auth.uid() AND student_id = user_id)
//   OR EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND coach_id = auth.uid())
// );

function ppShowSwingJournal() {
  ppHideAllViews();
  document.getElementById('ppSwingJournalView').style.display = '';
  var addForm = document.getElementById('sjAddForm');
  if (addForm) addForm.style.display = _viewingAsStudent ? 'none' : '';
  var dateInput = document.getElementById('sjEntryDate');
  if (dateInput && !dateInput.value) {
    var d = new Date();
    var iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    dateInput.value = iso;
  }
  renderSwingJournal();
}

async function addSwingJournalEntry() {
  var dateInput = document.getElementById('sjEntryDate');
  var textInput = document.getElementById('sjEntryText');
  var date = dateInput.value;
  var text = (textInput.value || '').trim();
  if (!date || !text) return;
  if (!S.currentUser) {
    var c = document.getElementById('sjEntries');
    if (c) c.innerHTML = '<div style="text-align:center;font-size:12px;color:#d4706e;padding:16px 0;">Log in to save swing journal entries.</div>';
    return;
  }
  var { error } = await _sb.from('swing_journal_entries').insert({
    user_id: activeUserId(),
    entry_date: date,
    text: text,
    created_at: new Date().toISOString()
  });
  if (error) {
    var c = document.getElementById('sjEntries');
    if (c) c.innerHTML = '<div style="text-align:center;font-size:12px;color:#d4706e;padding:16px 0;">' + escHtml(errText(error, 'Save failed: ')) + '</div>';
    return;
  }
  textInput.value = '';
  renderSwingJournal();
}

async function deleteSwingJournalEntry(id) {
  if (!S.currentUser) return;
  // Only owner can delete; coaches viewing a student shouldn't delete the student's entries.
  if (_viewingAsStudent) return;
  var { error } = await _sb.from('swing_journal_entries').delete().eq('id', id).eq('user_id', activeUserId());
  if (error) { alert(errText(error, 'Delete failed: ')); return; }
  renderSwingJournal();
}

async function renderSwingJournal() {
  var container = document.getElementById('sjEntries');
  if (!container) return;
  if (!S.currentUser) {
    container.innerHTML = '<div style="text-align:center;font-size:12px;color:#606060;padding:16px 0;">Log in to use the Swing Journal.</div>';
    return;
  }
  container.innerHTML = '<div style="text-align:center;font-size:12px;color:#606060;padding:16px 0;">Loading...</div>';
  var { data, error } = await _sb.from('swing_journal_entries')
    .select('*')
    .eq('user_id', activeUserId())
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    container.innerHTML = '<div style="text-align:center;font-size:12px;color:#d4706e;padding:16px 0;">' + escHtml(errText(error, 'Error: ')) + '</div>';
    return;
  }
  var entries = data || [];
  if (entries.length === 0) {
    container.innerHTML = '<div style="text-align:center;font-size:12px;color:#606060;padding:16px 0;">No entries yet. Add your first swing thought above.</div>';
    return;
  }
  var groups = {};
  entries.forEach(function(e) { (groups[e.entry_date] = groups[e.entry_date] || []).push(e); });
  var dates = Object.keys(groups).sort(function(a,b) { return b.localeCompare(a); });
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var canDelete = !_viewingAsStudent;
  var html = '';
  dates.forEach(function(d) {
    var dp = d.split('-');
    var disp = dp.length === 3 ? (months[parseInt(dp[1],10)-1] + ' ' + parseInt(dp[2],10) + ', ' + dp[0]) : d;
    html += '<div style="background:#222;border-radius:12px;padding:14px 16px;margin-bottom:10px;">';
    html += '<div style="font-size:13px;font-weight:800;color:#ffffff;margin-bottom:8px;">' + disp + '</div>';
    html += '<ul style="margin:0;padding-left:18px;font-size:13px;color:#9a9a9a;line-height:1.7;">';
    groups[d].forEach(function(e) {
      html += '<li style="display:flex;align-items:flex-start;gap:8px;">';
      html += '<span style="flex:1;">' + escHtml(e.text) + '</span>';
      if (canDelete) {
        html += '<button onclick="deleteSwingJournalEntry(\'' + e.id + '\')" style="background:transparent;border:none;color:#9a9a9a;font-size:11px;cursor:pointer;padding:0 4px;height:auto;max-width:none;width:auto;flex-shrink:0;">×</button>';
      }
      html += '</li>';
    });
    html += '</ul></div>';
  });
  container.innerHTML = html;
}

// Functions called from inline HTML handlers
expose({ ppShowSwingJournal, addSwingJournalEntry, deleteSwingJournalEntry });

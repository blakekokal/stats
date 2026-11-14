import { S } from './core.js';
import { expose } from './core.js';
import { _sb } from './core.js';

/* ── Direct Messages (coach <-> student) ── */
var _dmCoachId = null; // cached coach ID for student view

function _renderMessages(msgs, container, myId) {
  if (!msgs || !msgs.length) {
    container.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">No messages yet. Start the conversation!</div>';
    return;
  }
  var html = '';
  msgs.forEach(function(m) {
    var isMe = m.sender_id === myId;
    html += '<div style="display:flex;justify-content:' + (isMe ? 'flex-end' : 'flex-start') + ';margin-bottom:8px;">';
    html += '<div style="max-width:80%;background:' + (isMe ? '#2d7abc' : '#282828') + ';border-radius:12px;padding:10px 14px;">';
    html += '<div style="font-size:13px;color:#ffffff;line-height:1.4;word-break:break-word;">' + (m.message_text || '').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
    var d = new Date(m.created_at);
    var timeStr = (d.getMonth()+1) + '/' + d.getDate() + ' ' + d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
    html += '<div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:4px;">' + (m.sender_name || '') + ' · ' + timeStr + '</div>';
    html += '</div></div>';
  });
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

export async function loadStudentMessages() {
  if (!S.currentUser) return;
  var list = document.getElementById('cstMessagesList');
  // Find coach ID
  if (!_dmCoachId) {
    var { data: p } = await _sb.from('profiles').select('coach_id').eq('id', S.currentUser.id).single();
    if (!p || !p.coach_id) {
      list.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">Connect with a coach to send messages.</div>';
      return;
    }
    _dmCoachId = p.coach_id;
  }
  var { data: msgs } = await _sb.from('coach_messages')
    .select('*')
    .or('and(sender_id.eq.' + S.currentUser.id + ',receiver_id.eq.' + _dmCoachId + '),and(sender_id.eq.' + _dmCoachId + ',receiver_id.eq.' + S.currentUser.id + ')')
    .order('created_at', { ascending: true })
    .limit(100);
  _renderMessages(msgs || [], list, S.currentUser.id);
  // Mark unread as read
  await _sb.from('coach_messages').update({ read: true }).eq('receiver_id', S.currentUser.id).eq('sender_id', _dmCoachId).eq('read', false);
}

async function sendStudentMessage() {
  var input = document.getElementById('cstMsgInput');
  var text = (input.value || '').trim();
  var status = document.getElementById('cstMsgStatus');
  if (!text) return;
  if (!_dmCoachId) { status.style.color = '#d4706e'; status.textContent = 'No coach connected'; return; }
  input.value = '';
  var { data: p } = await _sb.from('profiles').select('display_name').eq('id', S.currentUser.id).single();
  var name = (p && p.display_name) || 'Student';
  var { error } = await _sb.from('coach_messages').insert({
    sender_id: S.currentUser.id, receiver_id: _dmCoachId, message_text: text,
    sender_name: name, read: false, created_at: new Date().toISOString()
  });
  if (error) { status.style.color = '#d4706e'; status.textContent = 'Error sending'; return; }
  await _sb.from('notifications').insert({
    user_id: _dmCoachId, type: 'student_message', title: 'Message from ' + name,
    message: text.length > 70 ? text.slice(0,70) + '…' : text, read: false, created_at: new Date().toISOString(),
    student_id: S.currentUser.id, student_name: name
  });
  loadStudentMessages();
}

export async function loadCoachMessages() {
  var sel = document.getElementById('coachMsgStudentSelect');
  var studentId = sel ? sel.value : '';
  var list = document.getElementById('cctMessagesList');
  var inputWrap = document.getElementById('cctMsgInputWrap');
  if (!studentId) {
    list.innerHTML = '<div style="text-align:center;color:#2e2e2e;font-size:13px;padding:20px 0;">Select a student to view messages.</div>';
    if (inputWrap) inputWrap.style.display = 'none';
    return;
  }
  if (inputWrap) inputWrap.style.display = 'flex';
  var { data: msgs } = await _sb.from('coach_messages')
    .select('*')
    .or('and(sender_id.eq.' + S.currentUser.id + ',receiver_id.eq.' + studentId + '),and(sender_id.eq.' + studentId + ',receiver_id.eq.' + S.currentUser.id + ')')
    .order('created_at', { ascending: true })
    .limit(100);
  _renderMessages(msgs || [], list, S.currentUser.id);
  // Mark unread as read
  await _sb.from('coach_messages').update({ read: true }).eq('receiver_id', S.currentUser.id).eq('sender_id', studentId).eq('read', false);
}

async function sendCoachMessage() {
  var studentId = document.getElementById('coachMsgStudentSelect').value;
  var input = document.getElementById('cctMsgInput');
  var text = (input.value || '').trim();
  var status = document.getElementById('cctMsgStatus');
  if (!studentId) { status.style.color = '#d4706e'; status.textContent = 'Select a student'; return; }
  if (!text) return;
  input.value = '';
  var { data: p } = await _sb.from('profiles').select('display_name').eq('id', S.currentUser.id).single();
  var name = (p && p.display_name) || 'Coach';
  var { error } = await _sb.from('coach_messages').insert({
    sender_id: S.currentUser.id, receiver_id: studentId, message_text: text,
    sender_name: name, read: false, created_at: new Date().toISOString()
  });
  if (error) { status.style.color = '#d4706e'; status.textContent = 'Error sending'; return; }
  await _sb.from('notifications').insert({
    user_id: studentId, type: 'coach_message', title: 'Message from ' + name,
    message: text.length > 70 ? text.slice(0,70) + '…' : text, read: false, created_at: new Date().toISOString()
  });
  loadCoachMessages();
}

// Functions called from inline HTML handlers
expose({ sendStudentMessage, loadCoachMessages, sendCoachMessage });

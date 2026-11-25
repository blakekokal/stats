import { S } from './core.js';
import { expose } from './core.js';
import { checkCoachingStudentNotifications } from './student-side.js';
import { checkCoachNotifications } from './students.js';
import { _sb } from './core.js';
import { ic } from '../icons.js';

// ═══════════════════════════════════════════════════════════════
// END PERFORMANCE ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════════════


// =============================================
// COACH / STUDENT SYSTEM
// =============================================

export var _userRole = 'student'; // 'student' or 'coach'
 // { id, name } — set when coach runs a combine for a student


export function generateInviteCode(userId) {
  // Generate a 6-char code from user ID (deterministic)
  var hash = 0;
  for (var i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  var n = Math.abs(hash);
  for (var j = 0; j < 6; j++) {
    code += chars[n % chars.length];
    n = Math.floor(n / chars.length) + userId.charCodeAt(j % userId.length);
  }
  return code;
}

// Switch the signed-in account's role and save it. The coaching app's own
// Student/Coach switch is gone (the switch now lives in Settings), so every
// element here is optional.
function setRole(role) {
  _userRole = role;
  var sBtn = document.getElementById('roleStudentBtn');
  var cBtn = document.getElementById('roleCoachBtn');
  if (sBtn && cBtn) {
    var on = role === 'student' ? sBtn : cBtn, off = role === 'student' ? cBtn : sBtn;
    on.style.background = '#007a52'; on.style.color = '#ffffff'; on.style.fontWeight = '700';
    off.style.background = '#282828'; off.style.color = '#606060'; off.style.fontWeight = '600';
  }
  var sc = document.getElementById('studentCodeSection'), ci = document.getElementById('coachInfoSection');
  if (sc) sc.style.display = role === 'student' ? 'flex' : 'none';
  if (ci) ci.style.display = role === 'student' ? 'none' : 'flex';
  if (role === 'coach') checkCoachNotifications();
  if (S.currentUser) saveRole(role);
}

// The signed-in account's role: { role: 'student' | 'coach', isAdmin, approved }.
// Admins are always coaches; approved means an admin has approved a coach request
// (so the player can switch back to Coach after trying Student).
export async function fetchMyRole() {
  if (!S.currentUser) return { role: 'student', isAdmin: false, approved: false };
  var { data } = await _sb.from('profiles').select('role, is_admin').eq('id', S.currentUser.id).single();
  var isAdmin = !!(data && data.is_admin);
  var role = isAdmin ? 'coach' : (data && data.role === 'coach' ? 'coach' : 'student');
  var approved = isAdmin || role === 'coach';
  if (!approved) {
    var { data: ok } = await _sb.from('coach_requests').select('id').eq('user_id', S.currentUser.id).eq('status', 'approved').limit(1);
    approved = !!(ok && ok.length);
  }
  _userRole = role;
  return { role: role, isAdmin: isAdmin, approved: approved };
}
export async function saveRole(role) {
  _userRole = role;
  if (!S.currentUser) return;
  var { error } = await _sb.from('profiles').update({ role: role }).eq('id', S.currentUser.id);
  if (error) throw new Error(error.message);
}

// Ask an admin for coach access: a coach_requests row, an in-app notification
// to each admin and an email. Returns 'sent', or 'pending' if one is already waiting.
export async function sendCoachRequest() {
  if (!S.currentUser) throw new Error('Log in first');
  var { data: existing } = await _sb.from('coach_requests')
    .select('id').eq('user_id', S.currentUser.id).eq('status', 'pending').limit(1);
  if (existing && existing.length > 0) return 'pending';
  var displayName = (S.currentUser.user_metadata && S.currentUser.user_metadata.display_name) || 'Unknown';
  var email = S.currentUser.email || '';
  var { error: insertErr } = await _sb.from('coach_requests').insert({
    user_id: S.currentUser.id, user_email: email, display_name: displayName, status: 'pending', created_at: new Date().toISOString()
  });
  if (insertErr) throw insertErr;
  var { data: admins } = await _sb.from('profiles').select('id').eq('is_admin', true);
  for (var i = 0; admins && i < admins.length; i++) {
    await _sb.from('notifications').insert({
      user_id: admins[i].id, type: 'coach_request', title: 'Coach Role Request',
      message: displayName + ' (' + email + ') is requesting coach access.', read: false, created_at: new Date().toISOString()
    });
  }
  await sendCoachRequestEmail(displayName, email);
  return 'sent';
}

// ─── COACH TEAMS SYSTEM ─────────────────────────────────────────────────────
// Supabase SQL to create the table (run once in your Supabase SQL editor):
//
//   CREATE TABLE coach_teams (
//     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//     coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
//     team_name TEXT NOT NULL,
//     created_at TIMESTAMPTZ DEFAULT now()
//   );
//   ALTER TABLE coach_teams ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "Coaches manage own teams" ON coach_teams FOR ALL USING (auth.uid() = coach_id);
//
//   -- Add team_id column to coach_students:
//   ALTER TABLE coach_students ADD COLUMN team_id UUID REFERENCES coach_teams(id) ON DELETE SET NULL;

// ─── COACH ROLE REQUEST SYSTEM ───────────────────────────────────────────────
// Supabase SQL to create the table (run once in your Supabase SQL editor):
//
//   CREATE TABLE coach_requests (
//     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
//     user_email TEXT,
//     display_name TEXT,
//     status TEXT DEFAULT 'pending',  -- 'pending' | 'approved' | 'denied'
//     created_at TIMESTAMPTZ DEFAULT now()
//   );
//   ALTER TABLE coach_requests ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "Users insert own" ON coach_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
//   CREATE POLICY "Users read own" ON coach_requests FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
//   CREATE POLICY "Admin update" ON coach_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
//
// Email via EmailJS (emailjs.com — free, 200 emails/month):
//   1. Sign up at emailjs.com
//   2. Add a Gmail service, create a template with variables:
//      {{from_name}}, {{from_email}}, {{to_email}}
//   3. Fill in the three constants below.

var _EMAILJS_SERVICE_ID  = 'service_vvxabqr';
var _EMAILJS_TEMPLATE_ID = 'template_c94gslr';
var _EMAILJS_PUBLIC_KEY  = '34VMCknAGDtqpdd0c';
var _ADMIN_EMAIL         = 'blakekokal@gmail.com';

async function requestCoachRole() {
  if (!S.currentUser) return;

  // Admins and coaches already have coach access; an approved player who chose
  // Student switches straight back. Everyone else asks (the modal below).
  var roleMsg = document.getElementById('roleMsg');
  var me = await fetchMyRole();
  if (me.role === 'coach' || me.approved) {
    if (me.role !== 'coach') setRole('coach');
    if (roleMsg) { roleMsg.style.color = '#00b87a'; roleMsg.textContent = "✓ You're a coach. Switch between Student and Coach in Settings."; }
    return;
  }

  // Show the explanation modal
  var modalMsg = document.getElementById('coachRequestModalMsg');
  var sendBtn = document.getElementById('coachRequestSendBtn');
  modalMsg.textContent = '';
  sendBtn.disabled = false;
  sendBtn.textContent = 'Send Request';
  var modal = document.getElementById('coachRequestModal');
  modal.style.display = 'flex';
}

async function submitCoachRequest() {
  if (!S.currentUser) return;

  var modalMsg = document.getElementById('coachRequestModalMsg');
  var sendBtn = document.getElementById('coachRequestSendBtn');

  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';
  modalMsg.style.color = '#606060';
  modalMsg.textContent = 'Submitting request...';

  try {
    if (await sendCoachRequest() === 'pending') {
      modalMsg.style.color = '#f0c830';
      modalMsg.innerHTML = ic('hourglass') + ' Request already pending — waiting for admin approval.';
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send Request';
      return;
    }

    modalMsg.style.color = '#00b87a';
    modalMsg.textContent = '✓ Request sent! You\'ll be notified when approved.';
    sendBtn.textContent = 'Sent!';

    // Close modal after short delay
    setTimeout(function() {
      document.getElementById('coachRequestModal').style.display = 'none';
      var roleMsg = document.getElementById('roleMsg');
      if (roleMsg) roleMsg.style.color = '#00b87a';
      if (roleMsg) roleMsg.textContent = '✓ Request sent! You\'ll be notified when approved.';
    }, 1500);
  } catch(e) {
    modalMsg.style.color = '#d4706e';
    modalMsg.textContent = 'Error: ' + (e.message || e);
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Request';
  }
}

async function sendCoachRequestEmail(displayName, requesterEmail) {
  // Skip if EmailJS not configured
  if (_EMAILJS_SERVICE_ID === 'YOUR_SERVICE_ID') return;
  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:  _EMAILJS_SERVICE_ID,
        template_id: _EMAILJS_TEMPLATE_ID,
        user_id:     _EMAILJS_PUBLIC_KEY,
        template_params: {
          to_email:    _ADMIN_EMAIL,
          from_name:   displayName,
          from_email:  requesterEmail,
          message:     displayName + ' (' + requesterEmail + ') has requested coach access to Blake Kokal Golf. Open the app → Coaching → Home to approve or deny.'
        }
      })
    });
  } catch(e) { console.warn('Email send failed:', e); }
}

export async function loadCoachRequests() {
  var section = document.getElementById('coachRequestsSection');
  var list = document.getElementById('coachRequestsList');
  if (!section || !list || !S.isAdmin) return;

  var { data, error } = await _sb.from('coach_requests')
    .select('*').eq('status', 'pending').order('created_at', { ascending: true });

  if (error || !data || data.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = '';
  data.forEach(function(req) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #282828;gap:8px;';
    row.innerHTML = '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (req.display_name || 'Unknown') + '</div>'
      + '<div style="font-size:11px;color:#606060;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (req.user_email || '') + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:6px;flex-shrink:0;">'
      + '<button onclick="approveCoachRequest(\'' + req.id + '\',\'' + req.user_id + '\')" style="background:#007a52;border:none;border-radius:6px;color:#ffffff;font-size:11px;font-weight:700;padding:5px 10px;cursor:pointer;height:auto;width:auto;max-width:none;">Approve</button>'
      + '<button onclick="denyCoachRequest(\'' + req.id + '\',this)" style="background:#2a1a1a;border:none;border-radius:6px;color:#ffffff;font-size:11px;font-weight:700;padding:5px 10px;cursor:pointer;height:auto;width:auto;max-width:none;">Deny</button>'
      + '</div>';
    list.appendChild(row);
  });
}

async function approveCoachRequest(requestId, userId) {
  // Update the request status
  await _sb.from('coach_requests').update({ status: 'approved' }).eq('id', requestId);
  // Promote the user's role
  await _sb.from('profiles').update({ role: 'coach' }).eq('id', userId);
  // Notify the user
  await _sb.from('notifications').insert({
    user_id: userId,
    type: 'coach_approved',
    title: 'Coach Access Approved!',
    message: 'Your request for coach access has been approved. Go to Settings to switch to Coach mode.',
    read: false,
    created_at: new Date().toISOString()
  });
  loadCoachRequests();
}

async function denyCoachRequest(requestId, btn) {
  btn.textContent = '...';
  await _sb.from('coach_requests').update({ status: 'denied' }).eq('id', requestId);
  loadCoachRequests();
}
// ─── END COACH ROLE REQUEST SYSTEM ───────────────────────────────────────────

function copyInviteCode() {
  var code = document.getElementById('myInviteCode').textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code);
    document.getElementById('profileMsg').textContent = '✓ Code copied!';
    document.getElementById('profileMsg').style.color = '#00b87a';
  }
}

export async function loadUserRole() {
  if (!S.currentUser) return;
  // Generate and show invite code
  var code = generateInviteCode(S.currentUser.id);
  document.getElementById('myInviteCode').textContent = code;

  // Save invite code to profiles if not already set
  await _sb.from('profiles').update({ invite_code: code }).eq('id', S.currentUser.id);

  // Load role from profile
  var { data } = await _sb.from('profiles').select('role, is_admin').eq('id', S.currentUser.id).single();
  S.isAdmin = !!(data && data.is_admin);
  if (S.isAdmin) {
    // Admin accounts are always coaches
    setRole('coach');
  } else if (data && data.role) {
    setRole(data.role);
  } else {
    setRole('student');
  }

  // Show pending notice if user has an outstanding coach request
  if (!S.isAdmin && (!data || data.role !== 'coach')) {
    var { data: pending } = await _sb.from('coach_requests')
      .select('id').eq('user_id', S.currentUser.id).eq('status', 'pending').limit(1);
    var roleMsg = document.getElementById('roleMsg');
    if (roleMsg && pending && pending.length > 0) {
      roleMsg.style.color = '#f0c830';
      roleMsg.innerHTML = ic('hourglass') + ' Coach request pending approval';
    }
  }
  // Check coaching notifications for home page dot
  if (typeof checkCoachingStudentNotifications === 'function') {
    checkCoachingStudentNotifications();
  }
  if (typeof checkCoachNotifications === 'function') {
    checkCoachNotifications();
  }
}

// Functions called from inline HTML handlers
expose({ setRole, requestCoachRole, submitCoachRequest, approveCoachRequest, denyCoachRequest, copyInviteCode });

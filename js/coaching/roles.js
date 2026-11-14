import { S } from './core.js';
import { expose } from './core.js';
import { checkCoachingStudentNotifications } from './student-side.js';
import { checkCoachNotifications } from './students.js';
import { _sb } from './core.js';

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

function setRole(role) {
  _userRole = role;
  // Update UI
  var sBtn = document.getElementById('roleStudentBtn');
  var cBtn = document.getElementById('roleCoachBtn');
  if (role === 'student') {
    sBtn.style.background = '#007a52'; sBtn.style.color = '#ffffff'; sBtn.style.fontWeight = '700';
    cBtn.style.background = '#282828'; cBtn.style.color = '#606060'; cBtn.style.fontWeight = '600';
    document.getElementById('studentCodeSection').style.display = 'flex';
    document.getElementById('coachInfoSection').style.display = 'none';
  } else {
    cBtn.style.background = '#007a52'; cBtn.style.color = '#ffffff'; cBtn.style.fontWeight = '700';
    sBtn.style.background = '#282828'; sBtn.style.color = '#606060'; sBtn.style.fontWeight = '600';
    document.getElementById('studentCodeSection').style.display = 'none';
    document.getElementById('coachInfoSection').style.display = 'flex';
    checkCoachNotifications();
  }
  // Save role to profiles table
  if (S.currentUser) {
    _sb.from('profiles').update({ role: role }).eq('id', S.currentUser.id);
  }
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

  // Admin always gets direct access
  if (S.isAdmin) { setRole('coach'); return; }

  // If already coach, switch back to student via Student btn
  if (_userRole === 'coach') { setRole('student'); return; }

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
    // Check for existing pending request
    var { data: existing } = await _sb.from('coach_requests')
      .select('id').eq('user_id', S.currentUser.id).eq('status', 'pending').limit(1);

    if (existing && existing.length > 0) {
      modalMsg.style.color = '#f0c830';
      modalMsg.textContent = '⏳ Request already pending — waiting for admin approval.';
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send Request';
      return;
    }

    var displayName = (S.currentUser.user_metadata && S.currentUser.user_metadata.display_name) || 'Unknown';
    var email = S.currentUser.email || '';

    // Insert request row
    var { error: insertErr } = await _sb.from('coach_requests').insert({
      user_id: S.currentUser.id,
      user_email: email,
      display_name: displayName,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    if (insertErr) throw insertErr;

    // In-app notification to admin
    var { data: admins } = await _sb.from('profiles').select('id').eq('is_admin', true);
    if (admins) {
      for (var i = 0; i < admins.length; i++) {
        await _sb.from('notifications').insert({
          user_id: admins[i].id,
          type: 'coach_request',
          title: 'Coach Role Request',
          message: displayName + ' (' + email + ') is requesting coach access.',
          read: false,
          created_at: new Date().toISOString()
        });
      }
    }

    // Email notification
    await sendCoachRequestEmail(displayName, email);

    modalMsg.style.color = '#00b87a';
    modalMsg.textContent = '✓ Request sent! You\'ll be notified when approved.';
    sendBtn.textContent = 'Sent!';

    // Close modal after short delay
    setTimeout(function() {
      document.getElementById('coachRequestModal').style.display = 'none';
      var roleMsg = document.getElementById('roleMsg');
      roleMsg.style.color = '#00b87a';
      roleMsg.textContent = '✓ Request sent! You\'ll be notified when approved.';
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
    title: 'Coach Access Approved! 🎉',
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
      roleMsg.textContent = '⏳ Coach request pending approval';
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

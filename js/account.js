// Account page: log in / sign up with the accounts shared with the coaching app,
// and, once signed in, the profile's strokes-gained handicap.

import { h, toast } from './app.js';
import { sync } from './store.js';
import { LEVELS } from './sg.js';

export const levelName = l => (l === 'Pro' ? 'Tour Pro' : l === 'Scratch' ? 'Scratch' : `${l} handicap`);

export function renderAccount(view) {
  const rerender = () => renderAccount(view);
  if (sync.recovering) return newPassword(view);
  if (sync.user) return signedIn(view, rerender);

  let signup = false;
  const email = h('input', { type: 'email', placeholder: 'Email', autocomplete: 'email', 'aria-label': 'Email' });
  const pass = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password', 'aria-label': 'Password' });
  const confirm = h('input', { type: 'password', placeholder: 'Confirm password', autocomplete: 'new-password', 'aria-label': 'Confirm password' });
  const name = h('input', { type: 'text', placeholder: 'Name', autocomplete: 'name', 'aria-label': 'Name' });
  const extra = h('div', { class: 'stack', hidden: true }, confirm, name);
  const msg = h('p', { class: 'muted' });
  const say = (text, bad) => { msg.textContent = text; msg.className = bad ? 'bad' : 'muted'; };
  const busy = async (text, fn) => { say(text); try { await fn(); } catch (e) { say(e.message || String(e), true); } };

  const loginBtn = h('button', { class: 'primary', onclick: () => {
    if (signup) { signup = false; extra.hidden = true; loginBtn.textContent = 'Log in'; signupBtn.textContent = 'Create account'; say(''); return; }
    if (!email.value.trim() || !pass.value) return say('Enter your email and password.', true);
    busy('Logging in…', async () => { await sync.signIn(email.value.trim(), pass.value); location.hash = '#/'; });
  } }, 'Log in');
  const signupBtn = h('button', { onclick: () => {
    if (!signup) { signup = true; extra.hidden = false; loginBtn.textContent = '← Back to log in'; signupBtn.textContent = 'Create account'; say(''); return; }
    if (!email.value.trim() || !pass.value) return say('Enter an email and password.', true);
    if (pass.value.length < 6) return say('Password must be at least 6 characters.', true);
    if (pass.value !== confirm.value) return say('Passwords do not match.', true);
    busy('Creating account…', async () => { await sync.signUp(email.value.trim(), pass.value, name.value.trim()); location.hash = '#/'; });
  } }, 'Create account');
  const forgot = h('button', { class: 'link', onclick: () => {
    if (!email.value.trim()) return say('Enter your email above, then tap Forgot password.', true);
    busy('Sending reset link…', async () => { await sync.resetPassword(email.value.trim()); say('Password reset email sent. Check your inbox.'); });
  } }, 'Forgot password?');

  view.replaceChildren(h('div', { class: 'page narrow' },
    h('h1', {}, 'Log in'),
    h('p', { class: 'muted' }, 'Use the same account as the coaching app. Your rounds are saved to it and appear on every device you log in on.'),
    h('div', { class: 'card stack' }, email, pass, extra,
      h('div', { class: 'row' }, loginBtn, signupBtn), forgot, msg)));
}

function signedIn(view, rerender) {
  const status = h('p', { class: 'muted' });
  const showStatus = () => {
    status.textContent = { syncing: 'Syncing…', ok: 'Rounds synced.', error: 'Sync problem: ' + sync.error }[sync.status] || '';
  };
  sync.onStatus(showStatus);
  const levelSel = h('select', { 'aria-label': 'Strokes gained handicap', onchange: async e => {
    try { await sync.setLevel(e.target.value); sessionStorage.removeItem('gs:level'); toast('Handicap saved.'); } catch (err) { toast(err.message || String(err)); }
  } }, LEVELS.map(l => h('option', { value: l, selected: l === (sync.level || 'Scratch') }, `vs ${levelName(l)}`)));

  view.replaceChildren(h('div', { class: 'page narrow' },
    h('h1', {}, sync.name),
    h('p', { class: 'muted' }, sync.email),
    h('div', { class: 'card stack' }, h('h3', {}, 'Strokes gained compared to'),
      h('p', { class: 'muted' }, 'The default on the hole screen and in your stats. Shared with the coaching app.'), levelSel),
    h('div', { class: 'card stack' }, h('h3', {}, 'Sync'), status,
      h('div', { class: 'row' },
        h('button', { onclick: () => sync.now() }, 'Sync now'),
        h('button', { class: 'danger', onclick: async () => { await sync.signOut(); rerender(); } }, 'Log out')))));
  showStatus();
}

// After following the link in a password-reset email.
function newPassword(view) {
  const pass = h('input', { type: 'password', placeholder: 'New password', autocomplete: 'new-password', 'aria-label': 'New password' });
  const confirm = h('input', { type: 'password', placeholder: 'Confirm new password', autocomplete: 'new-password', 'aria-label': 'Confirm new password' });
  const msg = h('p', { class: 'muted' });
  const say = (text, bad) => { msg.textContent = text; msg.className = bad ? 'bad' : 'muted'; };
  view.replaceChildren(h('div', { class: 'page narrow' },
    h('h1', {}, 'Set a new password'),
    h('p', { class: 'muted' }, 'This changes your password for the coaching app too.'),
    h('div', { class: 'card stack' }, pass, confirm,
      h('button', { class: 'primary', onclick: async () => {
        if (pass.value.length < 6) return say('Password must be at least 6 characters.', true);
        if (pass.value !== confirm.value) return say('Passwords do not match.', true);
        say('Saving…');
        try { await sync.setPassword(pass.value); toast('Password updated.'); location.hash = '#/'; } catch (e) { say(e.message || String(e), true); }
      } }, 'Save password'), msg)));
}

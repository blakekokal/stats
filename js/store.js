// Local-first document store, synced to the user's account.
//
// Every document lives in localStorage as { data, updated, deleted }. When the
// user is signed in, documents are merged with the `shot_tracker_docs` table,
// newest `updated` timestamp winning per document. Deletes are kept as
// tombstones so they propagate to other devices. Accounts are the ones shared
// with the coaching app (same Supabase project).

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const DOCS_KEY = 'gs:docs';
const OWNER_KEY = 'gs:owner'; // the account the local documents belong to
const TABLE = 'shot_tracker_docs';

// One-time reset: data saved before accounts arrived is discarded so every
// device starts fresh.
const DATA_VERSION = '2';
if (localStorage.getItem('gs:dataVersion') !== DATA_VERSION) {
  ['gs:docs', 'gs:sync', OWNER_KEY].forEach(k => localStorage.removeItem(k));
  localStorage.setItem('gs:dataVersion', DATA_VERSION);
}

let docs = {};
try { docs = JSON.parse(localStorage.getItem(DOCS_KEY) || '{}'); } catch { docs = {}; }

const listeners = new Set();
function persist() { localStorage.setItem(DOCS_KEY, JSON.stringify(docs)); }
function emit() { listeners.forEach(fn => fn()); }
function clearLocal() { docs = {}; persist(); emit(); }

export const store = {
  get(key) { const d = docs[key]; return d && !d.deleted ? d.data : null; },
  list(prefix) {
    return Object.keys(docs).filter(k => k.startsWith(prefix) && !docs[k].deleted).map(k => docs[k].data);
  },
  set(key, data) { docs[key] = { data, updated: Date.now() }; persist(); scheduleSync(); },
  remove(key) { docs[key] = { data: null, updated: Date.now(), deleted: true }; persist(); scheduleSync(); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  exportAll() { return JSON.stringify(docs); },
  importAll(json) {
    const incoming = JSON.parse(json);
    for (const [k, d] of Object.entries(incoming)) {
      if (d && typeof d.updated === 'number' && (!docs[k] || d.updated > docs[k].updated)) docs[k] = d;
    }
    persist(); emit(); scheduleSync();
  },
};

// ---- Accounts and sync ----

// The strokes-gained baseline saved on the user's profile (shared with the
// coaching app as hcp_preference: 'pro', '0', '5' ... '30'), as one of LEVELS.
const LEVEL_OF = { pro: 'Pro', 0: 'Scratch' };
export const levelFromPref = p => (p == null ? null : LEVEL_OF[p] || String(p));
const prefFromLevel = l => (l === 'Pro' ? 'pro' : l === 'Scratch' ? '0' : l);

export const sync = {
  status: 'off', // off | signed-out | syncing | ok | error
  error: '',
  user: null,
  get email() { return sync.user?.email || ''; },
  get name() { return sync.user?.user_metadata?.display_name || sync.email; },
  get level() { return levelFromPref(sync.user?.user_metadata?.hcp_preference); },
  async signIn(email, password) {
    const c = getClient(); if (!c) throw new Error('Accounts are unavailable right now.');
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await init();
  },
  async signUp(email, password, name) {
    const c = getClient(); if (!c) throw new Error('Accounts are unavailable right now.');
    const { data, error } = await c.auth.signUp({ email, password, options: { data: { display_name: name || email.split('@')[0] } } });
    if (error) throw error;
    if (!data.session) throw new Error('Account created. Confirm the email we sent you, then log in.');
    await init();
  },
  async resetPassword(email) {
    const c = getClient(); if (!c) throw new Error('Accounts are unavailable right now.');
    // The link in the email brings the user back to this page (this address
    // must be in the Supabase project's Redirect URLs list).
    const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw error;
  },
  // True after arriving from a password-reset email, until a new password is set.
  recovering: false,
  async setPassword(password) {
    const c = getClient(); if (!c) throw new Error('Accounts are unavailable right now.');
    const { error } = await c.auth.updateUser({ password });
    if (error) throw error;
    sync.recovering = false;
    await init();
  },
  // Saved the same way as the coaching app: on the profile row and the user's metadata.
  async setLevel(level) {
    const c = getClient(); if (!c || !sync.user) return;
    const hcp = prefFromLevel(level);
    await c.from('profiles').update({ hcp_preference: hcp }).eq('id', sync.user.id);
    const { data, error } = await c.auth.updateUser({ data: { hcp_preference: hcp } });
    if (error) throw error;
    sync.user = data.user;
    setStatus(sync.status, sync.error);
  },
  async setName(name) {
    const c = getClient(); if (!c || !sync.user) throw new Error('Log in first.');
    const { data, error } = await c.auth.updateUser({ data: { display_name: name } });
    if (error) throw error;
    sync.user = data.user;
    setStatus(sync.status, sync.error);
  },
  async changePassword(password) {
    const c = getClient(); if (!c || !sync.user) throw new Error('Log in first.');
    const { error } = await c.auth.updateUser({ password });
    if (error) throw error;
  },
  async signOut() {
    const c = getClient(); if (c) await c.auth.signOut();
    localStorage.removeItem(OWNER_KEY); clearLocal();
    await init();
  },
  now: () => runSync(),
  onStatus(fn) { statusListeners.add(fn); },
};

const statusListeners = new Set();
function setStatus(status, error = '') { sync.status = status; sync.error = error; statusListeners.forEach(fn => fn()); }

let client = null;
function getClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) return null;
  if (!client) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    client.auth.onAuthStateChange(event => {
      if (event !== 'PASSWORD_RECOVERY') return;
      sync.recovering = true;
      location.hash = '#/account';
      setStatus(sync.status, sync.error);
    });
  }
  return client;
}

export async function init() {
  const c = getClient();
  sync.user = null;
  if (!c) return setStatus('off');
  try {
    const { data } = await c.auth.getSession();
    if (!data.session) return setStatus('signed-out');
    const { data: fresh } = await c.auth.getUser();
    sync.user = fresh.user || data.session.user;
    // Local documents belong to whoever last signed in here; never mix accounts.
    const owner = localStorage.getItem(OWNER_KEY);
    if (owner && owner !== sync.user.id) clearLocal();
    localStorage.setItem(OWNER_KEY, sync.user.id);
    await runSync();
  } catch (e) { setStatus('error', e.message || String(e)); }
}

let timer = null;
function scheduleSync() {
  if (!sync.user) return;
  clearTimeout(timer);
  timer = setTimeout(runSync, 1500);
}

let running = false, again = false;
async function runSync() {
  const c = getClient();
  if (!c || !sync.user) return;
  if (running) { again = true; return; }
  running = true; setStatus('syncing');
  try {
    const { data: rows, error } = await c.from(TABLE).select('key, doc, updated');
    if (error) throw error;
    const remote = {};
    let changed = false;
    for (const r of rows) {
      remote[r.key] = r.updated;
      if (!docs[r.key] || r.updated > docs[r.key].updated) {
        docs[r.key] = { data: r.doc.data, updated: r.updated, ...(r.doc.deleted ? { deleted: true } : {}) };
        changed = true;
      }
    }
    const push = Object.entries(docs)
      .filter(([k, d]) => !(k in remote) || d.updated > remote[k])
      .map(([k, d]) => ({ user_id: sync.user.id, key: k, updated: d.updated, doc: { data: d.data, deleted: !!d.deleted } }));
    if (push.length) {
      const { error: e2 } = await c.from(TABLE).upsert(push, { onConflict: 'user_id,key' });
      if (e2) throw e2;
    }
    if (changed) { persist(); emit(); }
    setStatus('ok');
  } catch (e) {
    setStatus('error', e.message || String(e));
  } finally {
    running = false;
    if (again) { again = false; scheduleSync(); }
  }
}

window.addEventListener('online', () => runSync());
document.addEventListener('visibilitychange', () => { if (!document.hidden) runSync(); });

// Run once in the Supabase SQL editor to create this app's table.
export const SETUP_SQL = `create table if not exists shot_tracker_docs (
  user_id uuid not null references auth.users on delete cascade,
  key text not null,
  doc jsonb not null,
  updated bigint not null,
  primary key (user_id, key)
);
alter table shot_tracker_docs enable row level security;
create policy "own rows" on shot_tracker_docs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);`;

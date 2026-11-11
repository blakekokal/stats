// Local-first document store with optional Supabase sync.
//
// Every document lives in localStorage as { data, updated, deleted }. When sync
// is configured and the user is signed in, documents are merged with the
// `golf_docs` table, newest `updated` timestamp winning per document. Deletes
// are kept as tombstones so they propagate to other devices.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const DOCS_KEY = 'gs:docs';
const SYNC_KEY = 'gs:sync';

let docs = {};
try { docs = JSON.parse(localStorage.getItem(DOCS_KEY) || '{}'); } catch { docs = {}; }

const listeners = new Set();
function persist() { localStorage.setItem(DOCS_KEY, JSON.stringify(docs)); }
function emit() { listeners.forEach(fn => fn()); }

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

// ---- Sync ----

export const sync = {
  status: 'off', // off | signed-out | syncing | ok | error
  error: '',
  email: '',
  config() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'); } catch { /* ignore */ }
    return { url: saved.url || SUPABASE_URL, key: saved.key || SUPABASE_ANON_KEY };
  },
  setConfig(url, key) {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ url: url.trim(), key: key.trim() }));
    client = null;
    return init();
  },
  async signIn(email, password) {
    const c = getClient(); if (!c) throw new Error('Add the Supabase URL and key first.');
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await init();
  },
  async signUp(email, password) {
    const c = getClient(); if (!c) throw new Error('Add the Supabase URL and key first.');
    const { data, error } = await c.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('Account created. Confirm the email Supabase sent you, then sign in.');
    await init();
  },
  async signOut() { const c = getClient(); if (c) await c.auth.signOut(); await init(); },
  now: () => runSync(),
  onStatus(fn) { statusListeners.add(fn); },
};

const statusListeners = new Set();
function setStatus(status, error = '') { sync.status = status; sync.error = error; statusListeners.forEach(fn => fn()); }

let client = null;
let userId = null;
function getClient() {
  const { url, key } = sync.config();
  if (!url || !key || !window.supabase) return null;
  if (!client) client = window.supabase.createClient(url, key);
  return client;
}

export async function init() {
  const c = getClient();
  userId = null; sync.email = '';
  if (!c) return setStatus('off');
  try {
    const { data } = await c.auth.getSession();
    if (!data.session) return setStatus('signed-out');
    userId = data.session.user.id; sync.email = data.session.user.email || '';
    await runSync();
  } catch (e) { setStatus('error', e.message || String(e)); }
}

let timer = null;
function scheduleSync() {
  if (!userId) return;
  clearTimeout(timer);
  timer = setTimeout(runSync, 1500);
}

let running = false, again = false;
async function runSync() {
  const c = getClient();
  if (!c || !userId) return;
  if (running) { again = true; return; }
  running = true; setStatus('syncing');
  try {
    const { data: rows, error } = await c.from('golf_docs').select('key, doc, updated');
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
      .map(([k, d]) => ({ user_id: userId, key: k, updated: d.updated, doc: { data: d.data, deleted: !!d.deleted } }));
    if (push.length) {
      const { error: e2 } = await c.from('golf_docs').upsert(push, { onConflict: 'user_id,key' });
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

export const SETUP_SQL = `create table if not exists golf_docs (
  user_id uuid not null references auth.users on delete cascade,
  key text not null,
  doc jsonb not null,
  updated bigint not null,
  primary key (user_id, key)
);
alter table golf_docs enable row level security;
create policy "own rows" on golf_docs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);`;

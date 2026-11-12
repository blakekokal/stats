// Home, New Round, Round History, Settings and Log in, laid out like the
// coaching app. Only entering a round (GPS, Bridlewood), round history and the
// account settings work for now; the other buttons are shown but disabled.

import { h, course, toast } from './app.js';
import { store, sync } from './store.js';
import { newRound } from './model.js';
import { LEVELS } from './sg.js';
import { VERSION } from './version.js';
import { setCurrentRound, summarize, historyRounds, roundKeyOf } from './rounds.js';
import { downloadRoundCsv } from './dashboard.js';

const PREF_LABEL = { Pro: 'Tour Pro', Scratch: 'Scratch (0)' };
const levelOpt = (l, sel, short) => h('option', { value: l, selected: l === sel },
  short ? `vs ${l === 'Pro' ? 'Tour Pro' : l === 'Scratch' ? 'Scratch' : l + ' HCP'}` : `Compare to: ${PREF_LABEL[l] || l + ' Handicap'}`);
const profileLevel = () => (LEVELS.includes(sync.level) ? sync.level : 'Pro');
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
const fmtDate = d => { const [y, m, dd] = d.split('-').map(Number); return `${m}/${dd}/${y}`; };

function backBtn(href = '#/') {
  const b = h('button', { class: 'back-btn-top', 'aria-label': 'Back', onclick: () => { location.hash = href; } });
  b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>';
  return b;
}
const page = (cls, ...kids) => h('div', { class: 'cx ' + cls }, ...kids);
const needLogin = view => { if (sync.user) return false; renderLogin(view); return true; };

// ---------- home ----------

export function renderHome(view) {
  const soon = (ic, title, sub, bg, badge) => h('button', { class: 'homebtn', disabled: true, title: 'Coming soon', style: `background:${bg}` },
    h('span', { class: 'ic' }, ic), h('div', { style: 'flex:1' }, h('div', { class: 't' }, title), h('div', { class: 's' }, sub)), badge || null);
  const go = (ic, title, sub, bg, href) => h('button', { class: 'homebtn', style: `background:${bg}`, onclick: () => { location.hash = href; } },
    h('span', { class: 'ic' }, ic), h('div', {}, h('div', { class: 't' }, title), h('div', { class: 's' }, sub)));
  const divider = () => h('div', { style: 'height:1px;background:#282828;margin:3px 0;' });
  const search = h('button', { class: 'iconbtn', disabled: true, title: 'Coming soon' });
  search.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2.5" stroke-linecap="round" style="width:18px;height:18px;"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

  const brand = h('div', { style: 'text-align:center;margin-bottom:6px;' });
  brand.innerHTML = `<div style="font-family:'Barlow Condensed',system-ui,sans-serif;font-size:2.8rem;font-weight:900;letter-spacing:1px;line-height:1.0;color:#ffffff;">Blake Kokal<br><span style="display:inline-flex;align-items:baseline;justify-content:center;"><span style="font-size:10px;visibility:hidden;font-weight:600;">What's new</span><span style="font-size:13px;visibility:hidden;font-weight:700;margin-right:5px;">v${VERSION}</span>Golf<span class="wn" style="font-size:13px;color:#2e2e2e;font-weight:700;margin-left:6px;cursor:pointer;">v${VERSION}</span><span class="wn" style="font-size:10px;color:#44b8f0;font-weight:600;margin-left:5px;cursor:pointer;">&#x2190; What's new</span></span></div>`;
  brand.querySelectorAll('.wn').forEach(el => el.addEventListener('click', () => { location.hash = '#/whatsnew'; }));
  brand.append(h('div', { style: 'font-size:11px;color:#2e2e2e;margin-top:3px;' }, sync.user ? '👤 ' + sync.name : ''));

  view.replaceChildren(page('center',
    h('div', { style: 'width:100%;max-width:320px;display:flex;flex-direction:column;gap:7px;' },
      // Help on the left and search + settings on the right, level with the
      // "Blake Kokal" line and spread to the screen edges.
      h('div', { style: 'position:relative;' }, brand,
        h('div', { class: 'iconrow' },
          h('button', { class: 'iconbtn', disabled: true, title: 'Coming soon' }, '❓'),
          h('div', { style: 'display:flex;gap:4px;' }, search,
            h('button', { class: 'iconbtn', 'aria-label': 'Settings', onclick: () => { location.hash = '#/settings'; } }, '⚙️')))),
      go('⛳', 'Enter New Round', 'Track every shot', '#007a52', '#/new'),
      go('📋', 'Round History', 'All past rounds', '#00402c', '#/history'),
      divider(),
      go('📊', 'Stats Dashboard', 'Analytics & trends', '#3d96ee', '#/dashboard'),
      soon('🔍', 'Performance Analysis', 'Uncover your biggest misses & areas to improve', '#2d7abc'),
      soon('🎒', 'My Bag', 'Club distances & yardages', '#1a4a8a'),
      divider(),
      soon('🏌️', 'Practice and Learning', 'Combines · Drills · Practice · Learn', '#d49a10',
        h('span', { style: 'background:#d4706e;color:#fff;font-size:10px;font-weight:800;border-radius:10px;padding:2px 7px;flex-shrink:0;white-space:nowrap;animation:cxpulse 1.5s infinite;' }, 'NEW!')),
      soon('🎓', 'Coaching', 'Connect with your coach', '#00402c')),
    sync.user ? null : h('button', { class: 'linkbtn', style: 'margin-top:18px;', onclick: () => { location.hash = '#/account'; } }, 'Log In / Sign Up')));
}

// ---------- new round ----------

export function renderNewRound(view) {
  const name = h('input', { placeholder: 'Player Name', value: sync.user ? sync.name : '' });
  const level = h('select', { class: 'bigsel', style: 'flex:1;', 'aria-label': 'Compare to' }, LEVELS.map(l => levelOpt(l, profileLevel())));
  const date = h('input', { type: 'date', value: today(), style: 'flex:1;' });
  const lastTee = (store.get('settings') || {}).tee;
  const teeInfo = h('div', { style: 'width:100%;max-width:320px;text-align:center;font-size:12px;color:#606060;margin-top:-4px;' });
  const tee = h('select', { class: 'bigsel', 'aria-label': 'Tee box', onchange: () => showTee() },
    h('option', { value: '' }, 'Select Tee Box...'),
    course.tees.map(t => h('option', { value: t.name, selected: t.name === lastTee }, `${t.name} · ${t.yards.reduce((a, b) => a + b, 0)} yds`)));
  const par = course.holes.reduce((a, c) => a + c.par, 0);
  function showTee() {
    const t = course.tees.find(x => x.name === tee.value);
    teeInfo.textContent = t ? `Par ${par} · ${t.yards.reduce((a, b) => a + b, 0).toLocaleString()} yds · Rating ${t.rating} / Slope ${t.slope}` : '';
  }
  showTee();
  const place = h('input', { type: 'number', inputmode: 'numeric', min: 1, placeholder: 'Place (e.g. 1, 2, 3...)' });
  const placeWrap = h('div', { style: 'width:100%;max-width:320px;', hidden: true }, place);
  const type = h('select', { class: 'bigsel', 'aria-label': 'Round type', onchange: () => { placeWrap.hidden = type.value !== 'Tournament'; } },
    h('option', { value: 'Casual' }, 'Round Type: Casual'), h('option', { value: 'Tournament' }, 'Round Type: Tournament'));

  let holes = 18;
  const pick = (btn, n) => { b9.classList.remove('selected'); b18.classList.remove('selected'); if (btn) btn.classList.add('selected'); holes = n; if (btn) custom.value = ''; };
  const b9 = h('button', { class: 'holes9', onclick: () => pick(b9, 9) }, '9 Holes');
  const b18 = h('button', { class: 'holes18 selected', onclick: () => pick(b18, 18) }, '18 Holes');
  const custom = h('input', { type: 'number', inputmode: 'numeric', min: 3, max: 18, placeholder: 'Custom # of Holes (3–18)', oninput: () => { const n = parseInt(custom.value, 10); if (n >= 3 && n <= 18) pick(null, n); } });

  const err = h('div', { class: 'msg err' });
  const confirm = h('button', { class: 'holes9', onclick: () => {
    if (!tee.value) { err.textContent = 'Select a tee box.'; return; }
    if (custom.value && !(+custom.value >= 3 && +custom.value <= 18)) { err.textContent = 'Custom holes must be 3 to 18.'; return; }
    const r = { ...newRound(course, tee.value, date.value || today()), courseName: course.name, player: name.value.trim() || (sync.user ? sync.name : ''),
      level: level.value, type: type.value, place: type.value === 'Tournament' && place.value ? +place.value : null, holeCount: holes };
    store.set(roundKeyOf(r.id), r);
    setCurrentRound(r.id); sessionStorage.removeItem('gs:viewOnly'); sessionStorage.removeItem('gs:editingPast');
    store.set('settings', { ...(store.get('settings') || {}), tee: tee.value });
    sessionStorage.removeItem('gs:level');
    location.hash = '#/hole/1';
  } }, 'START');

  view.replaceChildren(page('top', backBtn(),
    h('div', { style: 'font-size:22px;font-weight:800;' }, 'New Round'),
    name,
    h('div', { class: 'row' }, level, date),
    h('input', { value: course.name, readonly: true, 'aria-label': 'Course', title: 'Bridlewood is the only course for now' }),
    tee, teeInfo, type, placeWrap,
    h('div', { class: 'row' }, b9, b18),
    custom,
    h('div', { style: 'width:100%;max-width:320px;margin-top:4px;' },
      h('div', { style: 'font-size:11px;color:#606060;text-align:center;margin-bottom:6px;letter-spacing:0.5px;text-transform:uppercase;' }, 'Entry Mode'),
      h('div', { style: 'display:flex;background:#222;border-radius:10px;overflow:hidden;border:1px solid #333;' },
        h('button', { style: 'flex:1;height:40px;border-radius:0;font-size:13px;font-weight:700;background:#007a52;color:#fff;max-width:none;' }, 'GPS'))),
    confirm, err,
    h('div', { style: 'margin-top:6px;display:flex;gap:8px;justify-content:center;width:100%;max-width:320px;' },
      h('button', { disabled: true, title: 'Coming soon', style: 'background:transparent;border:1px solid #3d3d3d;color:#606060;font-size:12px;height:auto;padding:8px 12px;width:auto;' }, '+ Create Custom Course'),
      h('button', { disabled: true, title: 'Coming soon', style: 'background:transparent;border:1px solid #3d3d3d;color:#606060;font-size:12px;height:auto;padding:8px 12px;width:auto;' }, 'My Courses'))));
}

// ---------- round history ----------

export function renderHistory(view) {
  if (needLogin(view)) return;
  const level = profileLevel();
  const sel = (opts, def) => h('select', { class: 'minisel', onchange: () => draw() }, opts.map(([v, l]) => h('option', { value: v, selected: v === def }, l)));
  const fType = sel([['all', 'All Types'], ['Casual', 'Casual'], ['Tournament', 'Tournament']]);
  const fHoles = sel([['all', 'All Holes'], ['9', '9 Holes'], ['18', '18 Holes']]);
  const fTime = sel([['all', 'All Time'], ['1', 'Last Month'], ['3', 'Last 3 Months'], ['6', 'Last 6 Months']]);
  const fStatus = sel([['all', 'All Status'], ['complete', 'Completed'], ['incomplete', 'In Progress']]);
  const sort = sel([['date-desc', 'Date: Newest'], ['date-asc', 'Date: Oldest'], ['score-asc', 'Score: Low→High'], ['score-desc', 'Score: High→Low']]);
  const search = h('input', { type: 'text', placeholder: '🔍 Search course name...', style: 'max-width:360px;margin-bottom:6px;', oninput: () => draw() });
  const msg = h('div', { style: 'font-size:13px;color:#606060;min-height:20px;text-align:center;' });
  const list = h('div', { style: 'width:100%;' });
  const filtMsg = h('div', { style: 'font-size:12px;color:#606060;text-align:center;margin-top:6px;' });

  function draw() {
    const all = historyRounds().map(r => ({ r, s: summarize(r, course, level) }));
    if (!all.length) { msg.textContent = 'No rounds yet. Tap Enter New Round on the home screen to start one.'; list.replaceChildren(); filtMsg.textContent = ''; return; }
    const q = search.value.toLowerCase().trim();
    let cutoff = null;
    if (fTime.value !== 'all') { cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - +fTime.value); }
    const shown = all.filter(({ r, s }) => {
      if (q && !(r.courseName || course.name).toLowerCase().includes(q) && !r.date.includes(q)) return false;
      if (fType.value !== 'all' && (r.type || 'Casual') !== fType.value) return false;
      if (fHoles.value !== 'all' && s.count !== +fHoles.value) return false;
      if (fStatus.value === 'complete' && s.incomplete) return false;
      if (fStatus.value === 'incomplete' && !s.incomplete) return false;
      if (cutoff && new Date(r.date + 'T12:00:00') < cutoff) return false;
      return true;
    }).sort((x, y) => ({ 'date-desc': y.r.date.localeCompare(x.r.date) || y.r.updated - x.r.updated, 'date-asc': x.r.date.localeCompare(y.r.date),
      'score-asc': x.s.score - y.s.score, 'score-desc': y.s.score - x.s.score })[sort.value]);
    msg.textContent = `${shown.length} of ${all.length} round(s)`;
    filtMsg.textContent = shown.length < all.length ? 'Filters active' : '';
    if (!shown.length) { list.replaceChildren(h('div', { style: 'text-align:center;color:#606060;padding:16px;font-size:13px;' }, 'No rounds match your filters')); return; }
    list.replaceChildren(...shown.map(({ r, s }) => card(r, s)));
  }

  function card(r, s) {
    const tp = s.toPar > 0 ? '+' + s.toPar : s.toPar === 0 ? 'E' : String(s.toPar);
    const del = (w, ht) => h('button', { style: `width:${w}px;max-width:none;height:${ht}px;font-size:12px;background:#e06060;border-radius:6px;`, onclick: e => {
      e.stopPropagation();
      if (confirm(`Delete the round from ${fmtDate(r.date)}? This removes it from every device.`)) { store.remove(roundKeyOf(r.id)); draw(); }
    } }, 'Del');
    const resume = () => { sessionStorage.removeItem('gs:viewOnly'); sessionStorage.removeItem('gs:editingPast'); setCurrentRound(r.id); store.set('settings', { ...(store.get('settings') || {}), tee: r.tee }); sessionStorage.removeItem('gs:level'); location.hash = `#/hole/${s.firstOpen || 1}`; };
    const holesInfo = s.done < s.count ? `${s.done}/${s.count} holes` : `${s.count} holes`;
    return h('div', { class: 'card', style: s.incomplete ? 'border-left:3px solid #d4706e;cursor:pointer;' : '', onclick: s.incomplete ? resume : null },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;' },
        h('div', {},
          h('div', { style: 'font-weight:700;font-size:15px;' }, r.courseName || course.name, s.incomplete ? h('span', { style: 'color:#f0c830;font-size:10px;font-weight:700;' }, ' ⏸ In Progress') : null),
          r.type === 'Tournament' ? h('div', { style: 'color:#f0c830;font-size:11px;font-weight:700;margin-top:2px;' }, '★ Tournament' + (r.place ? ` — ${ordinal(r.place)} Place` : '')) : null,
          h('div', { style: 'font-size:12px;color:#9a9a9a;' }, `${fmtDate(r.date)} · ${holesInfo}${r.player ? ' · ' + r.player : ''}`)),
        h('div', { style: 'text-align:right;' }, s.incomplete
          ? h('div', { style: 'font-size:14px;font-weight:700;color:#f0c830;' }, 'In Progress')
          : [h('div', { style: 'font-size:20px;font-weight:800;' }, String(s.score)),
            h('div', { style: `font-size:13px;color:${s.toPar > 0 ? '#d4706e' : s.toPar < 0 ? '#00a06d' : '#9a9a9a'}` }, tp)])),
      h('div', { style: 'display:flex;gap:6px;margin-top:8px;' }, s.incomplete
        ? [h('button', { style: 'flex:2;max-width:none;height:34px;font-size:13px;font-weight:700;background:#d4706e;border-radius:6px;', onclick: e => { e.stopPropagation(); resume(); } }, '▶ Resume Round'), del(60, 34)]
        : [h('button', { style: 'flex:1;max-width:none;height:30px;font-size:12px;background:#007a52;border-radius:6px;font-weight:700;', onclick: e => {
            e.stopPropagation();
            setCurrentRound(r.id); sessionStorage.setItem('gs:viewOnly', '1'); sessionStorage.removeItem('gs:editingPast'); sessionStorage.removeItem('gs:level');
            store.set('settings', { ...(store.get('settings') || {}), tee: r.tee });
            location.hash = '#/hole/1';
          } }, 'View/Edit'),
          h('button', { style: 'flex:1;max-width:none;height:30px;font-size:12px;background:#2d7abc;border-radius:6px;', onclick: e => { e.stopPropagation(); location.hash = `#/dashboard/${r.id}`; } }, 'Stats'),
          h('button', { title: 'Download scorecard (CSV)', style: 'width:50px;max-width:none;height:30px;font-size:12px;background:#00402c;border-radius:6px;', onclick: e => { e.stopPropagation(); downloadRoundCsv(r); } }, '📥'),
          del(50, 30)]));
  }

  view.replaceChildren(page('top', backBtn(),
    h('div', { style: 'width:100%;max-width:360px;' },
      h('div', { style: 'font-size:20px;font-weight:800;text-align:center;margin-bottom:8px;' }, '📋 Round History'),
      search,
      h('div', { style: 'display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-bottom:8px;' }, fType, fHoles, fTime, fStatus, sort),
      msg, list, filtMsg)));
  draw();
}
const ordinal = n => (n % 100 >= 11 && n % 100 <= 13 ? n + 'th' : n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));

// ---------- edit a past round ----------

export function renderEditRound(view, id) {
  if (needLogin(view)) return;
  const key = roundKeyOf(id), r = store.get(key);
  if (!r) { location.hash = '#/history'; return; }
  const name = h('input', { placeholder: 'Player Name', value: r.player || '' });
  const level = h('select', { class: 'bigsel', style: 'flex:1;', 'aria-label': 'Compare to' }, LEVELS.map(l => levelOpt(l, r.level || profileLevel())));
  const date = h('input', { type: 'date', value: r.date, style: 'flex:1;' });
  const tee = h('select', { class: 'bigsel', 'aria-label': 'Tee box' }, course.tees.map(t => h('option', { value: t.name, selected: t.name === r.tee }, `${t.name} · ${t.yards.reduce((a, b) => a + b, 0)} yds`)));
  const place = h('input', { type: 'number', inputmode: 'numeric', min: 1, placeholder: 'Place (e.g. 1, 2, 3...)', value: r.place || '' });
  const placeWrap = h('div', { style: 'width:100%;max-width:320px;', hidden: (r.type || 'Casual') !== 'Tournament' }, place);
  const type = h('select', { class: 'bigsel', 'aria-label': 'Round type', onchange: () => { placeWrap.hidden = type.value !== 'Tournament'; } },
    ['Casual', 'Tournament'].map(t => h('option', { value: t, selected: t === (r.type || 'Casual') }, `Round Type: ${t}`)));
  const msg = h('div', { class: 'msg' });
  const save = () => {
    store.set(key, { ...store.get(key), player: name.value.trim(), level: level.value, date: date.value || r.date, tee: tee.value,
      type: type.value, place: type.value === 'Tournament' && place.value ? +place.value : null, updated: Date.now() });
  };
  view.replaceChildren(page('top', backBtn('#/history'),
    h('div', { style: 'font-size:22px;font-weight:800;' }, 'Edit Round'),
    h('div', { style: 'font-size:12px;color:#9a9a9a;' }, r.courseName || course.name),
    name, h('div', { class: 'row' }, level, date), tee, type, placeWrap,
    h('button', { class: 'holes9', onclick: () => { save(); msg.textContent = '✓ Saved'; msg.className = 'msg ok'; setTimeout(() => { location.hash = '#/history'; }, 500); } }, 'SAVE'),
    h('button', { class: 'holes18', onclick: () => {
      save(); setCurrentRound(id); sessionStorage.removeItem('gs:viewOnly'); store.set('settings', { ...(store.get('settings') || {}), tee: tee.value }); sessionStorage.removeItem('gs:level');
      location.hash = '#/hole/1';
    } }, 'EDIT SHOTS ON THE MAP'),
    h('div', { style: 'font-size:11px;color:#606060;max-width:300px;' }, 'Opens the round on hole 1. Use Undo to change shots, then leave with Home → End and submit round.'),
    msg));
}

// ---------- settings ----------

export function renderSettingsPage(view) {
  if (needLogin(view)) return;
  const u = sync.user;
  const msgEl = () => h('div', { class: 'msg' });
  const say = (el, text, ok) => { el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err'); };
  const nameIn = h('input', { placeholder: 'Display Name', value: u.user_metadata?.display_name || '' });
  const nameMsg = msgEl(), hcpMsg = msgEl(), pwMsg = msgEl(), driveMsg = msgEl();
  const drive = h('input', { type: 'number', inputmode: 'numeric', min: 0, max: 450, placeholder: 'Yards (e.g. 250)', value: sync.avgDrive || '', style: 'max-width:180px;height:36px;font-size:14px;border-radius:8px;',
    onchange: async () => {
      const v = drive.value.trim() === '' ? null : Math.round(+drive.value);
      if (v != null && !(v >= 50 && v <= 450)) return say(driveMsg, 'Enter 50 to 450 yards, or leave blank');
      try { await sync.setAvgDrive(v); say(driveMsg, v ? '✓ Saved' : '✓ Cleared', true); setTimeout(() => { driveMsg.textContent = ''; }, 2000); }
      catch (e) { say(driveMsg, 'Error saving'); }
    } });
  const joined = u.created_at ? new Date(u.created_at) : null;
  const hcp = h('select', { class: 'minisel', style: 'padding:6px 12px;font-size:13px;width:100%;max-width:180px;border-radius:8px;', onchange: async () => {
    try { await sync.setLevel(hcp.value); sessionStorage.removeItem('gs:level'); say(hcpMsg, '✓ Saved', true); setTimeout(() => { hcpMsg.textContent = ''; }, 2000); }
    catch (e) { say(hcpMsg, 'Error saving'); }
  } }, LEVELS.map(l => levelOpt(l, profileLevel(), true)));
  const pw1 = h('input', { type: 'password', placeholder: 'New Password (min 6 chars)', autocomplete: 'new-password' });
  const pw2 = h('input', { type: 'password', placeholder: 'Confirm New Password', autocomplete: 'new-password' });
  const off = text => h('button', { disabled: true, title: 'Coming soon', style: 'flex:1;height:36px;font-size:12px;background:#333;border-radius:8px;font-weight:600;color:#606060;' }, text);

  view.replaceChildren(page('top', backBtn(),
    h('div', { style: 'width:100%;max-width:320px;display:flex;flex-direction:column;align-items:center;gap:4px;' },
      h('div', { style: 'font-size:18px;font-weight:800;' }, '⚙️ Settings'),
      h('div', { style: 'font-size:13px;color:#9a9a9a;' }, u.email),
      h('div', { style: 'font-size:11px;color:#606060;margin-bottom:2px;' }, joined ? `Joined ${joined.getMonth() + 1}/${joined.getDate()}/${joined.getFullYear()}` : ''),
      nameIn,
      h('button', { class: 'holes9', onclick: async () => {
        const n = nameIn.value.trim();
        if (!n) return say(nameMsg, 'Name cannot be empty');
        say(nameMsg, 'Saving...', true);
        try { await sync.setName(n); say(nameMsg, '✓ Name updated!', true); } catch (e) { say(nameMsg, e.message || String(e)); }
      } }, 'SAVE NAME'), nameMsg,
      h('div', { class: 'section' }, h('div', { class: 'lab' }, 'Account Role'),
        h('div', { style: 'display:flex;gap:6px;width:100%;max-width:280px;' }, off('Student'), off('Coach'))),
      h('div', { class: 'section' }, h('div', { class: 'lab' }, 'Strokes Gained Comparison'), hcp, hcpMsg),
      h('div', { class: 'section' }, h('div', { class: 'lab' }, 'Avg Total Drive'), drive,
        h('div', { style: 'font-size:11px;color:#606060;max-width:280px;' }, 'Par 4s and 5s open with the crosshair this far from the tee. Leave blank to use the spot where a drive down the fairway gains 0 strokes.'),
        driveMsg),
      h('div', { class: 'section' }, h('div', { class: 'lab' }, 'Launch Monitor'),
        h('div', { style: 'display:flex;gap:6px;width:100%;max-width:280px;' }, off('I have one'), off("I don't have one"))),
      h('div', { class: 'section' }, h('div', { class: 'lab' }, 'Change Password'), pw1, pw2,
        h('button', { style: 'background:#f0c830;', onclick: async () => {
          if (pw1.value.length < 6) return say(pwMsg, 'Password must be at least 6 characters');
          if (pw1.value !== pw2.value) return say(pwMsg, 'Passwords do not match');
          say(pwMsg, 'Updating...', true);
          try { await sync.changePassword(pw1.value); say(pwMsg, '✓ Password updated!', true); pw1.value = pw2.value = ''; } catch (e) { say(pwMsg, e.message || String(e)); }
        } }, 'UPDATE PASSWORD'), pwMsg),
      h('button', { style: 'background:#e06060;margin-top:8px;', onclick: async () => { await sync.signOut(); location.hash = '#/'; } }, 'LOG OUT'),
      h('button', { class: 'linkbtn', style: 'margin-top:14px;font-size:12px;', onclick: () => { location.hash = '#/device'; } }, 'Offline imagery & backup'))));
}

// ---------- log in ----------

export function renderLogin(view) {
  let signup = false;
  const msg = h('div', { style: 'font-size:13px;color:#d4706e;min-height:20px;' });
  const say = (text, color = '#d4706e') => { msg.textContent = text; msg.style.color = color; };
  const email = h('input', { type: 'email', placeholder: 'Email', autocomplete: 'email' });
  const pass = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password' });
  const confirm = h('input', { type: 'password', placeholder: 'Confirm Password', autocomplete: 'new-password' });
  const name = h('input', { placeholder: 'Display Name', autocomplete: 'name' });
  const extra = h('div', { style: 'width:100%;max-width:320px;flex-direction:column;align-items:center;gap:8px;display:flex;', hidden: true }, confirm, name);
  // Logging in from Round History or Settings stays there (the page redraws itself).
  const after = () => { if (location.hash === '#/account' || location.hash === '') location.hash = '#/'; };
  const loginBtn = h('button', { class: 'holes18', onclick: async () => {
    if (signup) { signup = false; extra.hidden = true; loginBtn.textContent = 'LOG IN'; signupBtn.textContent = 'SIGN UP'; say(''); return; }
    if (!email.value.trim() || !pass.value) return say('Email and password required');
    say('Logging in...', '#606060');
    try { await sync.signIn(email.value.trim(), pass.value); after(); } catch (e) { say(e.message || String(e)); }
  } }, 'LOG IN');
  const signupBtn = h('button', { class: 'holes9', onclick: async () => {
    if (!signup) { signup = true; extra.hidden = false; signupBtn.textContent = 'CREATE ACCOUNT'; loginBtn.textContent = '← BACK TO LOGIN'; say(''); return; }
    if (!email.value.trim() || !pass.value) return say('Email and password required');
    if (pass.value.length < 6) return say('Password must be at least 6 characters');
    if (pass.value !== confirm.value) return say('Passwords do not match');
    say('Creating account...', '#606060');
    try { await sync.signUp(email.value.trim(), pass.value, name.value.trim()); after(); }
    catch (e) { say(e.message || String(e), /Confirm the email/.test(e.message) ? '#00b87a' : '#d4706e'); }
  } }, 'SIGN UP');
  const forgot = h('button', { class: 'linkbtn', style: 'font-size:12px;', onclick: async () => {
    if (!email.value.trim()) return say('Enter your email above, then tap Forgot Password');
    say('Sending reset link...', '#606060');
    try { await sync.resetPassword(email.value.trim()); say('✓ Password reset email sent! Check your inbox.', '#00b87a'); } catch (e) { say(e.message || String(e)); }
  } }, 'Forgot Password?');
  view.replaceChildren(page('center', backBtn(),
    h('div', { style: 'font-size:24px;font-weight:800;' }, 'Account'), msg, email, pass, extra, loginBtn, signupBtn, forgot));
}


// ---------- what's new ----------

const CHANGES = [
  ['0.25.4', ['Hole tile shows the hole against par, e.g. 5 (+1)']],
  ['0.25.3', ['Editing a hole: Redo hole under the shot list starts it again from the tee']],
  ['0.25.2', ['Score tiles sit above the hole selector; "thru" counts up hole by hole']],
  ['0.25.1', ['Total score and hole score at the top beside Expected; tap either for the scorecard']],
  ['0.25.0', ['Editing a past round: shot list to move shots, Cancel beside Save, view stays put', 'Score card sits above the hole pill: (+1) 6 · +3 total']],
  ['0.24.4', ['Editing a past round: Save beside Undo goes back to view mode']],
  ['0.24.3', ['Viewing a past round: the menu has just Back to Round History and Home']],
  ['0.24.2', ['Smaller score bar at the top, beside Expected, with a round › button']],
  ['0.24.1', ['Round History: View/Edit opens each hole on the tee view with your shots; tap Edit to change them']],
  ['0.24.0', ['Round History: Edit, Stats and scorecard download work on past rounds', 'Removed the template, upload and photo buttons']],
  ['0.23.0', ['Stats Dashboard: strokes gained, scoring, off the tee, approach, around the green and putting, with radar charts and handicap index']],
  ['0.22.3', ["What's new works again", 'Rounds always show in Round History, whatever date the phone is set to']],
  ['0.22.2', ['Tapping Tee or Pin zooms in on the tee box or green; Set or cancel returns to your view']],
  ['0.22.1', ['SG key is a slim bar in the top-left so it no longer covers the yardages']],
  ['0.22.0', ['SG button shows the drive heat map from the tee (par 3s too)', 'Appr pill has a Distance | SG toggle: SG rings the pin where landing gains that much']],
  ['0.20.3', ['Arc, width, Appr circle and the aim line stay locked to the crosshair while panning']],
  ['0.20.0', ['Drive heat map in 0.25 SG bands, by real lie: fairway, rough, bunker and water']],
  ['0.18.0', ['Strokes-gained zones for the drive']],
  ['0.17.0', ['Menu Home asks: pause and save, end and submit, or delete the round']],
  ['0.16.0', ['Move tee / Move pin buttons; orange Undo at the top right']],
  ['0.15.0', ['SG button: ring around the pin where landing on the green gains 0 strokes']],
  ['0.14.0', ['Appr circle with 20–60 ft presets']],
  ['0.13.0', ['Par 3s open on the whole hole, par 4s and 5s on your drive', 'Avg Total Drive in Settings', 'Bigger putting view; holed stroke number shown at the hole']],
  ['0.12.0', ['New home, New Round, Round History and Settings screens', 'GPS rounds at Bridlewood']],
];

export function renderWhatsNew(view) {
  view.replaceChildren(page('top', backBtn(),
    h('div', { style: 'width:100%;max-width:340px;text-align:left;' },
      h('div', { style: 'font-size:22px;font-weight:800;text-align:center;margin-bottom:10px;' }, "What's new"),
      CHANGES.map(([v, items], i) => h('div', { class: 'card' },
        h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;' },
          h('strong', { style: 'font-size:15px;' }, `v${v}`), i === 0 ? h('span', { style: 'font-size:11px;color:#00b87a;font-weight:700;' }, 'LATEST') : null),
        h('ul', { style: 'margin:0;padding-left:18px;font-size:13px;color:#cfcfcf;line-height:1.4;' }, items.map(t => h('li', {}, t))))))));
}

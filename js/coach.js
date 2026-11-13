// Home, New Round, Round History, Settings and Log in, laid out like the
// coaching app. Only entering a round (GPS, Bridlewood), round history and the
// account settings work for now; the other buttons are shown but disabled.

import { h, course, toast, COURSES, courseById, setActiveCourse } from './app.js';
import { store, sync } from './store.js';
import { newRound } from './model.js';
import { LEVELS } from './sg.js';
import { VERSION } from './version.js';
import { setCurrentRound, summarize, historyRounds, roundKeyOf, startScouting } from './rounds.js';
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
  const soon = (ic, title, bg, badge) => h('button', { class: 'homebtn', disabled: true, title: 'Coming soon', style: `background:${bg}` },
    h('span', { class: 'ic' }, ic), h('div', { style: 'flex:1' }, h('div', { class: 't' }, title)), badge || null);
  const go = (ic, title, bg, href) => h('button', { class: 'homebtn', style: `background:${bg}`, onclick: () => { location.hash = href; } },
    h('span', { class: 'ic' }, ic), h('div', {}, h('div', { class: 't' }, title)));
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
      go('🛰️', 'GPS Overview', '#1a4a8a', '#/scout'),
      go('⛳', 'New Round', '#007a52', '#/new'),
      go('📋', 'Round History', '#00402c', '#/history'),
      divider(),
      go('📊', 'Stats Dashboard', '#3d96ee', '#/dashboard'),
      soon('🔍', 'Performance Analysis', '#2d7abc'),
      go('🎒', 'My Bag', '#1a4a8a', '#/bag'),
      divider(),
      soon('🏌️', 'Practice and Learning', '#d49a10',
        h('span', { style: 'background:#d4706e;color:#fff;font-size:10px;font-weight:800;border-radius:10px;padding:2px 7px;flex-shrink:0;white-space:nowrap;animation:cxpulse 1.5s infinite;' }, 'NEW!')),
      soon('🎓', 'Coaching', '#00402c')),
    sync.user ? null : h('button', { class: 'linkbtn', style: 'margin-top:18px;', onclick: () => { location.hash = '#/account'; } }, 'Log In / Sign Up')));
}

// ---------- new round ----------

// GPS Scouting uses the same page with just the course and tee box: nothing is saved.
export function renderNewRound(view, { scout = false } = {}) {
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
    teeInfo.textContent = t ? `Par ${par} · ${t.yards.reduce((a, b) => a + b, 0).toLocaleString()} yds` + (t.rating ? ` · Rating ${t.rating} / Slope ${t.slope}` : '') : '';
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
    if (scout) {
      store.set('settings', { ...(store.get('settings') || {}), tee: tee.value });
      startScouting(tee.value, course.id); sessionStorage.removeItem('gs:level');
      location.hash = '#/hole/1';
      return;
    }
    if (custom.value && !(+custom.value >= 3 && +custom.value <= 18)) { err.textContent = 'Custom holes must be 3 to 18.'; return; }
    const r = { ...newRound(course, tee.value, date.value || today()), courseName: course.name, player: name.value.trim() || (sync.user ? sync.name : ''),
      level: level.value, type: type.value, place: type.value === 'Tournament' && place.value ? +place.value : null, holeCount: holes };
    store.set(roundKeyOf(r.id), r);
    setActiveCourse(course.id);
    setCurrentRound(r.id); localStorage.removeItem('gs:viewOnly'); localStorage.removeItem('gs:editingPast');
    store.set('settings', { ...(store.get('settings') || {}), tee: tee.value });
    sessionStorage.removeItem('gs:level');
    location.hash = '#/hole/1';
  } }, 'START');

  // Picking another course redraws the page with that course's tee boxes.
  // Course: a dropdown, with a search button beside it that opens a box to type
  // in; matching courses are listed below it to tap.
  const pickCourse = id => { setActiveCourse(id); renderNewRound(view, { scout }); };
  const courseSel = h('select', { class: 'bigsel', 'aria-label': 'Course', style: 'flex:1;', onchange: e => pickCourse(e.target.value) },
    COURSES.map(c => h('option', { value: c.id, selected: c.id === course.id }, c.name)));
  const results = h('div', { class: 'courseresults', hidden: true });
  const search = h('input', { type: 'search', placeholder: 'Search courses…', 'aria-label': 'Search courses', hidden: true, oninput: () => {
    const q = search.value.trim().toLowerCase();
    const hits = COURSES.filter(c => !q || c.name.toLowerCase().includes(q) || c.id.includes(q));
    results.replaceChildren(...(hits.length ? hits.map(c => h('button', { class: c.id === course.id ? 'on' : '', onclick: () => pickCourse(c.id) }, c.name)) : [h('div', { class: 'none' }, 'No courses match')]));
    results.hidden = false;
  } });
  const searchBtn = h('button', { class: 'coursesearch', 'aria-label': 'Search courses', title: 'Search courses', onclick: () => {
    search.hidden = !search.hidden; results.hidden = search.hidden;
    if (!search.hidden) { search.value = ''; search.dispatchEvent(new Event('input')); search.focus(); }
  } }, '🔍');
  const courseBox = h('div', { style: 'width:100%;max-width:320px;display:grid;gap:6px;' }, h('div', { class: 'row', style: 'gap:6px;' }, courseSel, searchBtn), search, results);
  if (scout) {
    view.replaceChildren(page('top', backBtn(),
      h('div', { style: 'font-size:22px;font-weight:800;' }, 'GPS Overview'),
      h('div', { style: 'font-size:12px;color:#606060;text-align:center;margin-top:-4px;' }, 'Plan shots on any hole · nothing is saved'),
      courseBox, tee, teeInfo, confirm, err));
    return;
  }
  view.replaceChildren(page('top', backBtn(),
    h('div', { style: 'font-size:22px;font-weight:800;' }, 'New Round'),
    name,
    h('div', { class: 'row' }, level, date),
    courseBox,
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
    const all = historyRounds().map(r => ({ r, s: summarize(r, courseById(r.course), level) }));
    if (!all.length) { msg.textContent = 'No rounds yet. Tap New Round on the home screen to start one.'; list.replaceChildren(); filtMsg.textContent = ''; return; }
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
    const resume = () => { setActiveCourse(r.course || 'bridlewood'); localStorage.removeItem('gs:viewOnly'); localStorage.removeItem('gs:editingPast'); setCurrentRound(r.id); store.set('settings', { ...(store.get('settings') || {}), tee: r.tee }); sessionStorage.removeItem('gs:level'); location.hash = `#/hole/${s.firstOpen || 1}`; };
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
            setCurrentRound(r.id); localStorage.setItem('gs:viewOnly', '1'); localStorage.removeItem('gs:editingPast'); sessionStorage.removeItem('gs:level');
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
  const tee = h('select', { class: 'bigsel', 'aria-label': 'Tee box' }, courseById(r.course).tees.map(t => h('option', { value: t.name, selected: t.name === r.tee }, `${t.name} · ${t.yards.reduce((a, b) => a + b, 0)} yds`)));
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
    h('div', { style: 'font-size:12px;color:#9a9a9a;' }, r.courseName || courseById(r.course).name),
    name, h('div', { class: 'row' }, level, date), tee, type, placeWrap,
    h('button', { class: 'holes9', onclick: () => { save(); msg.textContent = '✓ Saved'; msg.className = 'msg ok'; setTimeout(() => { location.hash = '#/history'; }, 500); } }, 'SAVE'),
    h('button', { class: 'holes18', onclick: () => {
      save(); setCurrentRound(id); localStorage.removeItem('gs:viewOnly'); localStorage.setItem('gs:editingPast', '1'); localStorage.setItem('gs:editSnap', JSON.stringify(store.get(key).holes || {})); store.set('settings', { ...(store.get('settings') || {}), tee: tee.value }); sessionStorage.removeItem('gs:level');
      location.hash = '#/hole/1';
    } }, 'EDIT SHOTS ON THE MAP'),
    h('div', { style: 'font-size:11px;color:#606060;max-width:300px;' }, 'Opens the round on hole 1. Use Undo to change shots, then leave with Home → End and submit round.'),
    msg));
}

// ---------- my bag ----------
// Clubs and yardages come from the profile shared with the coaching app (edit
// them there). This app adds an arc width per club, used by Arc → Auto.

const BAG_ORDER = ['Dr', 'Dr2', '2W', '3W', '4W', '5W', '6W', '7W', '2HY', '3HY', '4HY', '5HY', '6HY', '7HY', '2I', '3I', '4I', '5I', '6I', '7I', '8I', '9I', '48', 'PW', 'GW', 'AW', 'SW', '50', '52', '54', '56', '58', '60', '62', 'LW'];
export function renderBag(view) {
  if (needLogin(view)) return;
  const clubs = (sync.bag || []).filter(c => c && c.name).sort((a, b) => BAG_ORDER.indexOf(a.name) - BAG_ORDER.indexOf(b.name));
  const arcs = { ...(store.get('clubArcs') || {}) };
  const msg = h('div', { class: 'msg' });
  const row = c => {
    const inp = h('input', { type: 'number', inputmode: 'numeric', min: 5, max: 100, placeholder: 'auto', value: arcs[c.name] || '', style: 'width:72px;height:34px;font-size:14px;border-radius:8px;',
      onchange: () => { const v = Math.round(+inp.value); if (v > 0) arcs[c.name] = Math.min(100, v); else delete arcs[c.name]; store.set('clubArcs', { ...arcs }); msg.textContent = '✓ Saved'; msg.className = 'msg ok'; setTimeout(() => { msg.textContent = ''; }, 1500); } });
    return h('div', { class: 'card', style: 'display:flex;align-items:center;gap:10px;margin:4px 0;' },
      h('div', { style: 'flex:1;' }, h('div', { style: 'font-weight:800;font-size:15px;' }, clubLabel(c.name)),
        h('div', { style: 'font-size:12px;color:#9a9a9a;' }, [c.carry ? `Carry ${c.carry}` : null, c.total ? `Total ${c.total}` : null].filter(Boolean).join(' · ') || 'No yardage yet')),
      h('div', { style: 'text-align:right;font-size:11px;color:#9a9a9a;' }, 'Arc (yds)', inp));
  };
  const refresh = h('button', { class: 'linkbtn', style: 'font-size:12px;', onclick: async () => { msg.textContent = 'Loading…'; msg.className = 'msg'; await sync.loadBag().catch(() => {}); renderBag(view); } }, 'Reload from the coaching app');
  view.replaceChildren(page('top', backBtn(),
    h('div', { style: 'width:100%;max-width:360px;' },
      h('div', { style: 'font-size:20px;font-weight:800;text-align:center;margin-bottom:4px;' }, '🎒 My Bag'),
      h('div', { style: 'font-size:12px;color:#9a9a9a;text-align:center;margin-bottom:8px;' }, 'Clubs and yardages come from your bag in the coaching app. Set an arc width per club for Arc → Auto; leave blank to use 15% of the club’s yardage.'),
      clubs.length ? clubs.map(row) : h('div', { style: 'color:#9a9a9a;text-align:center;padding:16px;font-size:13px;' }, 'No clubs in your bag yet. Add them in the coaching app\'s My Bag.'),
      msg, refresh)));
}
const clubLabel = n => (n === 'Dr' ? 'Driver' : /^(\d)W$/.test(n) ? `${n[0]} Wood` : /^(\d)HY$/.test(n) ? `${n[0]} Hybrid` : /^(\d)I$/.test(n) ? `${n[0]} Iron` : /^\d\d$/.test(n) ? `${n}°` : n);

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
  ['0.50.0', ['Home screen: the main buttons show just their names, no descriptions', 'Enter New Round is now New Round and GPS Scouting is now GPS Overview']],
  ['0.49.0', ['Stats Dashboard: the star charts are gone. Strokes gained is shown as simple bars, red to the left of 0 and green to the right, for Total, Off The Tee, Approach, Around Green and Putting']],
  ['0.48.1', ['Live view is simpler for people watching: no View, SG, Appr, Disp, Arc or Width buttons and no Expected strokes', 'Once a hole is holed out the crosshair and aiming lines go, leaving the hole and its shots', 'Bigger score tiles, as wide as the hole bar below them']],
  ['0.48.0', ['Live view: tap Live on a hole to get a link others can watch your round with (view only). They can tap shots for distance and club, open the scorecard and refresh', 'Live is on until you turn it off or end the round; the link keeps showing the round afterwards']],
  ['0.47.3', ['Bear Creek West and East: each course only uses its own tee boxes, fairways and greens (West #1 was teeing off from East #1)']],
  ['0.47.2', ['The old page layout no longer flashes up for a moment when the app opens']],
  ['0.47.1', ['Tap Expected (top right of a hole) for the scorecard filled in with what your chosen handicap is expected to shoot on each hole and over the round']],
  ['0.47.0', ['Tap Expected (top right of a hole) for a scorecard of what two handicap levels are expected to shoot on each hole and over the round, from your tees']],
  ['0.46.0', ['Opening view on par 4s and 5s aims at the hole\'s own fairway near your drive distance (shorter, longer or a lay-up when there\'s no fairway right there), never a bunker, water or OB spot', 'Course outline edits by an admin are published and go live for everyone']],
  ['0.45.0', ['Course outline editing (Course tab, Edit boundaries) is now for admin accounts only; everyone else sees the courses as published']],
  ['0.44.15', ['Squaw Creek and Bear Creek – West: updated fairway, green, tee, bunker, water, recovery and OB outlines for everyone']],
  ['0.44.14', ['GPS Scouting: changing Tees in the menu moves the tee', 'The tee always starts on the hole\'s tee box closest to the scorecard yardage for your tees (a dragged tee is no longer remembered)']],
  ['0.44.13', ['Edit boundaries: ✂ Cut on the course OB across the mouth of OB jutting into the course cuts that piece off as its own shape, to delete or move like a bunker']],
  ['0.44.12', ['Squaw Creek: the OB cut-outs by hole 12\'s tee are removed from saved boundary edits too']],
  ['0.44.11', ['Squaw Creek: the little OB cut-outs by hole 12\'s tee are gone; that ground is out of bounds']],
  ['0.44.10', ['Edit boundaries: tap a corner of a cut-out in the course OB, then Delete cutout to remove it']],
  ['0.44.9', ['Edit boundaries: ✂ Cut on the course OB line picks the stretch between two corners you tap, to drag as one unit (Other side switches to the rest of the line)']],
  ['0.44.8', ['Edit boundaries: ✂ Cut splits a shape in two between two corners you tap, so each piece can be moved on its own']],
  ['0.44.7', ['The opening crosshair and Auto aim only at the hole you are on: another hole\'s fairway counts as rough for aiming', 'Fairways, tee boxes and greens drawn or edited in Edit boundaries stay tied to that hole']],
  ['0.44.6', ['Edit boundaries labels each tee box with the tee sets that play from it (e.g. Blue 147) and its yardage']],
  ['0.44.5', ['Edit boundaries: ‹ › move to the previous or next hole while editing; changes carry over until you Save once']],
  ['0.44.4', ['Squaw Creek rebuilt from the course yardage book: every hole, fairway, bunker and the creek placed to match']],
  ['0.44.3', ['Edit boundaries shows only the hole you are on: its fairways, green and tee boxes, plus the bunkers, water and recovery areas along it']],
  ['0.44.2', ['Edit boundaries: drag the ⤡ at a selected boundary\'s corner to resize it, or use Size − / + for small steps']],
  ['0.44.1', ['Edit boundaries: drag the ✥ in the middle of a selected boundary to move the whole shape']],
  ['0.44.0', ['GPS Scouting: ☰ → Edit boundaries edits the hole you are on. Tap a boundary to drag its points, change its type or delete it; Draw adds a new one', 'Boundary types: fairway, rough, bunker, water, recovery, tee box, green and OB']],
  ['0.43.0', ['New course: Squaw Creek Golf Course (Willow Park), laid out from the club\'s course map']],
  ['0.42.0', ['New course: Tangle Ridge Golf Club (Grand Prairie)']],
  ['0.41.0', ['New course: Bear Creek Golf Club – East', 'Course search: tap 🔍 beside the course list on New Round or GPS Scouting']],
  ['0.40.1', ['Club distances use carry by default for arcs, dispersion, Comp and Auto; a Carry | Total switch is in the Arc/Disp Adj panel and the Comp picker']],
  ['0.40.0', ['Finishing a hole keeps the aiming buttons (they work from the tee again)', 'Choosing Recovery for a punch-out marks the previous shot as finishing in a recovery area (scored with the recovery baseline)']],
  ['0.39.7', ['Penalty numbering on the map: shot into water shows 1 (red), the drop shows 2 (blue), the next shot is 3']],
  ['0.39.6', ['After a drop the shot number sits on the drop, with a small red dot where the ball went in', 'Shot details read like "9 Iron 126 yds into the water" / "Dropped in fwy (+1 penalty)"']],
  ['0.39.5', ['Penalty jumps (from the water or OB to the drop or re-tee) are drawn as a dotted line']],
  ['0.39.4', ['Shot numbers count penalty strokes: a re-tee after OB is Shot 3']],
  ['0.39.3', ['Auto stays further from trouble: 15 yd from OB, 10 from water, 5 from bunkers']],
  ['0.39.2', ['Auto keeps its dispersion dots 5 yd clear of water, OB and bunkers where it can', 'Turning Auto off also turns the dots off']],
  ['0.39.1', ['Cleaner course outlines: overlapping fairway and green shapes merged, no outlines on top of each other']],
  ['0.39.0', ['Auto button: picks the best club and aiming point (by the average SG of its dispersion), moves the crosshair there and shows the dots; key lists the top clubs']],
  ['0.38.0', ['Water or OB: choose Re-tee/Replay (+1) or Drop (+1 water, +2 OB) and place the drop; strokes and SG count the penalty']],
  ['0.37.4', ['Cowboys: ponds redrawn from the imagery and kept out of bunkers; the mown grass around greens counts as fairway']],
  ['0.37.3', ['Cowboys: bunkers, fairways and greens redrawn from current imagery (after the renovation)']],
  ['0.37.2', ['Bear Creek West: fairways and greens redrawn to match the satellite imagery']],
  ['0.37.1', ['Bear Creek West: groves of trees between holes are now Recovery instead of OB']],
  ['0.37.0', ['New course: Cowboys Golf Club (Grapevine)']],
  ['0.36.0', ['New course: Bear Creek Golf Club – West (DFW). Pick it on New Round or GPS Scouting']],
  ['0.35.0', ['Disp shows just 20 dots (no oval)', 'Comp: a button beside it switches the compared clubs between arcs and dispersion dots']],
  ['0.34.0', ['Disp button: a dispersion oval with 15 shots in it (right ones a bit shorter, left a bit longer), showing their average SG', 'Arc, Disp and Appr are never on together']],
  ['0.33.1', ['GPS Scouting opens a short setup page: pick the tee box and press Start']],
  ['0.33.0', ['Arc and Appr are never on together — turning one on turns the other off', 'Appr has an Adj button beside it for the circle size, like Arc']],
  ['0.32.5', ['Comp: no white aiming line — each club has its own coloured line from the ball']],
  ['0.32.4', ['Comp hides the crosshair dot and turns the Arc off, so only the Comp arcs show']],
  ['0.32.3', ['Comp: the dot you\'re holding grows and glows, and its arc goes bold']],
  ['0.32.2', ['View also hides the crosshair, its yardages and the arc, width and approach circles (Comp arcs stay)']],
  ['0.32.1', ['Out of bounds is now everything outside the course boundary, drawn as one white line']],
  ['0.32.0', ['View button: hides the aiming line and shot tracer for a clean look (Comp arcs stay)', 'Comp moved to the right where Club was; Club moved up above it']],
  ['0.31.1', ["What's new updated"]],
  ['0.31.0', ['Comp: drag a club\'s dot to give it its own line off the tee (tap it to put it back)']],
  ['0.30.2', ['Comp: each arc has a dot with yards left above it and distance from the ball below']],
  ['0.30.0', ['Out of bounds: roads and houses are OB (white outlines), scored as stroke and distance', 'SG heat map reaches 70 yd either side, so OB shows in red', 'Comp button: compare 2–3 clubs as arcs on one line, with average SG for each', 'SG button moved to the left above Pin; Club button moved down']],
  ['0.29.1', ['Back to the previous button layout']],
  ['0.28.4', ['Arc → Auto changes only when you tap a club']],
  ['0.28.3', ['Arc button just turns the arc on; a small Adj button beside it opens the slider']],
  ['0.28.2', ['Arc → Auto sizes the arc to the shot (or the club\'s arc from My Bag)', 'My Bag page with arc widths per club']],
  ['0.28.1', ['Holes open at your My Bag driver distance', 'Picking a club moves the crosshair to its yardage']],
  ['0.28.0', ['GPS Scouting: plan shots on any hole, nothing is saved', 'Club button (auto: driver off par 4/5 tees, then My Bag yardages)', '+ asks for the club and swing (full, ¾, ½, punch, recovery)']],
  ['0.27.4', ['Shots titled "Shot 1 from tee", detail "Hit 257 yds to left rough"']],
  ['0.27.3', ['Shot details on two lines: "Hit 275 yds from tee to fwy" / "261 yds to hole"']],
  ['0.27.2', ['Shot details read like "Putter hit 15 ft to 2 ft from hole"']],
  ['0.27.1', ['Strokes Gained button sits next to Expected at the top']],
  ['0.27.0', ['Shot distances shown along the shot lines (zoom in for putts)', 'Shot details read like "Putter · 15 ft to 2 ft"', 'Viewing / editing a round survives a refresh; finished rounds reopen in view mode']],
  ['0.26.5', ['Strokes Gained panel: close (✕) button, sections start collapsed']],
  ['0.26.4', ['Viewing a round: no crosshair, readouts or aiming line']],
  ['0.26.3', ['Editing a past round: Home offers Leave without saving']],
  ['0.26.2', ['Strokes Gained button in the bottom-right when viewing a round', 'Shots from the green show Putter as the club']],
  ['0.26.1', ['Tap a numbered shot dot on the map to see that shot', 'Fixed the SG button showing over the menu on some phones']],
  ['0.26.0', ['Viewing a round: Strokes Gained panel with round and hole totals by category, and per-shot details']],
  ['0.25.5', ['Viewing a round no longer lets the tee or pin be dragged until you tap Edit']],
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

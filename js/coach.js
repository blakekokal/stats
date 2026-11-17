// Home, New Round, Round History, Settings and Log in, laid out like the
// coaching app. My Bag, Performance Analysis, Practice and Learning and
// Coaching are the coaching app's own pages (js/coaching).

import { h, course, toast, COURSES, courseById, setActiveCourse, goBack } from './app.js';
import { store, sync } from './store.js';
import { newRound } from './model.js';
import { LEVELS } from './sg.js';
import { checkCoachingDot } from './coaching/index.js';
import { VERSION } from './version.js';
import { setCurrentRound, summarize, historyRounds, roundKeyOf, startScouting, firstHoleOf, activeRound, pauseRound, resumeRound, holeCountOf } from './rounds.js';
import { downloadRoundCsv } from './dashboard.js';

const PREF_LABEL = { Pro: 'Tour Pro', Scratch: 'Scratch (0)' };
const levelOpt = (l, sel, short) => h('option', { value: l, selected: l === sel },
  short ? `vs ${l === 'Pro' ? 'Tour Pro' : l === 'Scratch' ? 'Scratch' : l + ' HCP'}` : `Compare to: ${PREF_LABEL[l] || l + ' Handicap'}`);
const profileLevel = () => (LEVELS.includes(sync.level) ? sync.level : 'Pro');
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
const fmtDate = d => { const [y, m, dd] = d.split('-').map(Number); return `${m}/${dd}/${y}`; };

// The one Back button: back to the page before this one (goBack in app.js).
function backBtn() {
  const b = h('button', { class: 'back-btn-top', 'aria-label': 'Back', onclick: goBack });
  b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>';
  return b;
}
const page = (cls, ...kids) => h('div', { class: 'cx ' + cls }, ...kids);
const needLogin = view => { if (sync.user) return false; renderLogin(view); return true; };

// Open an unfinished round on its first unfinished hole, as the one round being played.
function openRound(r) {
  setActiveCourse(r.course || 'bridlewood'); localStorage.removeItem('gs:viewOnly'); localStorage.removeItem('gs:editingPast');
  resumeRound(r.id); store.set('settings', { ...(store.get('settings') || {}), tee: r.tee }); sessionStorage.removeItem('gs:level');
  const open = Array.from({ length: holeCountOf(r) }, (_, i) => i + 1).find(n => !r.holes?.[n]?.done);
  location.hash = `#/hole/${open || 1}`;
}

// A round is still going (the app was closed, reloaded or crashed mid-round):
// it has to be continued, paused or deleted before anything else, so a second
// round can't be started beside it. Shown on Home and New Round.
export function askResume() {
  document.getElementById('resumeask')?.remove();
  const r = activeRound();
  if (!r) return false;
  const done = Object.values(r.holes || {}).filter(x => x?.done).length;
  const box = h('div', { class: 'leave', id: 'resumeask', style: 'position:fixed;' },
    h('div', { class: 'leavebox' },
      h('strong', {}, 'You have a round going'),
      h('div', { style: 'font-size:13px;color:#9a9a9a;margin-bottom:4px;' }, `${r.courseName} \u00b7 ${fmtDate(r.date)} \u00b7 ${done}/${holeCountOf(r)} holes`),
      h('button', { class: 'submit', onclick: () => { box.remove(); openRound(r); } }, '\u25b6 Continue round'),
      h('button', { class: 'pause', onclick: () => { box.remove(); pauseRound(r.id); toast('Round saved. Resume it from Round History'); askResume(); } }, 'Save and pause for later'),
      h('button', { class: 'delete', onclick: () => {
        if (!confirm('Delete this round? This cannot be undone.')) return;
        box.remove(); if (localStorage.getItem('gs:currentRound') === r.id) setCurrentRound(null); store.remove(roundKeyOf(r.id)); askResume();
      } }, 'End and delete round')));
  document.body.append(box);
  return true;
}

// ---------- home ----------

export function renderHome(view) {
  const go = (ic, title, bg, href) => h('button', { class: 'homebtn', style: `background:${bg}`, onclick: () => { location.hash = href; } },
    h('span', { class: 'ic' }, ic), h('div', {}, h('div', { class: 't' }, title)));
  const divider = () => h('div', { style: 'height:1px;background:#282828;margin:3px 0;' });
  const search = h('button', { class: 'iconbtn', disabled: true, title: 'Coming soon' });
  search.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2.5" stroke-linecap="round" style="width:18px;height:18px;"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

  const brand = h('div', { style: 'text-align:center;margin-bottom:6px;' });
  brand.innerHTML = `<div style="font-family:'Barlow Condensed',system-ui,sans-serif;font-size:2.8rem;font-weight:900;letter-spacing:1px;line-height:1.0;color:#ffffff;">Blake Kokal<br><span style="display:inline-flex;align-items:baseline;justify-content:center;"><span style="font-size:10px;visibility:hidden;font-weight:600;">What's new</span><span style="font-size:13px;visibility:hidden;font-weight:700;margin-right:5px;">v${VERSION}</span>Golf<span class="wn" style="font-size:13px;color:#2e2e2e;font-weight:700;margin-left:6px;cursor:pointer;">v${VERSION}</span><span class="wn" style="font-size:10px;color:#44b8f0;font-weight:600;margin-left:5px;cursor:pointer;">&#x2190; What's new</span></span></div>`;
  brand.querySelectorAll('.wn').forEach(el => el.addEventListener('click', () => { location.hash = '#/whatsnew'; }));
  brand.append(h('div', { style: 'font-size:11px;color:#2e2e2e;margin-top:3px;' }, sync.user ? '👤 ' + sync.name : ''));

  // Coaching, with a dot when a note, message or assignment is waiting.
  const coaching = go('🎓', 'Coaching', '#00402c', '#/coaching');
  coaching.append(h('span', { id: 'coachingNotifDot', style: 'display:none;width:10px;height:10px;border-radius:50%;background:#d4706e;margin-left:auto;flex-shrink:0;' }));
  if (sync.user) checkCoachingDot();

  const practice = go('🏌️', 'Practice and Learning', '#d49a10', '#/practice');

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
      go('🔍', 'Performance Analysis', '#2d7abc', '#/performance'),
      go('🎒', 'My Bag', '#1a4a8a', '#/bag'),
      divider(),
      practice,
      coaching),
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
  // The course starts blank: type to filter the list, tap one to pick it.
  let chosen = null;
  const tee = h('select', { class: 'bigsel', 'aria-label': 'Tee box', disabled: true, onchange: () => showTee() }, h('option', { value: '' }, 'Select Tee Box...'));
  function fillTees() {
    tee.replaceChildren(h('option', { value: '' }, chosen ? 'Select Tee Box...' : 'Pick a course first'),
      ...(chosen ? chosen.tees.map(t => h('option', { value: t.name, selected: t.name === lastTee }, `${t.name} · ${t.yards.reduce((a, b) => a + b, 0)} yds`)) : []));
    tee.disabled = !chosen;
    showTee();
  }
  function showTee() {
    const t = chosen?.tees.find(x => x.name === tee.value);
    const par = chosen ? chosen.holes.reduce((a, c) => a + c.par, 0) : 0;
    teeInfo.textContent = t ? `Par ${par} · ${t.yards.reduce((a, b) => a + b, 0).toLocaleString()} yds` + (t.rating ? ` · Rating ${t.rating} / Slope ${t.slope}` : '') : '';
  }
  fillTees();
  const place = h('input', { type: 'number', inputmode: 'numeric', min: 1, placeholder: 'Place (e.g. 1, 2, 3...)' });
  const placeWrap = h('div', { style: 'width:100%;max-width:320px;', hidden: true }, place);
  const type = h('select', { class: 'bigsel', 'aria-label': 'Round type', onchange: () => { placeWrap.hidden = type.value !== 'Tournament'; } },
    h('option', { value: 'Casual' }, 'Round Type: Casual'), h('option', { value: 'Tournament' }, 'Round Type: Tournament'));

  let holes = 18;
  const pick = (btn, n) => { b9.classList.remove('selected'); b18.classList.remove('selected'); if (btn) btn.classList.add('selected'); holes = n; if (btn) custom.value = ''; };
  const b9 = h('button', { class: 'holes9', onclick: () => pick(b9, 9) }, '9 Holes');
  const b18 = h('button', { class: 'holes18 selected', onclick: () => pick(b18, 18) }, '18 Holes');
  const custom = h('input', { type: 'number', inputmode: 'numeric', min: 3, max: 18, placeholder: 'Custom # of Holes (3–18)', oninput: () => { const n = parseInt(custom.value, 10); if (n >= 3 && n <= +custom.max) pick(null, n); } });

  const err = h('div', { class: 'msg err' });
  const confirm = h('button', { class: 'holes9', onclick: () => {
    if (!chosen) { err.textContent = 'Select a course.'; return; }
    if (!tee.value) { err.textContent = 'Select a tee box.'; return; }
    if (scout) {
      store.set('settings', { ...(store.get('settings') || {}), tee: tee.value });
      startScouting(tee.value, course.id); sessionStorage.removeItem('gs:level');
      location.hash = '#/hole/1';
      return;
    }
    if (askResume()) return; // one round at a time
    const most = Math.min(18, chosen.holes.length);
    if (custom.value && !(+custom.value >= 3 && +custom.value <= most)) { err.textContent = `Custom holes must be 3 to ${most}.`; return; }
    const r = { ...newRound(course, tee.value, date.value || today()), courseName: course.name, player: name.value.trim() || (sync.user ? sync.name : ''),
      level: level.value, type: type.value, place: type.value === 'Tournament' && place.value ? +place.value : null, holeCount: Math.min(holes, chosen.holes.length) };
    store.set(roundKeyOf(r.id), r);
    setActiveCourse(course.id);
    setCurrentRound(r.id); localStorage.removeItem('gs:viewOnly'); localStorage.removeItem('gs:editingPast');
    store.set('settings', { ...(store.get('settings') || {}), tee: tee.value });
    sessionStorage.removeItem('gs:level');
    location.hash = '#/hole/1';
  } }, 'START');

  // Course: a blank box to type in; the courses matching what's typed are listed
  // below it to tap. Picking one fills in its tee boxes.
  const results = h('div', { class: 'courseresults', hidden: true });
  const pickCourse = c => {
    setActiveCourse(c.id); chosen = courseById(c.id);
    search.value = c.name; results.hidden = true; err.textContent = '';
    fillTees();
    // A nine-hole course is played as 9 holes (or fewer, as a custom round).
    const nine = chosen.holes.length <= 9;
    b18.hidden = nine; custom.max = nine ? 9 : 18; custom.placeholder = `Custom # of Holes (3–${nine ? 9 : 18})`;
    if (nine && holes > 9) pick(b9, 9);
  };
  // Tapping the box lists every course, so one can be picked without typing (the
  // keyboard doesn't always come up). Typing narrows it to the matches, names
  // starting with what's typed first. The list drops down over the page, about
  // four courses tall, and scrolls. With a course picked, the list shows them all again.
  const hitsFor = () => {
    const q = search.value.trim().toLowerCase();
    if (!q || (chosen && search.value === chosen.name)) return [...COURSES].sort((x, y) => x.name.localeCompare(y.name));
    const starts = c => c.name.toLowerCase().startsWith(q) || c.name.toLowerCase().split(/\s+/).some(w => w.startsWith(q));
    return COURSES.filter(c => c.name.toLowerCase().includes(q) || c.id.includes(q))
      .sort((x, y) => starts(y) - starts(x) || x.name.localeCompare(y.name));
  };
  const showHits = () => {
    const hits = hitsFor();
    results.replaceChildren(...(hits.length ? hits.map(c => h('button', { class: c.id === chosen?.id ? 'on' : '', onmousedown: e => e.preventDefault(), onclick: () => pickCourse(c) }, c.name)) : [h('div', { class: 'none' }, 'No courses match')]));
    results.hidden = false;
  };
  const search = h('input', { type: 'search', placeholder: 'Course name', 'aria-label': 'Course', autocomplete: 'off', value: '',
    oninput: () => { if (chosen && search.value !== chosen.name) { chosen = null; fillTees(); } showHits(); },
    onfocus: showHits,
    onclick: showHits, // already focused: show the list again
    onblur: () => { results.hidden = true; },
    onkeydown: e => { if (e.key === 'Enter') { const hits = hitsFor(); if (hits.length === 1) { pickCourse(hits[0]); search.blur(); } } } });
  const courseBox = h('div', { style: 'width:100%;max-width:320px;position:relative;z-index:10;' }, search, results);
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
    const resume = () => openRound(r);
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
            location.hash = '#/hole/' + firstHoleOf(r, courseById(r.course)); // the first hole they played
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
  view.replaceChildren(page('top', backBtn(),
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
  ['0.83.0', ['Plays like has its own button at the top right, under Expected (Cowboys for now). With it on, each yardage by the crosshair shows the rise or drop right beside it (red uphill, green downhill) and what it plays just under it, a little smaller in blue', 'Switching Contours & slope leaves the View box open, and the box no longer jumps']],
  ['0.82.0', ['Course lines are smooth and rounded now: fairways, greens, bunkers, water, tee boxes and trees are drawn as curves instead of jagged straight edges, on the hole map and in the hole editor. OB and the course boundary keep their hard corners']],
  ['0.81.0', ['Plays like (View box, Cowboys): the yardages by the crosshair show how many yards the ground rises or drops and what the shot plays, e.g. 250(−5) 245 yd from the tee to the crosshair and 125(+2) 127 yd from there to the pin', 'Hillshade is gone; switching Contours & slope now closes the View box, and the box no longer jumps around']],
  ['0.80.5', ['Contours & slope: contour lines and arrows are see-through now, so the course shows through them']],
  ['0.80.4', ['Contours & slope: lighter, near-white contour lines and arrows with a faint dark edge, at full strength across the hole (fading only at the very edge), so they stand out on the grass']],
  ['0.80.3', ['Contours & slope: contour lines and arrows are a little thinner and fully opaque, so they stand out more']],
  ['0.80.2', ['Contours & slope: smooth, rounded contour lines in a thin light green, all the same weight, like a yardage book’s green pages, with smaller, finer downhill arrows']],
  ['0.80.1', ['Contours & slope: the downhill arrows now sit on the contour lines (thin line arrows, tail on the line, pointing straight downhill) instead of scattered over the ground']],
  ['0.80.0', ['Contours & slope (View box, Cowboys): contour lines now every 1, 3 or 5 yards, and only around the hole you’re on, fading out at the edges. Little arrows point downhill, bigger where it’s steeper; zoom in for more of them']],
  ['0.79.0', ['Elevation on the hole map (Cowboys Golf Club for now): the View box has Hillshade, to see the slopes (Soft, Medium or Strong), and Contour lines every 1, 2, 5 or 10 ft, with every fifth line bolder. Heights come from USGS lidar']],
  ['0.78.0', ['New course: Tour 18 Golf Course Dallas (Flower Mound), built from its yardage book: greens, fairways, bunkers, water, tee boxes and hole lines, lined up on the satellite picture, with every bunker checked against the sand in the picture; trees from the picture as circles. No out-of-bounds line yet: draw it in the hole editor (Draw new boundary \u2192 Course boundary)']],
  ['0.77.0', ['New course: Grapevine Golf Course \u2013 Bluebonnet (the first of its three nines), built from its yardage book. Nine-hole courses start a 9-hole round (no 18-hole option); ratings and slopes to come from the club']],
  ['0.76.2', ['Fewer trees to edit: where 2\u20135 small trees stood together, one bigger tree now covers the same spot (Sherrill Park #1 and #2, Bear Creek West, Bridlewood). Your published edits are kept']],
  ['0.76.1', ['Bridlewood: trees added from the satellite picture as circles (a few big ones in each wood, one per lone tree), inside the course boundary only and off greens, fairways, tees, bunkers and water. Nothing else changed']],
  ['0.76.0', ['Recording a shot: Lost ball is now Penalty / drop, with Re-tee or Replay (+1), Drop +1, Drop +2, or Free relief with no penalty (cart path, ground under repair). While you place a drop, a dotted line follows the crosshair from where the ball finished, as the shot tracer shows afterwards']],
  ['0.75.2', ['Bear Creek West: trees are now taken from the satellite picture as circles (a few big ones in each wood, one per lone tree), kept out of OB and off greens, fairways, tees, bunkers and water. Nothing else changed']],
  ['0.75.1', ['Sherrill Park #1: trees are now circles too – a few big ones in each wood, one per lone tree – so each can be moved, resized or deleted on its own']],
  ['0.75.0', ['Hole boundary editor: new Course boundary type under Draw new boundary. Trace the outer edge of the course and everything outside it counts as OB (it replaces any course boundary already there)']],
  ['0.74.3', ['Hole boundary editor: adding trees is now part of Draw new boundary \u2013 pick Trees and each tap drops a round tree (size with \u2212 and +); the separate Add trees button is gone']],
  ['0.74.2', ['Sherrill Park #2: fewer, bigger trees – a wood is now a few big circles instead of dozens of little ones (about 620 trees in all, down from 2,400). Your published edits are kept']],
  ['0.74.1', ['Hole boundary editor on a computer: Delete (or Backspace) removes the selected boundary, or the selected corner; while drawing, it removes the last corner placed']],
  ['0.74.0', ['Trees are now circles: on Sherrill Park #2 every wood is a cluster of round trees instead of one big outline, so each tree can be moved, resized or deleted on its own (your published edits are kept). In the hole boundary editor, Add trees drops a round tree wherever you tap; set its size with \u2212 and +']],
  ['0.73.7', ['Hole boundary editor: Save now keeps your changes on this device and stays in the editor; the new Save & finish publishes them for everyone and closes the editor']],
  ['0.73.6', ['Course lines on the hole map are now off for everyone, whatever was set before. Turn them back on under View \u2192 Course lines view']],
  ['0.73.5', ['Course lines are now off by default on the hole map. Turn them on under View \u2192 Course lines view; if you already switched them on or off, that choice is kept']],
  ['0.73.4', ['The menu on the hole screen now shows the name of the course you\u2019re playing or viewing, above the tees']],
  ['0.73.3', ['Sherrill Park Golf Course #2: bunkers, ponds and trees are now taken from the satellite picture (the yardage book had water and bunkers that aren’t there and missed others). Greens, fairways and tee boxes still come from the book']],
  ['0.73.2', ['Sherrill Park\u2019s two courses are now called Sherrill Park Golf Course #1 and #2']],
  ['0.73.1', ['Sherrill Park Course 2: the new outlines from its yardage book now show. Outline edits made before it was rebuilt were still being used instead']],
  ['0.73.0', ['Sherrill Park Golf Course \u2013 Course 2 is back, built from its yardage book: bunkers, ponds, fairways, greens and tee boxes from the book, lined up on the satellite picture, and trees drawn round each tree\u2019s canopy. Yardages, pars and handicaps are from the club\u2019s scorecard']],
  ['0.72.2', ['Sherrill Park Golf Course \u2013 Course 1: everything is lined up on the satellite picture (bunkers, greens, fairways and tee boxes had sat a few yards north of it), and the trees are drawn round each tree\u2019s real canopy instead of big circles']],
  ['0.72.1', ['Sherrill Park Course 2 is gone for now while it\u2019s redrawn from scratch. Rounds already played there show up under the default course']],
  ['0.72.0', ['Sherrill Park Golf Course \u2013 Course 1: trees, bunkers, water, fairways, greens and tee boxes are now taken from the course\u2019s yardage book instead of traced by eye from the satellite picture, so they match the course much more closely. Each hole\u2019s line follows the book\u2019s centre line, and every tee box is a real one']],
  ['0.71.1', ['Sherrill Park Course 2 redrawn from its yardage book: tee boxes are where the book marks them, hole lines follow the doglegs, and fairways are fewer, simpler shapes that start past the tees. Its trees are gone, to be drawn by hand']],
  ['0.71.0', ['New course: Sherrill Park Golf Course \u2013 Course 1 (Richardson). Yardages, pars and handicaps are from the club\u2019s scorecard; fairways, greens, bunkers, ponds and trees were traced from the satellite imagery, so check the outlines and tee spots on your first round']],
  ['0.70.0', ['New course: Sherrill Park Golf Course \u2013 Course 2 (Richardson). Yardages, pars and handicaps are from the club\u2019s scorecard; fairways, greens, bunkers, ponds and trees were traced from the satellite imagery, so check the outlines and tee spots on your first round']],
  ['0.69.2', ['Trees: a ball in the trees now counts as a recovery lie for strokes gained, not rough']],
  ['0.69.1', ['Bear Creek West and East: each hole only uses its own course\u2019s tee boxes, even with outline edits saved before v0.47.3 (West #1 Blue, Silver and Red were teeing off from East #1)']],
  ['0.69.0', ['New course: Cross Timbers Golf Course (Azle). Fairways, greens, bunkers, the pond and trees were traced from the satellite imagery, so check the hole numbers and outlines on your first round']],
  ['0.68.1', ['Courses: every recovery area is now trees, so Auto steers around them. A ball in one counts as rough unless another lie is drawn there']],
  ['0.68.0', ['Trees: a new boundary type to draw on a course (Edit boundaries). Auto keeps its targets clear of trees, won\u2019t pick a line that has to climb over trees close in front of the ball, and avoids leaving trees between your ball and the hole']],
  ['0.67.2', ['GPS: the \ud83d\udccd Shot button now sits just below the GPS button; the yardage to the hole stays at the top. Home: removed the NEW! tag from Practice and Learning']],
  ['0.67.1', ['View menu: switching Clean view on or off no longer moves the menu while it\u2019s open. Tapping the map or any other button closes the menu']],
  ['0.67.0', ['One Back button: every page now has a single Back button in the top left that takes you to wherever you were before. The Back button at the bottom of the screen and the extra \u201c\u2190 Strokes gained\u201d, \u201c\u2190 All rounds\u201d and step-back arrows are gone; the top-left button does their job']],
  ['0.66.1', ['New Round and GPS Overview: the course list is now a proper dropdown under the box. It shows about four courses, scrolls for the rest, and narrows as you type']],
  ['0.66.0', ['One round at a time: if the app closes, reloads or crashes mid-round, reopening it asks whether to continue the round, save and pause it for later, or delete it. A new round can\u2019t be started until you choose. Paused rounds stop being live and wait in Round History']],
  ['0.65.2', ['Fixed: the app showed a blank screen after the last update']],
  ['0.65.1', ['New Round and GPS Overview: tapping the course box lists every course again, so you can pick one without typing (handy when the keyboard doesn\u2019t come up). Typing still narrows the list']],
  ['0.65.0', ['Live rounds: when a player\u2019s round goes live, their coach gets a \u201cis live\u201d update in Recent Activity with a Watch button that opens the round live']],
  ['0.64.0', ['Comp + Auto: with Comp on, tapping Auto puts each compared club on its own best line (the best average SG for that club, kept clear of hazards). Tap Auto again to put them back on one line']],
  ['0.63.1', ['Hole screen: the compass is round again, with a small gap above the wind circle']],
  ['0.63.0', ['Hole screen: live wind under the compass. The arrow shows which way the wind is blowing on the map (it turns with the map) and the number is the speed in mph, for the course\u2019s location']],
  ['0.62.1', ['Club box: a Carry | Total switch for the yardages', 'Whose bag?: students are listed most recently active first (with when), and the box stays put near the top while you search instead of jumping around']],
  ['0.62.0', ['GPS Overview: the Club box shows whose bag it\u2019s using (yours to start). Tap it to search your students and load one\u2019s bag, so the clubs, yardages, arcs, Comp and Auto use their numbers; it stays on until you leave GPS Overview']],
  ['0.61.3', ['Coaching Recent Activity: a student\u2019s round has Profile, View round and Strokes gained buttons, so you don\u2019t have to open their profile first. Strokes gained opens that round\u2019s SG in a pop-up']],
  ['0.61.2', ['Dashboards: a round\u2019s strokes gained page has a View round button at the bottom that opens the round on the hole screen (the shots on the map)']],
  ['0.61.1', ['Past rounds: the score is the same size as the course name, and the SG total sits on the second line with the categories']],
  ['0.61.0', ['Dashboards: the strokes gained bars are compact so all five fit on a small screen without scrolling; below them, Past rounds lists every round, newest first, with its score and SG (tap one for that round)', 'Coaching: Recent Activity shows your students\u2019 rounds from the last two weeks straight from their saved rounds, even if no notification was sent']],
  ['0.60.3', ['Viewing a past round: Strokes Gained is a taller button in the bottom-right corner (its panel opens above it), View sits just above the menu, and the Tools button is gone']],
  ['0.60.2', ['Dashboards: Filter is a small grey link on the same line as \u201cper round\u201d']],
  ['0.60.1', ['Dashboards: SG by round is back at the bottom; tap a round to see its strokes gained (\u2190 All rounds goes back). A Filter button beside \u201cper round\u201d shows the round type, time and \u201cvs\u201d level filters']],
  ['0.60.0', ['Player dashboards (your Stats Dashboard and a student\u2019s dashboard for their coach): just the strokes gained bars, no filters, no \u201cvs\u201d level, no tabs and no SG totals. Tap a bar for that category\u2019s detailed stats (SG: Total opens scoring); \u2190 Strokes gained goes back']],
  ['0.59.0', ['Ending and submitting a round now sends your coach a New Round notification with the course and score', 'Coaching (coach side): one page, no tabs. Notes, Assign and Messages are gone, and of the three tiles only Students is left', 'Tap Students for one list of all your students, the one with the latest round, combine or other activity first, with a search box to find a name']],
  ['0.58.3', ['Replay: the player, date and course are back at the very top, with the hole, shot and club just under them']],
  ['0.58.2', ['Replay: the hole, shot and club are across the very top, with Strokes Gained on the right below them; play / pause and 2x are stacked at the bottom right']],
  ['0.58.1', ['Replay: the controls are at the top; the club for each shot shows in the bar and on the map at the ball as it\u2019s hit; putts are shown up close on the green; no second zoom after each shot lands']],
  ['0.58.0', ['Past rounds open on the first hole played (e.g. 10 for a back-nine round), with the score counting from there (+1 thru 1)', 'Replay, next to View round on a client\u2019s round: plays the round back one shot at a time, with a tracer for each shot and the view closing in on where it landed. Pause / play, 2x speed, and \u2715 to stop']],
  ['0.57.1', ['Viewing a client\u2019s round: the tag at the top shows FINAL, their name, the date and the course; Strokes Gained sits on the right just below it. The latest-shot strip only shows while a round is live', 'Tapping a shot: Shot 1 \u00b7 7 Iron, then how far and from where to where (155 yds from tee to fairway), then what was left (282 yds to hole), then strokes gained']],
  ['0.57.0', ['New Round and GPS Overview: the course list stays hidden until you start typing, then shows the top 5 matches', 'Hole screen: the two score tabs are now one long box, as wide as the hole pill, with this hole\u2019s score and where the round stands (e.g. +2 thru 5). Tap it for the scorecard and your total']],
  ['0.56.2', ['Hole screen: the score tabs are swapped, this hole\u2019s score first, then the round total. The hole tab now just says Score, since the hole number is on the hole pill below']],
  ['0.56.1', ['Hole screen: the buttons and hole info along the bottom sit a little lower, and the Total and Hole score tabs are shorter and closer to the hole number']],
  ['0.56.0', ['Hole screen buttons rearranged so they fit: on the left, a new SG button opens Auto and Comp; on the right, Club sits just above +, with Tools above it for Width, Arc, Disp and Appr', 'The Arc, Disp and Appr sliders now open low on the screen, between the two button columns', 'With GPS on, the distance to the pin and the Shot button move to the very top of the screen']],
  ['0.55.0', ['New Round and GPS Overview: fewer buttons on the hole screen. The aiming tools sit behind one Tools button on the right that opens them up the column; on the left are the menu, Tee, Pin and View', 'View opens a box with switches for SG map view (the drive heat map, which replaces the SG button), course lines view and clean view', 'Clean view hides everything but the hole info, View and the menu, for screenshots']],
  ['0.54.0', ['My Bag is the full one from the coaching app: tap a club to edit its carry, total and \u00be yardages, label and arc width; add, remove and import clubs, Find Yardages, Wedge Gapping, Speed and the Gap Visualizer', 'Performance Analysis: your focus area and strokes gained breakdown from your last 10 rounds here, plus combines', 'Practice and Learning: combines (evaluation test, putting, short game, wedges, line drill, driver), practice plans and log, drills, and the learning tools (SG calculator, putting break, distance optimizer, proximity, distance guide, Guide to Golf)', 'Coaching: assigned combines and drills now open here']],
  ['0.53.0', ['New Round and GPS Overview: the course box starts blank. Type the course name and the list narrows to the matching courses; tap one to pick it and choose its tee box']],
  ['0.52.6', ['Live view: the latest shot shows in a thin strip at the top (e.g. "Shot 1 · Driver 290 yds to fwy"); tap it to see the shot', 'Refresh is a small button in the bottom right corner']],
  ['0.52.5', ['Lost ball: a drop is +1 stroke, like water (out of bounds stays +2)']],
  ['0.52.4', ['Lost ball button on the shot sheet: re-hit (+1) or drop (+2), like out of bounds']],
  ['0.52.3', ['Score tiles: "thru" counts holes in the order played, so a round started on 10 keeps counting after the turn']],
  ['0.52.2', ['Live view: lighter tint, and only the green of the hole being played is highlighted, not its neighbours']],
  ['0.52.1', ['Live view: the holes around the one being played are tinted dark, so the hole stands out']],
  ['0.52.0', ['Coaching is here, shared with the coaching app: feedback from your coach, assigned drills, goals, messages and your invite code', 'Coaches: activity, notes, assignments, messages, students and teams, and each student\u2019s dashboard, rounds, notes, goals, bag and schedule from this app', 'Coaches can open a student\u2019s round on the map and watch a round live while it is being played']],
  ['0.51.3', ['Expected is a smaller tile without the handicap dropdown; tap it to pick the handicap and see the expected scorecard']],
  ['0.51.2', ['GPS button sits at the right edge; your yardage to the pin is in the top middle', 'Shot here is now a small blue pin button']],
  ['0.51.1', ['GPS button and your yardage to the pin moved to the top right, under Expected']],
  ['0.51.0', ['GPS (to test): the GPS button on a hole shows where you are as a blue dot with the distance to the pin', '"Shot here" records a shot finishing where you are standing; + still records the crosshair as before']],
  ['0.50.1', ['Live view: no Lines button and no course outlines for people watching']],
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

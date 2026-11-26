// Home, New Round, Round History, Settings and Log in, laid out like the
// coaching app. My Bag, Performance Analysis, Practice and Learning and
// Coaching are the coaching app's own pages (js/coaching).

import { h, course, toast, COURSES, courseById, setActiveCourse, goBack, ninesWith, comboId, isAdmin } from './app.js';
import { store, sync, submitCourseRequest, fetchCourseRequests, setCourseRequestStatus, countNewCourseRequests, markCourseRequestsSeen } from './store.js';
import { newRound } from './model.js';
import { LEVELS } from './sg.js';
import { checkCoachingDot } from './coaching/index.js';
import { fetchMyRole, saveRole, sendCoachRequest } from './coaching/roles.js';
import { VERSION } from './version.js';
import { icEl } from './icons.js';
import { addTestRounds, removeTestRounds, testRounds } from './testrounds.js';
import { setCurrentRound, summarize, historyRounds, roundKeyOf, startScouting, firstHoleOf, activeRound, pauseRound, resumeRound, holeCountOf } from './rounds.js';
import { downloadRoundCsv } from './dashboard.js';
import { openBookSetup, openSavedBooks } from './book.js';
import { holeFeatures, ownGreen } from './hole.js';
import { renderSGExplainer } from './learn/sg-explainer.js';
import { drillsData } from './coaching/data-drills.js';
import { libraryVideos } from './learn/library.js';

const levelOpt = (l, sel, short) => h('option', { value: l, selected: l === sel },
  short ? `vs ${l === 'Pro' ? 'Tour Pro' : l === 'Scratch' ? 'Scratch' : l + ' HCP'}` : `SG: ${l === 'Pro' ? 'Tour Pro' : l === 'Scratch' ? 'Scratch' : l + ' HCP'}`); // short enough for the half-width field
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
  const go = (icon, title, bg, href) => h('button', { class: 'homebtn', style: `background:${bg}`, onclick: () => { location.hash = href; } },
    h('span', { class: 'ic' }, icEl(icon)), h('div', {}, h('div', { class: 't' }, title)));
  const divider = () => h('div', { style: 'height:1px;background:#282828;margin:3px 0;flex:none;' });
  const search = h('button', { class: 'iconbtn', 'aria-label': 'Search', onclick: () => { location.hash = '#/search'; } });
  search.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#9a9a9a" stroke-width="2.5" stroke-linecap="round" style="width:18px;height:18px;"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

  const gearBtn = h('button', { class: 'iconbtn', 'aria-label': 'Settings', onclick: () => { location.hash = '#/settings'; } }, icEl('gear'));
  // For the admin: a red dot on the gear while a course request is waiting (listed in Settings).
  if (isAdmin) countNewCourseRequests().then(n => { if (n) { gearBtn.setAttribute('aria-label', `Settings (${n} new course request${n > 1 ? 's' : ''})`); gearBtn.append(h('span', { class: 'reqdot' })); } });
  const brand = h('div', { class: 'homebrand' });
  // One line, between the ? and the search / settings buttons; version and the player's name under it.
  brand.innerHTML = `<div class="hometitle">Blake Kokal Golf</div><div class="homesub"><span class="wn" style="color:#606060;font-weight:700;cursor:pointer;">v${VERSION}</span><span class="wn" style="color:#44b8f0;font-weight:600;cursor:pointer;">&#x2190; What's new</span></div>`;
  brand.querySelectorAll('.wn').forEach(el => el.addEventListener('click', () => { location.hash = '#/whatsnew'; }));
  brand.append(h('div', { class: 'homeuser' }, sync.user ? [icEl('user'), ' ' + sync.name] : ''));

  // Coaching, with a dot when a note, message or assignment is waiting.
  const coaching = go('cap', 'Coaching', '#00402c', '#/coaching');
  coaching.append(h('span', { id: 'coachingNotifDot', style: 'display:none;width:10px;height:10px;border-radius:50%;background:#d4706e;margin-left:auto;flex-shrink:0;' }));
  if (sync.user) checkCoachingDot();

  const practice = go('club', 'Practice and Learning', '#d49a10', '#/practice');

  view.replaceChildren(page('center home',
    h('div', { class: 'homecol' },
      // Help on the left, the title in the middle, settings (search under it) on the right.
      h('div', { class: 'homehead' },
        h('button', { class: 'iconbtn', 'aria-label': 'Strokes Gained explained', onclick: () => { location.hash = '#/help'; } }, icEl('help')),
        brand,
        // Settings with Search under it, so both sides are one button wide and the title stays centred.
        h('div', { style: 'display:flex;flex-direction:column;gap:6px;' }, gearBtn, search)),
      go('map', 'GPS Overview / Yardage Books', '#1a4a8a', '#/scout'),
      go('flag', 'New Round', '#007a52', '#/new'),
      go('scorecard', 'Round History', '#00402c', '#/history'),
      divider(),
      go('bars', 'Stats Dashboard', '#2d7abc', '#/dashboard'),
      go('perf', 'Performance Analysis', '#2d7abc', '#/performance'),
      go('bag', 'My Bag', '#1a4a8a', '#/bag'),
      divider(),
      practice,
      coaching),
    sync.user ? null : h('button', { class: 'linkbtn', style: 'margin-top:10px;flex:none;', onclick: () => { location.hash = '#/account'; } }, 'Log In / Sign Up')));
  // Everything fits, so a drag on Home shouldn't move the page at all: on iPhone
  // the whole screen otherwise slides and springs back (rubber-band bounce).
  view.firstChild.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
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
  // Picking a course fills in a tee box: the one you played last if this course
  // has it, otherwise the second longest (usually the Blues), or the only one.
  const total = t => t.yards.reduce((a, b) => a + b, 0);
  function defaultTee(c) {
    if (c.tees.some(t => t.name === lastTee)) return lastTee;
    const byLength = [...c.tees].sort((a, b) => total(b) - total(a));
    return (byLength[1] || byLength[0])?.name;
  }
  function fillTees() {
    const pick = chosen && defaultTee(chosen);
    tee.replaceChildren(h('option', { value: '' }, chosen ? 'Select Tee Box...' : 'Pick a course first'),
      ...(chosen ? chosen.tees.map(t => h('option', { value: t.name, selected: t.name === pick }, `${t.name} · ${total(t)} yds`)) : []));
    tee.disabled = !chosen;
    showTee();
  }
  function showTee() {
    const t = chosen?.tees.find(x => x.name === tee.value);
    const par = chosen ? chosen.holes.reduce((a, c) => a + c.par, 0) : 0;
    teeInfo.textContent = t ? `Par ${par} · ${t.yards.reduce((a, b) => a + b, 0).toLocaleString()} yds` + (t.rating ? ` · Rating ${t.rating} / Slope ${t.slope}` : '') : '';
  }
  fillTees();
  // Round type, Casual to start: Casual has every tool; Tournament keeps to what
  // the Rules of Golf allow (distances only: no plays-like, wind, contours,
  // strokes gained or club advice on the hole screen).
  const type = { value: '' };
  const typeNote = h('div', { style: 'width:100%;max-width:320px;text-align:center;font-size:12px;color:#606060;margin-top:-4px;' });
  const typeBtn = (v, label, sub) => h('button', { class: 'roundtype', 'aria-pressed': 'false', onclick: () => {
    type.value = v; err.textContent = '';
    typeRow.querySelectorAll('button').forEach(b => { const on = b === typeRow.querySelector(`[data-v="${v}"]`); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    typeNote.textContent = v === 'Tournament' ? 'Tournament mode: USGA legal features enabled' : 'Casual: every tool available';
  }, 'data-v': v }, h('b', {}, label), h('small', {}, sub));
  const typeRow = h('div', { class: 'roundtypes', role: 'group', 'aria-label': 'Round type' },
    typeBtn('Casual', 'Casual', 'Every tool available'), typeBtn('Tournament', 'Tournament', 'USGA legal'));

  let holes = 18;
  const pick = (btn, n) => { b9.classList.remove('selected'); b18.classList.remove('selected'); if (btn) btn.classList.add('selected'); holes = n; if (btn) custom.value = ''; };
  const b9 = h('button', { class: 'holes9', onclick: () => pick(b9, 9) }, '9 Holes');
  const b18 = h('button', { class: 'holes18 selected', onclick: () => pick(b18, 18) }, '18 Holes');
  const custom = h('input', { type: 'number', inputmode: 'numeric', min: 3, max: 18, placeholder: 'Custom # of Holes (3–18)', oninput: () => { const n = parseInt(custom.value, 10); if (n >= 3 && n <= +custom.max) pick(null, n); } });

  const err = h('div', { class: 'msg err' });
  typeRow.querySelector('[data-v="Casual"]').click(); // Casual to start; tap Tournament to change it
  const confirm = h('button', { class: 'holes9', onclick: () => {
    if (!chosen) { err.textContent = 'Select a course.'; return; }
    if (!tee.value) { err.textContent = 'Select a tee box.'; return; }
    if (!type.value) { err.textContent = 'Pick Casual or Tournament.'; return; }
    if (scout) {
      store.set('settings', { ...(store.get('settings') || {}), tee: tee.value });
      startScouting(tee.value, course.id, type.value); sessionStorage.removeItem('gs:level');
      location.hash = '#/hole/1';
      return;
    }
    if (askResume()) return; // one round at a time
    const most = Math.min(18, chosen.holes.length);
    if (custom.value && !(+custom.value >= 3 && +custom.value <= most)) { err.textContent = `Custom holes must be 3 to ${most}.`; return; }
    const r = { ...newRound(course, tee.value, date.value || today()), courseName: course.name, player: name.value.trim() || (sync.user ? sync.name : ''),
      level: level.value, type: type.value, place: null, holeCount: Math.min(holes, chosen.holes.length) };
    store.set(roundKeyOf(r.id), r);
    setActiveCourse(course.id);
    setCurrentRound(r.id); localStorage.removeItem('gs:viewOnly'); localStorage.removeItem('gs:editingPast');
    store.set('settings', { ...(store.get('settings') || {}), tee: tee.value });
    sessionStorage.removeItem('gs:level');
    location.hash = '#/hole/1';
  } }, 'START');
  // GPS Overview: a printable yardage book of the course from the tee box
  // picked (it opens on hole 1; ‹ › go round the holes, Print does the lot).
  const genBook = h('button', { class: 'holes9 genbook', onclick: () => {
    if (!chosen) { err.textContent = 'Select a course.'; return; }
    err.textContent = '';
    openBookSetup({ teeName: tee.value, tourney: type.value === 'Tournament', holeFeatures, ownGreen });
  } }, 'GENERATE YARDAGE BOOK');
  // The yardage books saved from Preview and edit: open one to edit and print it again.
  const reqBtn = () => sync.user ? h('button', { class: 'reqbtn', onclick: () => openCourseRequest(chosen ? '' : search.value.trim()) }, '+ Submit a New Course') : null;
  const savedBooksBtn = h('button', { class: 'holes9 savedbooks', onclick: () => openSavedBooks({ tourney: false, holeFeatures, ownGreen }) }, 'SAVED YARDAGE BOOKS');

  // Course: a blank box to type in; the courses matching what's typed are listed
  // below it to tap. Picking one fills in its tee boxes.
  const results = h('div', { class: 'courseresults', hidden: true });
  // A nine at a club with other nines asks: just these 9 holes, or 18 with
  // another nine as the back nine (each listed by its name).
  const ninesBox = h('div', { class: 'ninesbox', hidden: true });
  const shortName = id => { const n = COURSES.find(x => x.id === id)?.name || id; return n.split(' – ').slice(1).join(' – ') || n; };
  const useCourse = id => {
    setActiveCourse(id); chosen = courseById(id);
    search.value = chosen.name; err.textContent = '';
    fillTees();
    // A nine-hole course is played as 9 holes (or fewer, as a custom round).
    const nine = chosen.holes.length <= 9;
    b18.hidden = nine; custom.max = nine ? 9 : 18; custom.placeholder = `Custom # of Holes (3–${nine ? 9 : 18})`;
    if (nine && holes > 9) pick(b9, 9);
    if (!nine && chosen.parts) pick(b18, 18);
    drawNines();
  };
  function drawNines() {
    const front = chosen?.parts ? chosen.parts[0] : chosen?.id, others = front ? ninesWith(front) : [];
    ninesBox.hidden = !others.length;
    if (!others.length) return;
    const opt = (label, sub, on, go) => h('button', { class: on ? 'on' : '', onmousedown: e => e.preventDefault(), onclick: go }, h('b', {}, label), sub ? h('small', {}, sub) : null);
    ninesBox.replaceChildren(h('div', { class: 'ninesq' }, `${shortName(front)} is a 9-hole course. Play just these 9, or add another nine to make 18?`),
      opt('9 holes only', shortName(front), !chosen.parts, () => useCourse(front)),
      ...others.map(o => opt(`18 holes: + ${shortName(o.id)}`, `${shortName(front)} front 9, ${shortName(o.id)} back 9`, chosen.parts?.[1] === o.id, () => useCourse(comboId(front, o.id)))));
  }
  const pickCourse = c => { results.hidden = true; useCourse(c.id); };
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
    results.replaceChildren(...(hits.length ? hits.map(c => h('button', { class: c.id === chosen?.id ? 'on' : '', onmousedown: e => e.preventDefault(), onclick: () => pickCourse(c) }, c.name)) : [h('div', { class: 'none' }, 'No courses match'), sync.user ? h('button', { class: 'reqhit', onmousedown: e => e.preventDefault(), onclick: () => { search.blur(); openCourseRequest(search.value.trim()); } }, `+ Submit “${search.value.trim()}” as a new course`) : null]));
    results.hidden = false;
  };
  const search = h('input', { type: 'search', placeholder: 'Course name', 'aria-label': 'Course', autocomplete: 'off', value: '',
    oninput: () => { if (chosen && search.value !== chosen.name) { chosen = null; fillTees(); drawNines(); } showHits(); },
    onfocus: showHits,
    onclick: showHits, // already focused: show the list again
    onblur: () => { results.hidden = true; },
    onkeydown: e => { if (e.key === 'Enter') { const hits = hitsFor(); if (hits.length === 1) { pickCourse(hits[0]); search.blur(); } } } });
  const courseBox = h('div', { style: 'width:100%;max-width:320px;position:relative;z-index:10;' }, search, results);
  // Opened from Search with a course picked.
  const pre = sessionStorage.getItem('gs:pickCourse');
  if (pre) { sessionStorage.removeItem('gs:pickCourse'); if (COURSES.some(c => c.id === pre)) useCourse(pre); }
  if (scout) {
    view.replaceChildren(page('top', backBtn(),
      h('div', { style: 'font-size:20px;font-weight:800;padding:0 44px;line-height:1.2;' }, icEl('map', 'tint-blue'), ' GPS Overview / Yardage Books'),
      h('div', { style: 'font-size:12px;color:#606060;text-align:center;margin-top:-4px;' }, `${COURSES.length} courses added`),
      courseBox, ninesBox, tee, teeInfo, typeRow, typeNote, confirm, genBook, savedBooksBtn, err, reqBtn()));
    return;
  }
  // The page fits the screen and doesn't scroll (the course list scrolls inside its drop-down).
  view.replaceChildren(page('top noscroll', backBtn(),
    h('div', { style: 'font-size:22px;font-weight:800;' }, icEl('flag', 'tint-green'), ' New Round'),
    name,
    h('div', { class: 'row' }, level, date),
    courseBox, ninesBox,
    tee, teeInfo, typeRow, typeNote,
    h('div', { class: 'row' }, b9, b18),
    custom,
    confirm, err, reqBtn()));
}

// ---------- round history ----------

export function renderHistory(view) {
  if (needLogin(view)) return;
  const level = profileLevel();
  const sel = (opts, def) => h('select', { class: 'minisel', style: 'flex:1;max-width:190px;height:36px;font-size:13px;background:#333333;border-color:#3d3d3d;border-radius:8px;', onchange: () => draw() }, opts.map(([v, l]) => h('option', { value: v, selected: v === def }, l)));
  const fType = sel([['all', 'All Types'], ['Casual', 'Casual'], ['Tournament', 'Tournament']]);
  const fHoles = sel([['all', 'All Holes'], ['9', '9 Holes'], ['18', '18 Holes']]);
  const fTime = sel([['all', 'All Time'], ['1', 'Last Month'], ['3', 'Last 3 Months'], ['6', 'Last 6 Months']]);
  const fStatus = sel([['all', 'All Status'], ['complete', 'Completed'], ['incomplete', 'In Progress']]);
  const sort = sel([['date-desc', 'Date: Newest'], ['date-asc', 'Date: Oldest'], ['score-asc', 'Score: Low→High'], ['score-desc', 'Score: High→Low']]);
  const search = h('input', { type: 'text', placeholder: 'Search course name...', class: 'searchbox', style: 'max-width:360px;margin-bottom:6px;', oninput: () => draw() });
  const msg = h('div', { style: 'font-size:13px;color:#606060;min-height:20px;text-align:center;' });
  const list = h('div', { class: 'scrollpane', style: 'width:100%;' });
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
    const n = [fType, fHoles, fTime, fStatus].filter(f => f.value !== 'all').length + (sort.value !== 'date-desc' ? 1 : 0);
    filterBtn.lastChild.textContent = n ? `Filter · ${n}` : 'Filter';
    filterBtn.style.background = n ? '#2d7abc' : '#282828';
    filtMsg.textContent = shown.length < all.length ? 'Filters active' : '';
    if (!shown.length) { list.replaceChildren(h('div', { style: 'text-align:center;color:#606060;padding:16px;font-size:13px;' }, 'No rounds match your filters')); return; }
    list.replaceChildren(...shown.map(({ r, s }) => card(r, s)));
  }

  function card(r, s) {
    const tp = s.toPar > 0 ? '+' + s.toPar : s.toPar === 0 ? 'E' : String(s.toPar);
    const del = (w, ht) => h('button', { style: `width:${w}px;max-width:none;height:${ht}px;font-size:12px;background:#d4706e;border-radius:6px;`, onclick: e => {
      e.stopPropagation();
      if (confirm(`Delete the round from ${fmtDate(r.date)}? This removes it from every device.`)) { store.remove(roundKeyOf(r.id)); draw(); }
    } }, 'Del');
    const resume = () => openRound(r);
    const holesInfo = s.done < s.count ? `${s.done}/${s.count} holes` : `${s.count} holes`;
    return h('div', { class: 'card', style: s.incomplete ? 'border-left:3px solid #d4706e;cursor:pointer;' : '', onclick: s.incomplete ? resume : null },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;' },
        h('div', {},
          h('div', { style: 'font-weight:700;font-size:15px;' }, r.courseName || course.name, s.incomplete ? h('span', { style: 'color:#f0c830;font-size:10px;font-weight:700;' }, [' ', icEl('pause'), ' In Progress']) : null),
          r.type === 'Tournament' ? h('div', { style: 'color:#f0c830;font-size:11px;font-weight:700;margin-top:2px;' }, '★ Tournament' + (r.place ? ` — ${ordinal(r.place)} Place` : '')) : null,
          h('div', { style: 'font-size:12px;color:#9a9a9a;' }, `${fmtDate(r.date)} · ${holesInfo}${r.player ? ' · ' + r.player : ''}`)),
        h('div', { style: 'text-align:right;' }, s.incomplete
          ? h('div', { style: 'font-size:14px;font-weight:700;color:#f0c830;' }, 'In Progress')
          : [h('div', { style: 'font-size:20px;font-weight:800;' }, String(s.score)),
            h('div', { style: `font-size:13px;color:${s.toPar > 0 ? '#d4706e' : s.toPar < 0 ? '#00b87a' : '#9a9a9a'}` }, tp)])),
      h('div', { style: 'display:flex;gap:6px;margin-top:8px;' }, s.incomplete
        ? [h('button', { style: 'flex:2;max-width:none;height:34px;font-size:13px;font-weight:700;background:#d4706e;border-radius:6px;', onclick: e => { e.stopPropagation(); resume(); } }, '▶ Resume Round'), del(60, 34)]
        : [h('button', { style: 'flex:1;max-width:none;height:30px;font-size:12px;background:#007a52;border-radius:6px;font-weight:700;', onclick: e => {
            e.stopPropagation();
            setCurrentRound(r.id); localStorage.setItem('gs:viewOnly', '1'); localStorage.removeItem('gs:editingPast'); sessionStorage.removeItem('gs:level');
            store.set('settings', { ...(store.get('settings') || {}), tee: r.tee });
            location.hash = '#/hole/' + firstHoleOf(r, courseById(r.course)); // the first hole they played
          } }, 'View/Edit'),
          h('button', { style: 'flex:1;max-width:none;height:30px;font-size:12px;background:#2d7abc;border-radius:6px;', onclick: e => { e.stopPropagation(); location.hash = `#/dashboard/${r.id}`; } }, 'Stats'),
          h('button', { title: 'Download scorecard (CSV)', style: 'width:50px;max-width:none;height:30px;font-size:12px;background:#00402c;border-radius:6px;', onclick: e => { e.stopPropagation(); downloadRoundCsv(r); } }, icEl('download')),
          del(50, 30)]));
  }

  // One Filter button; tapping it drops down the filters and the sort order.
  const filterRow = (label, el) => h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;' },
    h('span', { style: 'font-size:13px;font-weight:600;color:#9a9a9a;' }, label), el);
  const panel = h('div', { hidden: true, style: 'position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:20;background:#282828;border:1px solid #3d3d3d;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,0.5);text-align:left;' },
    filterRow('Type', fType), filterRow('Holes', fHoles), filterRow('Time', fTime), filterRow('Status', fStatus), filterRow('Sort', sort),
    h('div', { style: 'display:flex;gap:8px;margin-top:4px;' },
      h('button', { style: 'flex:1;max-width:none;height:36px;font-size:13px;background:#333333;color:#9a9a9a;border-radius:8px;', onclick: () => {
        [fType, fHoles, fTime, fStatus].forEach(f => { f.value = 'all'; }); sort.value = 'date-desc'; draw();
      } }, 'Clear'),
      h('button', { style: 'flex:1;max-width:none;height:36px;font-size:13px;background:#2d7abc;border-radius:8px;', onclick: () => { panel.hidden = true; } }, 'Done')));
  const filterBtn = h('button', { 'aria-expanded': 'false', style: 'max-width:none;height:40px;font-size:14px;background:#282828;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:8px;',
    onclick: e => { e.stopPropagation(); panel.hidden = !panel.hidden; filterBtn.setAttribute('aria-expanded', String(!panel.hidden)); } },
    h('span', { style: 'font-size:15px;line-height:1;' }, '\u2630'), h('span', {}, 'Filter'));
  const filterWrap = h('div', { style: 'position:relative;margin-bottom:8px;' }, filterBtn, panel);
  // Tapping anywhere else closes it.
  // Only the list of rounds scrolls; the title, search and Filter stay put.
  const root = page('top fixedpage', backBtn(),
    h('div', { class: 'fixedcol', style: 'width:100%;max-width:360px;' },
      h('div', { style: 'font-size:20px;font-weight:800;text-align:center;margin-bottom:8px;' }, icEl('scorecard', 'tint-green'), ' Round History'),
      search, filterWrap,
      msg, list, filtMsg));
  root.addEventListener('click', e => { if (!panel.hidden && !filterWrap.contains(e.target)) { panel.hidden = true; filterBtn.setAttribute('aria-expanded', 'false'); } });
  view.replaceChildren(root);
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

// ---------- course requests ----------

// Submit a new course: a logged-in player names a course to be added; it lands
// in the admin's Settings (Course Requests) with a dot on Home's gear.
function openCourseRequest(prefill = '') {
  const close = () => ov.remove();
  const name = h('input', { placeholder: 'Course name', value: prefill, maxlength: 120, 'aria-label': 'Course name' });
  const place = h('input', { placeholder: 'City, State', maxlength: 120, 'aria-label': 'City and state' });
  const notes = h('input', { placeholder: 'Website or notes (optional)', maxlength: 1000, 'aria-label': 'Website or notes' });
  const msg = h('div', { class: 'msg' });
  const send = h('button', { class: 'holes9', onclick: async () => {
    const n = name.value.trim(), p = place.value.trim();
    if (n.length < 2) { msg.textContent = 'Enter the course name'; msg.className = 'msg err'; return; }
    if (!p) { msg.textContent = 'Enter the city and state'; msg.className = 'msg err'; return; }
    send.disabled = true; msg.textContent = 'Sending…'; msg.className = 'msg ok';
    try { await submitCourseRequest({ name: n, place: p, notes: notes.value.trim() }); close(); toast('Thanks! Your course request was sent.'); }
    catch (e) { msg.textContent = e.message || String(e); msg.className = 'msg err'; send.disabled = false; }
  } }, 'SUBMIT');
  const ov = h('div', { class: 'cx reqov', onclick: e => { if (e.target === ov) close(); } },
    h('div', { class: 'reqbox' },
      h('div', { style: 'font-size:18px;font-weight:800;' }, 'Submit a New Course'),
      h('div', { style: 'font-size:12px;color:#9a9a9a;margin-bottom:4px;' }, "Tell us the course and we'll add it."),
      name, place, notes, send, msg,
      h('button', { class: 'linkbtn', style: 'font-size:13px;', onclick: close }, 'Cancel')));
  document.body.append(ov);
  (prefill ? place : name).focus();
}

// Settings, admin only: add or remove made-up finished rounds, for testing.
function testRoundsSection() {
  const note = h('div', { class: 'small muted' });
  const show = () => { const n = testRounds().length; note.textContent = n ? `${n} test round${n > 1 ? 's' : ''} on your profile` : 'No test rounds'; rm.disabled = !n; };
  const add = h('button', { style: 'flex:1;max-width:none;height:36px;font-size:13px;background:#2d7abc;border-radius:8px;', onclick: () => {
    const n = addTestRounds(8); show(); toast(n ? `Added ${n} test rounds` : 'Test rounds already added');
  } }, 'Add 8 test rounds');
  const rm = h('button', { style: 'flex:1;max-width:none;height:36px;font-size:13px;background:#282828;border-radius:8px;', onclick: () => {
    if (!confirm('Remove all test rounds?')) return;
    const n = removeTestRounds(); show(); toast(`Removed ${n} test rounds`);
  } }, 'Remove test rounds');
  show();
  return h('div', { class: 'section' }, h('div', { class: 'lab' }, 'Test Rounds'), h('div', { class: 'row' }, add, rm), note);
}

// Settings, admin only: every request, newest first, with its status.
function courseRequestsSection() {
  const list = h('div', { class: 'reqlist' }, h('div', { class: 'small muted' }, 'Loading…'));
  const STATUS = [['new', 'New'], ['building', 'Building'], ['added', 'Added'], ['declined', 'Declined']];
  fetchCourseRequests().then(rows => {
    markCourseRequestsSeen();
    if (!rows.length) { list.replaceChildren(h('div', { class: 'small muted' }, 'No requests yet.')); return; }
    list.replaceChildren(...rows.map(r => {
      const d = new Date(r.created);
      const sel = h('select', { class: 'minisel', 'aria-label': 'Status of ' + r.name, onchange: async () => {
        try { await setCourseRequestStatus(r.id, sel.value); card.dataset.status = sel.value; } catch (e) { toast(e.message || String(e)); sel.value = card.dataset.status; }
      } }, STATUS.map(([v, l]) => h('option', { value: v, selected: v === r.status }, l)));
      const card = h('div', { class: 'reqcard', 'data-status': r.status },
        h('div', { class: 'reqtop' }, h('b', {}, r.name), sel),
        r.place ? h('div', {}, r.place) : null,
        r.notes ? h('div', { class: 'reqnotes' }, r.notes) : null,
        h('div', { class: 'small muted' }, `${r.who || r.email || 'A player'} · ${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`));
      return card;
    }));
  }).catch(e => list.replaceChildren(h('div', { class: 'small', style: 'color:#d4706e;' }, e.message || String(e))));
  return h('div', { class: 'section' }, h('div', { class: 'lab' }, 'Course Requests'), list);
}

// Settings > Account Role: Student or Coach. Coaches (and admins, always
// coaches) switch freely; anyone else taps Coach to ask an admin for access.
function accountRoleSection() {
  const msg = h('div', { class: 'msg' });
  const say = (t, ok) => { msg.textContent = t; msg.className = 'msg ' + (ok ? 'ok' : 'err'); };
  let me = null;
  const show = () => {
    student.classList.toggle('on', me?.role === 'student'); coach.classList.toggle('on', me?.role === 'coach');
    student.disabled = !me || me.isAdmin; coach.disabled = !me;
  };
  const pick = async role => {
    if (!me || me.role === role) return;
    if (role === 'coach' && !me.approved) {
      if (!confirm('Coach access lets you add students, view their rounds and assign drills. Send a request to the admin?')) return;
      say('Sending…', true);
      try { say((await sendCoachRequest()) === 'pending' ? 'Your request is already waiting for approval.' : "✓ Request sent! You'll be notified when it's approved.", true); }
      catch (e) { say(e.message || String(e)); }
      return;
    }
    const was = me.role; me.role = role; show();
    try { await saveRole(role); say(role === 'coach' ? '✓ Coach: Coaching shows your students.' : '✓ Student: Coaching shows your coach.', true); }
    catch (e) { me.role = was; show(); say(e.message || String(e)); }
  };
  const student = h('button', { class: 'rolebtn', disabled: true, onclick: () => pick('student') }, 'Student');
  const coach = h('button', { class: 'rolebtn', disabled: true, onclick: () => pick('coach') }, 'Coach');
  fetchMyRole().then(r => { me = r; show(); if (r.isAdmin) say('Admins are always coaches.', true); }).catch(e => say(e.message || String(e)));
  return h('div', { class: 'section' }, h('div', { class: 'lab' }, 'Account Role'),
    h('div', { style: 'display:flex;gap:6px;width:100%;max-width:280px;' }, student, coach), msg);
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
      h('div', { style: 'font-size:18px;font-weight:800;' }, icEl('gear'), ' Settings'),
      isAdmin ? courseRequestsSection() : null,
      isAdmin ? testRoundsSection() : null,
      h('div', { style: 'font-size:13px;color:#9a9a9a;' }, u.email),
      h('div', { style: 'font-size:11px;color:#606060;margin-bottom:2px;' }, joined ? `Joined ${joined.getMonth() + 1}/${joined.getDate()}/${joined.getFullYear()}` : ''),
      nameIn,
      h('button', { class: 'holes9', onclick: async () => {
        const n = nameIn.value.trim();
        if (!n) return say(nameMsg, 'Name cannot be empty');
        say(nameMsg, 'Saving...', true);
        try { await sync.setName(n); say(nameMsg, '✓ Name updated!', true); } catch (e) { say(nameMsg, e.message || String(e)); }
      } }, 'SAVE NAME'), nameMsg,
      accountRoleSection(),
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
      h('button', { style: 'background:#d4706e;margin-top:8px;', onclick: async () => { await sync.signOut(); location.hash = '#/'; } }, 'LOG OUT'),
      h('button', { class: 'linkbtn', style: 'margin-top:14px;font-size:12px;', onclick: () => { location.hash = '#/device'; } }, 'Offline imagery & backup'),
      deleteAccountSection(),
      h('a', { href: 'privacy.html', target: '_blank', rel: 'noopener', style: 'margin-top:10px;font-size:12px;color:#9a9a9a;' }, 'Privacy policy'))));
}

// Delete account: hidden behind a link, then a warning and the password.
function deleteAccountSection() {
  const pw = h('input', { type: 'password', placeholder: 'Your password', autocomplete: 'current-password', 'aria-label': 'Password' });
  const msg = h('div', { class: 'msg' });
  const go = h('button', { style: 'background:#d4706e;', onclick: async () => {
    if (!pw.value) { msg.textContent = 'Enter your password'; msg.className = 'msg err'; return; }
    if (!confirm('Delete your account and every round, shot and setting saved to it? This cannot be undone.')) return;
    go.disabled = true; msg.textContent = 'Deleting…'; msg.className = 'msg ok';
    try { await sync.deleteAccount(pw.value); location.hash = '#/'; toast('Your account has been deleted.'); }
    catch (e) { msg.textContent = e.message || String(e); msg.className = 'msg err'; go.disabled = false; }
  } }, 'DELETE MY ACCOUNT');
  const box = h('div', { class: 'section', hidden: true },
    h('div', { class: 'lab', style: 'color:#d4706e;' }, 'Delete Account'),
    h('div', { style: 'font-size:12px;color:#9a9a9a;max-width:280px;' }, 'This deletes your account and everything saved to it: rounds, shots, your bag and settings, for this app and the coaching app (they share the account). It cannot be undone. Download a backup first if you want to keep your rounds.'),
    pw, go, msg);
  const open = h('button', { class: 'linkbtn', style: 'margin-top:10px;font-size:12px;color:#d4706e;', onclick: () => { box.hidden = false; open.hidden = true; pw.focus(); } }, 'Delete account');
  return h('div', { style: 'display:contents;' }, open, box);
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
    h('div', { style: 'font-size:24px;font-weight:800;' }, 'Account'), msg, email, pass, extra, loginBtn, signupBtn, forgot,
    h('a', { href: 'privacy.html', target: '_blank', rel: 'noopener', style: 'margin-top:14px;font-size:12px;color:#9a9a9a;' }, 'Privacy policy')));
}


// ---------- what's new ----------

const CHANGES = [
  ['1.30.0', ['New course: Waterchase Golf Club (Fort Worth), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.29.0', ['New course: The Golf Club at Champions Circle (Fort Worth), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.28.0', ['New course: Rusted Rail Golf Club (Crandall), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap on the satellite picture, bunkers checked against the picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.27.0', ['New course: The Courses at Watters Creek – Traditions (Plano), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.26.0', ['New course: Duck Creek Golf Club (Garland), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap on the satellite picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.25.0', ['New course: Grover C. Keaton Golf Course (Dallas), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap on the satellite picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.24.0', ['New course: Texas Rangers Golf Club (Arlington), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, bunkers checked against the picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.23.0', ['New course: Pecan Valley Golf Course – Hills (Fort Worth), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.22.0', ['New course: The Resort Golf Club (Fort Worth), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.21.0', ['New courses: Tenison Park Golf Course – Highlands and Glen (Dallas), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.20.56', ['Swiping from near the left edge uses only the phone’s own back swipe (it no longer shows three screens)']],
  ['1.20.55', ['The right-side strip is near black (not pure black), so a swiped screen can slide over it again']],
  ['1.20.54', ['The strip down the right side of the screen is pure black']],
  ['1.20.53', ['The strip down the right side of the screen is a lighter grey, closer to the app']],
  ['1.20.52', ['Removed the Screen check page']],
  ['1.20.51', ['Screen check (Search → Screen check): this phone’s screen size and edges, to make use of the strip down the right side']],
  ['1.20.50', ['Swiping between tabs switches at once, like tapping the tab']],
  ['1.20.49', ['Swiping between tabs moves only what’s under the tabs; the title and tab buttons stay put, like tapping a tab']],
  ['1.20.48', ['Swiping back shows the screen before underneath as you drag, like the swipe from the left edge']],
  ['1.20.47', ['Swiping is smoother, the previous screen comes up as soon as you let go, and a quick flick is enough']],
  ['1.20.46', ['Swipe right from anywhere on a screen to go back (every screen but the GPS map); the screen follows your finger and slides away. Tabs slide the same way']],
  ['1.20.45', ['My Clubs, Coaching and a student’s page: no strip behind the tab buttons']],
  ['1.20.44', ['Swipe left or right to change tabs (Practice and Learning, My Clubs, Coaching, Performance Analysis, How Far Should I Hit It?); swipe right on the first tab to go back']],
  ['1.20.43', ['Recommended and Timed Practice: new ring chart in the app’s colours and font, one slice per category matching the rows below']],
  ['1.20.42', ['Every panel and tile is in the new glass style: Pre-Round Warm Up, Recommended and Timed Practice, Tour Practice, drill details, Learning Library, Guide to Golf, Proximity Calculator, Distance Optimizer, combines, Performance Analysis and more', 'Practice: the in-page Back links are gone; the Back button does it', 'Offline imagery & backup has the new look']],
  ['1.20.41', ['GPS: double-tapping a button no longer zooms the screen']],
  ['1.20.40', ['Speed and Combine History: filters and tiles in the new glass style']],
  ['1.20.39', ['Wedge Gapping: %, ½, Body and Clear buttons are all the same size']],
  ['1.20.38', ['Desktop: the Back button sits by the app, under Settings and Search, not in the window’s corner']],
  ['1.20.37', ['Coaching: Recent Activity runs to the bottom of the screen']],
  ['1.20.36', ['Learn: removed the Strokes Gained Calculator (GPS does it better)']],
  ['1.20.35', ['Practice and Learning: no dark strip behind the tabs', 'Short Game Combines, Line Drill, Driver and Evaluation Test: Back button in the bottom-right; card text centered']],
  ['1.20.34', ['Practice and Learning: no gap under the tabs']],
  ['1.20.33', ['Stats Dashboard, Round History and a student’s Dashboard: the list runs to the bottom of the screen (no empty band); its last row still scrolls clear of the Back button']],
  ['1.20.32', ['Stats Dashboard: each past round’s strokes gained fits on one line; SG: Total’s number sits in the middle of its bubble', 'Coaching: a student’s Dashboard tab is laid out the same way (only Past rounds scrolls)']],
  ['1.20.31', ['Stats Dashboard: Off The Tee, Approach, Around Green and Putting sit two by two under SG: Total, so more past rounds fit on screen']],
  ['1.20.30', ['Home: Search sits under Settings, so Blake Kokal Golf is always centred']],
  ['1.20.29', ['Settings (admin): Add 8 test rounds and Remove test rounds, for testing the dashboards and history']],
  ['1.20.28', ['Stats Dashboard: each strokes gained category is a glass bubble, so it looks tappable']],
  ['1.20.27', ['Stats Dashboard: tapping a category keeps its SG bar at the top with the title; only the stats under it scroll. SG: Total now shows its bar too']],
  ['1.20.26', ['Combine History: Delete is a round trash-can button, so it fits the card']],
  ['1.20.25', ['Stats Dashboard: the strokes gained bars stay put and only Past rounds scrolls, with no scroll bar', 'Back button: smaller and more see-through']],
  ['1.20.24', ['Back button: now in the bottom-right corner, for one-handed use']],
  ['1.20.23', ['Stats Dashboard: new bars icon']],
  ['1.20.22', ['New Round: the page fits the screen and doesn’t scroll']],
  ['1.20.21', ['Round History and Stats Dashboard: the page stays put; only the list of past rounds scrolls']],
  ['1.20.20', ['Viewing a student: no gray band behind the Dashboard, Rounds, Notes and Clubs buttons']],
  ['1.20.19', ['Coaching Recent Activity: Mark all read and Strokes gained fit inside their buttons on narrow screens']],
  ['1.20.18', ['Page titles show their Home icon in the same color: New Round, GPS Overview, Round History, Stats Dashboard, Performance Analysis, My Clubs, Practice and Learning, Coaching']],
  ['1.20.17', ['Settings: Account Role works. Coaches switch between Student and Coach; anyone else taps Coach to request coach access', 'Coaching: Request coach access no longer fails for coaches and admins']],
  ['1.20.16', ['Submit a New Course: on GPS Overview and New Round (and when a course search finds nothing), logged-in players can ask for a course to be added']],
  ['1.20.15', ['New Round: no Create Custom Course or My Courses buttons']],
  ['1.20.14', ['Performance Analysis, Combines: the Putting and Wedge cards line up, each pair the same height']],
  ['1.20.13', ['Strokes Gained Explained (the ? button, and in Learn): glass cards instead of blue, green and red; only the numbers are colored']],
  ['1.20.12', ['New Round: no "What type of round is this?" and no Place box for Tournament (set Place later in Edit Round)']],
  ['1.20.11', ['New Round: the compare-to picker reads "SG: 5 HCP", "SG: Tour Pro"..., so it fits']],
  ['1.20.10', ['GPS screen: map buttons are 50% see-through']],
  ['1.20.9', ['Home: bigger title, filling the space between the buttons']],
  ['1.20.8', ['Home: Blake Kokal Golf is on one line, between the ? and the search and settings buttons']],
  ['1.20.7', ['Back, search and settings buttons are round again, not oval', 'New settings icon: a gear']],
  ['1.20.6', ['Drills: tiles are glass instead of blue']],
  ['1.20.5', ['Practice and Learning: icons in color, like Home']],
  ['1.20.4', ['My Bag: no bar behind the tabs, club tiles are glass', 'Number fields: no up/down arrows']],
  ['1.20.3', ['Performance Analysis: cards are glass instead of red and green; only the numbers show red or green']],
  ['1.20.2', ['Course search: results are a plain list again', 'Performance Analysis and other toggles: no grey bubble behind the buttons']],
  ['1.20.1', ['Round type: Casual and Tournament are the same width; Tournament reads "USGA legal"']],
  ['1.20.0', ['New look: liquid glass. A graphite background, frosted glass buttons, fields and cards, and solid blue for whatever is selected']],
  ['1.19.7', ['Round type: Casual is "every tool available", Tournament is "USGA legal features enabled"']],
  ['1.19.6', ['No scroll bars anywhere in coaching, My Bag, Performance and Practice (they still scroll), so switching tabs on a player profile no longer shifts the page']],
  ['1.19.5', ['Player profiles: the Misc tab is now Clubs, and Goals and Schedule are hidden for now']],
  ['1.19.4', ['Find Yardages: your clubs are a 3-across grid instead of one long list']],
  ['1.19.3', ['My Clubs: no scroll bar, so the page no longer shifts sideways between My Bag, Find Yardages, Wedge Gapping and Speed']],
  ['1.19.2', ['App icon: back to the BLAKE KOKAL GOLF icon']],
  ['1.19.1', ['New app icon: BKG wearing the hat']],
  ['1.19.0', ['New courses: Rockwall Golf & Athletic Club (Rockwall), The Golf Club at Fossil Creek (Fort Worth), Whitestone Golf Club (Benbrook), Hawks Creek Golf Club (Westworth Village) and Oak Hollow Golf Course (McKinney), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, bunkers checked against the picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.18.13', ['Stats Dashboard: the Filter button sits to the right of the title (it was beside “per round”)']],
  ['1.18.12', ['Round History: one Filter button instead of five boxes. Tap it for a menu with Type, Holes, Time, Status and Sort (Clear resets them); it turns blue and shows how many are on']],
  ['1.18.11', ['Strokes Gained Explained: the same font as the rest of the app (the worked sums were in a typewriter font), with the app’s title size and weights and no text smaller than 11']],
  ['1.18.10', ['Home: the ? opens Strokes Gained Explained', 'Home: Search finds pages, courses, drills, combines and Learn tools and videos; tap one to go there (a course opens in GPS Overview)', 'Home: the ?, search and settings buttons sit in a row above the title, so they no longer cover it']],
  ['1.18.9', ['Drills: every drill tile and category tab is blue (Short Game and Full Swing were green and yellow)']],
  ['1.18.8', ['New Round and GPS Overview: picking a course fills in a tee box, the one you played last if the course has it, otherwise the second longest (usually the Blues)']],
  ['1.18.7', ['One color scheme across the app: Stats, Settings and Performance now use the same colors as the rest (the yardage book keeps its own)']],
  ['1.18.6', ['App icon back to the white BLAKE KOKAL GOLF']],
  ['1.18.5', ['Home Screen icon on iPhone is the dark one too (it was still showing the white icon)']],
  ['1.18.4', ['App icon: BLAKE KOKAL GOLF in white and green on black']],
  ['1.18.3', ['Menus: double-tapping no longer zooms the page in']],
  ['1.18.2', ['Home stays put: dragging on the main page no longer makes the screen slide and spring back']],
  ['1.18.1', ['Home fits the screen: no more scrolling on the main page. The buttons shrink a little on shorter phones so everything shows at once']],
  ['1.18.0', ['New icons: every emoji is now a simple outline icon in one style, on Home, Practice, Combines, Learn, Coaching and the rest of the app. Each Practice, Combines and Learn tile has its own icon, lined up on the left with the titles after it', 'Search boxes show a magnifier inside the box']],
  ['1.17.7', ['Home Screen icon: the BLAKE KOKAL GOLF badge now shows on iPhone instead of a plain letter']],
  ['1.17.6', ['Browser tab icon: the golfer drawing itself, with its background removed']],
  ['1.17.5', ['Browser tab icon: the golfer silhouette']],
  ['1.17.4', ['The app is now called BKG Stats (browser tab, home-screen name, privacy policy and backup file names)']],
  ['1.17.3', ['New app icon: BLAKE KOKAL GOLF (browser tab, and the home-screen icon when you add the app to your phone)']],
  ['1.17.2', ['Settings: Delete account, which permanently deletes your account and everything saved to it (for the coaching app too, as they share the account)', 'Privacy policy, linked from Settings and the log-in page']],
  ['1.17.1', ['Coaching: editing a student’s round also updates the score on its New Round notification in Recent Activity']],
  ['1.17.0', ['Last ball lost / unplayable: when the ball you already marked was lost or unplayable, tap + and choose it to re-tee or drop with the penalty and no extra stroke (before, Penalty / drop there added a stroke from where the ball lay)', 'A drop placed on the edge of a pond is played as from the rough and isn’t charged a second penalty; rounds that already had one are corrected', 'Coaching: Edit on a student’s round (opened from Coaching) to fix their shots; changes are saved to the student’s account']],
  ['1.16.3', ['Coaching: View round and Strokes gained on a New Round notification open that round (the course it names, played that day), not the one the student edited most recently']],
  ['1.16.2', ['Around the green is 30 yards or less everywhere (Stats, the round dashboard, Performance and practice plans); approach is everything over 30. Approach by distance starts with 30–75 and 75–100 yards, shown even before you have shots there']],
  ['1.16.1', ['Average drive: a Driver figure (tee shots logged with Driver) and an All clubs figure, both from par 4s and 5s only, on the Stats page, the Off the Tee tab and Performance']],
  ['1.16.0', ['New course: Isabella Golf Course (Hot Springs Village, Arkansas), all three nines (Nina, Pinta and Santa Maria): play any nine, or any two as 18. Greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap on the satellite picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.15.3', ['Yardage book, green page: no blue line down the middle of the green (the grid runs through as usual)']],
  ['1.15.2', ['Yardage book, par 5s: the whole-hole spread’s points are every 25 yards to the front of the green (25, 50, 75 …), so the red numbers are round, with the yards from the tee under each']],
  ['1.15.1', ['Yardage book: the back of the green is purple on every page (the green page’s back dot and depth too); the front stays a yellow dot with red yards. On a par 5’s whole-hole spread, a point every 25 yards off the tee, in the middle of the fairway, with its yards to the front']],
  ['1.15.0', ['New courses: The Tribute Golf Club and Old American Golf Club (The Colony) and Sky Creek Ranch Golf Club (Keller), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, bunkers checked against the picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.14.3', ['Yardage book: the front and back of the green are now its earliest and furthest points as you come in (shown up the middle); the green page’s grid and depth start at the front, and every yardage to the front uses it. On a par 5’s approach page, a purple dot marks the back of the green, the same colour as the numbers to the back']],
  ['1.14.2', ['Yardage book, par 5s: the whole-hole spread now starts at the fairway (the tees in their box), turned to fill both pages, with the hole number, yards and par in the corner. The approach page fills its page with numbers every 25 yards: red to the front of the green and, in brackets, to the back']],
  ['1.14.1', ['Yardage book, par 5s: like a tour book, two spreads instead of one. First the whole hole drawn across both pages (the green end on top, the tees on the bottom), then the green page over a close-up of the approach (the last 175 yards, drawn bigger). On the screen, in Reader mode and in every print layout']],
  ['1.14.0', ['New courses: The Golf Club at Twin Creeks (Allen), Woodbridge Golf Club (Sachse) and Buffalo Creek Golf Club (Heath), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, bunkers checked against the picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.13.5', ['Yardage book, Satellite style: the hole overview page now has its contours and downhill arrows too (in white over the picture), like the flat book. In Reader mode, Preview and edit and the PDF; the Contours & slope arrows switch turns them off']],
  ['1.13.4', ['Yardage book Reader mode, Flip up: the hole overview comes first, then its green: swipe up from the overview to the green, then up again to the next hole’s overview']],
  ['1.13.3', ['Yardage book Reader mode: Flip up now shows one page at a time, filling the screen: swipe up from the green page to the hole overview, then up again to the next hole’s green (down goes back). The menu arrow at the top is just the arrow now, no button behind it']],
  ['1.13.2', ['Yardage book: new Reader mode (GEN BOOK > Reader mode), the book read like an e-reader: just the pages, filling the screen. Side by side (green page left, hole page right; swipe left for the next hole) or Flip up (green page on top of the hole page; swipe up for the next hole). Tapping the edge of the page turns it too. The little arrow at the top pulls down a menu (close, hole, Flat or Satellite, Side by side or Flip up) and tucks it away again. Preview and edit is back the way it was']],
  ['1.13.1', ['Yardage book Preview and edit opens like the book itself: the green page and the hole page together, filling the screen (one over the other, or side by side on a wide screen). Swipe up to turn to the next hole, down to go back (the mouse wheel or arrow keys on a computer). Zoom in with + to look closer; − back to Fit to swipe again. On a phone the buttons sit in one row at the top (swipe it sideways for the rest)']],
  ['1.13.0', ['New courses: Cottonwood Valley Golf Course (Irving) and The Trails of Frisco Golf Club (Frisco), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, bunkers checked against the picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.12.4', ['Yardage book Edit: move the start, where every “from the tee” number is measured. Tap another tee box (on the map, or its yards in the TEES box) to measure from its front, or drag the yellow start dot anywhere; every number on the hole updates. ↺ Start from the … tee again under the page puts it back. Kept in that yardage book only']],
  ['1.12.3', ['Yardage book: no more dotted line from the tee to the green on the hole page (and the Center line switch is gone); the yellow dot at the front of the green, where every number is measured to, stays']],
  ['1.12.2', ['Yardage book Edit: tap any point (its dot or its numbers), including the book’s yardage markers and bunker numbers, to select it (a yellow ring), then Delete point; or drag a point to move it, and its yards update for where you put it. Tap the map to add a point, or to deselect']],
  ['1.12.1', ['Yardage book: the 50, 100, 150… yardage markers sit in the middle of the fairway (not on the hole line, which can run along its side). Yards to the front of the green are measured to the front as you come into the green on the approach (the yellow dot), not the side of the green facing the tee; on a dogleg that changes the tee’s yards to the front and some bunker numbers by the green']],
  ['1.12.0', ['New course: Prairie Lakes Golf Course (Grand Prairie), all three nines (Red, White and Blue): play any nine, or any two as 18. Traced from the satellite picture (greens, fairways, ponds, bunkers, trees), routed from the club\u2019s course map, with out-of-bounds line and elevation (contours and plays-like yardages). Each hole has one tee box (the back one); the shorter tees use the card yardages']],
  ['1.11.4', ['Yardage book: Add point is now Edit. In Edit, tap the hole page to add a point, or tap any point to delete it, including the book’s own (yardage markers, bunker and green numbers). Deleted book points stay gone in that yardage book; Bring back under the page restores them. Tap Done to finish']],
  ['1.11.3', ['Yardage book: written in your device’s own system font, and every outline (greens, fairways, bunkers, water, trees) and contour is drawn as a smooth, rounded curve instead of short straight pieces. The PDF is printed at 300 dpi (was 200), so lines stay sharp on paper']],
  ['1.11.2', ['Yardage book: each hole page is turned so your tee shot goes straight up the page, as you see it from the tee (to the landing zone, the hole line’s first bend), not tee-to-green; on a dogleg the rest of the hole bends off to the side. The TEES box moves to the top right (and the north arrow to the top left) when the green or fairway would be under it']],
  ['1.11.1', ['Cowboys #14–18: the fairway now runs under the green with a collar round it (no more cut-out for the green), like #10–13; bunkers stay cut out']],
  ['1.11.0', ['New courses: Stevens Park Golf Course (Dallas), Tierra Verde Golf Club (Arlington) and Riverside Golf Club (Grand Prairie), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, bunkers checked against the sand in the picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)', 'Riverside: #13 and #18 share one big double green, so each hole measures to its own end of it']],
  ['1.10.4', ['Cowboys: trees added along every hole (935 round trees on the tree canopy in the satellite picture, none in OB or on greens, fairways, tees, bunkers or water); everything else, including your published edits, is unchanged']],
  ['1.10.3', ['Hole editor: Save and Save & finish no longer get stuck on Saving…. The phone’s storage had filled up with copies of every course’s edits; Save & finish now publishes first and keeps no copy of its own, copies already published are cleared when the app opens, and if saving fails it says why and leaves your changes on screen to try again (publishing gives up after 30 s)']],
  ['1.10.2', ['Cowboys: greens redrawn on the putting surface only (the brighter fringe round them is now fairway) on 16 holes, and the fairway round every green follows the mown grass: #1 has the fairway left of the green, #2 the fringe round it, #12 the approach no longer part of the green']],
  ['1.10.1', ['Cowboys: the fairway round every green follows the dark, mown grass in the satellite picture (a clean ring round the green and the approach into it, no more peninsulas out into the rough), and the greens on #2, #4, #5, #6, #8, #10, #11 and #18 are redrawn on the putting surface']],
  ['1.10.0', ['Yardage book: a new Booklet layout, now the default, made like a tour book. Print two-sided (flip on short edge), cut once down the middle, lay the strips flat in a stack (strip 1 on top, numbered at the foot), staple across the middle on the STAPLE · FOLD line and fold the top half back on the staples. Every spread is the hole’s green above the staples and the hole below; 18 holes is 10 strips on 5 sheets. The cards are now called Cards · double-sided and the old fold layout Fold each strip; the setup page says how to put together whichever is picked']],
  ['1.9.6', ['Printed yardage book: the double-sided layouts have a dashed line marked CUT round every card (cut on it all round and no white margin is left on the cards), and the fold layouts have CUT down the middle and a FOLD line right across each strip']],
  ['1.9.5', ['Saved yardage books: each book has an Edit button (beside Rename and Delete) to open it, instead of tapping its name']],
  ['1.9.4', ['Yardage book: on par 3s the greenside bunkers have their numbers (yards from the tee to reach and to carry them, with up/down), like the front and back of the green', 'Yardage book: the line from a spot to its numbers no longer runs through a bunker when there’s another place for them']],
  ['1.9.3', ['Yardage book: on par 3s the front and back of the green look like the other numbers: a dot, a straight line out, the yards from the front of the tee in black and the blue up/down under it (no yards-to-the-front number, no F / B)']],
  ['1.9.2', ['Preview and edit: the points on the hole are listed under the buttons with their yards; tap one to delete it (or Delete all). − and + zoom the pages in and out (up to 4×; scroll round them)', 'Yardage book: par 3s always show the yards from the front of the tee to the front (F) and back (B) of the green']],
  ['1.9.1', ['Edit yardage markers lists the markers in use on par 3s, 4s and 5s separately (to start: none on par 3s, 50 to 200 on par 4s, 50 to 300 on par 5s). Tap one to take it off, type a number to add it to that par, or Reset a par to the default. Markers closer than 40 yards to the tee are left off']],
  ['1.9.0', ['GPS Overview is now GPS Overview / Yardage Books. GEN BOOK is GENERATE YARDAGE BOOK, and under it SAVED YARDAGE BOOKS lists the books you’ve saved: open one to edit it and print it again, rename or delete it', 'Yardage book: Preview and edit has Add point. Tap the hole page to put a point on it with its yards and up/down from the tee and to the front of the green (tap it again to take it off); Save keeps it in that yardage book only', 'Yardage book: Center numbers are now Yardage markers, with Edit yardage markers to type in your own distances to the front (25, 48, whatever you like) or go back to the default', 'Yardage book setup: the switches sit two to a row']],
  ['1.8.11', ['Yardage book: the tees box no longer has an empty white strip down its right side; the picture of the tees runs to the edge']],
  ['1.8.10', ['GEN BOOK setup: Satellite is a switch at the top of the hole page’s list, above Fairways (off is the flat book). Bunker & water numbers and the up/down yards by each number are always on, so their switches are gone']],
  ['1.8.9', ['GEN BOOK setup page looks like GPS Overview: Flat / Satellite and Zoomed view / Entire hole as tiles like Casual / Tournament, the tee box and format as the same dropdowns, on/off switches for what to show on the hole and green pages, then MAKE PDF or Preview']],
  ['1.8.8', ['GEN BOOK setup page: in the app’s dark colours, with Show split into Hole overview page and Green overview page. Hole overview page starts with Zoomed view (from the fairway, tees in a box) or Entire hole, in place of Tees in a box. The Green page and Only this hole switches are gone (both always on), and Center line / Center numbers / Neighboring holes are spelled the US way']],
  ['1.8.7', ['GEN BOOK opens a page to set the book up first: Style (Flat or Satellite), the tee box, the Format (Double-sided · letter to start, then Double-sided · legal, then the others) and what to show. Then Preview to look through it, or Make PDF for the whole book. Your picks are kept on this device']],
  ['1.8.6', ['GEN BOOK: in the Satellite style the green pages are on the satellite picture too: the green, bunkers and water outlined, with the yard grid, the yards from the front, and white contours and downhill arrows on top']],
  ['1.8.5', ['GEN BOOK: a Style choice beside the tee box. Satellite draws each hole page like Satellite book view, the satellite picture with the book’s outlines and numbers on it, on screen and in the printed PDF; the green pages stay as they are. Book is the plain book. Your pick is kept on this device']],
  ['1.8.4', ['GPS Overview: Satellite book view (was Yardage book + satellite) is the satellite picture with the yardage book’s outlines and numbers drawn on it, like Course lines view with all the book’s yardages: greens, tee boxes, fairways, bunkers and water outlined, not filled in, and no contours']],
  ['1.8.3', ['GPS Overview: Yardage book + satellite in the View box: the book drawn over the satellite picture, half and half', 'Yardage book: no 50 · 100 · 150 numbers down the middle of par 3s', 'Yardage book: water across the line of play has carry numbers: where the dotted line to the front of the green goes into the water and comes out, and where lines 20 yards either side of it come out']],
  ['1.8.2', ['GPS Overview: Yardage book view is now a map drawn like the book. Pinch to zoom, drag and turn it like the satellite map; the whole hole is there, tees and all. Tap the green for the green page (tap again to close). ‹ › still go round the holes', 'Yardage book: water numbers go from the nearest point of the water to the tee (to reach it) to the farthest (to carry it all)']],
  ['1.8.1', ['Yardage book: a 50 to the front of the green down the middle of every hole, with the 100, 150 and 200', 'Yardage book: water is marked like bunkers on more holes. A pond up to 80 yards off the line of play now gets its start and end numbers (Bridlewood #1’s lake right of the green: 82 and 53), and water that starts beside the tee still gets the number to carry it']],
  ['1.8.0', ['GPS Overview: Yardage book view in the View box. Switch it on and the hole turns into its yardage book pages (the green page over the hole page, from your tee box), with no tools or crosshair; ‹ › on the hole pill still go round the holes, and it stays on until you switch it off']],
  ['1.7.2', ['Yardage book: tee boxes are grey instead of green, and the one you’re playing from is dark with a heavy outline so it stands out']],
  ['1.7.1', ['Yardage book: the tees box is small and top left. It shows just the tee markers as they’re drawn on the map (with a little ground in front), a yellow dot on the front of each and lines out to a ruler, so the gaps are measured front to front. Beside the ruler, each tee’s yards to the front and how far it is from yours: red + for further back (add it to the black numbers from that tee), green − for further forward']],
  ['1.7.0', ['New course: Cedar Crest Golf Course (Dallas), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, bunkers checked against the sand in the picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.6.14', ['Yardage book: on par 4s and 5s the hole page starts just short of the fairway, so the hole is drawn bigger, and the tee boxes go in a small box at the top left with each one’s tees and yards to the front, like a tour book (Show › Tees in a box turns it off). Par 3s still show the whole hole']],
  ['1.6.13', ['Yardage book printing starts on Fold · letter (cut once): two strips per sheet, cut once down the middle, fold each in half and staple along the folds. Each strip sits in the middle of its half with even margins, and its pages fill it (3¾ in wide; 5¼ in tall on letter, 6¾ on legal, folding to 4¼ × 7)', 'Yardage book: Double-sided · letter puts four cards on a sheet again (two big ones is its own option)', 'Yardage book: the dotted line down the hole stops at the front of the green, where the numbers are measured to, with a yellow dot']],
  ['1.6.12', ['Yardage book: printing starts on Double-sided · letter (8½ × 11, two cards per sheet, about 4 × 6.6 in each), the paper most printers and print shops use. Legal and the fold layouts are still in the menu']],
  ['1.6.11', ['Yardage book: printing no longer cuts off the top of the pages. Every layout keeps a quarter-inch margin round the sheet (printers and print shops can’t print to the edge), the cards shrink a little to fit (about 4 × 6.6 in on legal), and the dashed cut lines go round every card']],
  ['1.6.10', ['Yardage book: a double-sided print layout, now the default. Four 4¼ × 7 cards per legal sheet (two per letter sheet), each hole page on the front and the next hole’s green on the back. Print at 100%, two-sided, flip on short edge; cut along the dashed lines, stack the cards by their numbers (1, the cover, on top) and staple along the top. 18 holes take 5 legal sheets. The fold layouts are still there']],
  ['1.6.9', ['Every course: greens, tee boxes, fairways, bunkers and water have soft, rounded outlines instead of jagged corners and kinks (Bridlewood’s tee boxes and greens most of all), so they look smooth on the map and in the yardage book. No outline moved more than about a yard and a half; trees, OB and course boundaries are unchanged']],
  ['1.6.8', ['Yardage book: the hole is drawn across about 90% of the page’s width, the key text at the foot of the hole and green pages is gone (the maps are bigger; the cover still explains the colours), and each strip of the printed flip book has a number at its foot so you know the order to stack them in (1, the cover, on top)']],
  ['1.6.7', ['Yardage book: Print now makes a PDF on your phone, then Share / Print or Open PDF. Pick the layout beside the print buttons: Flip book · legal (two strips per 8½ × 14 sheet: cut down the middle, fold each strip in half with the printing outside, stack them with the folds at the top, and each hole’s green sits above its hole page, like a tour book), Flip book · letter (the same at 79%), or Single pages (4¼ × 7). Print at 100%']],
  ['1.6.6', ['Yardage book: the plays-like line (PLAYS +N · N FT UPHILL) is gone from the top of each hole page, and from Show']],
  ['1.6.5', ['Yardage book: only the hole is drawn, like the live view’s spotlight. Contours, arrows, trees and other holes stop about 46 yards either side of the line of play and fade out, which saves ink (Show › Only this hole turns it off)', 'Yardage book: the downhill arrows are steadier. Each one is checked against the slope over a short and a longer distance, and left out where they disagree, so none point against the way the ground falls']],
  ['1.6.4', ['Yardage book: the green page looks like a tour book’s. It zooms in on the green as far as the USGA allows (3/8 inch to 5 yards when printed at 100%), with a 5-yard grid over the whole map, yards from the front down the left edge of the green, a blue line up the middle through the front and back marks, small downhill arrows on the green, contour lines around it, and plain bunkers and water with nothing drawn over them']],
  ['1.6.3', ['Bridlewood: every set of tees is tied to its own tee box on each hole (Black, Blue, White and Red no longer land on one box on #1 and #10), on the GPS screen and in the yardage book', 'Yardage book: every number is measured from the front of the tee box, not its middle', 'Yardage book: the Hole and Book print buttons work on phones. They open the pages in a new tab and print from there; use Share › Print or Save to Files if the print sheet doesn’t come up. Pages are 4¼ × 7 in']],
  ['1.6.2', ['GPS Overview: GEN BOOK no longer sticks on a blank screen on iPhone. The slope arrows used a calculation Safari can’t do on that many points; if a hole’s heights still won’t load it now draws the hole without contours instead of showing nothing']],
  ['1.6.1', ['GPS Overview: the yardage book has moved to a GEN BOOK button under START. Pick the course and tee box, tap GEN BOOK, and the book opens on hole 1 (‹ › go round the holes; Print does this hole or the whole course). It’s no longer in the View box']],
  ['1.6.0', ['GPS Overview: Yardage book (in the View box), laid out like a tour book flipped open: the green page on top and the whole hole below the fold, tee at the bottom. Numbers come in pairs, like a tour book: a dot on the spot, the yards to the front of the green above (red) and the yards from the tee below (black), off to the side on a short straight line, with small blue numbers for how many yards the ground goes up (+) or down (−): above the red one from the spot to the front of the green, below the black one from the tee to the spot. There’s a pair at the start and end of every bunker (not greenside ones) and water hazard, and down the middle at 100, 150 and 200 to the front (and 250 and 300 on par 5s). Contour lines and a field of small downhill arrows cover the hole, with plays-like height change in the header. The green page takes in the fairway leading up to the green, with a 3- or 5-yard grid, depth and width, front and back marks, edge numbers from the front, contours every few inches, downhill arrows and lines for notes. Pick the tee box at the top; Show turns each part on or off (kept on this device); Print makes a PDF or paper copy of the hole or the whole course, 4¼ × 7 inches with the green no bigger than 3/8 inch to 5 yards (the USGA limits for green-reading material, Rule 4.3) when printed at 100%. In a Tournament round the green page, contours and plays-like are left out (Rules of Golf 4.3)']],
  ['1.5.1', ['Tournament mode: Contours & slope shows the same contours as a casual round, greens included (no more gap around the greens). Still off at the start of every tournament round']],
  ['1.5.0', ['GPS Overview: under the title it now shows how many courses have been added, in place of “Plan shots on any hole · nothing is saved”']],
  ['1.4.0', ['Tournament mode: Contours is back in the View box as its own switch, off at the start of every tournament round. On, it shows the contour lines and downhill arrows everywhere except on and within 15 yards of any green (the Rules only allow green maps at a tiny scale). Plays-like yardages stay off']],
  ['1.3.1', ['Tournament mode: the Tools button (Width, Arc, Disp, Appr) is gone completely']],
  ['1.3.0', ['New courses: Fields Ranch – East and West (PGA Frisco), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines for both courses from OpenStreetMap lined up on the satellite picture, trees from the picture as circles, out-of-bounds line from the course boundaries, and elevation (contours and plays-like yardages)']],
  ['1.2.0', ['New course: Iron Horse Golf Course (North Richland Hills), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, bunkers checked against the sand in the picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['1.1.0', ['New courses: Indian Creek Golf Club – Creek and Lakes (Carrollton), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap, scorecards with Black/Blue/White/Red ratings and yardages, out-of-bounds line from the course boundary, trees from the satellite picture as circles, and elevation (contours and plays-like yardages)']],
  ['1.0.0', ['Version 1.0']],
  ['0.102.0', ['New course: Texas Star Golf Course (Euless), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap lined up on the satellite picture, bunkers checked against the sand in the picture, trees from the picture as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['0.101.0', ['New course: Firewheel Golf Park – Lakes (Garland), built from its yardage book: greens, fairways, bunkers, water, tee boxes and hole lines lined up on the satellite picture, bunkers checked against the sand in the picture, trees as circles, out-of-bounds line from the park boundary, and elevation (contours and plays-like yardages)']],
  ['0.100.0', ['New course: Coyote Ridge Golf Club (Carrollton), built from its yardage book: greens, fairways, bunkers, water, tee boxes and hole lines lined up on the satellite picture, every bunker checked against the sand in the picture, trees as circles, out-of-bounds line from the course boundary, and elevation (contours and plays-like yardages)']],
  ['0.99.0', ['New course: Lake Park Golf Course – Executive (Lewisville), the 9-hole par-28 course, built without a yardage book: greens, fairways, water, tee boxes and hole lines from OpenStreetMap, Blue/White/Red yardages from the scorecard (no rating or slope is published), out-of-bounds line from the course boundary, trees from the satellite picture as circles, and elevation (contours and plays-like yardages)']],
  ['0.98.0', ['New course: Lake Park Golf Course – Championship (Lewisville), built without a yardage book: greens, fairways, bunkers, water, tee boxes and hole lines from OpenStreetMap, out-of-bounds line from the course boundary, trees from the satellite picture as circles, and elevation (contours and plays-like yardages)']],
  ['0.97.0', ['New course: Lantana Golf Club (Lantana), built without a yardage book: greens, fairways, bunkers, water and tee boxes from OpenStreetMap lined up on the satellite picture, hole lines worked out from the scorecard, out-of-bounds line from the course boundary, trees from the picture as circles, and elevation (contours and plays-like yardages)']],
  ['0.96.4', ['GPS Overview: the Score box above the hole pill is gone (nothing is scored there)']],
  ['0.96.3', ['New Round: the Entry Mode GPS button above START is gone (it did nothing)']],
  ['0.96.2', ['New Round and GPS Overview start with Casual picked; tap Tournament to change it']],
  ['0.96.1', ['Tournament mode also drops Course lines view (the bunker, fairway, water and green outlines): the switch is gone from the View box and the lines stay off']],
  ['0.96.0', ['Tournament mode: New Round and GPS Overview now ask whether the round is Casual or Tournament. Casual has every tool. Tournament keeps to the Rules of Golf (4.3): plain yardages, compass, fairway width, arc, approach circle, scorecard and shot tracking stay; plays-like yardages, wind, contours and slope, strokes gained (crosshair SG, Disp, Appr SG, SG map, Expected) and club picks (Auto, Comp, the Club box’s Auto) are gone. The tag at the top left turns gold in a tournament round. A finished tournament round viewed from Round History shows everything again']],
  ['0.95.2', ['Contour lines are black for everyone now (same 60% opacity and width). You can still change them in the menu’s Settings']],
  ['0.95.1', ['Contour lines are a little stronger for everyone: 60% opacity (was 45%), same colour and width. You can still change them in the menu’s Settings']],
  ['0.95.0', ['New Settings button in the hole menu (☰): set the contour lines’ colour, opacity and width. It changes on the map as you move the sliders, is kept on this device, and Reset puts the standard look back']],
  ['0.94.3', ['Contour lines (and their downhill arrows) are a slightly darker colour, at the same opacity']],
  ['0.94.2', ['Auto picks the club with the highest SG again: avoiding bunkers, hazards and trees (and preferring the fairway) now only decides each club’s line, never which club. The Auto list no longer shows shots on the fairway']],
  ['0.94.1', ['Auto no longer swings a club towards a bunker to get more shots on the fairway: among options within 0.05 SG of the best it now takes the one with the fewest shots in bunkers, hazards and trees first, and only then the one with more on the fairway']],
  ['0.94.0', ['Auto is rebuilt from scratch. It tries every club in your bag on every line (1° apart) and picks the highest average SG, with three rules: a shot within 5 yd of water or OB counts as in it, and one within 3 yd of a bunker as in the bunker, so the pick keeps that far clear; it never aims at a hazard, bunker, trees or a recovery area while another line is open; and an option within 0.05 SG of the best with more shots on the fairway is taken instead. Trees in the way of the shot are no longer looked at. The Auto list shows each club’s shots on the fairway (out of 20)']],
  ['0.93.0', ['Auto no longer thinks a drive down the middle hits the trees off the tee: a ball is only blocked by trees while it’s still below the treetops (about the first 50 yd of a drive, less for shorter clubs), and only by the solid middle of a tree, not the edge of its circle. On Bridlewood #1 it now picks Driver at the pin']],
  ['0.92.0', ['Auto keeps the shots out of bunkers, trees, water and OB: it now takes a line with no shots landing in a hazard over one with a few, even at a small cost in SG (up to 0.15), and searches finer (half a degree) so it finds the gaps. In the Auto list, a club whose shots have trees close in front says so (trees in the way), which is why it can rank below a club with a lower SG']],
  ['0.91.0', ['Comp just turns on and off now. While it’s on, a ⚙ above it lets you change the compared clubs and pick arcs or dispersion dots (the first time, Comp opens the club picker)', 'Auto stays on from hole to hole: each new hole opens with the best club and line picked and shown, or with Comp on, each compared club on its own best line, and Comp stays on']],
  ['0.90.0', ['Grapevine – Pecan has elevation now: contour lines with downhill arrows and plays-like yardages, on its own or as either nine of an 18 with Bluebonnet or Mockingbird']],
  ['0.89.0', ['New course: Grapevine Golf Course \u2013 Pecan, the last of its three nines, built from its yardage book. Play it as 9, or with Bluebonnet or Mockingbird to make 18']],
  ['0.88.0', ['Nine-hole courses: picking one in New Round or GPS Overview asks whether to play just those 9 or add another nine at the same club to make 18 (e.g. Bluebonnet front 9, Mockingbird back 9). The back nine is holes 10–18, with the tee boxes’ yardages added up, and each hole keeps its own contours and plays-like heights']],
  ['0.87.0', ['Elevation on every course: contour lines with downhill arrows (View box) and plays-like yardages now work at Bear Creek East and West, Bridlewood, Cross Timbers, Grapevine Bluebonnet, Sherrill Park #1 and #2, Squaw Creek, Tangle Ridge, Tour 18 Dallas and Grapevine Mockingbird, as well as Cowboys']],
  ['0.86.0', ['New course: Grapevine Golf Course \u2013 Mockingbird, the second of its three nines, built from its yardage book']],
  ['0.85.3', ['Fixed: the app opened to a blank screen after 0.85.2']],
  ['0.85.2', ['Text you couldn’t read is readable now: dark grey words on the dark background (subtitles, empty messages, small labels and delete buttons in My Bag, Practice, Coaching and Performance Analysis) are a lighter grey', 'Combine buttons (Short Game Combines, Evaluation Test): the name and its description sit on two lines again instead of running together off the screen']],
  ['0.85.1', ['Plays like: the plays-like number lines up right under the yardage. The Wind box is smaller and sits lower, with just the direction and speed sliders (the Into / Helping / From left / From right buttons are gone); tap Live to go back to the live wind']],
  ['0.85.0', ['Wind: tap the wind arrow under the compass to set the wind by hand and try things out: Into, Helping, From left or From right (as the map faces), or slide the direction and speed. Plays like (with Wnd on) uses it straight away. A hand-set wind has a yellow ring and stays until you tap Use live wind']],
  ['0.84.1', ['Plays like: the main yardage always stays centred over the crosshair; the rise or drop beside it is smaller and centred on the line']],
  ['0.84.0', ['Plays like sits left of Expected. Tap it and two round switches show under it: Elv (the height change, on to start) and Wnd (the wind, off to start: into the wind adds 1% a mph, downwind takes off 0.5% a mph). The rise or drop now sits right by the number, e.g. 161(+1) yd, with what it plays under it']],
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

// ---------- help: Strokes Gained explained ----------

export function renderHelp(view) {
  const box = h('div', { style: 'width:100%;max-width:460px;background:#222222;border-radius:14px;overflow:hidden;text-align:left;' });
  renderSGExplainer();
  const src = document.getElementById('sgExplainerGraphic');
  if (src) box.innerHTML = src.innerHTML;
  view.replaceChildren(page('top', backBtn(), box));
}

// ---------- search: pages, courses, drills and Learn ----------

// Open a part of Practice and Learning once its page is up (the route draws it a moment later).
function openPractice(tab, then) {
  location.hash = '#/practice';
  let tries = 0;
  const t = setInterval(() => {
    const hub = document.getElementById('practiceHubPage');
    if ((hub && hub.classList.contains('active')) || ++tries > 40) {
      clearInterval(t);
      window.setPracticeHubTab?.(tab);
      if (then) then();
    }
  }, 50);
}

function searchItems() {
  const go = href => () => { location.hash = href; };
  const items = [
    ['GPS Overview / Yardage Books', 'Course maps, yardages and printable books', go('#/scout'), 'gps map yardage book course'],
    ['New Round', 'Start a round', go('#/new'), 'play start score'],
    ['Round History', 'Your past rounds', go('#/history'), 'rounds scores past'],
    ['Stats Dashboard', 'Strokes gained and stats', go('#/dashboard'), 'stats sg'],
    ['Performance Analysis', 'Rounds and combines over time', go('#/performance'), 'analysis trends'],
    ['My Bag', 'Clubs, distances and gapping', go('#/bag'), 'clubs distances gapping wedges speed'],
    ['Practice and Learning', 'Combines, drills, practice and learn', go('#/practice'), 'practice'],
    ['Coaching', 'Notes, messages and assignments', go('#/coaching'), 'coach lessons students'],
    ['Settings', 'Account and app settings', go('#/settings'), 'account profile'],
    ['Offline imagery & backup', 'Save maps for no signal, back up rounds', go('#/device'), 'offline backup restore download'],
    ['What’s New', `Version ${VERSION}`, go('#/whatsnew'), 'changes updates version'],
    ['Strokes Gained Explained', 'How strokes gained works', go('#/help'), 'sg help explained'],
  ].map(([title, sub, open, tags]) => ({ kind: 'Page', title, sub, open, tags }));
  const combines = [['Evaluation Test', 'goToEvalCombine'], ['Putting Combine', 'goToPuttingCombine'], ['Short Game Combine', 'goToCombines'],
    ['Wedge Distances Combine', 'goToWedgeCombine'], ['Line Drill Combine', 'goToLineDrill'], ['Driver Combine', 'goToDriverCombinePicker']];
  combines.forEach(([title, fn]) => items.push({ kind: 'Combine', title, sub: 'Practice and Learning › Combines', tags: 'combine test', open: () => openPractice('combines', () => window[fn]?.()) }));
  const learn = [['Learning Library', 'Articles, tips & guides', 'openLearningLibrary'],
    ['Putting Break Calculator', 'Putt break & aim point', 'toggleLearnPBV'], ['Distance Optimizer', 'Optimize distances for your game', 'toggleLearnDistanceOptimizer'],
    ['Proximity Calculator', 'How close to gain strokes', 'toggleLearnProximityCalc'], ['How Far Should I Hit It?', 'Tour averages & distance by speed or handicap', 'toggleDistanceGuide'],
    ['Guide to Golf', 'How to hit every shot', null]];
  learn.forEach(([title, sub, fn]) => items.push({ kind: 'Learn', title, sub, tags: 'learn', open: () => openPractice('learn', () => (fn ? window[fn]?.() : window.show?.('guideToGolfPage'))) }));
  libraryVideos.forEach(v => items.push({ kind: 'Video', title: v.title, sub: v.description, tags: (v.tags || []).join(' '), open: () => window.open(v.url, '_blank', 'noopener') }));
  const catName = { putting: 'Putting', shortgame: 'Short Game', fullswing: 'Full Swing' };
  Object.keys(drillsData).forEach(cat => (drillsData[cat] || []).forEach(d => items.push({
    kind: 'Drill', title: d.title, sub: `${catName[cat] || cat} drill` + ((d.subcategories || []).length ? ' · ' + d.subcategories.slice(0, 2).join(' · ') : ''),
    tags: [cat, catName[cat], ...(d.subcategories || [])].join(' '),
    open: () => openPractice('drills', () => { window.setDrillCategory?.(cat); window.showDrillDetail?.(d.id, cat); }) })));
  COURSES.forEach(c => items.push({ kind: 'Course', title: c.name, sub: 'Open in GPS Overview', tags: 'course',
    open: () => { sessionStorage.setItem('gs:pickCourse', c.id); location.hash = '#/scout'; } }));
  return items;
}

export function renderSearch(view) {
  const all = searchItems();
  const list = h('div', { style: 'width:100%;max-width:460px;display:flex;flex-direction:column;gap:6px;text-align:left;' });
  const input = h('input', { type: 'search', placeholder: 'Search courses, drills, pages…', 'aria-label': 'Search', autocomplete: 'off',
    style: 'max-width:460px;text-align:left;padding:0 14px;', oninput: () => draw() });
  const row = it => h('button', { style: 'max-width:none;height:auto;min-height:52px;padding:10px 14px;background:#282828;border-radius:10px;display:flex;align-items:center;gap:10px;text-align:left;white-space:normal;', onclick: it.open },
    h('div', { style: 'flex:1;min-width:0;' },
      h('div', { style: 'font-size:15px;font-weight:700;color:#ffffff;line-height:1.25;' }, it.title),
      it.sub ? h('div', { style: 'font-size:11px;font-weight:400;color:#9a9a9a;margin-top:2px;line-height:1.3;' }, it.sub) : null),
    h('span', { style: 'flex:none;font-size:10px;font-weight:700;color:#606060;text-transform:uppercase;letter-spacing:.06em;' }, it.kind));
  function draw() {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) { list.replaceChildren(...all.filter(i => i.kind === 'Page').map(row)); return; }
    const hay = i => `${i.title} ${i.sub || ''} ${i.tags || ''} ${i.kind}`.toLowerCase();
    const hits = all.filter(i => words.every(w => hay(i).includes(w)))
      .sort((a, b) => (b.title.toLowerCase().startsWith(words[0]) - a.title.toLowerCase().startsWith(words[0])) || (b.title.toLowerCase().includes(words.join(' ')) - a.title.toLowerCase().includes(words.join(' '))));
    list.replaceChildren(...(hits.length ? hits.slice(0, 60).map(row)
      : [h('div', { style: 'padding:20px;color:#606060;font-size:14px;text-align:center;background:#282828;border-radius:10px;' }, 'Nothing found')]));
  }
  draw();
  view.replaceChildren(page('top', backBtn(),
    h('div', { style: 'font-size:22px;font-weight:800;' }, 'Search'), input, list));
  setTimeout(() => input.focus(), 50);
}

// Swiping across a screen, like the phone's own swipe from the left edge:
// the screen follows the finger and slides away, with the screen before it
// showing underneath (a copy kept when it was left). Swipe right to go back a
// screen (on screens with tabs along the top, to the tab before first, and
// out of a step of a tab, like a Practice plan, before that); swipe left for
// the next tab. Every screen but the GPS map, and never from the very left
// edge, which is left to the phone's own back gesture.

const TAB_BARS = [
  '#phTabCombines, #phTabPlan, #phTabDrills, #phTabLearn',
  '#bagTabMyBag, #bagTabFindYardages, #bagTabWedgeGap, #bagTabSpeed',
  '#cstTab0, #cstTab1, #cstTab2, #cstTab3, #cstTab4',
  '#svTabDash, #svTabPerf, #svTabRounds, #svTabPractice, #svTabNotes, #svTabMisc',
  '#perfTabBtnRounds, #perfTabBtnCombines',
  '#dgTab_pga, #dgTab_lpga, #dgTab_handicap, #dgTab_speed, #dgTab_profile',
];
const EDGE = 28;    // px from the left edge kept for the phone's own back swipe
const LOCK = 12;    // px before deciding sideways or up-and-down
const DONE = 0.28;  // share of the screen's width that completes a swipe

const shown = el => el.offsetParent !== null || (getComputedStyle(el).position === 'fixed' && getComputedStyle(el).display !== 'none');
// The picked tab: the solid blue of a selected glass button, or a tab's own "active" class.
const isOn = b => /active|selected|\bon\b/.test(b.className) || getComputedStyle(b).backgroundColor === 'rgb(61, 139, 242)';

// Things a sideways drag belongs to: sliders, maps, drawings, fields, and anything that scrolls sideways.
function ownsSideways(el, stop) {
  for (; el && el !== stop; el = el.parentElement) {
    if (el.matches('input, select, textarea, canvas, .maplibregl-map, .leaflet-container, .holeview, [data-noswipe]')) return true;
    const ox = getComputedStyle(el).overflowX;
    if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 2) return true;
  }
  return false;
}

// The screen under the finger: a coaching page, the distance guide, or one of this app's pages.
const screenOf = el => el.closest?.('#coachroot .page.active, #distanceGuidePage') || el.closest?.('#view > .cx');
const activeScreen = () => [...document.querySelectorAll('#distanceGuidePage, #coachroot:not([hidden]) .page.active, #view:not([hidden]) > .cx')].filter(shown).pop();

// What a swipe each way would do here, or null: { fn, same } where same means it
// stays on this screen (a tab, or a step inside it) rather than going to another.
function actions(box) {
  const tabs = TAB_BARS.map(sel => [...box.querySelectorAll(sel)].filter(shown)).find(list => list.length > 1) || [];
  const i = tabs.findIndex(isOn);
  const step = [...box.querySelectorAll('.stepback')].some(b => b.parentElement.offsetParent);
  const back = [...box.querySelectorAll('.back-btn-top')].find(shown);
  return {
    region: tabs.length ? below(tabs[0].parentElement, box) : null,
    left: i >= 0 && i < tabs.length - 1 ? { fn: () => tabs[i + 1].click(), same: true } : null,
    right: step ? { fn: () => window.appBack?.(), same: true }
      : i > 0 ? { fn: () => tabs[i - 1].click(), same: true }
      : back ? { fn: () => back.click(), same: false } : null,
  };
}

// What sits under a row of tabs: the next things after it on the screen (going up
// from the row until there are some), less anything pinned in place like Back.
// Swiping between tabs moves only these, as tapping a tab changes only these.
function below(bar, box) {
  for (let el = bar; el && el !== box; el = el.parentElement) {
    const after = [];
    for (let n = el.nextElementSibling; n; n = n.nextElementSibling) if (shown(n) && getComputedStyle(n).position !== 'fixed') after.push(n);
    if (after.length) return after;
  }
  return null;
}

// Moving a screen: transform only, on its own layer; the glass blur is paused while
// anything moves (redrawing it every frame is what made it stutter).
function place(el, x, ms, opacity = 1) {
  if (Array.isArray(el)) { el.forEach(e => place(e, x, ms, opacity)); return; }
  el.style.willChange = 'transform';
  el.style.transition = ms ? `transform ${ms}ms cubic-bezier(.2,.8,.3,1), opacity ${ms}ms ease-out` : 'none';
  el.style.transform = `translate3d(${x}px,0,0)`;
  el.style.opacity = opacity === 1 ? '' : String(opacity);
}
const clear = el => { if (Array.isArray(el)) { el.forEach(clear); return; } el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; el.style.willChange = ''; };
let moving = 0;
const startMoving = () => { moving++; document.body.classList.add('swiping'); };
const stopMoving = () => { if (--moving <= 0) { moving = 0; document.body.classList.remove('swiping'); } };
// Bring a screen in from the side it was left on.
function arrive(el, from, w) {
  place(el, from * w * 0.3, 0, 0.5);
  (Array.isArray(el) ? el[0] : el)?.getBoundingClientRect();
  place(el, 0, 220);
  setTimeout(() => { clear(el); stopMoving(); }, 240);
}

// ---- The screens before this one ----
// Each time a screen is left for another, a copy of it is kept (with how far it
// was scrolled), so swiping back can show it underneath. Going back to a screen
// drops its copy.
const trail = []; // [{ key, node, scrolls, top }]
let cur = null;   // { key, el }
const keyOf = el => (el.closest('#coachroot') ? 'c:' + el.id : 'v:' + location.hash);
const scrolled = new Map(); // element -> scrollTop, for the screen on now
document.addEventListener('scroll', e => { const t = e.target === document ? document.scrollingElement : e.target; if (t && t.scrollTop != null) scrolled.set(t, t.scrollTop); }, { capture: true, passive: true });

function copyOf(el) {
  const all = [...el.querySelectorAll('*')];
  const scrolls = [], view = document.getElementById('view');
  let top = 0;
  scrolled.forEach((v, node) => {
    if (!v) return;
    if (node === el) scrolls.push([-1, v]);
    else if (node === view && view.contains(el)) top = v;
    else { const i = all.indexOf(node); if (i >= 0) scrolls.push([i, v]); }
  });
  const node = el.cloneNode(true);
  node.classList.add('active');
  node.querySelectorAll('canvas').forEach((c, i) => { // drawings don't copy: keep a picture of each
    const src = el.querySelectorAll('canvas')[i];
    try { const img = new Image(); img.src = src.toDataURL(); img.style.cssText = c.style.cssText; img.width = src.width; img.height = src.height; img.className = c.className; c.replaceWith(img); } catch { /* blank is fine */ }
  });
  return { node, scrolls, top, inCoach: !!el.closest('#coachroot') };
}

function noticeScreen() {
  const el = activeScreen();
  if (!el || el.id === 'distanceGuidePage') return;
  const key = keyOf(el);
  if (cur && cur.el === el) return; // the same screen (its address may move before the next one is drawn)
  if (cur && cur.key !== key) {
    const top = trail[trail.length - 1];
    if (top && top.key === key) trail.pop(); // came back to it
    else { try { trail.push({ key: cur.key, ...copyOf(cur.el) }); } catch { /* no copy */ } if (trail.length > 12) trail.shift(); }
  }
  cur = { key, el };
  scrolled.clear();
}
let noticing = false;
const soon = () => { if (!noticing) { noticing = true; queueMicrotask(() => { noticing = false; noticeScreen(); }); } };
function watch() {
  const view = document.getElementById('view'), root = document.getElementById('coachroot');
  if (!view || !root) { setTimeout(watch, 200); return; }
  // A page taken out of #view stays whole once removed, and a coaching page stays in
  // the document, so the copy can be made just after the change.
  new MutationObserver(soon).observe(view, { childList: true, attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(soon).observe(root, { attributes: true, subtree: true, attributeFilter: ['class', 'hidden'] });
  window.addEventListener('hashchange', soon);
  noticeScreen();
}
watch();

// The copy of the screen before, laid under the one being swiped.
function lay(entry) {
  const under = document.createElement('div');
  under.id = 'swipeUnder';
  under.setAttribute('aria-hidden', 'true');
  const host = document.createElement('div');
  host.className = entry.inCoach ? 'cx coachroot' : '';
  host.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
  const inner = document.createElement('div');
  inner.style.cssText = `position:absolute;left:0;right:0;top:${-entry.top}px;height:100%;`;
  if (!entry.inCoach) inner.id = 'swipeUnderView';
  const node = entry.node.cloneNode(true);
  inner.append(node); host.append(inner); under.append(host);
  const shade = document.createElement('div');
  shade.style.cssText = 'position:absolute;inset:0;background:#000;opacity:.35;pointer-events:none;';
  under.append(shade);
  document.body.append(under);
  const all = [...node.querySelectorAll('*')];
  entry.scrolls.forEach(([i, v]) => { const n = i < 0 ? node : all[i]; if (n) n.scrollTop = v; });
  return { under, host, shade };
}

let g = null; // the gesture going on
let frame = 0;
const BG = 'linear-gradient(180deg, #2c2c2e 0%, #232325 45%, #1a1a1c 100%)';

// Lift the screen being swiped over the copy of the one before: solid behind it,
// a soft shadow down its left edge.
function lift(box) {
  const view = document.getElementById('view');
  const st = view && view.contains(box) ? view.scrollTop : 0;
  box.style.setProperty('background', `${BG} 0 ${st}px / 100% ${window.innerHeight}px no-repeat, #1a1a1c`, 'important');
  box.style.boxShadow = '-14px 0 32px rgba(0,0,0,.45)';
  box.style.zIndex = '1';
}
const unlift = box => { box.style.removeProperty('background'); box.style.boxShadow = ''; box.style.zIndex = ''; };
function placeUnder(u, dx, w, ms) {
  const k = Math.max(0, Math.min(1, dx / w));
  const tr = ms ? `transform ${ms}ms cubic-bezier(.2,.8,.3,1), opacity ${ms}ms ease-out` : 'none';
  u.host.style.transition = tr; u.shade.style.transition = tr;
  u.host.style.transform = `translate3d(${(-0.3 + 0.3 * k) * w}px,0,0)`;
  u.shade.style.opacity = String(0.35 * (1 - k));
}
function drop(g) { if (g.under) { g.under.under.remove(); g.under = null; } unlift(g.box); }

document.addEventListener('touchstart', e => {
  g = null;
  const stale = document.getElementById('swipeUnder');
  if (stale) { if (moving) return; stale.remove(); } // left over: never let it block swiping
  if (e.touches.length !== 1 || document.body.classList.contains('playing')) return;
  const t = e.touches[0];
  if (t.clientX < EDGE) return;
  const box = screenOf(e.target);
  if (!box || ownsSideways(e.target, box)) return;
  // A full-screen tool open over the page (Learn's calculators) isn't this page.
  const over = e.target.closest('[style*="position:fixed"], [style*="position: fixed"]');
  if (over && over !== box && !box.contains(over)) return;
  g = { x: t.clientX, y: t.clientY, box, dir: null, dx: 0, trail: [], w: box.clientWidth || window.innerWidth };
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!g) return;
  const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
  if (!g.dir) {
    if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) { g = null; return; } // scrolling up or down
    g.dir = 'side';
    g.acts = actions(g.box);
    startMoving();
    // Going back to another screen: show the one before underneath, if there's a copy of it.
    const prev = trail[trail.length - 1];
    if (dx > 0 && g.acts.right && !g.acts.right.same && prev && prev.key !== (cur && cur.key)) {
      try { g.under = lay(prev); lift(g.box); placeUnder(g.under, 0, g.w, 0); } catch { g.under = null; }
    }
  }
  e.preventDefault(); // no page scroll while the screen is being dragged
  const can = dx > 0 ? g.acts.right : g.acts.left;
  g.dx = can ? dx : dx * 0.2; // nowhere to go that way: it only gives a little
  const now = performance.now();
  g.trail.push([now, dx]); while (g.trail.length > 2 && now - g.trail[0][0] > 100) g.trail.shift();
  if (!frame) frame = requestAnimationFrame(() => {
    frame = 0;
    if (!g || !g.dir) return;
    // Only a swipe back to another screen moves anything; tabs change at once on release.
    const m = g.dx > 0 && g.acts.right && !g.acts.right.same ? g.box : (g.acts.region ? null : g.box);
    if (g.m && g.m !== m) clear(g.m);
    g.m = m;
    if (m) place(m, g.dx, 0);
    if (g.under) placeUnder(g.under, Math.max(0, g.dx), g.w, 0);
  });
}, { passive: false });

function end() {
  if (!g || !g.dir) { g = null; return; }
  const gg = g, { box, dx, acts, trail: tr, w } = gg; g = null;
  if (frame) { cancelAnimationFrame(frame); frame = 0; }
  const act = dx > 0 ? acts.right : acts.left;
  const [t0, x0] = tr[0] || [0, 0], [t1, x1] = tr[tr.length - 1] || [1, 0];
  const v = (x1 - x0) / Math.max(1, t1 - t0); // px per ms
  const flick = Math.abs(v) > 0.4 && Math.sign(v) === Math.sign(dx) && Math.abs(dx) > 30;
  if (act && act.same && (Math.abs(dx) > 50 || flick)) { // a tab or a step: at once, as a tap
    if (gg.m) clear(gg.m);
    drop(gg); act.fn(); stopMoving();
    return;
  }
  if (!act || (Math.abs(dx) < w * DONE && !flick)) {
    place(gg.m || box, 0, 200);
    if (gg.under) placeUnder(gg.under, 0, w, 200);
    setTimeout(() => { clear(gg.m || box); drop(gg); stopMoving(); }, 220);
    return;
  }
  const out = dx > 0 ? 1 : -1;
  const ms = Math.round(Math.max(100, Math.min(220, (w - Math.abs(dx)) / Math.max(Math.abs(v), 1.2))));
  if (gg.under && out > 0) {
    // The screen before is already showing underneath: finish the slide, then swap the
    // real one in where the copy is (no gap, no second animation).
    place(box, w, ms);
    placeUnder(gg.under, w, w, ms);
    setTimeout(() => {
      act.fn();
      const began = performance.now();
      const swap = () => {
        const next = activeScreen();
        if ((!next || next === box) && performance.now() - began < 800) { requestAnimationFrame(swap); return; }
        clear(box); drop(gg); stopMoving();
      };
      requestAnimationFrame(swap);
    }, ms);
    return;
  }
  drop(gg); // (only shown when going back to another screen)
  if (act.same) { // a tab or a step: only what's under the tabs moves, as when a tab is tapped
    const m = acts.region || box;
    if (gg.m && gg.m !== m) clear(gg.m);
    place(m, out * w, ms, 0.5);
    setTimeout(() => { act.fn(); clear(m); arrive(acts.region ? (actions(box).region || m) : m, -out, w); }, ms);
    return;
  }
  place(box, out * w, ms, 0.5);
  // Another screen with no copy to show: start loading it now, while this one slides away.
  const began = performance.now();
  requestAnimationFrame(() => {
    act.fn();
    const come = () => {
      const next = activeScreen();
      if ((!next || next === box) && performance.now() - began < 700) { requestAnimationFrame(come); return; }
      setTimeout(() => clear(box), Math.max(0, ms - (performance.now() - began)));
      if (next && next !== box) arrive(next, -out, w); else stopMoving();
    };
    come();
  });
}
document.addEventListener('touchend', end, { passive: true });
document.addEventListener('touchcancel', () => {
  if (g && g.dir) { const gg = g; place(gg.box, 0, 200); if (gg.under) placeUnder(gg.under, 0, gg.w, 200); setTimeout(() => { clear(gg.box); drop(gg); stopMoving(); }, 220); }
  g = null;
}, { passive: true });

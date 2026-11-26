// Swiping across a screen, like the phone's own swipe from the left edge:
// the screen follows the finger and slides away. Swipe right to go back a
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

const shown = el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
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
    left: i >= 0 && i < tabs.length - 1 ? { fn: () => tabs[i + 1].click(), same: true } : null,
    right: step ? { fn: () => window.appBack?.(), same: true }
      : i > 0 ? { fn: () => tabs[i - 1].click(), same: true }
      : back ? { fn: () => back.click(), same: false } : null,
  };
}

// Moving a screen: transform only, on its own layer; the glass blur is paused while
// anything moves (redrawing it every frame is what made it stutter).
function place(el, x, ms, opacity = 1) {
  el.style.willChange = 'transform';
  el.style.transition = ms ? `transform ${ms}ms cubic-bezier(.2,.8,.3,1), opacity ${ms}ms ease-out` : 'none';
  el.style.transform = `translate3d(${x}px,0,0)`;
  el.style.opacity = opacity === 1 ? '' : String(opacity);
}
const clear = el => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; el.style.willChange = ''; };
let moving = 0;
const startMoving = () => { moving++; document.body.classList.add('swiping'); };
const stopMoving = () => { if (--moving <= 0) { moving = 0; document.body.classList.remove('swiping'); } };
// Bring a screen in from the side it was left on.
function arrive(el, from, w) {
  place(el, from * w * 0.3, 0, 0.5);
  el.getBoundingClientRect();
  place(el, 0, 220);
  setTimeout(() => { clear(el); stopMoving(); }, 240);
}

let g = null; // the gesture going on
let frame = 0;

document.addEventListener('touchstart', e => {
  g = null;
  if (e.touches.length !== 1 || document.body.classList.contains('playing')) return;
  const t = e.touches[0];
  if (t.clientX < EDGE) return;
  const box = screenOf(e.target);
  if (!box || ownsSideways(e.target, box)) return;
  // A full-screen tool open over the page (Learn's calculators) isn't this page.
  const over = e.target.closest('[style*="position:fixed"], [style*="position: fixed"]');
  if (over && over !== box && !box.contains(over)) return;
  g = { x: t.clientX, y: t.clientY, box, dir: null, dx: 0, trail: [] };
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
  }
  e.preventDefault(); // no page scroll while the screen is being dragged
  const can = dx > 0 ? g.acts.right : g.acts.left;
  g.dx = can ? dx : dx * 0.2; // nowhere to go that way: it only gives a little
  const now = performance.now();
  g.trail.push([now, dx]); while (g.trail.length > 2 && now - g.trail[0][0] > 100) g.trail.shift();
  if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (g && g.dir) place(g.box, g.dx, 0); });
}, { passive: false });

function end() {
  if (!g || !g.dir) { g = null; return; }
  const { box, dx, acts, trail } = g; g = null;
  if (frame) { cancelAnimationFrame(frame); frame = 0; }
  const w = box.clientWidth || window.innerWidth;
  const act = dx > 0 ? acts.right : acts.left;
  const [t0, x0] = trail[0] || [0, 0], [t1, x1] = trail[trail.length - 1] || [1, 0];
  const v = (x1 - x0) / Math.max(1, t1 - t0); // px per ms
  const flick = Math.abs(v) > 0.4 && Math.sign(v) === Math.sign(dx) && Math.abs(dx) > 30;
  if (!act || (Math.abs(dx) < w * DONE && !flick)) {
    place(box, 0, 200); setTimeout(() => { clear(box); stopMoving(); }, 220); return;
  }
  const out = dx > 0 ? 1 : -1;
  const ms = Math.round(Math.max(90, Math.min(180, (w - Math.abs(dx)) / Math.max(Math.abs(v), 1.5))));
  place(box, out * w, ms, 0.5);
  if (act.same) { // a tab or a step: the same screen comes back with the new content
    setTimeout(() => { act.fn(); arrive(box, -out, w); }, ms);
    return;
  }
  // Another screen: start loading it now, while this one is still sliding away.
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
  if (g && g.dir) { const b = g.box; place(b, 0, 200); setTimeout(() => { clear(b); stopMoving(); }, 220); }
  g = null;
}, { passive: true });

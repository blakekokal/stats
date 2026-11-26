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

// What a swipe each way would do here, or null.
function actions(box) {
  const tabs = TAB_BARS.map(sel => [...box.querySelectorAll(sel)].filter(shown)).find(list => list.length > 1) || [];
  const i = tabs.findIndex(isOn);
  const step = [...box.querySelectorAll('.stepback')].some(b => b.parentElement.offsetParent);
  const back = [...box.querySelectorAll('.back-btn-top')].find(shown);
  return {
    left: i >= 0 && i < tabs.length - 1 ? () => tabs[i + 1].click() : null,
    right: !step && i > 0 ? () => tabs[i - 1].click()
      : back ? () => back.click()
      : step ? () => window.appBack?.() : null,
  };
}

function slide(el, x, ms, opacity = 1) {
  el.style.transition = ms ? `transform ${ms}ms ease-out, opacity ${ms}ms ease-out` : 'none';
  el.style.transform = x ? `translateX(${x}px)` : '';
  el.style.opacity = opacity === 1 ? '' : String(opacity);
}
const clear = el => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; };

let g = null; // the gesture going on: { x, y, box, dir, acts, dx }

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
  g = { x: t.clientX, y: t.clientY, box, dir: null, dx: 0 };
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!g) return;
  const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
  if (!g.dir) {
    if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) { g = null; return; } // scrolling up or down
    g.dir = 'side';
    g.acts = actions(g.box);
  }
  e.preventDefault(); // no page scroll while the screen is being dragged
  const can = dx > 0 ? g.acts.right : g.acts.left;
  g.dx = can ? dx : dx * 0.2; // nowhere to go that way: it only gives a little
  slide(g.box, g.dx, 0);
}, { passive: false });

function end() {
  if (!g || !g.dir) { g = null; return; }
  const { box, dx, acts } = g; g = null;
  const w = box.clientWidth || window.innerWidth;
  const act = dx > 0 ? acts.right : acts.left;
  if (!act || Math.abs(dx) < w * DONE) { slide(box, 0, 180); setTimeout(() => clear(box), 200); return; }
  const out = dx > 0 ? 1 : -1;
  slide(box, out * w, 160, 0.4);
  setTimeout(() => {
    const hash = location.hash;
    act();
    // The screen it lands on comes in from the other side: a tab or step at once,
    // another page once it's drawn (this app draws its pages a moment after the move).
    const t0 = Date.now();
    const come = () => {
      const next = activeScreen();
      const moved = location.hash !== hash;
      if (moved && (!next || next === box) && Date.now() - t0 < 600) { requestAnimationFrame(come); return; }
      clear(box);
      if (!next) return;
      slide(next, -out * w * 0.3, 0, 0.4);
      requestAnimationFrame(() => requestAnimationFrame(() => { slide(next, 0, 200); setTimeout(() => clear(next), 220); }));
    };
    come();
  }, 160);
}
document.addEventListener('touchend', end, { passive: true });
document.addEventListener('touchcancel', () => { if (g && g.dir) { slide(g.box, 0, 180); const b = g.box; setTimeout(() => clear(b), 200); } g = null; }, { passive: true });

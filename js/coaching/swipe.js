// Swiping on screens with tabs along the top (Practice and Learning, My Clubs,
// Coaching, a student's page, Performance Analysis, How Far Should I Hit It?):
// swipe left for the next tab, right for the one before. Swiping right on the
// first tab, or inside a step of a tab (a Practice plan, say), goes back a
// screen, the same as the Back button.

const TAB_BARS = [
  '#phTabCombines, #phTabPlan, #phTabDrills, #phTabLearn',
  '#bagTabMyBag, #bagTabFindYardages, #bagTabWedgeGap, #bagTabSpeed',
  '#cstTab0, #cstTab1, #cstTab2, #cstTab3, #cstTab4',
  '#svTabDash, #svTabPerf, #svTabRounds, #svTabPractice, #svTabNotes, #svTabMisc',
  '#perfTabBtnRounds, #perfTabBtnCombines',
  '#dgTab_pga, #dgTab_lpga, #dgTab_handicap, #dgTab_speed, #dgTab_profile',
];
const MIN_DX = 70; // px sideways before it counts as a swipe

const shown = el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
// The picked tab: the solid blue of a selected glass button, or a tab's own "active" class.
const isOn = b => /active|selected|\bon\b/.test(b.className) || getComputedStyle(b).backgroundColor === 'rgb(61, 139, 242)';

// Things a sideways drag belongs to: sliders, maps, drawings, fields, and anything that scrolls sideways.
function ownsSideways(el, stop) {
  for (; el && el !== stop; el = el.parentElement) {
    if (el.matches('input, select, textarea, canvas, .maplibregl-map, .leaflet-container, [data-noswipe]')) return true;
    const ox = getComputedStyle(el).overflowX;
    if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 2) return true;
  }
  return false;
}

let start = null;
document.addEventListener('touchstart', e => {
  start = null;
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  const box = e.target.closest?.('.coachroot .page.active, #distanceGuidePage');
  if (!box || ownsSideways(e.target, box)) return;
  // A full-screen tool open over the page (Learn's calculators) isn't this page.
  const over = e.target.closest('[style*="position:fixed"], [style*="position: fixed"]');
  if (over && over !== box && !box.contains(over)) return;
  start = { x: t.clientX, y: t.clientY, at: Date.now(), box };
}, { passive: true });

document.addEventListener('touchend', e => {
  if (!start) return;
  const s = start; start = null;
  const t = e.changedTouches[0];
  const dx = t.clientX - s.x, dy = t.clientY - s.y;
  if (Math.abs(dx) < MIN_DX || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - s.at > 800) return;
  const tabs = TAB_BARS.map(sel => [...s.box.querySelectorAll(sel)].filter(shown)).find(list => list.length > 1);
  if (!tabs) return;
  const i = tabs.findIndex(isOn);
  if (dx < 0) { if (i >= 0 && i < tabs.length - 1) tabs[i + 1].click(); return; }
  // Right: a step inside the tab first, then the tab before, then back a screen.
  const step = [...s.box.querySelectorAll('.stepback')].some(b => b.parentElement.offsetParent);
  if (!step && i > 0) { tabs[i - 1].click(); return; }
  const back = [...s.box.querySelectorAll('.back-btn-top')].find(shown);
  if (back) back.click(); else window.appBack?.();
}, { passive: true });

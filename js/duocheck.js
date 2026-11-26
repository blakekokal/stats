// #/screen: a check of this phone's screen (its size, the edges the phone keeps
// for itself, and whether a tap in the strip down the right side reaches the
// app), so the layout can use that strip on phones that have one.
import { h, goBack } from './app.js';

export function renderScreenCheck(view) {
  const probe = h('div', { style: 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);' });
  document.body.append(probe);
  const ps = getComputedStyle(probe);
  const inset = [ps.paddingTop, ps.paddingRight, ps.paddingBottom, ps.paddingLeft].map(v => Math.round(parseFloat(v)));
  probe.remove();
  const vv = window.visualViewport;
  const lines = [
    `Window: ${innerWidth} × ${innerHeight}`,
    `Screen: ${screen.width} × ${screen.height} (×${devicePixelRatio})`,
    vv ? `Visible: ${Math.round(vv.width)} × ${Math.round(vv.height)}` : '',
    `Page width: ${document.documentElement.clientWidth}`,
    `Kept edges (top, right, bottom, left): ${inset.join(', ')}`,
    `Home screen app: ${matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'yes' : 'no'}`,
  ].filter(Boolean);
  const out = h('div', { style: 'font-size:13px;color:#9a9a9a;min-height:18px;margin-top:6px;' }, 'Tap the green dots (one is just past the right edge).');
  const hits = new Set();
  const dot = (label, css) => h('button', { class: 'glass-skip', style: `position:fixed;z-index:50;width:44px;height:44px;min-height:0;border-radius:50%;border:0;background:#30D158;color:#000;font-weight:800;font-size:13px;${css}`,
    onclick: () => { hits.add(label); out.textContent = 'Reached: ' + [...hits].join(', '); } }, label);
  const back = h('button', { class: 'back-btn-top', 'aria-label': 'Back', onclick: goBack });
  back.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>';
  view.replaceChildren(h('div', { class: 'cx' }, back,
    h('h2', {}, 'Screen check'),
    h('div', { class: 'card', style: 'text-align:left;font-size:14px;line-height:1.7;' }, lines.map(l => h('div', {}, l))),
    out,
    dot('A', 'right:8px;top:220px;'),
    dot('B', 'right:-70px;top:220px;'),
    dot('C', `left:${innerWidth + 20}px;top:300px;`)));
}

// The app's icon set: simple outline icons built from lines, circles and
// rectangles, one 2px stroke, drawn on a 24 grid and scaled so each fills the
// same area. ic('flag') gives the <svg> markup; it takes the text colour and
// is 1.15em square unless CSS sizes it (.ico).

const P = {
  map: '<g transform="translate(0.00 0.00) scale(1.000)" stroke-width="2.00"><path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></g>',
  flag: '<g transform="translate(1.00 0.00) scale(1.000)" stroke-width="2.00"><path d="M7 21V3"/><path d="M7 4h11l-3 4 3 4H7"/><path d="M4 21h6"/></g>',
  scorecard: '<g transform="translate(0.29 0.54) scale(0.976)" stroke-width="2.05"><rect x="5" y="4" width="14" height="17" rx="1.5"/><path d="M9 2.5h6M8.5 9h7M8.5 13h7M8.5 17h4"/></g>',
  bars: '<g transform="translate(0.00 -0.75) scale(1.000)" stroke-width="2.00"><path d="M3 20.5h18"/><rect x="5" y="11.5" width="4" height="9"/><rect x="10" y="5" width="4" height="15.5"/><rect x="15" y="14" width="4" height="6.5"/></g>',
  perf: '<g transform="translate(-0.63 -0.63) scale(1.053)" stroke-width="1.90"><circle cx="10" cy="10" r="6.5"/><path d="M15 15l5.5 5.5"/><path d="M6.8 12.2l2.2-2.2 1.8 1.6 2.4-3"/></g>',
  bag: '<g transform="translate(0.08 1.72) scale(0.886)" stroke-width="2.26"><rect x="7" y="8" width="9" height="15" rx="2.2"/><path d="M7 13h9M9.5 8L8.6 3.6M11.5 8l.3-4.6M14 8l1.2-3.6M8.6 3.6H5.8M11.8 3.4H9.2"/><ellipse cx="17.3" cy="3.2" rx="3.3" ry="2.1" transform="rotate(-18 17.3 3.2)"/></g>',
  club: '<g transform="translate(-0.56 -0.05) scale(1.026)" stroke-width="1.95"><path d="M17 3L9.5 17.5"/><path d="M9.5 17.5l-1 2.5H4.5l.8-2.5z"/><circle cx="17.5" cy="18" r="2.5"/></g>',
  cap: '<g transform="translate(1.09 1.55) scale(0.909)" stroke-width="2.20"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5l6 3 6-3v-5M22 9v6"/></g>',
  gear: '<g transform="translate(0.57 0.57) scale(0.952)" stroke-width="2.10"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></g>',
  help: '<g transform="translate(0.00 0.00) scale(1.000)" stroke-width="2.00"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1v.8"/><circle cx="12" cy="16.8" r=".4"/></g>',
  user: '<g transform="translate(-0.63 -1.16) scale(1.053)" stroke-width="1.90"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 6 0 0 1 15 0z"/></g>',
  target: '<g transform="translate(0.00 0.00) scale(1.000)" stroke-width="2.00"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/></g>',
  putt: '<g transform="translate(1.57 2.00) scale(0.870)" stroke-width="2.30"><path d="M11 2.5L9.8 11.5H7.4v3.5"/><rect x="1.5" y="15" width="10" height="5.5" rx="1.4"/><circle cx="15" cy="17.8" r="2.3"/><path d="M19.5 17.8h3" stroke-dasharray="0.1 2.6"/></g>',
  chip: '<g transform="translate(0.37 0.32) scale(0.962)" stroke-width="2.08"><path d="M17 21V3"/><path d="M17 4h4.5l-1.5 2.2 1.5 2.3H17"/><path d="M13 21h8"/><path d="M4.5 19C6 11 11 10 14 15" stroke-dasharray="1.6 3"/><circle cx="4.5" cy="19.5" r="1.8"/></g>',
  carry: '<g transform="translate(1.37 -2.01) scale(0.897)" stroke-width="2.23"><path d="M3.5 19.5Q12 0 20.5 19.5" stroke-dasharray="1.6 3"/><circle cx="3.5" cy="19.5" r="1.8"/><path d="M15 21.5h7"/></g>',
  line: '<g transform="translate(-1.19 0.87) scale(0.939)" stroke-width="2.13"><path d="M7 21.5V2.5" stroke-dasharray="1.6 2.8"/><path d="M7 21.5C7 13 10 7.5 17.4 4.8"/><circle cx="19" cy="4.3" r="2.1"/></g>',
  driver: '<g transform="translate(0.90 0.57) scale(0.952)" stroke-width="2.10"><path d="M19.5 2.5L9.8 16"/><path d="M10.6 14.5l-1.2 4.2C5.6 20.3 2.5 19.5 2.5 17.6c0-1.9 3.1-3.4 8.1-3.1z"/><circle cx="18.5" cy="16" r="2.3"/><path d="M18.5 18.3v3.2"/></g>',
  journal: '<g transform="translate(0.00 0.00) scale(1.000)" stroke-width="2.00"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 3v18M12.5 8h3.5M12.5 12h3.5"/></g>',
  dumbbell: '<g transform="translate(1.66 1.66) scale(0.862)" stroke-width="2.32"><g transform="rotate(-45 12 12)"><path d="M8 12h8"/><rect x="4" y="7" width="4" height="10" rx="1"/><rect x="16" y="7" width="4" height="10" rx="1"/><path d="M2 10v4M22 10v4"/></g></g>',
  checklist: '<g transform="translate(-0.63 -1.42) scale(1.053)" stroke-width="1.90"><path d="M3.5 6l2 2 3.5-3.5M3.5 12.5l2 2 3.5-3.5M3.5 19l2 2 3.5-3.5"/><path d="M12 6.5h8.5M12 13h8.5M12 19.5h8.5"/></g>',
  watch: '<g transform="translate(0.15 0.54) scale(0.976)" stroke-width="2.05"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M12 2.5V6M18 7.5l1.8-1.8"/></g>',
  trophy: '<g transform="translate(-0.63 -0.63) scale(1.053)" stroke-width="1.90"><path d="M7 3.5h10v5a5 5 0 0 1-10 0z"/><path d="M7 5.5H4v1.5a3 3 0 0 0 3 3M17 5.5h3v1.5a3 3 0 0 1-3 3M12 13.5v3.5"/><rect x="8.5" y="17" width="7" height="3.5" rx=".5"/></g>',
  pencil: '<g transform="translate(-1.53 -2.71) scale(1.176)" stroke-width="1.70"><path d="M4 20l1-5L15 5l4 4L9 19z"/><path d="M13 7l4 4"/></g>',
  shuffle: '<g transform="translate(-0.05 -0.31) scale(1.026)" stroke-width="1.95"><path d="M3 7h3.5l10 10H20M3 17h3.5l10-10H20"/><path d="M17.5 4l3 3-3 3M17.5 14l3 3-3 3"/></g>',
  books: '<g transform="translate(-0.48 -0.28) scale(0.990)" stroke-width="2.02"><rect x="3.5" y="4" width="4" height="16" rx=".5"/><rect x="8.5" y="6.5" width="4" height="13.5" rx=".5"/><path d="M14.3 7.4l3.8-1.1 3.6 13.4-3.8 1.1z"/></g>',
  calc: '<g transform="translate(0.57 0.57) scale(0.952)" stroke-width="2.10"><rect x="5" y="2.5" width="14" height="19" rx="2"/><rect x="8" y="5.5" width="8" height="4" rx=".5"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/></g>',
  breakGreen: '<g transform="translate(-0.18 0.30) scale(0.958)" stroke-width="2.09"><path d="M4 8.5C5.5 4 12 2.5 17 4S23 10 21.5 15 14 22 8.5 20.5 2.5 13 4 8.5z"/><circle cx="16" cy="8.5" r="1.4" fill="currentColor"/><path d="M8 16C7.5 12 10.5 9.4 13.8 8.9" stroke-dasharray="1.4 2.4"/><circle cx="8.3" cy="16.8" r="1.4"/></g>',
  ruler: '<g transform="translate(0.14 0.14) scale(0.988)" stroke-width="2.02"><rect x="2.6" y="8.5" width="18.8" height="7" rx="1" transform="rotate(-45 12 12)"/><path d="M7.8 11.4l1.8 1.8M10.6 8.6l1.8 1.8M13.4 5.8l1.8 1.8"/></g>',
  prox: '<g transform="translate(0.00 0.00) scale(1.000)" stroke-width="2.00"><circle cx="12" cy="12" r="9" stroke-dasharray="1.6 3"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.6" cy="5.4" r="1.6"/></g>',
  flight: '<g transform="translate(0.00 -1.86) scale(1.000)" stroke-width="2.00"><path d="M1.5 19.5h21"/><path d="M2.5 19.5C10 10.5 16 7 17.8 8.6c1.2 1 1.6 3.4 1.9 6.3" stroke-dasharray="1.5 2.6"/><circle cx="19.9" cy="17.3" r="1.8"/></g>',
  book: '<g transform="translate(0.35 1.61) scale(0.971)" stroke-width="2.06"><path d="M12 7v13M12 7c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5z"/><circle cx="12" cy="3" r="1.6"/></g>',
  lock: '<g transform="translate(-0.63 -1.16) scale(1.053)" stroke-width="1.90"><rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></g>',
  bell: '<g transform="translate(-0.97 -1.78) scale(1.081)" stroke-width="1.85"><path d="M5 17.5h14l-1.5-2.5V10a5.5 5.5 0 0 0-11 0v5z"/><path d="M10 21h4"/></g>',
  hourglass: '<g transform="translate(-1.20 -1.20) scale(1.100)" stroke-width="1.82"><path d="M6.5 3h11M6.5 21h11M8 3v3l4 6-4 6v3M16 3v3l-4 6 4 6v3"/></g>',
  chat: '<g transform="translate(-1.33 -1.89) scale(1.111)" stroke-width="1.80"><path d="M4 5h16v11H9.5L4 20z"/></g>',
  pin: '<g transform="translate(-1.51 -2.32) scale(1.126)" stroke-width="1.78"><path d="M12 21.5L6.6 13.2a6.2 6.2 0 1 1 10.8 0z"/><circle cx="12" cy="9.5" r="2"/></g>',
  live: '<g transform="translate(-1.33 -1.33) scale(1.111)" stroke-width="1.80"><circle cx="12" cy="12" r="3.5" fill="currentColor"/><circle cx="12" cy="12" r="8"/></g>',
  check: '<g transform="translate(0.00 0.00) scale(1.000)" stroke-width="2.00"><circle cx="12" cy="12" r="9"/><path d="M8 12.2l2.8 2.8L16 9.5"/></g>',
  memo: '<g transform="translate(-0.50 0.00) scale(1.000)" stroke-width="2.00"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/></g>',
  search: '<g transform="translate(-1.16 -1.16) scale(1.053)" stroke-width="1.90"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></g>',
  save: '<g transform="translate(-1.71 -1.43) scale(1.143)" stroke-width="1.75"><path d="M12 4v10M8 10l4 4 4-4M5 19.5h14"/></g>',
  trash: '<g transform="translate(-1.33 -1.33) scale(1.111)" stroke-width="1.80"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></g>',
  warn: '<g transform="translate(0.57 0.57) scale(0.952)" stroke-width="2.10"><path d="M12 3.5l9.5 17h-19z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.6" r=".4"/></g>',
  cal: '<g transform="translate(0.00 0.00) scale(1.000)" stroke-width="2.00"><rect x="3.5" y="5" width="17" height="16" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></g>',
  pause: '<g transform="translate(-3.00 -3.00) scale(1.250)" stroke-width="1.60"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></g>',
  download: '<g transform="translate(-0.63 -0.11) scale(1.053)" stroke-width="1.90"><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></g>',
  box: '<g transform="translate(-1.33 -1.33) scale(1.111)" stroke-width="1.80"><rect x="4" y="4" width="16" height="16" rx="2"/></g>',
};

export const ICON_NAMES = Object.keys(P);

export function ic(name, cls = '') {
  const p = P[name];
  if (!p) return '';
  return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

// The same icon as an element, for code that builds the page with h().
export function icEl(name, cls = '') {
  const t = document.createElement('template');
  t.innerHTML = ic(name, cls);
  return t.content.firstChild || document.createTextNode('');
}

import { h, course } from './app.js';
import { store, sync } from './store.js';
import { LEVELS } from './sg.js';
import { levelName } from './account.js';
import { analyzeRound, CATS, CAT_LABEL, fmtSg, fmtPar } from './model.js';

const pct = (n, d) => (d ? Math.round((100 * n) / d) + '%' : '–');

// Horizontal diverging bars around a zero line: blue = gained, red = lost.
function sgBars(rows) {
  const max = Math.max(0.5, ...rows.map(r => Math.abs(r.v)));
  return h('div', { class: 'sgbars', role: 'img', 'aria-label': 'Strokes gained per 18 holes by category: ' + rows.map(r => `${r.label} ${fmtSg(r.v)}`).join(', ') },
    rows.map(r => {
      const w = (Math.abs(r.v) / max) * 50;
      return h('div', { class: 'sgrow' + (r.total ? ' total' : ''), title: `${r.label}: ${fmtSg(r.v)} strokes per 18 holes` },
        h('span', { class: 'lab' }, r.label),
        h('span', { class: 'track' },
          h('span', { class: 'bar ' + (r.v >= 0 ? 'pos' : 'neg'), style: `width:${w}%;${r.v >= 0 ? 'left:50%' : `right:50%`}` })),
        h('span', { class: 'val' }, fmtSg(r.v)));
    }));
}

function bucketTable(title, unit, shots, edges) {
  const rows = edges.map(([lo, hi]) => {
    const s = shots.filter(x => x.dist >= lo && x.dist < hi);
    return { label: hi === Infinity ? `${lo}+ ${unit}` : `${lo}–${hi} ${unit}`, n: s.length, sg: s.length ? s.reduce((a, x) => a + x.sg, 0) / s.length : null };
  });
  return h('div', { class: 'card' }, h('h3', {}, title),
    h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Distance'), h('th', { class: 'num' }, 'Shots'), h('th', { class: 'num' }, 'SG per shot'))),
      h('tbody', {}, rows.map(r => h('tr', {}, h('td', {}, r.label), h('td', { class: 'num' }, r.n),
        h('td', { class: 'num sg ' + (r.sg == null ? '' : r.sg >= 0 ? 'pos' : 'neg') }, fmtSg(r.sg)))))));
}

export function renderStats(view) {
  // Compared to the handicap on the user's profile, unless changed here this visit.
  const pick = l => (LEVELS.includes(l) ? l : null);
  const level = pick(sessionStorage.getItem('statsLevel')) || pick(sync.level) || 'Scratch';
  const levelSel = h('select', { 'aria-label': 'Compare to', onchange: e => { sessionStorage.setItem('statsLevel', e.target.value); renderStats(view); } },
    LEVELS.map(l => h('option', { value: l, selected: l === level }, `vs ${levelName(l)}`)));
  const all = store.list('round:').sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(r => ({ r, a: analyzeRound(r, course, level) })).filter(x => x.a.holes > 0);
  const saved = sessionStorage.getItem('statsN') || 'all';
  const n = saved === 'all' ? all.length : Math.min(all.length, +saved);
  const set = all.slice(0, n);

  const filter = h('select', { 'aria-label': 'Rounds included', onchange: e => { sessionStorage.setItem('statsN', e.target.value); renderStats(view); } },
    [['all', 'All rounds'], ['5', 'Last 5'], ['10', 'Last 10'], ['20', 'Last 20']].map(([v, l]) => h('option', { value: v, selected: v === saved }, l)));

  if (!set.length) {
    view.replaceChildren(h('div', { class: 'page' }, h('h1', {}, 'Stats'),
      h('p', { class: 'muted' }, sync.user ? 'Hole out on at least one hole (record your shots with + and tap Holed) to see strokes gained here.' : 'Log in, then record your shots with + and tap Holed to see strokes gained here.')));
    return;
  }

  const holes = set.reduce((t, x) => t + x.a.holes, 0);
  const per18 = v => (v / holes) * 18;
  const sum = k => set.reduce((t, x) => t + x.a[k], 0);
  const sg = k => per18(set.reduce((t, x) => t + x.a.sg[k], 0));
  const full = set.filter(x => x.a.holes === 18);
  const shots = set.flatMap(x => x.a.shots);
  const tee = shots.filter(s => s.cat === 'ott' && s.len != null);

  const tile = (label, value, note) => h('div', { class: 'tile' }, h('span', { class: 'muted' }, label), h('strong', {}, value), note ? h('small', { class: 'muted' }, note) : null);

  view.replaceChildren(h('div', { class: 'page' },
    h('div', { class: 'row between' }, h('h1', {}, 'Stats'), h('div', { class: 'row' }, levelSel, filter)),
    h('p', { class: 'muted' }, `${set.length} round${set.length > 1 ? 's' : ''}, ${holes} hole${holes > 1 ? 's' : ''}. Strokes gained compares each shot with a ${levelName(level)} player from the same distance and lie: above zero you gained strokes on them, below zero you lost strokes.`),
    h('div', { class: 'tiles' },
      tile('SG total', fmtSg(sg('total')), 'per 18 holes'),
      tile('Avg score', full.length ? (full.reduce((t, x) => t + x.a.score, 0) / full.length).toFixed(1) : '–', full.length ? `${full.length} full round${full.length > 1 ? 's' : ''}` : 'no full rounds yet'),
      tile('Fairways', pct(sum('fir'), sum('firN'))),
      tile('Greens in reg', pct(sum('gir'), sum('girN'))),
      tile('Putts', per18(sum('putts')).toFixed(1), 'per 18 holes'),
      tile('Avg drive', tee.length ? Math.round(tee.reduce((t, s) => t + s.len, 0) / tee.length) + ' yd' : '–', 'par 4s and 5s')),
    h('div', { class: 'card' }, h('h3', {}, 'Strokes gained per 18 holes'),
      sgBars([...CATS.map(c => ({ label: CAT_LABEL[c], v: sg(c) })), { label: 'Total', v: sg('total'), total: true }])),
    h('div', { class: 'grid2' },
      bucketTable('Approach by distance', 'yd', shots.filter(s => s.cat === 'app'), [[30, 75], [75, 125], [125, 175], [175, 225], [225, Infinity]]),
      bucketTable('Putting by distance', 'ft', shots.filter(s => s.cat === 'putt'), [[0, 4], [4, 8], [8, 15], [15, 30], [30, Infinity]])),
    h('div', { class: 'card' }, h('h3', {}, 'By round'),
      h('div', { class: 'scroll' }, h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Date'), h('th', { class: 'num' }, 'Holes'), h('th', { class: 'num' }, 'Score'),
          CATS.map(c => h('th', { class: 'num' }, CAT_LABEL[c])), h('th', { class: 'num' }, 'Total'))),
        h('tbody', {}, set.map(({ r, a }) => h('tr', {},
          h('td', {}, r.date),
          h('td', { class: 'num' }, a.holes),
          h('td', { class: 'num' }, `${a.score} (${fmtPar(a.score - a.par)})`),
          CATS.map(c => h('td', { class: 'num sg ' + (a.sg[c] >= 0 ? 'pos' : 'neg') }, fmtSg(a.sg[c]))),
          h('td', { class: 'num sg ' + (a.sg.total >= 0 ? 'pos' : 'neg') }, fmtSg(a.sg.total)))))))),
  ));
}

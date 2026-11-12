import { h, course, toast, TILE_URL } from './app.js';
import { store } from './store.js';
import { boundsOf } from './geo.js';

function tileList() {
  const urls = new Set();
  for (const ch of course.holes) {
    const [[s, w], [n, e]] = boundsOf(ch.line, 70);
    for (let z = 16; z <= 19; z++) {
      const k = 2 ** z;
      const x = lon => Math.floor(((lon + 180) / 360) * k);
      const y = lat => Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * k);
      for (let tx = x(w); tx <= x(e); tx++) for (let ty = y(n); ty <= y(s); ty++) urls.add(TILE_URL.replace('{z}', z).replace('{y}', ty).replace('{x}', tx));
    }
  }
  return [...urls];
}

export function renderSettings(view) {
  const progress = h('span', { class: 'muted' });

  async function saveImagery(btn) {
    btn.disabled = true;
    const urls = tileList();
    let done = 0, failed = 0;
    const next = async () => {
      while (urls.length) {
        const u = urls.pop();
        try { const r = await fetch(u, { mode: 'cors' }); if (!r.ok) failed++; } catch { failed++; }
        progress.textContent = ` ${++done} tiles${failed ? `, ${failed} failed` : ''}`;
      }
    };
    await Promise.all(Array.from({ length: 6 }, next));
    progress.textContent = failed ? ` Done, but ${failed} of ${done} tiles failed. Try again on a better connection.` : ` Done: ${done} tiles saved on this device.`;
    btn.disabled = false;
  }

  const fileIn = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async e => {
    const f = e.target.files[0]; if (!f) return;
    try { store.importAll(await f.text()); toast('Backup imported.'); } catch { toast('That file is not a valid backup.'); }
  } });

  view.replaceChildren(h('div', { class: 'page' },
    h('h1', {}, 'Settings'),

    h('div', { class: 'card' }, h('h3', {}, 'Offline imagery'),
      h('p', { class: 'muted' }, 'Save the satellite images for all 18 holes on this device so the map works with no signal on the course. Needs the installed (https) version of the app.'),
      h('button', { onclick: e => saveImagery(e.target) }, 'Save imagery for offline'), progress),

    h('div', { class: 'card' }, h('h3', {}, 'Backup'),
      h('p', { class: 'muted' }, 'Download every round and outline edit as a file, or restore from one.'),
      h('div', { class: 'row' },
        h('button', { onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([store.exportAll()], { type: 'application/json' })), download: `shot-tracker-backup-${new Date().toISOString().slice(0, 10)}.json` });
          a.click();
        } }, 'Download backup'),
        h('button', { onclick: () => fileIn.click() }, 'Restore from file'), fileIn)),

    h('div', { class: 'card' }, h('h3', {}, 'Rounds'),
      store.list('round:').sort((a, b) => (a.date < b.date ? 1 : -1)).map(r =>
        h('div', { class: 'row between' }, h('span', {}, `${r.date} · ${r.tee}`),
          h('button', { class: 'danger', onclick: () => { if (confirm(`Delete the round from ${r.date}? This removes it from every synced device.`)) { store.remove('round:' + r.id); renderSettings(view); } } }, 'Delete'))),
      store.list('round:').length ? null : h('p', { class: 'muted' }, 'No rounds yet.')),

    h('p', { class: 'muted small' }, course.attribution + '. Imagery © Esri and its data providers. Strokes-gained baselines by handicap level.'),
  ));
}

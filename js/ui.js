// Shared controls, so a button that does the same thing looks and works the
// same on every page (styles in css/glass.css, "Shared controls").
//
// Filter: one "☰ Filter" button that drops down the list's pickers, with Clear
// and Done. The button turns blue and shows how many are set ("Filter · 2").
// A picker counts as set when it isn't on its first option (or on the option
// named by its data-default). Markup, from a template string or h():
//   <div class="fmenu">
//     <button type="button" class="fbtn">☰ <span>Filter</span></button>
//     <div class="fpanel" hidden>
//       <label class="frow"><span>Type</span><select ...></select></label> ...
//       <div class="factions"><button type="button" class="fclear">Clear</button><button type="button" class="fdone">Done</button></div>
//     </div>
//   </div>
// filterMenu(rows) builds the same thing (rows: [label, select] pairs).

const defIndex = s => {
  const d = s.dataset.default;
  if (d == null) return 0;
  const i = [...s.options].findIndex(o => o.value === d);
  return i < 0 ? 0 : i;
};
const isSet = s => s.options.length > 0 && s.selectedIndex !== defIndex(s);

export function refreshFilter(menu) {
  const btn = menu.querySelector(':scope > .fbtn'); if (!btn) return;
  const n = [...menu.querySelectorAll('.fpanel select')].filter(isSet).length;
  const label = btn.querySelector('span');
  if (label) label.textContent = n ? `Filter · ${n}` : 'Filter';
  btn.classList.toggle('on', n > 0);
}
export function refreshFilters(scope = document) { scope.querySelectorAll('.fmenu').forEach(refreshFilter); }

function setOpen(menu, open) {
  const panel = menu.querySelector(':scope > .fpanel'), btn = menu.querySelector(':scope > .fbtn');
  if (!panel) return;
  panel.hidden = !open;
  menu.classList.toggle('open', open);
  btn?.setAttribute('aria-expanded', String(open));
  if (open) refreshFilter(menu);
}

document.addEventListener('click', e => {
  const t = e.target instanceof Element ? e.target : null;
  // A tap anywhere outside an open Filter closes it.
  document.querySelectorAll('.fmenu.open').forEach(m => { if (!t || !m.contains(t)) setOpen(m, false); });
  if (!t) return;
  const menu = t.closest('.fmenu'); if (!menu) return;
  if (t.closest('.fbtn')) { e.stopPropagation(); setOpen(menu, !menu.classList.contains('open')); return; }
  if (t.closest('.fdone')) { setOpen(menu, false); return; }
  if (t.closest('.fclear')) {
    menu.querySelectorAll('.fpanel select').forEach(s => {
      if (!isSet(s)) return;
      s.selectedIndex = defIndex(s);
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    refreshFilter(menu);
  }
}, true);
document.addEventListener('change', e => {
  const menu = e.target instanceof Element ? e.target.closest('.fmenu') : null;
  if (menu) refreshFilter(menu);
});

// The same Filter, built with DOM calls (pages drawn with h()).
export function filterMenu(rows) {
  const el = (tag, cls, ...kids) => { const n = document.createElement(tag); if (cls) n.className = cls; n.append(...kids); return n; };
  const btn = el('button', 'fbtn', '☰ ', el('span', '', 'Filter'));
  btn.type = 'button'; btn.setAttribute('aria-expanded', 'false');
  const clear = el('button', 'fclear', 'Clear'), done = el('button', 'fdone', 'Done');
  clear.type = done.type = 'button';
  const panel = el('div', 'fpanel', ...rows.map(([label, sel]) => el('label', 'frow', el('span', '', label), sel)), el('div', 'factions', clear, done));
  panel.hidden = true;
  const menu = el('div', 'fmenu', btn, panel);
  refreshFilter(menu);
  return menu;
}

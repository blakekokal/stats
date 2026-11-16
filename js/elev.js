// Elevation layers for the hole map: hillshade and contour lines, from USGS
// 3DEP lidar built by tools/elevation.py into data/elev/. Only courses listed
// in data/elev/index.json have them.

const abs = p => new URL(p, location.href).href;
let indexP = null;
export const elevIndex = () => (indexP ||= fetch(abs('data/elev/index.json')).then(r => (r.ok ? r.json() : {})).catch(() => ({})));

// The View box's choices, kept on this device.
export const CONTOUR_FT = [1, 2, 5, 10];
export const SHADE = { Soft: 0.25, Medium: 0.45, Strong: 0.7 };
const get = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch { /* not kept */ } };
export const elevPrefs = {
  get shade() { return get('gs:hillshade', '0') === '1'; }, set shade(v) { put('gs:hillshade', v ? '1' : '0'); },
  get shadeStr() { const s = get('gs:hillshadeStr', 'Medium'); return s in SHADE ? s : 'Medium'; }, set shadeStr(v) { put('gs:hillshadeStr', v); },
  get contours() { return get('gs:contours', '0') === '1'; }, set contours(v) { put('gs:contours', v ? '1' : '0'); },
  get contourFt() { const n = +get('gs:contourFt', '2'); return CONTOUR_FT.includes(n) ? n : 2; }, set contourFt(v) { put('gs:contourFt', String(v)); },
};

// Adds (or updates) the layers on map m for course id cid, as elevPrefs says.
// The layers go just above the imagery, under everything the app draws.
export async function drawElevation(m, cid) {
  const info = (await elevIndex())[cid];
  if (!info || !m.getStyle()) return;
  const below = ['sgzones', 'outlines'].find(id => m.getLayer(id));
  if (elevPrefs.shade && !m.getSource('elev-dem')) {
    m.addSource('elev-dem', { type: 'raster-dem', encoding: 'terrarium', tiles: [`${abs(`data/elev/${cid}/`)}{z}/{x}/{y}.png`],
      tileSize: 256, minzoom: info.minzoom, maxzoom: info.maxzoom, bounds: info.bounds, attribution: 'USGS 3DEP' });
    m.addLayer({ id: 'elev-shade', type: 'hillshade', source: 'elev-dem', paint: {
      'hillshade-shadow-color': '#000', 'hillshade-highlight-color': '#fff', 'hillshade-accent-color': '#000',
      'hillshade-illumination-direction': 315 } }, below);
  }
  if (m.getLayer('elev-shade')) {
    m.setLayoutProperty('elev-shade', 'visibility', elevPrefs.shade ? 'visible' : 'none');
    m.setPaintProperty('elev-shade', 'hillshade-exaggeration', SHADE[elevPrefs.shadeStr]);
  }
  if (elevPrefs.contours && !m.getSource('elev-contours')) {
    m.addSource('elev-contours', { type: 'geojson', data: abs(`data/elev/${cid}.contours.json`) });
    const below2 = ['sgzones', 'outlines'].find(id => m.getLayer(id));
    m.addLayer({ id: 'elev-contour', type: 'line', source: 'elev-contours',
      paint: { 'line-color': '#fff3c4', 'line-width': 0.9, 'line-opacity': 0.55 } }, below2);
    // Every fifth line (the index contour) is bolder, to count by.
    m.addLayer({ id: 'elev-contour-index', type: 'line', source: 'elev-contours',
      paint: { 'line-color': '#ffe58a', 'line-width': 1.8, 'line-opacity': 0.85 } }, below2);
  }
  if (m.getLayer('elev-contour')) {
    const ft = elevPrefs.contourFt, vis = elevPrefs.contours ? 'visible' : 'none';
    m.setFilter('elev-contour', ['all', ['==', ['%', ['get', 'ft'], ft], 0], ['!=', ['%', ['get', 'ft'], ft * 5], 0]]);
    m.setFilter('elev-contour-index', ['==', ['%', ['get', 'ft'], ft * 5], 0]);
    m.setLayoutProperty('elev-contour', 'visibility', vis);
    m.setLayoutProperty('elev-contour-index', 'visibility', vis);
  }
}

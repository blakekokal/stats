// Elevation layers for the hole map: hillshade and contour lines, from USGS
// 3DEP lidar built by tools/elevation.py into data/elev/. Only courses listed
// in data/elev/index.json have them.

const abs = p => new URL(p, location.href).href;
let indexP = null;
export const elevIndex = () => (indexP ||= fetch(abs('data/elev/index.json')).then(r => (r.ok ? r.json() : {})).catch(() => ({})));

// The View box's choices, kept on this device.
export const CONTOUR_YD = [1, 3, 5];
export const SHADE = { Soft: 0.25, Medium: 0.45, Strong: 0.7 };
const get = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch { /* not kept */ } };
export const elevPrefs = {
  get shade() { return get('gs:hillshade', '0') === '1'; }, set shade(v) { put('gs:hillshade', v ? '1' : '0'); },
  get shadeStr() { const s = get('gs:hillshadeStr', 'Medium'); return s in SHADE ? s : 'Medium'; }, set shadeStr(v) { put('gs:hillshadeStr', v); },
  get contours() { return get('gs:contours', '0') === '1'; }, set contours(v) { put('gs:contours', v ? '1' : '0'); },
  get contourYd() { const n = +get('gs:contourYd', '1'); return CONTOUR_YD.includes(n) ? n : 1; }, set contourYd(v) { put('gs:contourYd', String(v)); },
};

// Contours and slope arrows, fetched once per course.
const loaded = {};
const load = (cid, what) => (loaded[cid + what] ||= fetch(abs(`data/elev/${cid}.${what}.json`)).then(r => (r.ok ? r.json() : null)).catch(() => null));

// Rounds a line's corners (Chaikin: each pass cuts every corner at 1/4 and
// 3/4), so the contours read as smooth curves. Closed rings stay closed.
function smooth(c, passes = 3) {
  for (let k = 0; k < passes && c.length > 2; k++) {
    const closed = c[0][0] === c[c.length - 1][0] && c[0][1] === c[c.length - 1][1];
    const out = closed ? [] : [c[0]];
    for (let i = 0; i < c.length - 1; i++) {
      const [ax, ay] = c[i], [bx, by] = c[i + 1];
      out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    if (closed) out.push(out[0]); else out.push(c[c.length - 1]);
    c = out;
  }
  return c;
}
const smoothed = {};
const loadContours = cid => (smoothed[cid] ||= load(cid, 'contours').then(gj => gj && {
  ...gj, features: gj.features.map(f => ({ ...f, geometry: { ...f.geometry, coordinates: smooth(f.geometry.coordinates) } })) }));

// The hole's area, like the live view's spotlight but roomier: everything
// within LINE_YD of the hole's line or SHAPE_YD of its own fairways, green and
// tee boxes, fading out over the next FEATHER_YD. weight(p) is 1 inside, 0 outside.
const M_PER_YD = 0.9144, LINE_YD = 40, SHAPE_YD = 22, FEATHER_YD = 20, M_PER_DEG = 111320;
function holeArea({ line, own }) {
  const o = line[0], k = Math.cos((o[0] * Math.PI) / 180);
  const loc = p => [(p[1] - o[1]) * M_PER_DEG * k, (p[0] - o[0]) * M_PER_DEG];
  const shapes = [{ pts: line.map(loc), r: LINE_YD * M_PER_YD }];
  for (const f of own) if (f.t === 'fairway' || f.t === 'green' || f.t === 'tee') shapes.push({ pts: f.p[0].map(loc), r: SHAPE_YD * M_PER_YD, fill: true });
  const F = FEATHER_YD * M_PER_YD;
  const all = shapes.flatMap(s => s.pts), pad = LINE_YD * M_PER_YD + F;
  const box = [Math.min(...all.map(q => q[0])) - pad, Math.min(...all.map(q => q[1])) - pad, Math.max(...all.map(q => q[0])) + pad, Math.max(...all.map(q => q[1])) + pad];
  const segDist = (q, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L)) : 0;
    return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy);
  };
  const inside = (q, pts) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > q[1]) !== (yj > q[1]) && q[0] < ((xj - xi) * (q[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const weightLocal = q => {
    if (q[0] < box[0] || q[0] > box[2] || q[1] < box[1] || q[1] > box[3]) return 0;
    let w = 0;
    for (const s of shapes) {
      let d = Infinity;
      if (s.fill && inside(q, s.pts)) d = 0;
      else for (let i = 0; i < s.pts.length - 1; i++) d = Math.min(d, segDist(q, s.pts[i], s.pts[i + 1]));
      w = Math.max(w, Math.min(1, Math.max(0, 1 - (d - s.r) / F)));
      if (w === 1) break;
    }
    return w;
  };
  // Lng/lat in (GeoJSON order) -> weight.
  return { weight: ll => weightLocal(loc([ll[1], ll[0]])), loc: ll => loc([ll[1], ll[0]]), inBox: q => q[0] >= box[0] && q[0] <= box[2] && q[1] >= box[1] && q[1] <= box[3] };
}

// The contour lines at every `iv` yards, cut to the hole's area in short
// pieces, each with its fade (a).
function clipContours(gj, area, iv) {
  const out = [];
  const piece = (pts, a, yd) => out.push({ type: 'Feature', properties: { a: Math.round(a * 10) / 10 }, geometry: { type: 'LineString', coordinates: pts } });
  for (const f of gj.features) {
    const yd = f.properties.yd;
    if (yd % iv) continue;
    const c = f.geometry.coordinates;
    if (!c.some(p => area.inBox(area.loc(p)))) continue;
    // Every 3 m or so along the line, with its weight.
    const pts = [];
    for (let i = 0; i < c.length; i++) {
      if (i) {
        const [ax, ay] = area.loc(c[i - 1]), [bx, by] = area.loc(c[i]);
        const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 3);
        for (let j = 1; j < n; j++) { const t = j / n; pts.push([c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t]); }
      }
      pts.push(c[i]);
    }
    const w = pts.map(area.weight);
    let run = null, runA = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = Math.round(((w[i] + w[i + 1]) / 2) * 10) / 10;
      if (a <= 0) { if (run) piece(run, runA, yd); run = null; continue; }
      if (run && a === runA) { run.push(pts[i + 1]); continue; }
      if (run) piece(run, runA, yd);
      run = [pts[i], pts[i + 1]]; runA = a;
    }
    if (run) piece(run, runA, yd);
  }
  return { type: 'FeatureCollection', features: out };
}

// Downhill arrows along the contour lines shown: one every ARROW_STEP_M along
// each line, its tail just off the line, pointing straight downhill (square to
// the line, to the side the line's "dn" says). Each gets a level for the zoom
// it shows from: level 0 every 4th, level 1 every other one, level 2 the rest.
const ARROW_STEP_M = 12;
function contourArrows(gj, area, iv) {
  const out = [];
  for (const f of gj.features) {
    if (f.properties.yd % iv) continue;
    const c = f.geometry.coordinates, q = c.map(area.loc);
    if (!q.some(area.inBox)) continue;
    let next = ARROW_STEP_M / 2, along = 0, n = 0;
    for (let i = 0; i < q.length - 1; i++) {
      const dx = q[i + 1][0] - q[i][0], dy = q[i + 1][1] - q[i][1], L = Math.hypot(dx, dy);
      while (L && next <= along + L) {
        const t = (next - along) / L, ll = [c[i][0] + (c[i + 1][0] - c[i][0]) * t, c[i][1] + (c[i + 1][1] - c[i][1]) * t];
        const a = area.weight(ll);
        if (a > 0.05) {
          const brg = (Math.atan2(dx, dy) * 180) / Math.PI + (f.properties.dn === 1 ? -90 : 90);
          out.push({ type: 'Feature', properties: { b: Math.round((brg + 360) % 360), lvl: n % 4 === 0 ? 0 : n % 2 === 0 ? 1 : 2, a: Math.round(a * 10) / 10 },
            geometry: { type: 'Point', coordinates: ll } });
        }
        n++; next += ARROW_STEP_M;
      }
      along += L;
    }
  }
  return { type: 'FeatureCollection', features: out };
}

// A thin line arrow pointing up (north), its tail at the bottom with a hair of
// a gap; the layer anchors the tail on the contour line and turns it downhill.
function arrowImage() {
  const W = 16, H = 28, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.lineCap = x.lineJoin = 'round';
  const draw = () => { x.beginPath(); x.moveTo(8, 25); x.lineTo(8, 4); x.moveTo(4, 9); x.lineTo(8, 4); x.lineTo(12, 9); x.stroke(); };
  x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 3.2; draw();
  x.strokeStyle = '#eafff0'; x.lineWidth = 1.6; draw();
  return x.getImageData(0, 0, W, H);
}
const EMPTY = { type: 'FeatureCollection', features: [] };
// Which arrows show at which zoom: the widest-spaced from the hole view, the
// in-between ones zoomed in more, all of them near the green.
const ARROW_ZOOM = [0, 17.6, 18.6];

// Adds (or updates) the layers on map m for course id cid, as elevPrefs says.
// `hole` is { line: [tee, ..., pin], own: the hole's own features }: contours
// and arrows show only around it. The layers go just above the imagery, under
// everything the app draws.
export async function drawElevation(m, cid, hole) {
  const info = (await elevIndex())[cid];
  if (!info || !m.getStyle()) return;
  const below = () => ['sgzones', 'outlines'].find(id => m.getLayer(id));
  if (elevPrefs.shade && !m.getSource('elev-dem')) {
    m.addSource('elev-dem', { type: 'raster-dem', encoding: 'terrarium', tiles: [`${abs(`data/elev/${cid}/`)}{z}/{x}/{y}.png`],
      tileSize: 256, minzoom: info.minzoom, maxzoom: info.maxzoom, bounds: info.bounds, attribution: 'USGS 3DEP' });
    m.addLayer({ id: 'elev-shade', type: 'hillshade', source: 'elev-dem', paint: {
      'hillshade-shadow-color': '#000', 'hillshade-highlight-color': '#fff', 'hillshade-accent-color': '#000',
      'hillshade-illumination-direction': 315 } }, below());
  }
  if (m.getLayer('elev-shade')) {
    m.setLayoutProperty('elev-shade', 'visibility', elevPrefs.shade ? 'visible' : 'none');
    m.setPaintProperty('elev-shade', 'hillshade-exaggeration', SHADE[elevPrefs.shadeStr]);
  }

  if (!elevPrefs.contours) {
    for (const id of ['elev-contours', 'elev-arrows']) if (m.getSource(id)) m.getSource(id).setData(EMPTY);
    return;
  }
  const gj = await loadContours(cid);
  if (!m.getStyle() || !elevPrefs.contours) return;
  const area = holeArea(hole);
  if (!m.getSource('elev-contours')) {
    m.addSource('elev-contours', { type: 'geojson', data: EMPTY });
    // Thin, even green lines, like a yardage book's green pages.
    // Full strength until close to the edge of the hole's area, then fading.
    const fade = ['min', 1, ['*', 2, ['get', 'a']]];
    const lineLayout = { 'line-join': 'round', 'line-cap': 'round' };
    // A faint dark edge under each line so it shows on light and dark ground alike.
    m.addLayer({ id: 'elev-contour-edge', type: 'line', source: 'elev-contours', layout: lineLayout,
      paint: { 'line-color': '#000', 'line-width': ['interpolate', ['linear'], ['zoom'], 16, 1.8, 19, 2.4], 'line-opacity': ['*', 0.3, fade] } }, below());
    m.addLayer({ id: 'elev-contour', type: 'line', source: 'elev-contours', layout: lineLayout,
      paint: { 'line-color': '#eafff0', 'line-width': ['interpolate', ['linear'], ['zoom'], 16, 0.6, 19, 1], 'line-opacity': fade } }, below());
  }
  if (!m.getSource('elev-arrows')) {
    if (!m.hasImage('elev-arrow5')) m.addImage('elev-arrow5', arrowImage(), { pixelRatio: 2 });
    m.addSource('elev-arrows', { type: 'geojson', data: EMPTY });
    ARROW_ZOOM.forEach((z, lvl) => m.addLayer({ id: `elev-arrows-${lvl}`, type: 'symbol', source: 'elev-arrows', minzoom: z, filter: ['==', ['get', 'lvl'], lvl],
      layout: { 'icon-image': 'elev-arrow5', 'icon-anchor': 'bottom', 'icon-rotate': ['get', 'b'], 'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': ['interpolate', ['linear'], ['zoom'], 16, 0.75, 19, 1] },
      paint: { 'icon-opacity': ['min', 1, ['*', 2, ['get', 'a']]] } }, below()));
  }
  m.getSource('elev-contours').setData(gj ? clipContours(gj, area, elevPrefs.contourYd) : EMPTY);
  m.getSource('elev-arrows').setData(gj ? contourArrows(gj, area, elevPrefs.contourYd) : EMPTY);
}

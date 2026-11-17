// Elevation for the hole map: contour lines with downhill arrows, and heights
// for plays-like yardages, from USGS 3DEP lidar built by tools/elevation.py into
// data/elev/. Only courses listed in data/elev/index.json have them.

const abs = p => new URL(p, location.href).href;
let indexP = null;
export const elevIndex = () => (indexP ||= fetch(abs('data/elev/index.json')).then(r => (r.ok ? r.json() : {})).catch(() => ({})));

// The View box's choices, kept on this device.
export const CONTOUR_YD = [1, 3, 5];
const get = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch { /* not kept */ } };
// The contour lines' look for everyone, until changed on a device.
export const CONTOUR_LOOK = { color: '#000000', opacity: 0.6, width: 1 };
export function resetContourLook() { for (const k of ['gs:contourColor', 'gs:contourOpacity', 'gs:contourWidth']) { try { localStorage.removeItem(k); } catch { /* nothing kept */ } } }
export const elevPrefs = {
  get contours() { return get('gs:contours', '0') === '1'; }, set contours(v) { put('gs:contours', v ? '1' : '0'); },
  get contourYd() { const n = +get('gs:contourYd', '1'); return CONTOUR_YD.includes(n) ? n : 1; }, set contourYd(v) { put('gs:contourYd', String(v)); },
  get playsLike() { return get('gs:playsLike', '0') === '1'; }, set playsLike(v) { put('gs:playsLike', v ? '1' : '0'); },
  // What plays like counts: the height change (on unless turned off) and the wind (off unless turned on).
  get playsElev() { return get('gs:playsElev', '1') === '1'; }, set playsElev(v) { put('gs:playsElev', v ? '1' : '0'); },
  // How the contour lines look (menu > Settings): colour, opacity (0.05 to 1) and
  // width (a multiple of the standard width, 0.5 to 4).
  get contourColor() { const c = get('gs:contourColor', CONTOUR_LOOK.color); return /^#[0-9a-f]{6}$/i.test(c) ? c : CONTOUR_LOOK.color; }, set contourColor(v) { put('gs:contourColor', v); },
  get contourOpacity() { const n = +get('gs:contourOpacity', CONTOUR_LOOK.opacity); return n >= 0.05 && n <= 1 ? n : CONTOUR_LOOK.opacity; }, set contourOpacity(v) { put('gs:contourOpacity', String(v)); },
  get contourWidth() { const n = +get('gs:contourWidth', CONTOUR_LOOK.width); return n >= 0.5 && n <= 4 ? n : CONTOUR_LOOK.width; }, set contourWidth(v) { put('gs:contourWidth', String(v)); },
  // Tournament rounds have their own Contours switch, off at the start of each
  // round: it holds the id of the one tournament round it was turned on in.
  tourneyContours(id) { return get('gs:tContours', '') === id; }, setTourneyContours(id, v) { put('gs:tContours', v ? id : ''); },
  get playsWind() { return get('gs:playsWind', '0') === '1'; }, set playsWind(v) { put('gs:playsWind', v ? '1' : '0'); },
};

// Height in metres at [lat, lng] from the course's height tiles (Terrarium PNGs),
// or null until the tile is in (then onReady runs, once per tile, so the caller
// can redraw). Bilinear between the tile's pixels.
const tiles = {};
export function heightAt(cid, info, p, onReady) {
  if (!info || !p) return null;
  const z = info.maxzoom, n = 2 ** z * 256;
  const [w, s, e, nn] = info.bounds;
  if (p[1] < w || p[1] > e || p[0] < s || p[0] > nn) return null;
  const X = ((p[1] + 180) / 360) * n - 0.5;
  const lat = (p[0] * Math.PI) / 180;
  const Y = ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n - 0.5;
  const px = (gx, gy) => {
    const tx = Math.floor(gx / 256), ty = Math.floor(gy / 256), key = `${cid}/${z}/${tx}/${ty}`;
    let t = tiles[key];
    if (!t) {
      t = tiles[key] = { data: null };
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
        t.data = x.getImageData(0, 0, 256, 256).data;
        onReady?.();
      };
      img.onerror = () => { t.data = 'none'; };
      img.src = abs(`data/elev/${key}.png`);
    }
    if (!t.data || t.data === 'none') return null;
    const i = ((gy - ty * 256) * 256 + (gx - tx * 256)) * 4, d = t.data;
    return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768;
  };
  const x0 = Math.floor(X), y0 = Math.floor(Y), fx = X - x0, fy = Y - y0;
  const a = px(x0, y0), b = px(x0 + 1, y0), c = px(x0, y0 + 1), d = px(x0 + 1, y0 + 1);
  if ([a, b, c, d].some(v => v == null)) return null;
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

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
// A tournament (`cut`: the course's green outlines) also cuts the lines out on
// and within CUT_YD of every green: the Rules only allow green maps at a tiny
// scale, so nothing is shown there at all.
export const CUT_YD = 15;
function holeArea({ line, own, cut }) {
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
  const C = CUT_YD * M_PER_YD;
  const cuts = (cut || []).map(r => { const pts = r.map(loc), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { pts, b: [Math.min(...xs) - C, Math.min(...ys) - C, Math.max(...xs) + C, Math.max(...ys) + C] }; });
  const nearGreen = q => cuts.some(({ pts, b }) => {
    if (q[0] < b[0] || q[0] > b[2] || q[1] < b[1] || q[1] > b[3]) return false;
    if (inside(q, pts)) return true;
    for (let i = 0; i < pts.length - 1; i++) if (segDist(q, pts[i], pts[i + 1]) <= C) return true;
    return false;
  });
  const weightLocal = q => {
    if (q[0] < box[0] || q[0] > box[2] || q[1] < box[1] || q[1] > box[3]) return 0;
    if (cuts.length && nearGreen(q)) return 0;
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
  x.strokeStyle = elevPrefs.contourColor; x.lineWidth = 1.6; draw();
  return x.getImageData(0, 0, W, H);
}
const EMPTY = { type: 'FeatureCollection', features: [] };
// Which arrows show at which zoom: the widest-spaced from the hole view, the
// in-between ones zoomed in more, all of them near the green.
const ARROW_ZOOM = [0, 17.6, 18.6];

// Puts the contour look (colour, opacity, width) onto the layers; the arrows follow the lines.
export function styleElevation(m) {
  if (!m.getStyle() || !m.getLayer('elev-contour')) return;
  const fade = ['min', 1, ['*', 2, ['get', 'a']]];
  const { contourColor: color, contourOpacity: op, contourWidth: w } = elevPrefs;
  m.setPaintProperty('elev-contour', 'line-color', color);
  m.setPaintProperty('elev-contour', 'line-opacity', ['*', op, fade]);
  m.setPaintProperty('elev-contour', 'line-width', ['interpolate', ['linear'], ['zoom'], 16, 0.6 * w, 19, w]);
  m.setPaintProperty('elev-contour-edge', 'line-width', ['interpolate', ['linear'], ['zoom'], 16, 0.6 * w + 1.2, 19, w + 1.4]);
  if (m.hasImage('elev-arrow5')) m.updateImage('elev-arrow5', arrowImage());
  ARROW_ZOOM.forEach((z, lvl) => { if (m.getLayer(`elev-arrows-${lvl}`)) m.setPaintProperty(`elev-arrows-${lvl}`, 'icon-opacity', ['*', Math.min(1, op * 1.2), fade]); });
}

// Adds (or updates) the layers on map m for course id cid, as elevPrefs says.
// `hole` is { line: [tee, ..., pin], own: the hole's own features }: contours
// and arrows show only around it. `on` overrides the Contours switch (a
// tournament has its own) and `cut` lists green rings to leave bare. The layers go just above the imagery, under
// everything the app draws.
export async function drawElevation(m, cid, hole) {
  const info = (await elevIndex())[cid];
  if (!info || !m.getStyle()) return;
  const below = () => ['sgzones', 'outlines'].find(id => m.getLayer(id));
  const on = () => hole.on ?? elevPrefs.contours;
  if (!on()) {
    for (const id of ['elev-contours', 'elev-arrows']) if (m.getSource(id)) m.getSource(id).setData(EMPTY);
    return;
  }
  const gj = await loadContours(cid);
  if (!m.getStyle() || !on()) return;
  const area = holeArea(hole);
  if (!m.getSource('elev-contours')) {
    m.addSource('elev-contours', { type: 'geojson', data: EMPTY });
    // Thin, even green lines, like a yardage book's green pages.
    // Full strength until close to the edge of the hole's area, then fading.
    const fade = ['min', 1, ['*', 2, ['get', 'a']]];
    const lineLayout = { 'line-join': 'round', 'line-cap': 'round' };
    // A very faint dark edge under each line so it still shows on light ground.
    m.addLayer({ id: 'elev-contour-edge', type: 'line', source: 'elev-contours', layout: lineLayout,
      paint: { 'line-color': '#000', 'line-width': ['interpolate', ['linear'], ['zoom'], 16, 1.8, 19, 2.4], 'line-opacity': ['*', 0.12, fade] } }, below());
    m.addLayer({ id: 'elev-contour', type: 'line', source: 'elev-contours', layout: lineLayout,
      paint: { 'line-color': '#bcd6c4', 'line-width': ['interpolate', ['linear'], ['zoom'], 16, 0.6, 19, 1], 'line-opacity': ['*', 0.45, fade] } }, below());
  }
  if (!m.getSource('elev-arrows')) {
    if (!m.hasImage('elev-arrow5')) m.addImage('elev-arrow5', arrowImage(), { pixelRatio: 2 });
    m.addSource('elev-arrows', { type: 'geojson', data: EMPTY });
    ARROW_ZOOM.forEach((z, lvl) => m.addLayer({ id: `elev-arrows-${lvl}`, type: 'symbol', source: 'elev-arrows', minzoom: z, filter: ['==', ['get', 'lvl'], lvl],
      layout: { 'icon-image': 'elev-arrow5', 'icon-anchor': 'bottom', 'icon-rotate': ['get', 'b'], 'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': ['interpolate', ['linear'], ['zoom'], 16, 0.75, 19, 1] },
      paint: { 'icon-opacity': ['*', 0.55, ['min', 1, ['*', 2, ['get', 'a']]]] } }, below()));
  }
  styleElevation(m);
  m.getSource('elev-contours').setData(gj ? clipContours(gj, area, elevPrefs.contourYd) : EMPTY);
  m.getSource('elev-arrows').setData(gj ? contourArrows(gj, area, elevPrefs.contourYd) : EMPTY);
}

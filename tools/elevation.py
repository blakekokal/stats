#!/usr/bin/env python3
"""Elevation for a course: hillshade tiles and contour lines from USGS 3DEP lidar.

    python3 tools/elevation.py cowboys

Reads data/<course>.json for the course's extent (holes and features, not the
course-wide OB area), downloads the 3DEP 1 m bare-earth elevation for it
(elevation.nationalmap.gov, free, no key) and writes:

  data/elev/<course>/{z}/{x}/{y}.png  Terrarium-encoded elevation tiles (zoom
                                      13-17) for the map's hillshade layer
  data/elev/<course>.contours.json    contour lines every 1 yd as GeoJSON
                                      (property "yd": height in yards); the
                                      app filters them to the interval chosen
  data/elev/<course>.slopes.json      downslope arrows on a grid (see slopes())
  data/elev/index.json                which courses have elevation, and their
                                      extent (the app reads this)

Needs numpy, Pillow, tifffile and scikit-image (pip install tifffile scikit-image).
"""
import io
import json
import math
import os
import sys
import urllib.parse
import urllib.request

import numpy as np
import tifffile
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage import measure

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICE = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage'
R = 6378137.0
PAD_M = 120  # ground metres around the course
RES = 1.0  # web-mercator metres per pixel of the downloaded grid
ZOOMS = range(13, 18)
# The shading tiles' heights are stretched this many times (from the lowest
# point): MapLibre's hillshade is made for mountains, and a golf course's gentle
# slopes barely show at true height. Contours use true heights.
SHADE_STRETCH = 5
FT_PER_M = 3.28084
YD_PER_M = FT_PER_M / 3
SLOPE_STEP_M = 8  # ground metres between the closest downslope arrows
SLOPE_PAD_M = 50  # arrows this far around the course's shapes and hole lines
MIN_SLOPE_PCT = 1  # flatter than this: no arrow


def merc(lat, lng):
    x = math.radians(lng) * R
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * R
    return x, y


def unmerc(x, y):
    return math.degrees(2 * math.atan(math.exp(y / R)) - math.pi / 2), math.degrees(x / R)


def course_points(course):
    pts = []
    for h in course['holes']:
        pts += [p for p in [h.get('tee'), h.get('pin')] if p] + (h.get('line') or [])
    for f in course['features']:
        if f['t'] == 'ob':
            continue
        p = f['p']
        while isinstance(p[0][0], list):
            p = [q for r in p for q in r]
        pts += p
    return pts


def fetch_chunk(x0, y0, x1, y1, w, h):
    q = urllib.parse.urlencode({
        'bbox': f'{x0},{y0},{x1},{y1}', 'bboxSR': 3857, 'imageSR': 3857,
        'size': f'{w},{h}', 'format': 'tiff', 'pixelType': 'F32',
        'interpolation': 'RSP_BilinearInterpolation', 'noData': -9999, 'f': 'image',
    })
    for attempt in range(4):
        try:
            with urllib.request.urlopen(f'{SERVICE}?{q}', timeout=300) as r:
                data = r.read()
            a = tifffile.imread(io.BytesIO(data)).astype(np.float64)
            return a[..., 0] if a.ndim == 3 else a
        except Exception as e:  # the service throws the odd 500
            if attempt == 3:
                raise
            print(f'  retry ({e})')


def fetch_dem(x0, y0, x1, y1):
    """The grid in 1000 px chunks (the service fails on big requests)."""
    w, h = round((x1 - x0) / RES), round((y1 - y0) / RES)
    dem = np.empty((h, w))
    C = 1000
    for r in range(0, h, C):
        for c in range(0, w, C):
            cw, chh = min(C, w - c), min(C, h - r)
            dem[r:r + chh, c:c + cw] = fetch_chunk(x0 + c * RES, y1 - (r + chh) * RES, x0 + (c + cw) * RES, y1 - r * RES, cw, chh)
    bad = (dem < -500) | ~np.isfinite(dem)
    if bad.all():
        sys.exit('No elevation returned for this area')
    if bad.any():  # fill holes from the nearest good cell
        idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
        dem = dem[tuple(idx)]
    return dem  # row 0 is the north edge


def sample(dem, x0, y1, xs, ys):
    """Bilinear elevation at mercator xs, ys (arrays)."""
    c = (xs - x0) / RES - 0.5
    r = (y1 - ys) / RES - 0.5
    return ndimage.map_coordinates(dem, [r, c], order=1, mode='nearest')


def write_tiles(dem, x0, y0, x1, y1, out):
    n = 0
    for z in ZOOMS:
        size = 2 * math.pi * R / 2 ** z
        tx0, tx1 = int((x0 + math.pi * R) // size), int((x1 + math.pi * R) // size)
        ty0, ty1 = int((math.pi * R - y1) // size), int((math.pi * R - y0) // size)
        for tx in range(tx0, tx1 + 1):
            for ty in range(ty0, ty1 + 1):
                px = (np.arange(256) + 0.5) / 256 * size
                xs = -math.pi * R + tx * size + px
                ys = math.pi * R - ty * size - px
                X, Y = np.meshgrid(xs, ys)
                # Smooth more as the tile pixels get bigger than the grid's.
                src = dem if size / 256 <= RES * 1.5 else ndimage.uniform_filter(dem, max(1, round(size / 256 / RES)))
                e = sample(src, x0, y1, X.ravel(), Y.ravel()).reshape(256, 256)
                v = np.round(((e - dem.min()) * SHADE_STRETCH + 32768) * 20) / 20  # to 5 cm: the tiles compress far better
                rgb = np.stack([np.floor(v / 256), np.floor(v) % 256, np.floor((v - np.floor(v)) * 256)], -1)
                d = os.path.join(out, str(z), str(tx))
                os.makedirs(d, exist_ok=True)
                Image.fromarray(rgb.clip(0, 255).astype(np.uint8)).save(os.path.join(d, f'{ty}.png'), optimize=True)
                n += 1
    return n


def simplify(line, tol):
    """Douglas-Peucker on a list of (x, y)."""
    if len(line) < 3:
        return line
    P = np.array(line)
    keep = np.zeros(len(P), bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(P) - 1)]
    while stack:
        i, j = stack.pop()
        if j - i < 2:
            continue
        a, b = P[i], P[j]
        ab = b - a
        seg = P[i + 1:j] - a
        L = math.hypot(*ab)
        d = np.abs(ab[0] * seg[:, 1] - ab[1] * seg[:, 0]) / L if L else np.hypot(seg[:, 0], seg[:, 1])
        k = int(d.argmax())
        if d[k] > tol:
            keep[i + 1 + k] = True
            stack += [(i, i + 1 + k), (i + 1 + k, j)]
    return [tuple(p) for p in P[keep]]


def contours(dem, x0, y1):
    """Contour lines every 1 yd (property "yd": the height in yards)."""
    yd = ndimage.gaussian_filter(dem, 2.0) * YD_PER_M  # smooth out lidar noise
    feats = []
    for level in range(math.ceil(yd.min()), math.floor(yd.max()) + 1):
        for c in measure.find_contours(yd, level):
            if len(c) < 25:  # tiny rings: noise
                continue
            xy = [(x0 + (col + 0.5) * RES, y1 - (row + 0.5) * RES) for row, col in c]
            xy = simplify(xy, 1.0)
            ll = [[round(lng, 5), round(lat, 5)] for lat, lng in (unmerc(x, y) for x, y in xy)]
            feats.append({'type': 'Feature', 'properties': {'yd': level},
                          'geometry': {'type': 'LineString', 'coordinates': ll}})
    return {'type': 'FeatureCollection', 'features': feats}


def play_mask(course, shape, x0, y1, k):
    """True within SLOPE_PAD_M ground metres of the course's shapes and hole lines (not OB)."""
    img = Image.new('L', (shape[1], shape[0]), 0)
    d = ImageDraw.Draw(img)
    px = lambda p: ((merc(*p)[0] - x0) / RES, (y1 - merc(*p)[1]) / RES)
    for h in course['holes']:
        line = [p for p in [h.get('tee')] + (h.get('line') or []) + [h.get('pin')] if p]
        d.line([px(p) for p in line], fill=255, width=max(1, round(30 * k / RES)))
    for f in course['features']:
        if f['t'] == 'ob':
            continue
        for ring in (f['p'] if isinstance(f['p'][0][0], list) else [f['p']]):
            if len(ring) > 2:
                d.polygon([px(p) for p in ring], fill=255)
    near = np.array(img) > 0
    return ndimage.distance_transform_edt(~near) * RES / k <= SLOPE_PAD_M


def slopes(dem, mask, x0, y1, k):
    """Downslope arrows on a grid: [lng, lat, bearing (deg), slope (% x10), level].
    Level 0 points are SLOPE_STEP_M * 4 apart, level 1 add the points between
    (* 2), level 2 the rest; the app shows more levels as it zooms in. Each
    level's slope is measured over about its own spacing."""
    step = SLOPE_STEP_M * k / RES  # grid pixels between points
    out = []
    for lvl, mult in enumerate([4, 2, 1]):
        z = ndimage.gaussian_filter(dem, step * mult / 2.5)
        gr, gc = np.gradient(z)  # per pixel: rows run south, cols east
        per_m = k / RES  # pixels per ground metre
        east, north = -gc * per_m, gr * per_m  # downhill direction (dz/dx is uphill)
        rows = np.arange(step / 2, dem.shape[0], step)
        cols = np.arange(step / 2, dem.shape[1], step)
        for i, r in enumerate(rows):
            for j, c in enumerate(cols):
                if lvl == 0 and (i % 4 or j % 4):
                    continue
                if lvl == 1 and (i % 2 or j % 2 or (i % 4 == 0 and j % 4 == 0)):
                    continue
                if lvl == 2 and i % 2 == 0 and j % 2 == 0:
                    continue
                ri, ci = int(r), int(c)
                if not mask[ri, ci]:
                    continue
                e, n = east[ri, ci], north[ri, ci]
                pct = math.hypot(e, n) * 100
                if pct < MIN_SLOPE_PCT:
                    continue
                lat, lng = unmerc(x0 + (c + 0.5) * RES, y1 - (r + 0.5) * RES)
                out.append([round(lng, 6), round(lat, 6), round(math.degrees(math.atan2(e, n))) % 360, round(pct * 10), lvl])
    return out


def main():
    cid = sys.argv[1]
    course = json.load(open(os.path.join(ROOT, 'data', f'{cid}.json')))
    pts = course_points(course)
    lat0, lat1 = min(p[0] for p in pts), max(p[0] for p in pts)
    lng0, lng1 = min(p[1] for p in pts), max(p[1] for p in pts)
    k = 1 / math.cos(math.radians((lat0 + lat1) / 2))  # mercator metres per ground metre
    x0, y0 = merc(lat0, lng0)
    x1, y1 = merc(lat1, lng1)
    x0, y0, x1, y1 = x0 - PAD_M * k, y0 - PAD_M * k, x1 + PAD_M * k, y1 + PAD_M * k
    print(f'Fetching 3DEP for {cid}: {round((x1 - x0) / RES)} x {round((y1 - y0) / RES)} px')
    cache = os.path.join(ROOT, 'tools', f'{cid}.dem.npy')  # git-ignored
    if os.path.exists(cache) and '--refetch' not in sys.argv:
        dem = np.load(cache)
    else:
        dem = fetch_dem(x0, y0, x1, y1)
        np.save(cache, dem)
    print(f'Elevation {dem.min():.1f}-{dem.max():.1f} m ({dem.min() * FT_PER_M:.0f}-{dem.max() * FT_PER_M:.0f} ft)')

    out = os.path.join(ROOT, 'data', 'elev')
    tiles = os.path.join(out, cid)
    if os.path.isdir(tiles):
        import shutil
        shutil.rmtree(tiles)
    print(f'{write_tiles(dem, x0, y0, x1, y1, tiles)} tiles')

    gj = contours(dem, x0, y1)
    path = os.path.join(out, f'{cid}.contours.json')
    with open(path, 'w') as f:
        json.dump(gj, f, separators=(',', ':'))
    print(f'{len(gj["features"])} contour lines, {os.path.getsize(path) // 1024} KB')

    arrows = slopes(dem, play_mask(course, dem.shape, x0, y1, k), x0, y1, k)
    path = os.path.join(out, f'{cid}.slopes.json')
    with open(path, 'w') as f:
        json.dump(arrows, f, separators=(',', ':'))
    print(f'{len(arrows)} downslope arrows, {os.path.getsize(path) // 1024} KB')

    s, w = unmerc(x0, y0)
    n, e = unmerc(x1, y1)
    idx_path = os.path.join(out, 'index.json')
    idx = json.load(open(idx_path)) if os.path.exists(idx_path) else {}
    idx[cid] = {'bounds': [round(w, 6), round(s, 6), round(e, 6), round(n, 6)],
                'minzoom': min(ZOOMS), 'maxzoom': max(ZOOMS),
                'ft': [math.floor(dem.min() * FT_PER_M), math.ceil(dem.max() * FT_PER_M)],
                'shadeStretch': SHADE_STRETCH, 'source': 'USGS 3DEP'}
    with open(idx_path, 'w') as f:
        json.dump(idx, f, indent=1)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Elevation for a course: hillshade tiles and contour lines from USGS 3DEP lidar.

    python3 tools/elevation.py cowboys

Reads data/<course>.json for the course's extent (holes and features, not the
course-wide OB area), downloads the 3DEP 1 m bare-earth elevation for it
(elevation.nationalmap.gov, free, no key) and writes:

  data/elev/<course>/{z}/{x}/{y}.png  Terrarium-encoded elevation tiles (zoom
                                      13-17) for the map's hillshade layer
  data/elev/<course>.contours.json    contour lines every 1 yd as GeoJSON
                                      (property "yd": height in yards, "dn":
                                      1 if downhill is left of the line's
                                      direction, -1 if right); the
                                      app filters them to the interval chosen
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
from PIL import Image
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
            # Which side is downhill: compare the ground a little to each side.
            mid = (c[1:] + c[:-1]) / 2
            d = c[1:] - c[:-1]
            nrm = np.stack([-d[:, 1], d[:, 0]], 1)  # in (row, col): left of travel on the map (rows run south)
            nrm /= np.maximum(np.hypot(nrm[:, 0], nrm[:, 1]), 1e-9)[:, None]
            left = ndimage.map_coordinates(yd, (mid + 2 * nrm).T, order=1, mode='nearest')
            right = ndimage.map_coordinates(yd, (mid - 2 * nrm).T, order=1, mode='nearest')
            dn = 1 if np.mean(left < right) > 0.5 else -1
            xy = [(x0 + (col + 0.5) * RES, y1 - (row + 0.5) * RES) for row, col in c]
            xy = simplify(xy, 1.0)
            ll = [[round(lng, 5), round(lat, 5)] for lat, lng in (unmerc(x, y) for x, y in xy)]
            feats.append({'type': 'Feature', 'properties': {'yd': level, 'dn': dn},
                          'geometry': {'type': 'LineString', 'coordinates': ll}})
    return {'type': 'FeatureCollection', 'features': feats}


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

    old = os.path.join(out, f'{cid}.slopes.json')  # the old grid of arrows
    if os.path.exists(old):
        os.remove(old)

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

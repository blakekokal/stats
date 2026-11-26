#!/usr/bin/env python3
"""Measure how far a course's OSM outlines sit off the zoom-19 Esri imagery.

Usage: fit_shift.py course.json m19.png [bunker|green] [reach_m]
(mosaic from fetch_tiles.py, with its .meta beside it). Prints the shift (metres east,
north) to ADD to the config's current `shift` so the outlines land on the imagery.

bunker (default): the share of bunker pixels on sand (bright, unsaturated, lifted over
its surroundings, as in detect_sand.py) for every shift up to reach_m (default 12 m).
green: for winter imagery / brown sand, where the bunker fit fails: the share of each
green's edge band (2 m inside vs 2 m outside) whose inside is smoother than its outside.
"""
import cv2, numpy as np, json, math, sys
from shapely.geometry import Polygon
c = json.load(open(sys.argv[1])); mos = sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else 'bunker'; reach = float(sys.argv[4]) if len(sys.argv) > 4 else 12
img = cv2.imread(mos); H, W = img.shape[:2]
z, X0, Y0 = map(int, open(mos + '.meta').read().split()); N = 256 * 2 ** z
mpp = 156543.03 * math.cos(math.radians(c['holes'][0]['tee'][0])) / 2 ** z
def to_px(lat, lon):
    gx = (lon + 180) / 360 * N
    gy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * N
    return gx - X0 * 256, gy - Y0 * 256
def raster(rings):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.round(np.array([to_px(*q) for q in r])).astype(np.int32) for r in rings], 1); return m
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
if mode == 'bunker':
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV); S, V = hsv[..., 1].astype(np.int16), hsv[..., 2].astype(np.int16)
    target = ((V > 195) & (S < 55) & (gray - cv2.blur(gray, (41, 41)) > 35)).astype(np.float32)
    shapes = [f['p'][0] for f in c['features'] if f['t'] == 'bunker']
    pos = raster(shapes); neg = None
else:  # smooth (low local variance) inside the green's edge, rough outside
    var = cv2.blur(gray * gray, (7, 7)) - cv2.blur(gray, (7, 7)) ** 2
    target = (var < np.percentile(var, 35)).astype(np.float32)
    shapes = [f['p'][0] for f in c['features'] if f['t'] == 'green']
    k = max(1, round(2 / mpp)); g = raster(shapes)
    pos = g - cv2.erode(g, np.ones((2 * k + 1, 2 * k + 1), np.uint8)); neg = cv2.dilate(g, np.ones((2 * k + 1, 2 * k + 1), np.uint8)) - g
py, px = np.nonzero(pos); ny, nx = np.nonzero(neg) if neg is not None else (None, None)
def score(dx, dy):  # dx, dy in pixels (image x right, y down)
    def take(yy, xx):
        yy = np.clip(np.round(yy + dy).astype(int), 0, H - 1); xx = np.clip(np.round(xx + dx).astype(int), 0, W - 1)
        return target[yy, xx].mean()
    return take(py, px) - (take(ny, nx) if neg is not None else 0)
best = (-9, 0, 0); R = int(reach / mpp)
for step in (4, 1):
    cx, cy = (0, 0) if step == 4 else best[1:]
    rng = range(-R, R + 1, step) if step == 4 else range(-6, 7)
    for dy in rng:
        for dx in rng:
            s = score(cx + dx if step == 1 else dx, cy + dy if step == 1 else dy)
            if s > best[0]: best = (s, cx + dx if step == 1 else dx, cy + dy if step == 1 else dy)
print(f'{mode}: {len(shapes)} shapes; at zero shift {score(0, 0):.3f}, best {best[0]:.3f} at '
      f'east {best[1] * mpp:+.1f} m, north {-best[2] * mpp:+.1f} m')

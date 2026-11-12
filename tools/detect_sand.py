#!/usr/bin/env python3
"""Replace a course's bunkers with the sand visible in the satellite imagery.

Usage: detect_sand.py course.json mosaic.png out.json [osm.json]
(the OSM export, if given, supplies cart paths: sand right on one is dropped)
(mosaic from tools/fetch_tiles.py, with its .meta file beside it)

Sand is picked out as near-white pixels much brighter than their surroundings.
Thin, long pieces (cart paths) and specks are dropped, as is anything out of
bounds or more than REACH metres from a hole. Mapped bunkers inside the imagery
near the holes are removed; others are kept.
"""
import cv2, numpy as np, json, math, sys
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import unary_union

REACH = 80  # metres from a hole's line

course_path, mos, out = sys.argv[1:4]
osm_path = sys.argv[4] if len(sys.argv) > 4 else None
c = json.load(open(course_path))
img = cv2.imread(mos); Hh, Ww = img.shape[:2]
z, X0, Y0 = map(int, open(mos + '.meta').read().split()); N = 256 * 2 ** z
mpp = 156543.03 * math.cos(math.radians(c['holes'][0]['tee'][0])) / 2 ** z
def to_px(lat, lon):
    gx = (lon + 180) / 360 * N
    gy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * N
    return gx - X0 * 256, gy - Y0 * 256
def to_ll(x, y):
    gx, gy = x + X0 * 256, y + Y0 * 256
    return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / N)))), 6), round(gx / N * 360 - 180, 6)]

hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
S, V = hsv[..., 1].astype(np.int16), hsv[..., 2].astype(np.int16)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
m = ((V > 195) & (S < 55) & (gray - cv2.blur(gray, (41, 41)) > 35)).astype(np.uint8)
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
dist = cv2.distanceTransform(m, cv2.DIST_L2, 5)

# In bounds and near a hole, in pixel space.
P = lambda ring: [to_px(*q) for q in ring]
holes = unary_union([LineString(P(h['line'])).buffer(REACH / mpp) for h in c['holes']])
ob = unary_union([Polygon(P(f['p'][0]), [P(r) for r in f['p'][1:]]).buffer(0) for f in c['features'] if f['t'] == 'ob'])
paths = unary_union([LineString(P([[q['lat'], q['lon']] for q in e['geometry']])).buffer(2.0 / mpp)
    for e in (json.load(open(osm_path))['elements'] if osm_path else [])
    if e.get('tags', {}).get('golf') == 'cartpath' or e.get('tags', {}).get('highway') in ('path', 'footway', 'service', 'track')
    if e.get('geometry') and len(e['geometry']) > 1])

cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
new = []
for cnt in cs:
    a = cv2.contourArea(cnt) * mpp * mpp
    if a < 12 or a > 2500: continue
    x, y, w, h = cv2.boundingRect(cnt)
    thick = dist[y:y + h, x:x + w].max() * 2 * mpp
    (_, _), (rw, rh), _ = cv2.minAreaRect(cnt)
    length = max(rw, rh) * mpp
    if thick < 2.2 or length / thick > 8: continue  # cart paths: thin and long
    if cv2.contourArea(cnt) / max(1, rw * rh) < 0.2: continue  # path bends and junctions
    blob = np.zeros((h, w), np.uint8); cv2.drawContours(blob, [cnt - [x, y]], -1, 1, -1); blob = blob > 0
    if V[y:y + h, x:x + w][blob].mean() < 220 or S[y:y + h, x:x + w][blob].mean() > 30: continue  # concrete is greyer than sand
    poly = Polygon(cnt.reshape(-1, 2)).buffer(0.6 / mpp).simplify(0.3 / mpp)  # soft sand edge
    cen = poly.representative_point()
    if not holes.contains(cen) or ob.contains(cen): continue
    if not paths.is_empty and poly.intersection(paths).area > 0.4 * poly.area: continue  # on a cart path
    new.append({'t': 'bunker', 'p': [[to_ll(px_, py_) for px_, py_ in poly.exterior.coords]]})

def in_view(f):  # inside the imagery and near one of this course's holes
    pts = P(f['p'][0])
    return all(0 <= x < Ww and 0 <= y < Hh for x, y in pts) and holes.contains(Polygon(pts).buffer(0).representative_point())
old = [f for f in c['features'] if f['t'] == 'bunker' and in_view(f)]
c['features'] = [f for f in c['features'] if not (f['t'] == 'bunker' and in_view(f))] + new
json.dump(c, open(out, 'w'), separators=(',', ':'))
print(f'{len(old)} mapped bunkers replaced by {len(new)} found in the imagery')

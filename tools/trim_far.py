#!/usr/bin/env python3
"""Drop what isn't part of the course from a course file: short courses, practice holes, ranges
and practice greens that sit inside the same OpenStreetMap boundary. A green more than GREEN_M
from every pin, and a bunker, fairway or tee more than OTHER_M from every hole line, goes; ponds
stay (hazards either way). With a box, only shapes whose middle is inside it are looked at.

Usage: trim_far.py course.json [GREEN_M=15] [OTHER_M=45] [S,W,N,E|-] [other.json ...]
Other course files on the same ground (Stonebriar's two courses) add their holes, so neither
course's shapes are taken for practice ones.
"""
import json, math, sys
from shapely.geometry import LineString, Point, Polygon
p = sys.argv[1]; d = json.load(open(p))
G = float(sys.argv[2]) if len(sys.argv) > 2 else 15; O = float(sys.argv[3]) if len(sys.argv) > 3 else 45
box = tuple(map(float, sys.argv[4].split(','))) if len(sys.argv) > 4 and sys.argv[4] != '-' else None
holes = d['holes'] + [h for q in sys.argv[5:] for h in json.load(open(q))['holes']]
K = 111320 * math.cos(math.radians(d['holes'][0]['pin'][0])); xy = lambda q: (q[1] * K, q[0] * 110574)
lines = [LineString([xy(q) for q in h['line']]) for h in holes]; pins = [Point(xy(h['pin'])) for h in holes]
def keep(f):
    if f['t'] not in ('green', 'bunker', 'fairway', 'tee'): return True
    c = Polygon([xy(q) for q in f['p'][0]]).buffer(0).representative_point()
    if box and not (box[0] <= c.y / 110574 <= box[2] and box[1] <= c.x / K <= box[3]): return True
    if f['t'] == 'green': return min(q.distance(c) for q in pins) <= G
    return min(l.distance(c) for l in lines) <= O
n = len(d['features']); d['features'] = [f for f in d['features'] if keep(f)]
json.dump(d, open(p, 'w'), separators=(',', ':')); print(p, n - len(d['features']), 'dropped')

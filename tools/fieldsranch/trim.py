#!/usr/bin/env python3
"""Drop what isn't part of the East or West courses from both course files: The Swing
(the short course), the range targets and practice greens all sit inside the East's
OpenStreetMap boundary. A green more than 15 m from every pin and a bunker, fairway or
tee more than 60 m from every hole line (of either course) goes; the courses' own
shapes are all well within that.

Usage: trim.py ../data/fieldsranch-east.json ../data/fieldsranch-west.json
"""
import json, math, sys
from shapely.geometry import LineString, Point
D = {p: json.load(open(p)) for p in sys.argv[1:]}
holes = [h for d in D.values() for h in d['holes']]
K = 111320 * math.cos(math.radians(holes[0]['pin'][0])); xy = lambda q: (q[1] * K, q[0] * 110574)
lines = [LineString([xy(q) for q in h['line']]) for h in holes]; pins = [Point(xy(h['pin'])) for h in holes]
def keep(f):
    if f['t'] not in ('green', 'bunker', 'fairway', 'tee'): return True
    r = f['p'][0]; c = Point(sum(xy(q)[0] for q in r) / len(r), sum(xy(q)[1] for q in r) / len(r))
    if f['t'] == 'green': return min(p.distance(c) for p in pins) <= 15
    return min(l.distance(c) for l in lines) <= 60
for p, d in D.items():
    n = len(d['features']); d['features'] = [f for f in d['features'] if keep(f)]
    json.dump(d, open(p, 'w'), separators=(',', ':')); print(p, n - len(d['features']), 'dropped')

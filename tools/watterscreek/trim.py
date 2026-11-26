#!/usr/bin/env python3
"""Drop what isn't part of the Traditions course: The Futures (the 9-hole short course), the
practice holes, the range and the practice greens all sit inside the same OpenStreetMap boundary,
east of #1 and #18. A green more than 15 m from every pin and a bunker, fairway or tee more than
45 m from every hole line goes; ponds stay (they are hazards either way).

Usage: trim.py ../data/watterscreek.json
"""
import json, math, sys
from shapely.geometry import LineString, Point, Polygon
p = sys.argv[1]; d = json.load(open(p))
K = 111320 * math.cos(math.radians(d['holes'][0]['pin'][0])); xy = lambda q: (q[1] * K, q[0] * 110574)
lines = [LineString([xy(q) for q in h['line']]) for h in d['holes']]; pins = [Point(xy(h['pin'])) for h in d['holes']]
def keep(f):
    if f['t'] not in ('green', 'bunker', 'fairway', 'tee'): return True
    c = Polygon([xy(q) for q in f['p'][0]]).buffer(0).representative_point()
    if f['t'] == 'green': return min(q.distance(c) for q in pins) <= 15
    return min(l.distance(c) for l in lines) <= 45
n = len(d['features']); d['features'] = [f for f in d['features'] if keep(f)]
json.dump(d, open(p, 'w'), separators=(',', ':')); print(p, n - len(d['features']), 'dropped')

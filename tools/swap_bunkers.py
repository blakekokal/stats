#!/usr/bin/env python3
"""Replace a course file's bunkers with those hazards_from_imagery.py found, keeping everything
else (greens, fairways, tee boxes, ponds, hole lines) as it was, and cut the new bunkers out of
any green they overlap (a green that predates the bunkers would otherwise hold sand). For courses
whose mapped bunkers predate a renovation (TPC Craig Ranch: OSM's are from 2019, before the
2020-21 rebuild).
Usage: swap_bunkers.py course.json imagery.json out.json"""
import json, math, sys
from shapely.geometry import Polygon
from shapely.ops import unary_union
a, b = (json.load(open(p)) for p in sys.argv[1:3])
new = [f for f in b['features'] if f['t'] == 'bunker']
K = 111320 * math.cos(math.radians(a['holes'][0]['pin'][0]))
xy = lambda q: (q[1] * K, q[0] * 110574); back = lambda x, y: [round(y / 110574, 6), round(x / K, 6)]
sand = unary_union([Polygon([xy(q) for q in f['p'][0]]).buffer(0) for f in new])
feats, cut = [], 0
for f in a['features']:
    if f['t'] == 'bunker': continue
    if f['t'] == 'green':
        g = Polygon([xy(q) for q in f['p'][0]], [[xy(q) for q in r] for r in f['p'][1:]]).buffer(0)
        if g.intersection(sand).area > 1:
            g = g.difference(sand.buffer(0.3)); cut += 1
            g = max(getattr(g, 'geoms', [g]), key=lambda p: p.area)
            f = {**f, 'p': [[back(x, y) for x, y in r.coords] for r in [g.exterior, *g.interiors]]}
    feats.append(f)
a['features'] = feats + new
json.dump(a, open(sys.argv[3], 'w'), separators=(',', ':'))
print(len(new), 'bunkers;', cut, 'greens had sand cut out')

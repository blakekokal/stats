#!/usr/bin/env python3
"""Tidy a course file so its surfaces don't overlap.

Usage: clean_course.py course.json

Fairways (including green surrounds) are merged into single shapes, greens
likewise, and bunkers, water and greens are cut out of the fairways, so each
spot has one outline. Thin slivers and spurs under SLIVER metres are removed.
"""
import json, math, sys
from shapely.geometry import Polygon
from shapely.ops import unary_union

SLIVER = 1.5  # metres
path = sys.argv[1]
c = json.load(open(path))
lat0 = c['holes'][0]['tee'][0]
k, M = math.cos(math.radians(lat0)), 111320
xy = lambda q: (q[1] * M * k, q[0] * M)
back = lambda x, y: [round(y / M, 6), round(x / (M * k), 6)]
def shape(f): return Polygon([xy(q) for q in f['p'][0]], [[xy(q) for q in r] for r in f['p'][1:]]).buffer(0)
def feats(t, geom):
    out = []
    for g in (geom.geoms if hasattr(geom, 'geoms') else [geom]):
        if g.geom_type != 'Polygon' or g.area < 4: continue
        g = g.simplify(0.25)
        out.append({'t': t, 'p': [[back(x, y) for x, y in r.coords] for r in [g.exterior, *g.interiors]]})
    return out
by = lambda t: [f for f in c['features'] if f['t'] == t]
tidy = lambda g: g.buffer(-SLIVER / 2, join_style=1).buffer(SLIVER / 2, join_style=1)
greens = tidy(unary_union([shape(f) for f in by('green')]))
sand = unary_union([shape(f) for f in by('bunker')])
water = unary_union([shape(f) for f in by('water')])
fair = tidy(unary_union([shape(f) for f in by('fairway')]).difference(greens).difference(sand).difference(water))
before = len(by('fairway')), len(by('green'))
rest = [f for f in c['features'] if f['t'] not in ('fairway', 'green')]
c['features'] = rest + feats('green', greens) + feats('fairway', fair)
json.dump(c, open(path, 'w'), separators=(',', ':'))
print(f'{path}: fairways {before[0]} -> {len(by("fairway"))}, greens {before[1]} -> {len(by("green"))}')

#!/usr/bin/env python3
"""Add only the bunkers named here from what bunkers_from_imagery.py found (its other finds
are often roofs, paths or bare ground). The course's own bunkers all stay: drop the ones on
grass with `drop` in the config instead, so a rebuild keeps that.

Usage: keep_found_bunkers.py course.json checked.json out.json lat,lng [lat,lng ...]
(checked.json is bunkers_from_imagery.py's output.) A find is added if its middle (mean of its
points) is within 5 m of a lat,lng given.
"""
import json, math, sys
a, b = (json.load(open(p)) for p in sys.argv[1:3])
want = [tuple(map(float, s.split(','))) for s in sys.argv[4:]]
key = lambda f: json.dumps(f['p'][0][:3])
old = {key(f) for f in a['features'] if f['t'] == 'bunker'}
def wanted(f):
    r = f['p'][0]; lat = sum(q[0] for q in r) / len(r); lng = sum(q[1] for q in r) / len(r)
    return any(math.hypot((lat - w[0]) * 110574, (lng - w[1]) * 111320 * math.cos(math.radians(lat))) < 5 for w in want)
add = [f for f in b['features'] if f['t'] == 'bunker' and key(f) not in old and wanted(f)]
a['features'] += add
json.dump(a, open(sys.argv[3], 'w'), separators=(',', ':'))
print(len(add), 'bunkers added;', sum(f['t'] == 'bunker' for f in a['features']), 'in all')

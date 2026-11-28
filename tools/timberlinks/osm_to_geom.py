#!/usr/bin/env python3
"""Turn an OpenStreetMap API export (api/0.6/map.json for a bbox round the course)
into the Overpass "out geom" files the shared scripts read.

Usage: osm_to_geom.py map.json   (writes ../timberlinks.osm.json, ../timberlinks.boundary.osm.json,
                                   ../timberlinks.roads_houses.osm.json)
A 9-hole course. OpenStreetMap has no hole lines, but its greens carry their hole number (ref; #1's is a
multipolygon): the hole lines are routed here, each from a tee box near the previous green to its own
green (the tee box within 250 m of the previous green whose distance to the green best fits the card's
Blue yards, never more than 4% over). Only shapes inside the course boundary (way 130805180) are kept.
"""
import json, sys, os
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union, polygonize
here = os.path.dirname(os.path.abspath(__file__))
NAME, REL, RTYPE = 'timberlinks', 130805180, 'way'
els = json.load(open(sys.argv[1]))['elements']
nodes = {e['id']: {'lat': e['lat'], 'lon': e['lon']} for e in els if e['type'] == 'node'}
ways = {e['id']: e for e in els if e['type'] == 'way'}
def geom(w): return [nodes[n] for n in w['nodes'] if n in nodes]
def as_way(w): return {'type': 'way', 'id': w['id'], 'tags': w.get('tags', {}), 'geometry': geom(w)}
def as_rel(r):
    return {'type': 'relation', 'id': r['id'], 'tags': r.get('tags', {}), 'members': [
        {'type': 'way', 'ref': m['ref'], 'role': m['role'], 'geometry': geom(ways[m['ref']])}
        for m in r['members'] if m['type'] == 'way' and m['ref'] in ways]}
conv = lambda e: as_way(e) if e['type'] == 'way' else as_rel(e)
def area_of(e):
    ws = [e] if e['type'] == 'way' else [ways[m['ref']] for m in e['members'] if m['type'] == 'way' and m['ref'] in ways and m.get('role', 'outer') in ('outer', '')]
    lines = [LineString([(p['lon'], p['lat']) for p in geom(w)]) for w in ws if len(geom(w)) >= 2]
    return unary_union(list(polygonize(unary_union(lines)))).buffer(0)
course = next(e for e in els if e['type'] == RTYPE and e['id'] == REL)
A = area_of(course)
feat, bound, roads = [], [conv(course)], []
for e in els:
    t = e.get('tags', {})
    if e['type'] == 'node': continue
    if t.get('golf') == 'hole':
        l = LineString([(p['lon'], p['lat']) for p in geom(e)])
        if A.intersection(l).length > 0.5 * l.length: feat.append(as_way(e))
        continue
    if (t.get('golf') or t.get('natural') == 'water') and t.get('golf') not in ('cartpath', 'clubhouse', 'rough', 'driving_range', 'path'):
        a = area_of(e)
        if not a.is_empty and A.contains(a.representative_point()): feat.append(conv(e))
    if e['type'] == 'way' and (t.get('highway') or t.get('building')): roads.append(as_way(e))
import math
BLUE = [480, 330, 380, 385, 193, 154, 391, 210, 520]
PAR = [5, 4, 4, 4, 3, 3, 4, 3, 5]
byid = {(e['type'], e['id']): e for e in els}
cen = lambda f: (lambda P: (P.centroid.y, P.centroid.x))(area_of(byid[(f['type'], f['id'])]))
greens = {int(f['tags']['ref']): cen(f) for f in feat if f['tags'].get('golf') == 'green' and f['tags'].get('ref', '').isdigit()}
tees = [cen(f) for f in feat if f['tags'].get('golf') == 'tee']
m = lambda a, b: math.hypot((a[0] - b[0]) * 110574, (a[1] - b[1]) * 111320 * math.cos(math.radians(a[0])))
for n in range(1, 10):
    g, prev = greens[n], greens[9 if n == 1 else n - 1]
    want = BLUE[n - 1] * 0.9144
    cands = [t for t in tees if m(t, prev) < 250 and m(t, g) < want * 1.04] or [t for t in tees if m(t, g) < want * 1.04]
    t = min(cands, key=lambda t: abs(m(t, g) - want))
    print(f'#{n}: tee {m(t, g) / 0.9144:.0f} yd from the green (card {BLUE[n - 1]}), {m(t, prev):.0f} m from #{9 if n == 1 else n - 1} green')
    feat.append({'type': 'way', 'id': -n, 'tags': {'golf': 'hole', 'ref': str(n), 'par': str(PAR[n - 1])},
                 'geometry': [{'lat': t[0], 'lon': t[1]}, {'lat': g[0], 'lon': g[1]}]})
dump = lambda name, x: json.dump({'elements': x}, open(os.path.join(here, '..', name), 'w'), separators=(',', ':'))
dump(f'{NAME}.osm.json', feat); dump(f'{NAME}.boundary.osm.json', bound); dump(f'{NAME}.roads_houses.osm.json', roads)
from collections import Counter
print(Counter(f['tags'].get('golf') or 'water' for f in feat), sorted((f['tags'].get('ref'), f['tags'].get('par')) for f in feat if f['tags'].get('golf') == 'hole'))

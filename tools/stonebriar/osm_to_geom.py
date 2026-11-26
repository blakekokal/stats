#!/usr/bin/env python3
"""Turn an OpenStreetMap API export (api/0.6/map.json round Stonebriar Country Club) into the
Overpass "out geom" files the shared scripts read: one feature file per course (both
courses' shapes inside the park's boundary, only that course's 18 hole lines), and the
boundary, roads and houses.

Usage: osm_to_geom.py map.json   (writes ../stonebriar-cc.osm.json, ../stonebriar-fazio.osm.json,
                                   ../stonebriar.boundary.osm.json, ../stonebriar.roads_houses.osm.json)
One boundary (relation 3652901) holds both courses. OpenStreetMap's hole lines carry no
course name: the Country Club course's 18 are ways 1071122469-1071122486, the Fazio course's
the rest (1071122851, 1071122852, 1071143264-1071143279); their pars and lengths match each card.
"""
import json, sys, os
from shapely.geometry import LineString
from shapely.ops import unary_union, polygonize
here = os.path.dirname(os.path.abspath(__file__))
REL, RTYPE = 3652901, 'relation'
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
shapes, holes, bound, roads = [], {'cc': [], 'fazio': []}, [conv(course)], []
for e in els:
    t = e.get('tags', {})
    if e['type'] == 'node': continue
    if t.get('golf') == 'hole':
        holes['cc' if 1071122469 <= e['id'] <= 1071122486 else 'fazio'].append(as_way(e)); continue
    if (t.get('golf') or t.get('natural') == 'water') and t.get('golf') not in ('cartpath', 'clubhouse', 'rough', 'driving_range', 'path'):
        a = area_of(e)
        if not a.is_empty and A.contains(a.representative_point()): shapes.append(conv(e))
    if e['type'] == 'way' and (t.get('highway') or t.get('building')): roads.append(as_way(e))
dump = lambda name, x: json.dump({'elements': x}, open(os.path.join(here, '..', name), 'w'), separators=(',', ':'))
for k in holes: dump(f'stonebriar-{k}.osm.json', shapes + holes[k])
dump('stonebriar.boundary.osm.json', bound); dump('stonebriar.roads_houses.osm.json', roads)
from collections import Counter
print({k: len(v) for k, v in holes.items()}, Counter(f['tags'].get('golf') or 'water' for f in shapes))

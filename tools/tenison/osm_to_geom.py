#!/usr/bin/env python3
"""Turn an OpenStreetMap API export (api/0.6/map.json round Tenison Park) into the
Overpass "out geom" files the shared scripts read: one feature file per course (both
courses' shapes inside the park's boundary, only that course's 18 hole lines), and the
boundary, roads and houses.

Usage: osm_to_geom.py map.json   (writes ../tenison-highlands.osm.json, ../tenison-glen.osm.json,
                                   ../tenison.boundary.osm.json, ../tenison.roads_houses.osm.json)
One boundary (way 465004152) holds both courses. OpenStreetMap's hole lines carry no
course name: the Highlands' 18 (the west half, ways 721062299-721267437) were mapped in
2019, the Glen's (the east half, ways 1449293614-1449293705) in 2025; their handicap tags
match each club card.
"""
import json, sys, os
from shapely.geometry import LineString
from shapely.ops import unary_union, polygonize
here = os.path.dirname(os.path.abspath(__file__))
REL, RTYPE = 465004152, 'way'
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
shapes, holes, bound, roads = [], {'highlands': [], 'glen': []}, [conv(course)], []
for e in els:
    t = e.get('tags', {})
    if e['type'] == 'node': continue
    if t.get('golf') == 'hole':
        holes['highlands' if e['id'] < 1000000000 else 'glen'].append(as_way(e)); continue
    if (t.get('golf') or t.get('natural') == 'water') and t.get('golf') not in ('cartpath', 'clubhouse', 'rough', 'driving_range', 'path'):
        a = area_of(e)
        if not a.is_empty and A.contains(a.representative_point()): shapes.append(conv(e))
    if e['type'] == 'way' and (t.get('highway') or t.get('building')): roads.append(as_way(e))
dump = lambda name, x: json.dump({'elements': x}, open(os.path.join(here, '..', name), 'w'), separators=(',', ':'))
for k in holes: dump(f'tenison-{k}.osm.json', shapes + holes[k])
dump('tenison.boundary.osm.json', bound); dump('tenison.roads_houses.osm.json', roads)
from collections import Counter
print({k: len(v) for k, v in holes.items()}, Counter(f['tags'].get('golf') or 'water' for f in shapes))

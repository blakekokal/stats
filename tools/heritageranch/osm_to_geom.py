#!/usr/bin/env python3
"""Turn an OpenStreetMap API export (api/0.6/map.json for a bbox round the course)
into the Overpass "out geom" files the shared scripts read.

Usage: osm_to_geom.py map.json   (writes ../heritageranch.osm.json, ../heritageranch.boundary.osm.json,
                                   ../heritageranch.roads_houses.osm.json)
OpenStreetMap has the course's 18 hole lines (with par). Only shapes and hole lines
inside the course boundary are kept: three ways, 570328263, 570328257 and 570328258, joined.
"""
import json, sys, os
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union, polygonize
here = os.path.dirname(os.path.abspath(__file__))
NAME, REL, RTYPE = 'heritageranch', 570328263, 'way'
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
parts = [next(e for e in els if e['type'] == 'way' and e['id'] == i) for i in (570328263, 570328257, 570328258)]
A = unary_union([area_of(w) for w in parts])
feat, roads = [], []
bound = [{'type': 'relation', 'id': 0, 'tags': {'leisure': 'golf_course', 'name': 'Heritage Ranch'},
          'members': [{'type': 'way', 'ref': w['id'], 'role': 'outer', 'geometry': geom(w)} for w in parts]}]  # add_ob.py reads one boundary
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
dump = lambda name, x: json.dump({'elements': x}, open(os.path.join(here, '..', name), 'w'), separators=(',', ':'))
dump(f'{NAME}.osm.json', feat); dump(f'{NAME}.boundary.osm.json', bound); dump(f'{NAME}.roads_houses.osm.json', roads)
from collections import Counter
print(Counter(f['tags'].get('golf') or 'water' for f in feat), sorted((f['tags'].get('ref'), f['tags'].get('par')) for f in feat if f['tags'].get('golf') == 'hole'))

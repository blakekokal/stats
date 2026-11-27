#!/usr/bin/env python3
"""Turn an OpenStreetMap API export (api/0.6/map.json for a bbox round the course)
into the Overpass "out geom" files the shared scripts read.

Usage: osm_to_geom.py map.json   (writes ../ridgeview.osm.json, ../ridgeview.boundary.osm.json,
                                   ../ridgeview.roads_houses.osm.json)
OpenStreetMap has 17 of the course's hole lines (with par and handicap). #18 has none: it is added
here from its back tee box (33.108153, -96.746229) through the middle of its mapped fairway (a dogleg
right) to the middle of its green (33.111399, -96.745791): 420 yards, the card's 423. Only shapes and hole lines
inside the course boundary (relation 9848761) are kept.
"""
import json, sys, os
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union, polygonize
here = os.path.dirname(os.path.abspath(__file__))
NAME, REL, RTYPE = 'ridgeview', 9848761, 'relation'
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
feat.append({'type': 'way', 'id': -18, 'tags': {'golf': 'hole', 'ref': '18', 'par': '4'},
             'geometry': [{'lat': 33.108153, 'lon': -96.746229}, {'lat': 33.11051, 'lon': -96.745287}, {'lat': 33.111399, 'lon': -96.745791}]})  # #18, missing in OSM
dump = lambda name, x: json.dump({'elements': x}, open(os.path.join(here, '..', name), 'w'), separators=(',', ':'))
dump(f'{NAME}.osm.json', feat); dump(f'{NAME}.boundary.osm.json', bound); dump(f'{NAME}.roads_houses.osm.json', roads)
from collections import Counter
print(Counter(f['tags'].get('golf') or 'water' for f in feat), sorted((f['tags'].get('ref'), f['tags'].get('par')) for f in feat if f['tags'].get('golf') == 'hole'))

#!/usr/bin/env python3
"""Turn an OpenStreetMap API export (api/0.6/map.json for a bbox round the course)
into the Overpass "out geom" files the shared scripts read.

Usage: osm_to_geom.py map.json   (writes ../lakepark-exec.osm.json,
                                   ../lakepark-exec.boundary.osm.json,
                                   ../lakepark-exec.roads_houses.osm.json)

The Executive and Championship courses share the grounds, so only what lies in the
Executive course's boundary (leisure=golf_course, way 336437861) is kept. OpenStreetMap
has the Executive course's nine hole lines (the ones with no handicap tag; the
Championship's carry one).
"""
import json, sys, os
from shapely.geometry import Polygon, LineString

BOUNDARY = 336437861
PRACTICE_GREEN = 662596713
here = os.path.dirname(os.path.abspath(__file__))
els = json.load(open(sys.argv[1]))['elements']
nodes = {e['id']: {'lat': e['lat'], 'lon': e['lon']} for e in els if e['type'] == 'node'}
ways = {e['id']: e for e in els if e['type'] == 'way'}
def geom(w): return [nodes[n] for n in w['nodes'] if n in nodes]
def as_way(w): return {'type': 'way', 'id': w['id'], 'tags': w.get('tags', {}), 'geometry': geom(w)}
def as_rel(r):
    return {'type': 'relation', 'id': r['id'], 'tags': r.get('tags', {}), 'members': [
        {'type': 'way', 'ref': m['ref'], 'role': m['role'], 'geometry': geom(ways[m['ref']])}
        for m in r['members'] if m['type'] == 'way' and m['ref'] in ways]}
def conv(e): return as_way(e) if e['type'] == 'way' else as_rel(e)
def pts(e):
    if e['type'] == 'way': return [(p['lon'], p['lat']) for p in geom(e)]
    return [(p['lon'], p['lat']) for m in e['members'] if m['type'] == 'way' and m['ref'] in ways for p in geom(ways[m['ref']])]
bnd = Polygon(pts(ways[BOUNDARY])).buffer(0.0001)  # ~10 m slack
def ours(e):
    p = pts(e)
    if not p: return False
    shape = LineString(p) if len(p) > 1 else None
    return shape is not None and bnd.contains(shape.centroid) and shape.intersection(bnd).length > 0.6 * shape.length

feat, bound, roads, holes = [], [], [], {}
for e in els:
    t = e.get('tags', {})
    if e['type'] == 'node': continue
    if e['id'] == BOUNDARY: bound.append(conv(e)); continue
    if t.get('golf') == 'hole':
        if 'handicap' not in t and ours(e): holes[t['ref']] = conv(e)
        continue
    if (t.get('golf') or t.get('natural') == 'water') and e['id'] != PRACTICE_GREEN and ours(e):
        feat.append(conv(e))
    if e['type'] == 'way' and (t.get('highway') or t.get('building')): roads.append(as_way(e))
assert sorted(holes, key=int) == [str(i) for i in range(1, 10)], sorted(holes)
feat += holes.values()
dump = lambda name, x: json.dump({'elements': x}, open(os.path.join(here, '..', name), 'w'), separators=(',', ':'))
dump('lakepark-exec.osm.json', feat); dump('lakepark-exec.boundary.osm.json', bound); dump('lakepark-exec.roads_houses.osm.json', roads)
from collections import Counter
print(Counter(f['tags'].get('golf') or f['tags'].get('natural') for f in feat))

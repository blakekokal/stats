#!/usr/bin/env python3
"""Turn an OpenStreetMap API export (api/0.6/map.json for a bbox round the course)
into the Overpass "out geom" files the shared scripts read.

Usage: osm_to_geom.py map.json   (writes ../maridoe.osm.json, ../maridoe.boundary.osm.json,
                                   ../maridoe.roads_houses.osm.json)
OpenStreetMap has the course's 18 hole lines, but numbered in another order than the club's card:
OSM's 9-12, 5, 6, 16, 17, 8 are the card's 1-9 and OSM's 1-4, 13, 14, 15, 7, 18 its 10-18 (pars, lengths
and the walk from each green to the next tee all fit; OSM tags #7, the card's 604-yard 17th, par 4).
Only shapes and hole lines inside the course boundary (way 321513687) are kept. Also writes
../maridoe.paths.osm.json (cart paths and paths, for fill_from_imagery.py --paths).
"""
import json, sys, os
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union, polygonize
here = os.path.dirname(os.path.abspath(__file__))
NAME, REL, RTYPE = 'maridoe', 321513687, 'way'
els = json.load(open(sys.argv[1]))['elements']
nodes = {e['id']: {'lat': e['lat'], 'lon': e['lon']} for e in els if e['type'] == 'node'}
ways = {e['id']: e for e in els if e['type'] == 'way'}
def geom(w): return [nodes[n] for n in w['nodes'] if n in nodes]
def as_way(w): return {'type': 'way', 'id': w['id'], 'tags': w.get('tags', {}), 'geometry': geom(w)}
def as_rel(r):
    return {'type': 'relation', 'id': r['id'], 'tags': r.get('tags', {}), 'members': [
        {'type': 'way', 'ref': m['ref'], 'role': m['role'], 'geometry': geom(ways[m['ref']])}
        for m in r['members'] if m['type'] == 'way' and m['ref'] in ways]}
CARD = {9: 1, 10: 2, 11: 3, 12: 4, 5: 5, 6: 6, 16: 7, 17: 8, 8: 9, 1: 10, 2: 11, 3: 12, 4: 13, 13: 14, 14: 15, 15: 16, 7: 17, 18: 18}
conv = lambda e: as_way(e) if e['type'] == 'way' else as_rel(e)
def area_of(e):
    ws = [e] if e['type'] == 'way' else [ways[m['ref']] for m in e['members'] if m['type'] == 'way' and m['ref'] in ways and m.get('role', 'outer') in ('outer', '')]
    lines = [LineString([(p['lon'], p['lat']) for p in geom(w)]) for w in ws if len(geom(w)) >= 2]
    return unary_union(list(polygonize(unary_union(lines)))).buffer(0)
course = next(e for e in els if e['type'] == RTYPE and e['id'] == REL)
A = area_of(course)
feat, bound, roads, paths = [], [conv(course)], [], []
for e in els:
    t = e.get('tags', {})
    if e['type'] == 'node': continue
    if t.get('golf') == 'hole':
        l = LineString([(p['lon'], p['lat']) for p in geom(e)])
        if A.intersection(l).length > 0.5 * l.length:
            w = as_way(e); w['tags'] = dict(w['tags'], ref=str(CARD[int(t['ref'])])); w['tags'].pop('par', None); feat.append(w)
        continue
    if (t.get('golf') or t.get('natural') == 'water') and t.get('golf') not in ('cartpath', 'clubhouse', 'rough', 'driving_range', 'path'):
        a = area_of(e)
        if not a.is_empty and A.contains(a.representative_point()): feat.append(conv(e))
    if e['type'] == 'way' and (t.get('highway') or t.get('building')): roads.append(as_way(e))
    if e['type'] == 'way' and (t.get('golf') == 'cartpath' or t.get('highway') in ('path', 'footway', 'service', 'track')): paths.append(as_way(e))
dump = lambda name, x: json.dump({'elements': x}, open(os.path.join(here, '..', name), 'w'), separators=(',', ':'))
dump(f'{NAME}.osm.json', feat); dump(f'{NAME}.boundary.osm.json', bound); dump(f'{NAME}.roads_houses.osm.json', roads); dump(f'{NAME}.paths.osm.json', paths)
from collections import Counter
print(Counter(f['tags'].get('golf') or 'water' for f in feat), sorted(int(f['tags'].get('ref')) for f in feat if f['tags'].get('golf') == 'hole'))

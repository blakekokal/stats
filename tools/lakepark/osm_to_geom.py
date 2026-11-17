#!/usr/bin/env python3
"""Turn an OpenStreetMap API export (api/0.6/map.json for a bbox round the course)
into the Overpass "out geom" files the shared scripts read, for the Championship
course only (the Executive course next door is left out).

Usage: osm_to_geom.py map.json   (writes ../lakepark.osm.json, ../lakepark.boundary.osm.json,
                                   ../lakepark.roads_houses.osm.json)
OpenStreetMap has the Championship course's 18 hole lines (with par and handicap).
"""
import json, sys, os
from shapely.geometry import Polygon, Point

CHAMP, EXEC = 336438232, 336437861  # the two leisure=golf_course ways
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
poly = lambda w: Polygon([(p['lon'], p['lat']) for p in geom(w)]).buffer(0)
champ, execu = poly(ways[CHAMP]), poly(ways[EXEC])
def pts(e):
    ws = [e] if e['type'] == 'way' else [ways[m['ref']] for m in e['members'] if m['type'] == 'way' and m['ref'] in ways]
    return [Point(p['lon'], p['lat']) for w in ws for p in geom(w)]
def executive(e):  # mostly inside the Executive course and not the Championship one
    ps = pts(e)
    return sum(execu.contains(p) and not champ.buffer(0.0001).contains(p) for p in ps) > len(ps) / 2
feat, bound, roads = [], [], []
for e in els:
    t = e.get('tags', {})
    if e['type'] == 'node': continue
    if (t.get('golf') or t.get('natural') == 'water') and t.get('golf') not in ('cartpath', 'clubhouse'):
        if t.get('golf') == 'hole' and not t.get('handicap'): continue  # the Executive's holes
        if t.get('golf') != 'hole' and executive(e): continue
        feat.append(as_way(e) if e['type'] == 'way' else as_rel(e))
    if e['id'] == CHAMP: bound.append(as_way(e))
    if e['type'] == 'way' and (t.get('highway') or t.get('building')): roads.append(as_way(e))
dump = lambda name, x: json.dump({'elements': x}, open(os.path.join(here, '..', name), 'w'), separators=(',', ':'))
dump('lakepark.osm.json', feat); dump('lakepark.boundary.osm.json', bound); dump('lakepark.roads_houses.osm.json', roads)
from collections import Counter
print(Counter(f['tags'].get('golf') or 'water' for f in feat))

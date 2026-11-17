#!/usr/bin/env python3
"""Turn OpenStreetMap API exports (api/0.6/map.json, in parts, round Indian Creek)
into the Overpass "out geom" files the shared scripts read. Both courses (Creek and
Lakes) share one boundary and one set of features; the hole lines carry
golf:course:name, which each course's config picks with "courseName".

Usage: osm_to_geom.py map1.json [map2.json ...]
  (writes ../indiancreek.osm.json, ../indiancreek.boundary.osm.json,
   ../indiancreek.roads_houses.osm.json)
"""
import json, sys, os
from shapely.geometry import Polygon, Point

PARK = 475716356  # leisure=golf_course "Indian Creek Golf Club" (both courses)
here = os.path.dirname(os.path.abspath(__file__))
els = {}
for f in sys.argv[1:]:
    for e in json.load(open(f))['elements']:
        els[(e['type'], e['id'])] = e
els = list(els.values())
nodes = {e['id']: {'lat': e['lat'], 'lon': e['lon']} for e in els if e['type'] == 'node'}
ways = {e['id']: e for e in els if e['type'] == 'way'}
def geom(w): return [nodes[n] for n in w['nodes'] if n in nodes]
def as_way(w): return {'type': 'way', 'id': w['id'], 'tags': w.get('tags', {}), 'geometry': geom(w)}
def as_rel(r):
    return {'type': 'relation', 'id': r['id'], 'tags': r.get('tags', {}), 'members': [
        {'type': 'way', 'ref': m['ref'], 'role': m['role'], 'geometry': geom(ways[m['ref']])}
        for m in r['members'] if m['type'] == 'way' and m['ref'] in ways]}
park = Polygon([(p['lon'], p['lat']) for p in geom(ways[PARK])]).buffer(0.0004)  # ~40 m slack
near = park.buffer(0.002)  # roads and houses within ~200 m
def pts(e):
    ws = [e] if e['type'] == 'way' else [ways[m['ref']] for m in e['members'] if m['type'] == 'way' and m['ref'] in ways]
    return [Point(p['lon'], p['lat']) for w in ws for p in geom(w)]
def ours(e):  # mostly inside Indian Creek (not Coyote Ridge or Castle Hills next door)
    ps = pts(e)
    return ps and sum(park.contains(p) for p in ps) > len(ps) / 2
feat, bound, roads = [], [], []
for e in els:
    t = e.get('tags', {})
    if e['type'] == 'node': continue
    if (t.get('golf') or t.get('natural') == 'water') and t.get('golf') not in ('cartpath', 'clubhouse', 'pin', 'path'):
        if ours(e):
            feat.append(as_way(e) if e['type'] == 'way' else as_rel(e))
    if e['type'] == 'way' and e['id'] == PARK: bound.append(as_way(e))
    if e['type'] == 'way' and (t.get('highway') or t.get('building')) and any(near.contains(p) for p in pts(e)):
        roads.append(as_way(e))
dump = lambda name, x: json.dump({'elements': x}, open(os.path.join(here, '..', name), 'w'), separators=(',', ':'))
dump('indiancreek.osm.json', feat); dump('indiancreek.boundary.osm.json', bound); dump('indiancreek.roads_houses.osm.json', roads)
from collections import Counter
print(Counter(f['tags'].get('golf') or 'water' for f in feat))

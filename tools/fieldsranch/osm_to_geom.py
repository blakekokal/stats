#!/usr/bin/env python3
"""Turn an OpenStreetMap API export (api/0.6/map.json round both Fields Ranch courses)
into the Overpass "out geom" files the shared scripts read: one feature file per course
(both courses' shapes inside their boundaries, only that course's 18 hole lines), and the boundary, roads and houses.

Usage: osm_to_geom.py map.json   (writes ../fieldsranch-east.osm.json, ../fieldsranch-west.osm.json,
                                   ../fieldsranch.boundary.osm.json, ../fieldsranch.roads_houses.osm.json)
OpenStreetMap's hole lines carry no course name; each set of 18 lies inside its own
course's boundary (Fields Ranch - East Course / - West Course), which tells them apart.
"""
import json, sys, os
from shapely.geometry import Polygon, LineString
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
conv = lambda e: as_way(e) if e['type'] == 'way' else as_rel(e)
area = {e['tags']['name'].split(' - ')[1].split()[0].lower(): Polygon([(p['lon'], p['lat']) for p in geom(e)]).buffer(0)
        for e in els if e['type'] == 'way' and e.get('tags', {}).get('leisure') == 'golf_course'}
shapes, holes, bound, roads = [], {k: [] for k in area}, [], []
for e in els:
    t = e.get('tags', {})
    if e['type'] == 'node': continue
    if t.get('golf') == 'hole':
        l = LineString([(p['lon'], p['lat']) for p in geom(e)])
        k = max(area, key=lambda k: area[k].intersection(l).length); holes[k].append(as_way(e)); continue
    if (t.get('golf') or t.get('natural') == 'water') and t.get('golf') not in ('cartpath', 'clubhouse', 'rough', 'driving_range', 'path'):
        pts = [(p['lon'], p['lat']) for w in ([e] if e['type'] == 'way' else [ways[m['ref']] for m in e['members'] if m['type'] == 'way' and m['ref'] in ways]) for p in geom(w)]
        if pts and any(a.contains(Polygon(pts).buffer(0).representative_point()) if len(pts) >= 3 else False for a in area.values()):
            shapes.append(conv(e))  # only the two courses (not the range, The Swing or ponds outside)
    if t.get('leisure') == 'golf_course': bound.append(conv(e))
    if e['type'] == 'way' and (t.get('highway') or t.get('building')): roads.append(as_way(e))
dump = lambda name, x: json.dump({'elements': x}, open(os.path.join(here, '..', name), 'w'), separators=(',', ':'))
for k in holes: dump(f'fieldsranch-{k}.osm.json', shapes + holes[k])
bound = [{'type': 'relation', 'id': 0, 'tags': {'leisure': 'golf_course', 'name': 'Fields Ranch'},
          'members': [{'type': 'way', 'ref': b['id'], 'role': 'outer', 'geometry': b['geometry']} for b in bound]}]  # add_ob.py reads one boundary: both courses as one
dump('fieldsranch.boundary.osm.json', bound); dump('fieldsranch.roads_houses.osm.json', roads)
from collections import Counter
print({k: len(v) for k, v in holes.items()}, Counter(f['tags'].get('golf') or 'water' for f in shapes))

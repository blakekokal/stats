#!/usr/bin/env python3
"""The Firewheel Golf Park boundary (all three courses), roads and houses from an
OpenStreetMap API export, as the Overpass "out geom" files add_ob.py reads.

Usage: osm_boundary.py map.json   (writes ../firewheel-lakes.boundary.osm.json, ../firewheel-lakes.roads_houses.osm.json)
"""
import json, sys, os
here = os.path.dirname(os.path.abspath(__file__))
els = json.load(open(sys.argv[1]))['elements']
nodes = {e['id']: {'lat': e['lat'], 'lon': e['lon']} for e in els if e['type'] == 'node'}
ways = {e['id']: e for e in els if e['type'] == 'way'}
geom = lambda w: [nodes[n] for n in w['nodes'] if n in nodes]
way = lambda w: {'type': 'way', 'id': w['id'], 'tags': w.get('tags', {}), 'geometry': geom(w)}
rel = lambda r: {'type': 'relation', 'id': r['id'], 'tags': r.get('tags', {}), 'members': [
    {'type': 'way', 'ref': m['ref'], 'role': m['role'], 'geometry': geom(ways[m['ref']])} for m in r['members'] if m['type'] == 'way' and m['ref'] in ways]}
bound = [way(e) if e['type'] == 'way' else rel(e) for e in els if e['type'] != 'node' and e.get('tags', {}).get('leisure') == 'golf_course']
roads = [way(e) for e in els if e['type'] == 'way' and (e.get('tags', {}).get('highway') or e.get('tags', {}).get('building'))]
dump = lambda name, x: json.dump({'elements': x}, open(os.path.join(here, '..', name), 'w'), separators=(',', ':'))
dump('firewheel-lakes.boundary.osm.json', bound); dump('firewheel-lakes.roads_houses.osm.json', roads)
print(len(bound), 'boundary,', len(roads), 'roads and buildings;', [len(b.get('members', [])) for b in bound], 'members')

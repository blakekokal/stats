#!/usr/bin/env python3
"""The course boundary, roads and houses from an OpenStreetMap API export, as the
Overpass "out geom" files add_ob.py reads (OpenStreetMap has only the boundary here).

Usage: osm_boundary.py map.json   (writes ../coyoteridge.boundary.osm.json, ../coyoteridge.roads_houses.osm.json)
"""
import json, sys, os
here = os.path.dirname(os.path.abspath(__file__))
els = json.load(open(sys.argv[1]))['elements']
nodes = {e['id']: {'lat': e['lat'], 'lon': e['lon']} for e in els if e['type'] == 'node'}
way = lambda w: {'type': 'way', 'id': w['id'], 'tags': w.get('tags', {}), 'geometry': [nodes[n] for n in w['nodes'] if n in nodes]}
bound = [way(e) for e in els if e['type'] == 'way' and e.get('tags', {}).get('leisure') == 'golf_course']
roads = [way(e) for e in els if e['type'] == 'way' and (e.get('tags', {}).get('highway') or e.get('tags', {}).get('building'))]
dump = lambda name, x: json.dump({'elements': x}, open(os.path.join(here, '..', name), 'w'), separators=(',', ':'))
dump('coyoteridge.boundary.osm.json', bound); dump('coyoteridge.roads_houses.osm.json', roads)
print(len(bound), 'boundary,', len(roads), 'roads and buildings;', [len(b['geometry']) for b in bound], 'points')

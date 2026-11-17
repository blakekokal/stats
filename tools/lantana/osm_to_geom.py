#!/usr/bin/env python3
"""Turn an OpenStreetMap API export (api/0.6/map.json for a bbox round the course)
into the Overpass "out geom" files the shared scripts read, and add the hole lines.

Usage: osm_to_geom.py map.json   (writes ../lantana.osm.json, ../lantana.boundary.osm.json,
                                   ../lantana.roads_houses.osm.json)

Overpass was down when this course was built, so the plain OSM API was used.
OpenStreetMap has no hole lines here, so each hole's line is made from holes.py:
the back tee (of the hole's tee boxes, the one farthest from the green) to the
middle of the green, bending where the fairway does: a par 4 bends at about
245 yd from the back tee, a par 5 there and again 220 yd further on, each bend at
the middle of the fairway on that arc (no bend if it's within 5 m of straight);
holes.BENDS gives a hole's bends by hand instead.
"""
import json, math, sys, os
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union
from holes import HOLES, PRACTICE_GREEN, BENDS

PAR = [4,4,5,3,4,4,5,3,4, 4,3,4,5,4,3,5,4,4]
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
lat0 = els[0].get('lat', 33.09) if els[0]['type'] == 'node' else 33.09
KX, KY = 111320 * math.cos(math.radians(33.09)), 110574
xy = lambda p: (p['lon'] * KX, p['lat'] * KY)
back = lambda x, y: {'lat': y / KY, 'lon': x / KX}

feat, bound, roads = [], [], []
for e in els:
    t = e.get('tags', {})
    if e['type'] == 'node': continue
    if t.get('golf') or t.get('natural') == 'water':
        if e['id'] == PRACTICE_GREEN: continue
        feat.append(conv(e))
    if t.get('leisure') == 'golf_course': bound.append(conv(e))
    if e['type'] == 'way' and (t.get('highway') or t.get('building')): roads.append(as_way(e))

def poly(w): return Polygon([xy(p) for p in geom(w)])
fairway = unary_union([poly(ways[m['ref']]) if e['type'] == 'relation' else poly(e)
                       for e in els if e.get('tags', {}).get('golf') == 'fairway'
                       for m in (e['members'] if e['type'] == 'relation' else [None])
                       if e['type'] == 'way' or (m['type'] == 'way' and m['ref'] in ways and m['role'] != 'inner')]).buffer(0)
for n, (tees, green) in HOLES.items():
    g = poly(ways[green]).centroid
    t = max((poly(ways[i]).centroid for i in tees), key=lambda c: c.distance(g))
    pts = [t]
    steps = [] if n in BENDS else {4: [224], 5: [224, 425]}.get(PAR[n - 1], [])
    pts += [Point(xy({'lat': a, 'lon': b})) for a, b in BENDS.get(n, [])]
    for R in steps:
        a = pts[0]
        if a.distance(g) - R < 90: break
        ring = a.buffer(R, 256).exterior.intersection(fairway)
        straight = LineString([pts[-1], g])
        aim = straight.interpolate(R - pts[-1].distance(a) if len(pts) > 1 else R)
        cands = [s for s in getattr(ring, 'geoms', [ring]) if not s.is_empty and s.length > 8]
        if not cands: continue
        seg = min(cands, key=lambda s: s.distance(aim))
        if seg.distance(aim) > 60: continue
        b = seg.interpolate(0.5, normalized=True)
        if LineString([pts[-1], g]).distance(b) > 5: pts.append(b)
    pts.append(g)
    feat.append({'type': 'way', 'id': -n, 'tags': {'golf': 'hole', 'ref': str(n), 'par': str(PAR[n - 1])},
                 'geometry': [back(p.x, p.y) for p in pts]})
    print(n, PAR[n - 1], len(pts), round(sum(pts[i].distance(pts[i + 1]) for i in range(len(pts) - 1)) / 0.9144), 'yd')
dump = lambda name, x: json.dump({'elements': x}, open(os.path.join(here, '..', name), 'w'), separators=(',', ':'))
dump('lantana.osm.json', feat); dump('lantana.boundary.osm.json', bound); dump('lantana.roads_houses.osm.json', roads)

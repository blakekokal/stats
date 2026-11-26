#!/usr/bin/env python3
"""Drop the 9-hole par-3 course's shapes from Shady Oaks: a green, tee, bunker or fairway goes when it
lies nearer one of the par-3 course's hole lines (the unnamed ones in the OSM export) than any of the
main course's, or is a green more than 15 m from every main pin (practice greens).

Usage: trim_par3.py map.json ../data/shadyoaks.json   (map.json: the OSM API export)
"""
import json, math, sys
from shapely.geometry import LineString, Point, Polygon
els = json.load(open(sys.argv[1]))['elements']; p = sys.argv[2]; d = json.load(open(p))
nodes = {e['id']: (e['lat'], e['lon']) for e in els if e['type'] == 'node'}
sh = json.load(open('shadyoaks.config.json'))['shift']
dla = sh['north'] / 111320; dlo = sh['east'] / (111320 * math.cos(math.radians(32.75)))
K = 111320 * math.cos(math.radians(d['holes'][0]['pin'][0])); xy = lambda q: (q[1] * K, q[0] * 110574)
par3 = [LineString([xy((nodes[n][0] + dla, nodes[n][1] + dlo)) for n in e['nodes'] if n in nodes]) for e in els
        if e['type'] == 'way' and e.get('tags', {}).get('golf') == 'hole' and not e['tags'].get('name', '').startswith('SOCC')
        and 1513890714 <= e['id'] <= 1513890722]
main = [LineString([xy(q) for q in h['line']]) for h in d['holes']]; pins = [Point(xy(h['pin'])) for h in d['holes']]
def keep(f):
    if f['t'] not in ('green', 'bunker', 'fairway', 'tee'): return True
    P = Polygon([xy(q) for q in f['p'][0]]).buffer(0); c = P.representative_point()
    if f['t'] == 'green' and min(q.distance(c) for q in pins) > 15: return False
    return min(l.distance(c) for l in main) <= min(l.distance(c) for l in par3) + 5
n = len(d['features']); d['features'] = [f for f in d['features'] if keep(f)]
json.dump(d, open(p, 'w'), separators=(',', ':')); print(len(par3), 'par-3 holes;', n - len(d['features']), 'shapes dropped')

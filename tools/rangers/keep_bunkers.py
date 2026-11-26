#!/usr/bin/env python3
"""After bunkers_from_imagery.py: take out its finds that aren't bunkers (paths, roofs, a pile of
brush), keeping only the round fairway bunker at 32.777006, -97.097658 (between #12 and #17).
Usage: keep_bunkers.py before.json checked.json out.json"""
import json, sys
a, b = (json.load(open(p)) for p in sys.argv[1:3])
key = lambda f: json.dumps(f['p'][0][:3])
old = {key(f) for f in a['features'] if f['t'] == 'bunker'}
def is_keeper(f):
    n = len(f['p'][0]); lat = sum(q[0] for q in f['p'][0]) / n; lng = sum(q[1] for q in f['p'][0]) / n
    return abs(lat - 32.777006) < 0.00005 and abs(lng + 97.097658) < 0.00005
b['features'] = [f for f in b['features'] if f['t'] != 'bunker' or key(f) in old or is_keeper(f)]
json.dump(b, open(sys.argv[3], 'w'), separators=(',', ':'))
print(sum(f['t'] == 'bunker' for f in b['features']), 'bunkers')

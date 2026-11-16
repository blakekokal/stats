# Merges a course file's small round trees that stand 2-5 together into one
# bigger tree each (tree_circles.merge_small). Other trees and shapes are kept.
#   python3 merge_trees.py ../data/<id>.json out.json
import json, math, sys
import tree_circles
src, out = sys.argv[1:3]
d = json.load(open(src))
lat0 = d['holes'][0]['pin'][0]; KX = 111320 * math.cos(math.radians(lat0)); KY = 110574
def circle(f):  # a round tree as (x, y, r) in metres, or None
    r = f['p'][0][:-1] if f['p'][0][0] == f['p'][0][-1] else f['p'][0]
    if len(f['p']) > 1 or len(r) < 8: return None
    pts = [(q[1] * KX, q[0] * KY) for q in r]; cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
    ds = [math.dist((cx, cy), p) for p in pts]; m = sum(ds) / len(ds)
    return (cx, cy, m) if max(ds) - min(ds) < 0.15 * m else None
trees = [(f, circle(f)) for f in d['features'] if f['t'] == 'trees']
round_ = [c for f, c in trees if c]
merged = tree_circles.merge_small(round_, 1.0)
def feat(x, y, r):
    rg = tree_circles.ring(x, y, r)
    return {'t': 'trees', 'p': [[[round(q[1] / KY, 6), round(q[0] / KX, 6)] for q in rg + [rg[0]]]]}
d['features'] = [f for f in d['features'] if f['t'] != 'trees'] + [f for f, c in trees if not c] + [feat(*c) for c in merged]
json.dump(d, open(out, 'w'), separators=(',', ':'))
print(len(trees), 'trees ->', len(merged) + sum(1 for f, c in trees if not c), f'({len(round_)} round, {len(trees) - len(round_)} other shapes kept)')

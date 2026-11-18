#!/usr/bin/env python3
"""Soften a course's outlines: greens, tee boxes, fairways, bunkers and water
become smooth, rounded shapes instead of jagged ones.

Usage: soften_shapes.py course.json [published-doc.json]

Each ring (in metres) loses its small zig-zags and kinks (simplified at
PRE metres), long edges are split at SEG metres (by kind) (so rounding stays near
each corner and no pond or creek loses its tip), then its corners are rounded (Chaikin: every pass cuts each
corner at 1/4 and 3/4), then points that add nothing are dropped (POST
metres), so a shape keeps about as many corners to edit as before. A shape
that would come out broken, or change size by more than 10%, is kept as it was.
Trees (circles already), OB and the course boundary are left alone.

With a published doc (the `doc` of the course's row in `course_edits`), the
owner's published outlines are the starting point, and the file gets a new
`builtAt` so the app uses the softened file instead of the old edits.
"""
import json, math, sys, time
from shapely.geometry import Polygon

PRE, PASSES, POST = 0.3, 3, 0.08
# Edge length (m) a long edge is split at, by kind: about how far from each corner
# the rounding reaches. Greens and fairways get wide curves; water stays tight
# so a creek keeps its tips.
SEG = {'green': 6, 'fairway': 6, 'tee': 3, 'bunker': 3, 'water': 2.5}
SOFT = {'green', 'tee', 'fairway', 'bunker', 'water'}

path = sys.argv[1]
c = json.load(open(path))
if len(sys.argv) > 2:
    doc = json.load(open(sys.argv[2]))
    feats = doc['features'] if doc.get('ob') else [f for f in doc['features'] if f['t'] != 'ob'] + [f for f in c['features'] if f['t'] == 'ob']
    c['features'] = feats
    c['builtAt'] = int(time.time() * 1000)

lat0 = c['holes'][0]['tee'][0]
k, M = math.cos(math.radians(lat0)), 111320
xy = lambda q: (q[1] * M * k, q[0] * M)
back = lambda p: [round(p[1] / M, 6), round(p[0] / (M * k), 6)]

def chaikin(pts):
    for _ in range(PASSES):
        out = []
        n = len(pts)
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]
            out += [(0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]), (0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1])]
        pts = out
    return pts

def soften(ring, t):
    pts = [xy(q) for q in ring]
    if pts[0] == pts[-1]: pts = pts[:-1]
    if len(pts) < 3: return None
    g = Polygon(pts)
    if not g.is_valid: g = g.buffer(0)
    if g.geom_type != 'Polygon' or g.area < 1: return None
    s = g.exterior.simplify(PRE).segmentize(SEG[t])  # short edges: a corner is only rounded near the corner
    q = list(s.coords)[:-1]
    if len(q) < 3: return None
    r = Polygon(chaikin(q)).exterior.simplify(POST)
    return list(r.coords)

def sharp(ring):  # corners turning more than 60 degrees
    p = [xy(q) for q in ring]
    if p[0] == p[-1]: p = p[:-1]
    n, t = len(p), 0
    for i in range(n):
        a, b, d = p[i - 1], p[i], p[(i + 1) % n]
        u, v = (b[0] - a[0], b[1] - a[1]), (d[0] - b[0], d[1] - b[1])
        if math.hypot(*u) and math.hypot(*v):
            ang = abs(math.degrees(math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])))
            t += ang > 60
    return t

done = kept = before = after = pts0 = pts1 = 0
for f in c['features']:
    if f['t'] not in SOFT: continue
    rings = []
    for ring in f['p']:
        before += sharp(ring); pts0 += len(ring)
        new = soften(ring, f['t'])
        old_a = Polygon([xy(q) for q in ring]).buffer(0).area if len(ring) >= 3 else 0
        if new and Polygon(new).is_valid and old_a and abs(Polygon(new).area / old_a - 1) < 0.1:
            ring2 = [back(p) for p in new]
            ring2.append(ring2[0])
            rings.append(ring2); done += 1
        else:
            rings.append(ring); kept += 1
        after += sharp(rings[-1]); pts1 += len(rings[-1])
    # A softened outer ring must still hold its holes.
    if len(rings) > 1:
        outer = Polygon([xy(q) for q in rings[0]])
        if not all(outer.contains(Polygon([xy(q) for q in r])) for r in rings[1:]): continue
    f['p'] = rings

json.dump(c, open(path, 'w'), separators=(',', ':'))
print(f'{path}: {done} outlines softened, {kept} kept as they were; sharp corners {before} -> {after}; points {pts0} -> {pts1}')

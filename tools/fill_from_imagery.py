#!/usr/bin/env python3
"""Fill gaps in a course file from the zoom-19 Esri imagery, for courses OpenStreetMap maps only in part.

  --fairways [N,N..|missing]  a fairway for each listed par 4/5 (or each with under 30% of its line on
        fairway: "missing"), from 40% of the way (at most 120 m) off the tee to 8 m short of the green.
        Each hole learns its own colours, as trace_turf.py does: fairway from a 12 m strip along the line,
        rough from a band 22-38 m out; a smooth pixel within 25 m of the line is fairway if it is nearer
        the fairway colour (green-red weighted most), joined to the strip, less greens, bunkers, water and cart paths (an OSM export given with --paths).
        A hole whose fairway can't be told from its rough gets none (and is reported).
  --tees  a 12 x 8 m tee box at the start of every hole line with no tee box within 15 m.
  --bunkers  bunkers where OSM has none: white sand (bright, unsaturated, brighter than its surroundings)
        inside the course (not in the OB area: run add_ob.py first, so roofs are left out), within 60 m
        of a hole line, 8 to 1500 m2, compact, off cart paths and greens. For courses whose bunkers are
        white in the imagery; check the result by eye.

Usage: fill_from_imagery.py course.json m19.png out.json [--fairways missing|1,2,5] [--tees] [--bunkers] [--paths export.json]
"""
import json, math, sys, cv2, numpy as np
from shapely.geometry import LineString, Polygon
src, img, out = sys.argv[1:4]; args = sys.argv[4:]
d = json.load(open(src)); im = cv2.imread(img); H, W = im.shape[:2]
Z, X0, Y0 = map(int, open(img + '.meta').read().split()); NN = 256 * 2 ** Z
lat0 = d['holes'][0]['pin'][0]; M = 156543.03392 * math.cos(math.radians(lat0)) / 2 ** Z
KY, KX = 110574.0, 111320 * math.cos(math.radians(lat0))
def px(p):
    lat, lng = p; gx = (lng + 180) / 360 * NN; gy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * NN
    return gx - X0 * 256, gy - Y0 * 256
def ll(x, y):
    gx, gy = x + X0 * 256, y + Y0 * 256
    return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / NN)))), 6), round(gx / NN * 360 - 180, 6)]
def off(p, e, n): return [round(p[0] + n / KY, 6), round(p[1] + e / KX, 6)]
def vec(a, b): return ((b[1] - a[1]) * KX, (b[0] - a[0]) * KY)
def dist(a, b): return math.hypot(*vec(a, b))
def along(a, b, m): x, y = vec(a, b); L = math.hypot(x, y); return off(a, x / L * m, y / L * m)
def cut(line, start, end):
    o, s = [], 0
    for a, b in zip(line, line[1:]):
        dd = dist(a, b)
        if s + dd >= start and s <= end:
            p = along(a, b, max(0, start - s)) if start > s else a
            q = along(a, b, min(dd, end - s)) if end < s + dd else b
            if not o: o.append(p)
            o.append(q)
        s += dd
    return o
xy = lambda q: (q[1] * KX, q[0] * KY)
poly = lambda f: Polygon([xy(q) for q in f['p'][0]]).buffer(0)
added = []
if '--fairways' in args:
    which = args[args.index('--fairways') + 1]
    fw = [poly(f) for f in d['features'] if f['t'] == 'fairway']
    def cover(h):
        l = LineString([xy(q) for q in h['line']]); return sum(f.intersection(l).length for f in fw) / l.length
    todo = [h for h in d['holes'] if h['par'] > 3 and (cover(h) < 0.3 if which == 'missing' else h['n'] in {int(x) for x in which.split(',')})]
    lab = cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32), (0, 0), 2)
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32); mu = cv2.blur(g, (9, 9)); sd = np.sqrt(np.maximum(cv2.blur(g * g, (9, 9)) - mu * mu, 0))
    smooth = sd < 10
    disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    wt = np.array([0.5, 2.0, 1.0], np.float32)
    block = np.zeros((H, W), np.uint8)
    for f in d['features']:
        if f['t'] in ('green', 'bunker', 'water'):
            cv2.fillPoly(block, [np.array([px(q) for q in f['p'][0]], np.int32)], 1)
    block = cv2.dilate(block, disk(int(1.5 / M)))
    if '--paths' in args:
        for e in json.load(open(args[args.index('--paths') + 1]))['elements']:
            t_ = e.get('tags', {})
            if e.get('geometry') and (t_.get('golf') == 'cartpath' or t_.get('highway') in ('path', 'footway', 'service', 'track')):
                cv2.polylines(block, [np.array([px((q['lat'], q['lon'])) for q in e['geometry']], np.int32)], False, 1, max(1, int(3 / M)))
    for h in todo:
        line = h['line']; D = sum(dist(a, b) for a, b in zip(line, line[1:]))
        seg = cut(line, min(120, D * 0.4), D - 8)
        band = lambda w: cv2.polylines(np.zeros((H, W), np.uint8), [np.array([px(p) for p in seg], np.int32)], False, 1, max(1, int(w / M))) > 0
        corr, core, ring = band(50), band(12), band(76) & ~band(44)
        ok = smooth & (block == 0)
        if (core & ok).sum() < 200 or (ring & ok).sum() < 200: added.append(f"#{h['n']}: no turf found"); continue
        t = np.median(lab[core & ok], 0); rr = ring & ok & (np.abs(lab[..., 1] - t[1]) > 1.5)
        o = np.median(lab[rr], 0) if rr.sum() > 200 else None
        if o is None or (abs(o[1] - t[1]) < 2.5 and abs(o[0] - t[0]) < 8): added.append(f"#{h['n']}: fairway not told from rough"); continue
        ys, xs = np.nonzero(corr); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        sub = lab[y0:y1, x0:x1]
        near = (((sub - t) * wt) ** 2).sum(-1) < (((sub - o) * wt) ** 2).sum(-1)
        m = np.zeros((H, W), np.uint8); m[y0:y1, x0:x1] = near & corr[y0:y1, x0:x1] & ok[y0:y1, x0:x1]
        m = cv2.medianBlur(m * 255, 5) // 255
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, disk(int(2 / M))); m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, disk(int(5 / M)))
        m = m & (block == 0)
        k, lb, st, _ = cv2.connectedComponentsWithStats(m); keep = np.zeros_like(m)
        for j in range(1, k):
            if st[j, 4] * M * M > 150 and (core & (lb == j)).any(): keep[lb == j] = 1
        cs, _ = cv2.findContours(keep, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); got = 0
        for c in cs:
            if cv2.contourArea(c) * M * M < 300: continue
            c = cv2.approxPolyDP(c, 1.0 / M, True); r = [ll(*q[0]) for q in c]
            d['features'].append({'t': 'fairway', 'p': [r + [r[0]]]}); got += cv2.contourArea(c) * M * M
        added.append(f"#{h['n']}: fairway {got:.0f} m2" if got else f"#{h['n']}: no turf found")
if '--tees' in args:
    tees = [poly(f) for f in d['features'] if f['t'] == 'tee']
    for h in d['holes']:
        t = h['line'][0]; P = Polygon([xy(t)] * 3).buffer(0.1) if False else None
        from shapely.geometry import Point
        if any(x.distance(Point(xy(t))) < 15 for x in tees): continue
        a, b = t, along(t, h['line'][1], 12); x, y = vec(a, b); Lr = math.hypot(x, y); nx, ny = -y / Lr * 4, x / Lr * 4
        r = [off(a, nx, ny), off(b, nx, ny), off(b, -nx, -ny), off(a, -nx, -ny)]
        d['features'].append({'t': 'tee', 'p': [r + [r[0]]]}); added.append(f"#{h['n']}: tee box")
if '--bunkers' in args:
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); Sat, V = hsv[..., 1].astype(np.float32), hsv[..., 2].astype(np.float32)
    lift = V - cv2.blur(V, (61, 61))
    sand = ((V > 190) & (Sat < 50) & (lift > 10)).astype(np.uint8)
    disk2 = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    sand = cv2.morphologyEx(sand, cv2.MORPH_OPEN, disk2(max(1, int(0.8 / M))))
    # OB features are a big box with the course cut out: fill the course holes back in
    obm = np.zeros((H, W), np.uint8)
    for f in d['features']:
        if f['t'] == 'ob':
            cv2.fillPoly(obm, [np.array([px(q) for q in f['p'][0]], np.int32)], 1)
            for r in f['p'][1:]: cv2.fillPoly(obm, [np.array([px(q) for q in r], np.int32)], 0)
    allow = np.zeros((H, W), np.uint8)
    for h in d['holes']: cv2.polylines(allow, [np.array([px(q) for q in h['line']], np.int32)], False, 1, int(120 / M))
    allow &= (1 - obm)
    bad = np.zeros((H, W), np.uint8)
    for f in d['features']:
        if f['t'] in ('green', 'tee', 'bunker'): cv2.fillPoly(bad, [np.array([px(q) for q in f['p'][0]], np.int32)], 1)
    if '--paths' in args:
        for e in json.load(open(args[args.index('--paths') + 1]))['elements']:
            if e.get('geometry'): cv2.polylines(bad, [np.array([px((q['lat'], q['lon'])) for q in e['geometry']], np.int32)], False, 1, max(1, int(3 / M)))
    sand &= allow
    cs, _ = cv2.findContours(sand, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); nb = 0
    for c in cs:
        a = cv2.contourArea(c) * M * M
        if a < 8 or a > 1500: continue
        (_, _), (rw, rh), _ = cv2.minAreaRect(c)
        if max(rw, rh) / max(1, min(rw, rh)) > 5 or cv2.contourArea(c) / max(1, rw * rh) < 0.35: continue  # paths
        blob = np.zeros((H, W), np.uint8); cv2.drawContours(blob, [c], -1, 1, -1)
        if (blob & bad).sum() > 0.3 * blob.sum(): continue
        c = cv2.approxPolyDP(c, 0.3 / M, True); r = [ll(*q[0]) for q in c]
        if len(r) < 4: continue
        d['features'].append({'t': 'bunker', 'p': [r + [r[0]]]}); nb += 1
    added.append(f"{nb} bunkers")
json.dump(d, open(out, 'w'), separators=(',', ':'))
print('; '.join(added) or 'nothing added')

#!/usr/bin/env python3
"""Add a green that the map lacks, grown in the zoom-19 imagery from a point on it: the pixels
within 30 m of the point whose colour (Lab) is close to the seed's (median of a 2 m disc),
connected to it, smoothed; kept 2 m inside the fairway (collar) round the point, if there is one. Use it where OSM has a hole line but no green (Stonebriar Fazio #7).

A hole whose line ends within 15 m of the new green's middle gets its pin there.

Usage: green_from_seed.py course.json m19.png out.json lat,lng [lat,lng ...] [--tol 9]
"""
import cv2, json, math, sys, numpy as np
args = [a for a in sys.argv[4:] if not a.startswith('--')]
tol = float(sys.argv[sys.argv.index('--tol') + 1]) if '--tol' in sys.argv else 9
if '--tol' in sys.argv: args = [a for a in args if a != sys.argv[sys.argv.index('--tol') + 1]]
d = json.load(open(sys.argv[1])); mos = sys.argv[2]
im = cv2.imread(mos); z, X0, Y0 = map(int, open(mos + '.meta').read().split()); N = 256 * 2 ** z
mpp = 156543.03 * math.cos(math.radians(d['holes'][0]['pin'][0])) / 2 ** z
def px(lat, lon):
    gx = (lon + 180) / 360 * N; gy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * N
    return gx - X0 * 256, gy - Y0 * 256
def ll(x, y):
    gx, gy = x + X0 * 256, y + Y0 * 256
    return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / N)))), 6), round(gx / N * 360 - 180, 6)]
lab = cv2.cvtColor(cv2.GaussianBlur(im, (5, 5), 0), cv2.COLOR_BGR2LAB).astype(np.float32)
for a in args:
    lat, lng = map(float, a.split(',')); x, y = map(int, px(lat, lng)); R = int(30 / mpp); r = max(2, int(2 / mpp))
    win = lab[y - R:y + R, x - R:x + R]
    yy, xx = np.ogrid[-R:R, -R:R]; disc = xx * xx + yy * yy <= r * r
    seed = np.median(win[disc], axis=0)
    m = (np.linalg.norm(win - seed, axis=2) < tol).astype(np.uint8) * (xx * xx + yy * yy <= R * R)
    for f in d['features']:  # stay inside the fairway (collar) the point is in
        if f['t'] != 'fairway': continue
        P = np.array([px(*q) for q in f['p'][0]]) - [x - R, y - R]
        if cv2.pointPolygonTest(P.astype(np.float32), (float(R), float(R)), False) > 0:
            fw = np.zeros_like(m); cv2.fillPoly(fw, [np.round(P).astype(np.int32)], 1)
            m = m * cv2.erode(fw, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * int(2 / mpp) + 1,) * 2))
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    n, lbl = cv2.connectedComponents(m); m = (lbl == lbl[R, R]).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); c = max(cs, key=cv2.contourArea)
    c = cv2.approxPolyDP(c, 0.4 / mpp, True).reshape(-1, 2)
    ring = [ll(x - R + p[0], y - R + p[1]) for p in c]; ring.append(ring[0])
    d['features'].append({'t': 'green', 'p': [ring]})
    n = len(ring) - 1; cen = [round(sum(q[0] for q in ring[:n]) / n, 6), round(sum(q[1] for q in ring[:n]) / n, 6)]
    for h in d['holes']:  # the hole whose line ends on this green gets its pin in the middle of it
        e = h['line'][-1]
        if math.hypot((e[0] - cen[0]) * 110574, (e[1] - cen[1]) * 111320 * math.cos(math.radians(cen[0]))) < 15:
            h['pin'] = cen; print(f'  #{h["n"]} pin moved to it')
    print(f'green at {lat},{lng}: {cv2.contourArea(c) * mpp * mpp:.0f} m2')
json.dump(d, open(sys.argv[3], 'w'), separators=(',', ':'))

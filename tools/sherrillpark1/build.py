# Builds data/sherrillpark1.json from the zoom-18 imagery (m18.png) and the hole lines (holes.py).
import cv2, numpy as np, json, math, sys
from holes import HOLES, TEES, PAR, HCP, MPP, NOT_SAND
im = cv2.imread('m18.png'); H, W = im.shape[:2]
Z, X0, Y0 = map(int, open('m18.png.meta').read().split()); N = 256 * 2 ** Z
lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
L, A, B = lab[..., 0] * 100 / 255, lab[..., 1] - 128, lab[..., 2] - 128
g = cv2.GaussianBlur(L, (0, 0), 1.0); m = cv2.blur(g, (9, 9)); sd = np.sqrt(np.maximum(cv2.blur(g * g, (9, 9)) - m * m, 0))
Lb, Ab, sb = cv2.blur(L, (7, 7)), cv2.blur(A, (7, 7)), cv2.blur(sd, (7, 7))
px = lambda v: max(1, int(round(v / MPP)))
disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
u8 = lambda a: a.astype(np.uint8) * 255
def ll(x, y):  # mosaic px -> [lat, lng]
    gx, gy = x + X0 * 256, y + Y0 * 256
    return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / N)))), 6), round(gx / N * 360 - 180, 6)]
def rings(mask, min_m2, eps_m, hole_m2=60):
    cs, hier = cv2.findContours(u8(mask), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    if hier is None: return out
    for i, c in enumerate(cs):
        if hier[0][i][3] != -1 or cv2.contourArea(c) * MPP * MPP < min_m2: continue
        rs, j = [c], hier[0][i][2]
        while j != -1:
            if cv2.contourArea(cs[j]) * MPP * MPP >= hole_m2: rs.append(cs[j])
            j = hier[0][j][0]
        poly = []
        for r in rs:
            r = cv2.approxPolyDP(r, max(0.6, eps_m / MPP), True)[:, 0, :]
            if len(r) >= 3: poly.append([[float(x), float(y)] for x, y in r.tolist()])
        if poly: out.append(poly)
    return out
# distance to the hole lines, and which hole is nearest
best = np.full((H, W), 1e9, np.float32); own = np.zeros((H, W), np.uint8)
for n, l in HOLES.items():
    li = np.full((H, W), 255, np.uint8); cv2.polylines(li, [np.array(l, np.int32)], False, 0, 1)
    d = cv2.distanceTransform(li, cv2.DIST_L2, 3); near = d < best; best[near] = d[near]; own[near] = n
dist = best * MPP
# water: dark and flat
muddy = (Lb > 30) & (Lb < 47.5) & (Ab > -18.5) & (sb < 0.75)  # the brown ponds: paler than turf is green, and flatter
water = cv2.morphologyEx(u8(((Lb < 34.5) & (sb < 1.6)) | (Lb < 17) | muddy), cv2.MORPH_OPEN, disk(px(3))) > 0
k, lb, st, _ = cv2.connectedComponentsWithStats(u8(water))
water = np.isin(lb, [i for i in range(1, k) if st[i, 4] * MPP * MPP > 250]) & (dist < 110)
water = cv2.morphologyEx(u8(water), cv2.MORPH_CLOSE, disk(px(7)))
FLAT = 0.3
cs, _ = cv2.findContours(water, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)  # algae and reflections leave gaps
flat = (((Lb < 34.5) & (sb < 1.6)) | muddy).astype(np.uint8)
def pond(c):  # tree shadow is as dark as a pond but never flat
    one = cv2.drawContours(np.zeros((H, W), np.uint8), [c], -1, 1, -1)
    return cv2.contourArea(c) * MPP * MPP > 500 and (flat & one).sum() / one.sum() > FLAT
water = cv2.drawContours(np.zeros((H, W), np.uint8), [c for c in cs if pond(c)], -1, 255, -1) > 0
# trees: dark, not water
trees = ((Lb < 34) | ((Lb < 41) & (sb > 2.2))) & ~(cv2.dilate(u8(water), disk(px(3))) > 0)
trees = cv2.morphologyEx(u8(trees), cv2.MORPH_CLOSE, disk(px(2.5)))
trees = cv2.morphologyEx(trees, cv2.MORPH_OPEN, disk(px(2))) > 0
# sand: bright and pale
sand = cv2.morphologyEx(u8((L > 70) & (A > -8) & (B > 2) & (B < 28)), cv2.MORPH_OPEN, disk(3))  # wider than a cart path
k, lb, st, cen = cv2.connectedComponentsWithStats(sand)
bunk = np.isin(lb, [i for i in range(1, k) if 25 <= st[i, 4] * MPP * MPP <= 450 and st[i, 4] / (st[i, 2] * st[i, 3]) > 0.4
                      and all(math.dist(cen[i], q) * MPP > 22 for q in NOT_SAND)]) & (dist < 45)
bunk = cv2.morphologyEx(u8(bunk), cv2.MORPH_CLOSE, disk(px(1))) > 0
# greens: the greenest smooth turf, grown from each hole's last point
gc = cv2.morphologyEx(u8((Ab < -24.8) & (sb < 1.6) & (Lb > 42)), cv2.MORPH_OPEN, disk(6)) > 0
k, lb, st, cen = cv2.connectedComponentsWithStats(u8(gc))
greens = np.zeros((H, W), bool); gof = {}
for n, l in HOLES.items():
    i = min(range(1, k), key=lambda i: math.dist(cen[i], l[-1]))
    if math.dist(cen[i], l[-1]) * MPP >= 20: print('green far', n, cen[i], l[-1])
    gm = cv2.morphologyEx(u8(lb == i), cv2.MORPH_CLOSE, disk(px(2.5))) > 0
    gm = cv2.dilate(u8(gm), disk(px(1.5))) > 0  # the mask stops short of the collar
    gof[n] = gm; greens |= gm
greens &= ~bunk
# fairway: smooth green turf near the hole lines
turf = (Ab < -11) & (Lb > 36) & ~trees  # the fairways here are drier
turf = cv2.morphologyEx(u8(turf), cv2.MORPH_CLOSE, disk(px(2))) > 0
fw = turf & (dist < 19) & ~greens & ~bunk & ~water
fw = cv2.morphologyEx(u8(fw), cv2.MORPH_OPEN, disk(px(3))) > 0
edge = cv2.morphologyEx(own, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)) > 0
tr = trees & (dist < 60) & ~edge  # each hole gets the trees nearest its line
feats = []
for t, mask, mn, eps in (('water', water, 300, 1.2), ('trees', tr, 40, 1.6), ('fairway', fw, 400, 1.3), ('bunker', bunk, 8, 0.5)):
    for p in rings(mask, mn, eps): feats.append({'t': t, 'px': p})
cenr = lambda r: (sum(p[0] for p in r) / len(r), sum(p[1] for p in r) / len(r))
yd = lambda a, b: math.dist(a, b) * MPP / 0.9144
holes = []; PRO = TEES[0]['yards']
for n in range(1, 19):
    line = [tuple(p) for p in HOLES[n]]
    gr = max(rings(gof[n] & ~bunk, 60, 0.7), key=lambda p: cv2.contourArea(np.array(p[0], np.float32)))
    feats.append({'t': 'green', 'px': gr, 'h': n}); line[-1] = cenr(gr[0])
    # every tee sits on the first leg (the app measures a tee to the first turn, then along the line)
    need = max(PRO[n - 1] - min(t['yards'][n - 1] for t in TEES) + 25, 0)
    while len(line) > 2 and yd(line[0], line[1]) < need: line.pop(1)
    rest = sum(yd(line[i], line[i + 1]) for i in range(1, len(line) - 1))
    ux, uy = line[0][0] - line[1][0], line[0][1] - line[1][1]; ul = math.hypot(ux, uy); ux, uy = ux / ul, uy / ul
    spots = {}
    for t in TEES:
        d = max(t['yards'][n - 1] - rest, 30) * 0.9144 / MPP  # px from the first turn
        d = min(d, ul + 15 * 0.9144 / MPP)  # never far behind the traced tee: houses and other holes are there
        spots[round(d)] = (line[1][0] + ux * d, line[1][1] + uy * d)
    line[0] = spots[max(spots)]
    for d, (cx, cy) in spots.items():  # a 9 m x 6 m box across the line
        a, b = 4.5 / MPP, 3 / MPP
        box = [(cx + ux * sa * a - uy * sb * b, cy + uy * sa * a + ux * sb * b) for sa, sb in ((1, 1), (1, -1), (-1, -1), (-1, 1))]
        feats.append({'t': 'tee', 'px': [box], 'h': n})
    holes.append({'n': n, 'par': PAR[n - 1], 'hcp': HCP[n - 1], 'line': [ll(*p) for p in line], 'tee': ll(*line[0]), 'pin': ll(*line[-1]), '_px': line})
    print(n, 'line', len(line), 'plays', round(yd(line[0], line[1]) + rest), PRO[n - 1], 'tee moved', round(yd(line[0], HOLES[n][0])))
out = {'id': 'sherrillpark1', 'name': 'Sherrill Park Golf Course #1', 'location': 'Richardson, TX', 'tees': TEES,
       'holes': [{k: v for k, v in h.items() if k != '_px'} for h in holes],
       'features': [dict({'t': f['t'], 'p': [[ll(*q) for q in r] + [ll(*r[0])] for r in f['px']]}, **({'h': f['h']} if 'h' in f else {})) for f in feats],
       'attribution': 'Course outlines traced from Esri World Imagery'}
json.dump(out, open(sys.argv[1], 'w'), separators=(',', ':'))
from collections import Counter
print(Counter(f['t'] for f in feats), sum(len(r) for f in feats for r in f['px']), 'points')
if len(sys.argv) > 2:  # a picture to check the result by eye
    col = {'water': (255, 120, 0), 'trees': (0, 90, 0), 'fairway': (120, 255, 120), 'bunker': (0, 255, 255), 'green': (0, 0, 255), 'tee': (255, 0, 255)}
    for f in feats:
        for r in f['px']: cv2.polylines(im, [np.array(r, np.int32)], True, col[f['t']], 2 if f['t'] != 'trees' else 1)
    for h in holes:
        p = np.array(h['_px'], np.int32); cv2.polylines(im, [p], False, (255, 255, 255), 2)
        mx, my = p[len(p) // 2] if len(p) > 2 else (p[0] + p[1]) // 2
        cv2.putText(im, str(h['n']), (int(mx) + 8, int(my)), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (0, 0, 0), 6); cv2.putText(im, str(h['n']), (int(mx) + 8, int(my)), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (0, 255, 255), 3)
    cv2.imwrite(sys.argv[2], cv2.resize(im[250:2700, 200:2300], None, fx=0.65, fy=0.65, interpolation=cv2.INTER_AREA))

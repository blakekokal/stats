import cv2, numpy as np, json, math
from holes import HOLES
f = np.load('feat.npz'); L, A, B, sd = (f[k].astype(np.float32) for k in ('L', 'A', 'B', 'sd'))
H, W = L.shape; MPP = 0.25074
def P(x, y): return (int(round(2 * x - 256)), int(round(2 * y)))  # m18 -> m19 px
px = lambda m: max(1, int(round(m / MPP)))
disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
u8 = lambda m: m.astype(np.uint8) * 255
# distance to the hole lines
lines = np.full((H, W), 255, np.uint8)
for l in HOLES.values(): cv2.polylines(lines, [np.array([P(*p) for p in l], np.int32)], False, 0, 1)
dist = cv2.distanceTransform(lines, cv2.DIST_L2, 5) * MPP  # metres to nearest hole line
def polys(mask, min_m2, eps_m, max_m2=1e12):
    cs, hier = cv2.findContours(u8(mask), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    if hier is None: return out
    for i, c in enumerate(cs):
        if hier[0][i][3] != -1: continue  # holes handled with their parent
        a = cv2.contourArea(c) * MPP * MPP
        if a < min_m2 or a > max_m2: continue
        rings = [c]
        j = hier[0][i][2]
        while j != -1:
            if cv2.contourArea(cs[j]) * MPP * MPP >= max(min_m2, 60): rings.append(cs[j])
            j = hier[0][j][0]
        rr = []
        for r in rings:
            r = cv2.approxPolyDP(r, px(eps_m), True)[:, 0, :]
            if len(r) >= 3: rr.append([[(x + 256) / 2, y / 2] for x, y in r.tolist()])
        if rr: out.append(rr)
    return out
# water: the pond (dark, flat, big)
water = cv2.morphologyEx(u8((L < 22) & (sd < 1.6)), cv2.MORPH_OPEN, disk(px(3))) > 0
n, lab, st, _ = cv2.connectedComponentsWithStats(u8(water))
water = np.isin(lab, [i for i in range(1, n) if st[i, 4] * MPP * MPP > 3000]) & (dist < 150)
water = cv2.morphologyEx(u8(water), cv2.MORPH_CLOSE, disk(px(4))) > 0
# trees: dark, not water
trees = (L < 37) & ~cv2.dilate(u8(water), disk(px(3))).astype(bool)
trees = cv2.morphologyEx(u8(trees), cv2.MORPH_CLOSE, disk(px(2.5)))
trees = cv2.morphologyEx(trees, cv2.MORPH_OPEN, disk(px(2))) > 0
trees &= dist < 75
# sand
sand = (L > 63) & (A > -9) & (B > 14) & (sd < 6)
sand = cv2.morphologyEx(u8(sand), cv2.MORPH_OPEN, disk(px(1.2))) > 0
# turf
turf = (A < -13.5) & (L > 38) & (L < 68) & (sd < 3.2)
turf = cv2.morphologyEx(u8(turf), cv2.MORPH_OPEN, disk(px(1.5)))
turf = cv2.morphologyEx(turf, cv2.MORPH_CLOSE, disk(px(3))) > 0
# greens: grown from each hole's last point over the brightest, greenest turf
greens = np.zeros((H, W), bool)
gcand = cv2.morphologyEx(u8((A < -23.5) & (L > 47.5) & (sd < 2.2)), cv2.MORPH_OPEN, disk(px(1.5))) > 0
GREEN_R = {}
for nn, l in HOLES.items():
    cx, cy = P(*l[-1]); R = px(GREEN_R.get(nn, 19))
    win = np.zeros((H, W), np.uint8); cv2.circle(win, (cx, cy), R, 255, -1)
    m = gcand & (win > 0)
    k, lab2, st2, cen = cv2.connectedComponentsWithStats(u8(m))
    if k < 2: print('no green found', nn); continue
    best = min(range(1, k), key=lambda i: math.hypot(cen[i][0] - cx, cen[i][1] - cy) - 0.02 * st2[i, 4] ** 0.5)
    g = cv2.morphologyEx(u8(lab2 == best), cv2.MORPH_CLOSE, disk(px(3))) > 0
    greens |= g
    print('green', nn, round(st2[best, 4] * MPP * MPP), 'm2')
# fairway: turf near the hole lines, tied to them
fw = turf & (dist < 42) & ~greens
fw = cv2.morphologyEx(u8(fw), cv2.MORPH_OPEN, disk(px(3)))
k, lab3, st3, _ = cv2.connectedComponentsWithStats(fw)
keep = [i for i in range(1, k) if st3[i, 4] * MPP * MPP > 500]
fw = np.isin(lab3, keep)
feats = []
for t, mask, mn, eps, mx in (('water', water, 500, 1.5, 1e12), ('trees', trees, 80, 2.0, 1e12), ('fairway', fw, 500, 1.5, 1e12), ('green', greens, 80, 0.8, 1e12), ('bunker', sand & (dist < 70), 20, 0.7, 900)):
    ps = polys(mask, mn, eps, mx)
    print(t, len(ps), sum(len(r) for p in ps for r in p))
    for p in ps: feats.append({'t': t, 'rings': p, 'px': p[0]})
np.savez_compressed('masks.npz', water=water, trees=trees, fw=fw, greens=greens, sand=sand, turf=turf, dist=dist.astype(np.float16))
json.dump(feats, open('seg.json', 'w'))

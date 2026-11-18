"""Shapes for the 27 holes (all three nines in one file):
round seed greens (regrown to the turf by trace_turf.py), a back tee box, the hole
line from back tee to green, and each par 4 and 5's fairway: the mown, still-green
grass in the zoom-19 imagery within 38 m of the hole line, from 120 m off the tee
to the green.
   python3 seed.py m19.png out.json"""
import json, math, sys, os, cv2, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from course import NINES, TEE, BENDS, CHIPPING, PUTTING
img, outp = sys.argv[1:3]
im = cv2.imread(img); H, W = im.shape[:2]
Z, X0, Y0 = map(int, open(img + '.meta').read().split()); NN = 256 * 2 ** Z
M = 156543.03392 * math.cos(math.radians(32.70)) / 2 ** Z
def px(p):
    lat, lng = p; gx = (lng + 180) / 360 * NN; gy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * NN
    return gx - X0 * 256, gy - Y0 * 256
def ll(x, y):
    gx, gy = x + X0 * 256, y + Y0 * 256
    return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / NN)))), 6), round(gx / NN * 360 - 180, 6)]
KY, KX = 110900.0, 111320 * math.cos(math.radians(32.70))
def off(p, e, n): return [round(p[0] + n / KY, 6), round(p[1] + e / KX, 6)]
def vec(a, b): return ((b[1] - a[1]) * KX, (b[0] - a[0]) * KY)
def dist(a, b): return math.hypot(*vec(a, b))
def along(a, b, m): x, y = vec(a, b); L = math.hypot(x, y); return off(a, x / L * m, y / L * m)
def circle(c, r, n=24): pts = [off(c, r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)]; return pts + [pts[0]]
def rect(a, b, w):
    x, y = vec(a, b); L = math.hypot(x, y); nx, ny = -y / L * w / 2, x / L * w / 2
    r = [off(a, nx, ny), off(b, nx, ny), off(b, -nx, -ny), off(a, -nx, -ny)]; return r + [r[0]]
def cut(line, start, end):  # the part of a polyline from `start` m to `end` m along it
    out, s = [], 0
    for a, b in zip(line, line[1:]):
        d = dist(a, b)
        if s + d >= start and s <= end:
            p = along(a, b, max(0, start - s)) if start > s else a
            q = along(a, b, min(d, end - s)) if end < s + d else b
            if not out: out.append(p)
            out.append(q)
        s += d
    return out
lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32); L, A = lab[..., 0] * 100 / 255, lab[..., 1] - 128
g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32); mu = cv2.blur(g, (9, 9)); sd = np.sqrt(np.maximum(cv2.blur(g * g, (9, 9)) - mu * mu, 0))
turf = ((A < -7) & (L > 42) & (sd < 14)).astype(np.uint8)
disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
turf = cv2.morphologyEx(turf, cv2.MORPH_OPEN, disk(int(2 / M))); turf = cv2.morphologyEx(turf, cv2.MORPH_CLOSE, disk(int(4 / M)))
holes, feats, nfw = [], [], [0, 0]
greens_px = np.zeros((H, W), np.uint8)
for n in NINES.values():
    for gpt in n['greens']: cv2.circle(greens_px, tuple(int(v) for v in px(gpt)), int(18 / M), 1, -1)
for key, n in NINES.items():
    prev = n['start']
    for i, gpt in enumerate(n['greens']):
        Lm = n['yards']['Blue'][i] * 0.9144
        tee = TEE.get((key, i + 1)) or along(gpt, prev, Lm)
        line = [tee] + BENDS.get((key, i + 1), []) + [gpt]
        holes.append({'nine': key, 'n': i + 1, 'par': n['par'][i], 'hcp': n['hcp'][i], 'line': line, 'tee': tee, 'pin': gpt})
        feats.append({'t': 'green', 'p': [circle(gpt, 13)]})
        feats.append({'t': 'tee', 'p': [rect(tee, along(tee, line[1], 12), 8)]})
        if n['par'][i] > 3:
            D = sum(dist(a, b) for a, b in zip(line, line[1:]))
            seg = cut(line, min(120, D * 0.4), D - 8)
            corr = np.zeros((H, W), np.uint8)
            cv2.polylines(corr, [np.array([px(p) for p in seg], np.int32)], False, 1, int(76 / M))
            core = np.zeros((H, W), np.uint8)
            cv2.polylines(core, [np.array([px(p) for p in seg], np.int32)], False, 1, int(16 / M))
            m = turf & corr & (1 - greens_px)
            k, lb, st, _ = cv2.connectedComponentsWithStats(m)
            keep = np.zeros_like(m)
            for j in range(1, k):
                if st[j, 4] * M * M > 150 and (core[lb == j]).any(): keep[lb == j] = 1
            cs, _ = cv2.findContours(keep, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            got = False
            for c in cs:
                if cv2.contourArea(c) * M * M < 300: continue
                c = cv2.approxPolyDP(c, 1.0 / M, True)
                r = [ll(*q[0]) for q in c]; feats.append({'t': 'fairway', 'p': [r + [r[0]]]}); got = True
            nfw[0 if got else 1] += 1
            if not got: feats.append({'t': 'fairway', 'p': [rect(seg[0], seg[-1], 28)]})
        prev = gpt
for c in (CHIPPING, PUTTING): feats.append({'t': 'green', 'p': [circle(c, 10)], 'practice': True})
json.dump({'id': 'prairielakes', 'name': 'Prairie Lakes', 'location': 'Grand Prairie, TX', 'tees': [], 'holes': holes, 'features': feats}, open(outp, 'w'))
print(len(holes), 'holes;', 'fairways from the imagery / fallback corridor:', nfw)

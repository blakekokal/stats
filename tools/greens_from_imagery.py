#!/usr/bin/env python3
"""Redraw each hole's green, and the fairway round it, from the zoom-19 Esri
imagery (what the app shows). For courses whose greens and the fairways by the
greens don't sit on the picture (Cowboys, from OpenStreetMap).

Usage: greens_from_imagery.py data/<id>.json out.json [check_dir] [tiles_dir]

Green: the putting surface is a duller, smoother green than the fairway round
it (in Cowboys' winter imagery: A about -17 against -25 in Lab). From the
middle of the hole's green, it grows through pixels the colour of that green
(its own median, so each green sets its own colour), staying within 8 m of the
old outline. Kept only if it comes out a sensible size (0.6 to 1.8 times the
old one) and clean; otherwise the old green stays.

Fairway by the green: within FW_ZONE metres of the (new) green, the fairway is
the mown, still-green grass (not the tan dormant rough, not trees), within
12 m of the old fairway or the green, less the green, bunkers and water and
other holes' greens and tee boxes. Beyond that the old fairway stays as it was.

Only the shapes it changes are written differently; run soften_shapes on
those (see tools/cowboys/rebuild_greens.sh). check_dir gets a picture of each
green, old outline thin, new thick.
"""
import json, math, os, sys, cv2, numpy as np
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))
src, out = sys.argv[1:3]
check = sys.argv[3] if len(sys.argv) > 3 else None
tdir = sys.argv[4] if len(sys.argv) > 4 else '/tmp/esri_tiles'
Z = 19; N = 256 * 2 ** Z
FW_ZONE = 40      # metres from the green where the fairway is redrawn
GREEN_GROW = 5    # metres a green may grow beyond its old outline
FW_GROW = 12      # metres the fairway may grow beyond its old outline

d = json.load(open(src))
feats = d['features']

def world(lat, lng):
    s = math.sin(math.radians(lat))
    return (lng + 180) / 360 * N, (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * N

def tile(x, y):
    import time, urllib.request
    os.makedirs(tdir, exist_ok=True)
    p = f'{tdir}/{Z}_{x}_{y}.jpg'
    for a in range(6):
        if os.path.exists(p): break
        try:
            req = urllib.request.Request(f'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{Z}/{y}/{x}', headers={'User-Agent': 'tile-trace'})
            data = urllib.request.urlopen(req, timeout=30).read()
            if cv2.imdecode(np.frombuffer(data, np.uint8), 1) is None: raise ValueError('bad tile')
            open(p, 'wb').write(data)
        except Exception:
            time.sleep(1 + 2 * a)
    return cv2.imread(p)

def crop(lat0, lng0, lat1, lng1):
    """The imagery over a box; returns image, to_px, to_ll, metres per px."""
    x0, y0 = world(lat1, lng0); x1, y1 = world(lat0, lng1)
    tx0, ty0, tx1, ty1 = int(x0 // 256), int(y0 // 256), int(x1 // 256), int(y1 // 256)
    im = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256, 3), np.uint8)
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1): im[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = tile(tx, ty)
    ox, oy = tx0 * 256, ty0 * 256
    M = 156543.03392 * math.cos(math.radians((lat0 + lat1) / 2)) / 2 ** Z
    def to_px(p):
        x, y = world(*p); return x - ox, y - oy
    def to_ll(x, y):
        gx, gy = x + ox, y + oy
        return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / N)))), 7), round(gx / N * 360 - 180, 7)]
    return im, to_px, to_ll, M

def centre(r): return [sum(p[0] for p in r) / len(r), sum(p[1] for p in r) / len(r)]
def inring(p, r):
    c = False; j = len(r) - 1
    for i in range(len(r)):
        if (r[i][1] > p[1]) != (r[j][1] > p[1]) and p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]: c = not c
        j = i
    return c
def own_green(h):
    gs = [f for f in feats if f['t'] == 'green']
    return next((f for f in gs if f.get('h') == h['n']), None) or next((f for f in gs if inring(h['pin'], f['p'][0])), None) \
        or min(gs, key=lambda f: (centre(f['p'][0])[0] - h['pin'][0]) ** 2 + (centre(f['p'][0])[1] - h['pin'][1]) ** 2)
def fill(shape, fs, to_px):
    m = np.zeros(shape[:2], np.uint8)
    for f in fs:
        rs = [np.array([to_px(q) for q in r], np.int32) for r in f['p']]
        cv2.fillPoly(m, rs[:1], 1)
        if len(rs) > 1: cv2.fillPoly(m, rs[1:], 0)
    return m
disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
def bbox(fs, pad_m):
    pts = [q for f in fs for r in f['p'] for q in r]
    la = [p[0] for p in pts]; ln = [p[1] for p in pts]
    dl = pad_m / 111320; dn = pad_m / (111320 * math.cos(math.radians(la[0])))
    return min(la) - dl, min(ln) - dn, max(la) + dl, max(ln) + dn
def polys(mask, M, min_m2, eps_m, to_ll, hole_m2=30):
    cs, hier = cv2.findContours(mask.astype(np.uint8) * 255, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    res = []
    if hier is None: return res
    for i, c in enumerate(cs):
        if hier[0][i][3] != -1 or cv2.contourArea(c) * M * M < min_m2: continue
        rs, j = [c], hier[0][i][2]
        while j != -1:
            if cv2.contourArea(cs[j]) * M * M >= hole_m2: rs.append(cs[j])
            j = hier[0][j][0]
        p = [[to_ll(x + 0.5, y + 0.5) for x, y in cv2.approxPolyDP(r, eps_m / M, True)[:, 0, :].tolist()] for r in rs]
        p = [r + [r[0]] for r in p if len(r) >= 3]
        if p: res.append(p)
    return res

changed = set()   # ids of new features (for softening only those)
report = []
for h in d['holes']:
    g = own_green(h)
    gi = feats.index(g)
    # The fairways that come near this green (within the zone, plus a little).
    near_fw = []
    im0, tp0, _, M0 = crop(*bbox([g], FW_ZONE + 25))
    zone0 = cv2.dilate(fill(im0.shape, [g], tp0), disk(int((FW_ZONE + 5) / M0))) > 0
    for f in feats:
        if f['t'] != 'fairway': continue
        m = fill(im0.shape, [f], tp0)
        if (m.astype(bool) & zone0).any(): near_fw.append(f)
    # One crop over the green and all of those fairways (whole), so their far parts are kept exactly.
    im, to_px, to_ll, M = crop(*bbox([g] + near_fw, 30))
    lab = cv2.cvtColor(cv2.GaussianBlur(im, (0, 0), 1.2), cv2.COLOR_BGR2LAB).astype(np.float32)
    L, A, B = lab[..., 0] * 100 / 255, lab[..., 1] - 128, lab[..., 2] - 128
    Lr = cv2.cvtColor(im, cv2.COLOR_BGR2LAB)[..., 0].astype(np.float32) * 100 / 255
    tex = cv2.blur(np.abs(Lr - cv2.blur(Lr, (3, 3))), (9, 9))  # leafy trees are rough, mown grass smooth
    old_g = fill(im.shape, [g], to_px).astype(bool)
    others = fill(im.shape, [f for f in feats if f is not g and f['t'] in ('green', 'tee')], to_px).astype(bool)
    hazards = fill(im.shape, [f for f in feats if f['t'] in ('bunker', 'water')], to_px).astype(bool)

    # --- the green
    core = cv2.erode(old_g.astype(np.uint8), disk(int(2 / M))) > 0
    if core.sum() < 50: core = old_g
    Lg, Ag, Bg = np.median(L[core]), np.median(A[core]), np.median(B[core])
    sA = max(2.0, 1.2 * np.std(A[core]))
    like = (np.abs(A - Ag) < sA + 0.5) & (np.abs(L - Lg) < 7) & (np.abs(B - Bg) < 5) & (tex < 3.5)
    allow = cv2.dilate(old_g.astype(np.uint8), disk(int(GREEN_GROW / M))) > 0
    gm = like & allow & ~hazards & ~others
    # Greens are smooth, rounded shapes: a wide opening takes off the collar's fingers.
    gm = cv2.morphologyEx(gm.astype(np.uint8), cv2.MORPH_CLOSE, disk(int(2 / M)))
    gm = cv2.morphologyEx(gm, cv2.MORPH_OPEN, disk(int(3 / M)))
    k, lb, st, _ = cv2.connectedComponentsWithStats(gm)
    new_g = None
    if k > 1:
        best = max(range(1, k), key=lambda i: ((lb == i) & core).sum())
        cand = lb == best
        # fill holes (a flag, a shadow)
        ff = cand.astype(np.uint8).copy(); hh, ww = ff.shape
        msk = np.zeros((hh + 2, ww + 2), np.uint8); cv2.floodFill(ff, msk, (0, 0), 2)
        cand = (ff != 2)
        ratio = cand.sum() / max(1, old_g.sum())
        overlap = (cand & old_g).sum() / max(1, old_g.sum())
        # Clean and round (no ragged edge), about the old size, mostly where the old one was.
        cs = cv2.findContours(cand.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0]
        c0 = max(cs, key=cv2.contourArea) if cs else None
        solid = cv2.contourArea(c0) / max(1, cv2.contourArea(cv2.convexHull(c0))) if c0 is not None else 0
        per = cv2.arcLength(c0, True) if c0 is not None else 1
        round_ = 4 * math.pi * cv2.contourArea(c0) / per ** 2 if c0 is not None else 0
        if 0.75 <= ratio <= 1.45 and overlap > 0.75 and solid > 0.88 and round_ > 0.55: new_g = cand
    g_final = new_g if new_g is not None else old_g

    # --- the fairway by the green
    fw_old = fill(im.shape, near_fw, to_px).astype(bool)
    zone = cv2.dilate(g_final.astype(np.uint8), disk(int(FW_ZONE / M))) > 0
    turf = (A < min(Ag - 3, -19)) & (L > 20) & (L < 62) & (tex < 4.5)
    turf = cv2.morphologyEx(turf.astype(np.uint8), cv2.MORPH_OPEN, disk(int(1.0 / M)))
    turf = cv2.morphologyEx(turf, cv2.MORPH_CLOSE, disk(int(3 / M))) > 0
    near_ok = cv2.dilate((fw_old | g_final).astype(np.uint8), disk(int(FW_GROW / M))) > 0
    fw_zone = turf & near_ok & zone & ~cv2.dilate(g_final.astype(np.uint8), disk(1)).astype(bool) & ~hazards & ~others
    # The fairway leads to the green: only grass joined to the old fairway's part in the zone, or touching the green.
    fw_new = (fw_old & ~zone) | fw_zone
    fw_new = cv2.morphologyEx(fw_new.astype(np.uint8), cv2.MORPH_OPEN, disk(int(1.5 / M)))
    fw_new = cv2.morphologyEx(fw_new, cv2.MORPH_CLOSE, disk(int(2 / M))) > 0
    k, lb, st, _ = cv2.connectedComponentsWithStats(fw_new.astype(np.uint8))
    keep_ids = set()
    gring = cv2.dilate(g_final.astype(np.uint8), disk(int(3 / M))) > 0
    for i in range(1, k):
        comp = lb == i
        if (comp & fw_old & ~zone).any() or ((comp & gring).any() and st[i, 4] * M * M > 60): keep_ids.add(i)
    fw_new = np.isin(lb, list(keep_ids))
    # No little holes in it (a shadow, a darker patch): only bunkers, water and greens cut it.
    holes_ = ~fw_new & ~hazards & ~others & ~g_final
    k2, lb2, st2, _ = cv2.connectedComponentsWithStats(holes_.astype(np.uint8))
    for i in range(1, k2):
        x, y, w, hh = st2[i, :4]
        if st2[i, 4] * M * M < 400 and x > 0 and y > 0 and x + w < fw_new.shape[1] and y + hh < fw_new.shape[0]: fw_new |= lb2 == i
    # The fairway may not run onto the green.
    fw_new &= ~g_final

    # --- write back
    if new_g is not None:
        p = polys(new_g, M, 50, 0.25, to_ll)
        if p:
            nf = {**g, 'p': max(p, key=lambda r: len(r[0]))}
            feats[gi] = nf; changed.add(id(nf)); g = nf
    if near_fw:
        hs = Counter(f.get('h') for f in near_fw if f.get('h') is not None)
        for f in near_fw: feats.remove(f)
        for p in polys(fw_new, M, 25, 0.3, to_ll):
            nf = {'t': 'fairway', 'p': p}
            if len(hs) == 1: nf['h'] = next(iter(hs))
            feats.append(nf); changed.add(id(nf))
    a_old, a_new = old_g.sum() * M * M, g_final.sum() * M * M
    report.append(f"#{h['n']}: green {'redrawn' if new_g is not None else 'kept'} {a_old:.0f} -> {a_new:.0f} m2; fairways near it {len(near_fw)}")

    if check:
        os.makedirs(check, exist_ok=True)
        o = im.copy()
        for mk, col, wd in ((old_g, (0, 200, 255), 1), (fw_old, (255, 200, 0), 1), (fw_new, (255, 255, 0), 3), (g_final, (0, 255, 255), 3)):
            cs = cv2.findContours(mk.astype(np.uint8), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)[0]
            cv2.drawContours(o, cs, -1, col, wd)
        c = to_px(centre(g['p'][0])); r = int(70 / M)
        x0, y0 = max(0, int(c[0]) - r), max(0, int(c[1]) - r)
        cv2.imwrite(f"{check}/g{h['n']}.png", o[y0:int(c[1]) + r, x0:int(c[0]) + r])

json.dump(d, open(out, 'w'), separators=(',', ':'))
json.dump([i for i, f in enumerate(d['features']) if id(f) in changed], open(out + '.changed', 'w'))
print('\n'.join(report))
print(Counter(f['t'] for f in d['features']))

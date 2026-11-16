# Trees as circles: a wood becomes a cluster of round trees instead of one blob,
# which is easier to edit (move, resize or delete one tree at a time).
# circles(mask, M) packs circles into a tree mask (M: metres per pixel), biggest
# first: each goes where the trees are thickest, 4-14 m across the middle, spaced
# out so a wood is a few big trees (it needn't be exact); a lone tree gets one.
#   python3 tree_circles.py course.json m19.png out.json   # a course file's trees, as circles
import json, math, sys
import cv2, numpy as np

MAX_R, MIN_R = 14.0, 4.0  # metres
SIDES = 10
SPACING = 1.35  # each circle clears this times its radius: a few big trees, not a crowd of little ones
LEFT = 0.4  # stop once less than this share of a wood is uncovered (it needn't be exact)

def circles(mask, M):
    mask = mask.astype(np.uint8)
    out = []
    k, lb, st, _ = cv2.connectedComponentsWithStats(mask)
    for i in range(1, k):
        x, y, w, h = st[i, :4]; P = 2
        sub = np.pad((lb[y:y + h, x:x + w] == i).astype(np.uint8), P)
        total = sub.sum(); first = True
        while True:
            dt = cv2.distanceTransform(sub, cv2.DIST_L2, 5)
            _, best, _, (cx, cy) = cv2.minMaxLoc(dt)
            if not first and (best * M < MIN_R * 0.5 or sub.sum() < LEFT * total): break
            if first and best * M < 1.0: break  # a speck, not a tree
            r = max(min(best, MAX_R / M), MIN_R / M if first else best)
            out.append((x + cx - P + 0.5, y + cy - P + 0.5, min(max(r, MIN_R / M), MAX_R / M)))
            cv2.circle(sub, (cx, cy), int(math.ceil(r * SPACING)), 0, -1)
            first = False
    return out  # (x, y, radius) in pixels

def ring(x, y, r):  # a circle as a closed ring of pixel points
    return [(x + r * math.cos(2 * math.pi * k / SIDES), y + r * math.sin(2 * math.pi * k / SIDES)) for k in range(SIDES)]

if __name__ == '__main__':
    src, img, out = sys.argv[1:4]
    d = json.load(open(src))
    meta = open(img + '.meta').read().split(); Z, X0, Y0 = map(int, meta)
    H, W = cv2.imread(img, cv2.IMREAD_GRAYSCALE).shape
    N = 256 * 2 ** Z
    M = 156543.03392 * math.cos(math.radians(d['holes'][0]['pin'][0])) / 2 ** Z
    def px(lat, lng):
        gx = (lng + 180) / 360 * N; gy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * N
        return gx - X0 * 256, gy - Y0 * 256
    def ll(x, y):
        gx, gy = x + X0 * 256, y + Y0 * 256
        return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / N)))), 6), round(gx / N * 360 - 180, 6)]
    mask = np.zeros((H, W), np.uint8)
    trees = [f for f in d['features'] if f['t'] == 'trees']
    for f in trees:
        cv2.fillPoly(mask, [np.array([px(*q) for q in f['p'][0]], np.int32)], 1)
        for r in f['p'][1:]: cv2.fillPoly(mask, [np.array([px(*q) for q in r], np.int32)], 0)  # clearings
    cs = circles(mask, M)
    rest = [f for f in d['features'] if f['t'] != 'trees']
    d['features'] = rest + [{'t': 'trees', 'p': [[ll(*q) for q in ring(x, y, r)] + [ll(*ring(x, y, r)[0])]]} for x, y, r in cs]
    json.dump(d, open(out, 'w'), separators=(',', ':'))
    print(len(trees), 'tree shapes ->', len(cs), 'circles')

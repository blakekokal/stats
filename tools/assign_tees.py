"""Work out which tee box each set of tees plays from, hole by hole, and save
it in the course file as holes[i].teeAt = { "<tee name>": [lat, lng] } (the
middle of that box). The app uses teeAt before guessing from the yardage, and
it lives on the holes, so the owner's published outline edits don't undo it.

On each hole the tee sets (longest first) are lined up with the hole's own
boxes (furthest back first): a set never plays from in front of a shorter set,
two sets share a box only when that fits the scorecard much better, and the
card can differ from the ground by a steady amount (it's measured differently).

Usage: tools/assign_tees.py data/<course>.json [--write]
"""
import itertools, json, math, statistics, sys

M = 111320


def yd(a, b):
    k = math.cos(math.radians(a[0]))
    return math.hypot((a[0] - b[0]) * M, (a[1] - b[1]) * M * k) * 1.09361


def centre(r):
    r = r[:-1] if r[0] == r[-1] else r
    return [sum(p[0] for p in r) / len(r), sum(p[1] for p in r) / len(r)]


def along(h, p):
    l = h['line']; s = yd(p, l[1])
    for i in range(1, len(l) - 1): s += yd(l[i], l[i + 1])
    return s


def seg_m(p, a, b):
    k = math.cos(math.radians(a[0]))
    P = [(p[1] - a[1]) * M * k, (p[0] - a[0]) * M]; B = [(b[1] - a[1]) * M * k, (b[0] - a[0]) * M]
    L = B[0] ** 2 + B[1] ** 2
    t = max(0, min(1, (P[0] * B[0] + P[1] * B[1]) / L)) if L else 0
    return math.hypot(P[0] - t * B[0], P[1] - t * B[1])


def line_m(p, l): return min(seg_m(p, l[i], l[i + 1]) for i in range(len(l) - 1))


SHARE = 12     # yards of misfit a shared box costs (sets nearly always have their own box)
DRIFT = 0.15   # per yard the card's offset strays from a typical -7


def assign(d):
    holes = d['holes']
    tees = [f for f in d['features'] if f['t'] == 'tee']
    own = {h['n']: [] for h in holes}
    for f in tees:  # each box to the hole whose line it's nearest (as the app does)
        if f.get('h') is not None: own.setdefault(f['h'], []).append(f); continue
        c = centre(f['p'][0])
        dist, n = min((line_m(c, h['line']), h['n']) for h in holes)
        if dist <= 120: own[n].append(f)
    out = {}
    for h in holes:
        sets = sorted(d['tees'], key=lambda t: -t['yards'][h['n'] - 1])
        boxes = sorted(((along(h, centre(f['p'][0])), f) for f in own[h['n']]), key=lambda x: -x[0])
        if not boxes: continue
        best = None
        for pick in itertools.combinations_with_replacement(range(len(boxes)), len(sets)):
            diffs = [boxes[j][0] - s['yards'][h['n'] - 1] for j, s in zip(pick, sets)]
            off = statistics.median(diffs)
            cost = sum(abs(x - off) for x in diffs) + SHARE * (len(pick) - len(set(pick))) + DRIFT * abs(off + 7) * len(sets)
            if best is None or cost < best[0]: best = (cost, pick, off)
        cost, pick, off = best
        out[h['n']] = {s['name']: (boxes[j][1], boxes[j][0]) for j, s in zip(pick, sets)}
        print(f"{h['n']:>2} card-vs-ground {off:+.0f} yd | " + '  '.join(
            f"{s['name']} {s['yards'][h['n'] - 1]}->box {round(boxes[j][0])}" for j, s in zip(pick, sets)))
    return out


if __name__ == '__main__':
    path = sys.argv[1]
    d = json.load(open(path))
    res = assign(d)
    if '--write' in sys.argv:
        for h in d['holes']:
            if h['n'] in res:
                h['teeAt'] = {name: [round(v, 6) for v in centre(f['p'][0])] for name, (f, _) in res[h['n']].items()}
        json.dump(d, open(path, 'w'), separators=(',', ':'))
        print('wrote', path)

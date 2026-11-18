"""Build the three Prairie Lakes nines (data/prairielakes-red|white|blue.json) from the
zoom-19 imagery. Run from tools/:  python3 prairielakes/build.py
Steps: seed.py (greens, tee boxes, hole lines, fairways from the turf), trace_turf.py
(greens regrown to the putting surface), hazards_from_imagery.py (bunkers, ponds),
then each feature goes to the nine of its nearest hole, and per nine add_ob.py,
trees_from_imagery.py and soften_shapes.py."""
import json, math, os, subprocess, sys
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union
sys.path.insert(0, os.path.dirname(__file__))
from course import NINES, PAIRS, CHIPPING, PUTTING, NOT_WATER
T = os.path.join(os.path.dirname(__file__), 'work'); os.makedirs(T, exist_ok=True)
IMG = 'prairielakes/m19.png'
run = lambda *a: subprocess.run([sys.executable, *a], check=True)
run('prairielakes/seed.py', IMG, f'{T}/seed.json')
run('trace_turf.py', f'{T}/seed.json', IMG + '.meta', IMG, f'{T}/turf.json', '4', '8', '0', '0')
run('hazards_from_imagery.py', f'{T}/turf.json', IMG, f'{T}/haz.json')
d = json.load(open(f'{T}/haz.json'))
xy = lambda p: (p[1] * 93600, p[0] * 110900)
poly = lambda f: Polygon([xy(q) for q in f['p'][0]]).buffer(0)
bound = []
for e in json.load(open('prairielakes.boundary.osm.json'))['elements']:
    if e['type'] == 'way': bound.append(Polygon([xy([p['lat'], p['lon']]) for p in e['geometry']]).buffer(0))
B = unary_union(bound)
keep = []
for f in d['features']:
    P = poly(f); c = P.representative_point()
    if f['t'] == 'green' and any(P.buffer(3).contains(Point(xy(q))) for q in (CHIPPING, PUTTING)): continue  # practice greens
    if f['t'] == 'water' and (not B.contains(c) or any(P.distance(Point(xy(q))) < 25 for q in NOT_WATER)): continue
    if f['t'] == 'trees': continue  # redone per nine by trees_from_imagery.py
    keep.append(f)
lines = [(h['nine'], LineString([xy(p) for p in h['line']])) for h in d['holes']]
def solve(i):  # each nine's own rating and slope from the three pairs
    br, rw, wb = i
    return {'blue': round((br + wb - rw) / 2, 1), 'red': round((br + rw - wb) / 2, 1), 'white': round((rw + wb - br) / 2, 1)}
for key, n in NINES.items():
    tees = []
    for t, pr in PAIRS.items():
        r = solve([p[0] for p in pr])[key]; s = round(solve([p[1] * 2 for p in pr])[key])
        tees.append({'name': t, 'rating': r, 'slope': s, 'yards': n['yards'][t]})
    holes = [{k: h[k] for k in ('n', 'par', 'hcp', 'line', 'tee', 'pin')} for h in d['holes'] if h['nine'] == key]
    # each shape goes to the nine of its nearest hole; ponds also to every nine with a hole
    # line within 40 m (the big lake is in play on both Red 8 and White 8)
    feats = [f for f in keep if min(lines, key=lambda l: l[1].distance(poly(f).centroid))[0] == key
             or (f['t'] == 'water' and any(k == key and l.distance(poly(f)) < 40 for k, l in lines))]
    out = f'../data/prairielakes-{key}.json'
    json.dump({'id': f'prairielakes-{key}', 'name': f"Prairie Lakes Golf Course – {n['name']}", 'location': 'Grand Prairie, TX',
               'tees': tees, 'holes': holes, 'features': feats,
               'attribution': 'Course shapes traced from Esri World Imagery; course boundary © OpenStreetMap contributors (ODbL)'},
              open(out, 'w'), separators=(',', ':'))
    run('add_ob.py', 'prairielakes.boundary.osm.json', 'prairielakes.roads_houses.osm.json', 'prairielakes/ob.config.json', out)
    run('trees_from_imagery.py', out, IMG, out)
    subprocess.run([sys.executable, 'tools/soften_shapes.py', f'data/prairielakes-{key}.json'], cwd='..', check=True)
    print(key, [(t['name'], t['rating'], t['slope'], sum(t['yards'])) for t in tees])

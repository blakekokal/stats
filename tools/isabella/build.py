"""Build the three Isabella nines (data/isabella-nina|pinta|santamaria.json) from OpenStreetMap.
Run from tools/:  python3 isabella/build.py
Each nine gets its own OSM holes (course.py, by way id, renumbered 1-9) and the shapes whose
nearest hole line is one of its holes (ponds also go to every nine with a hole line within
40 m); then build_course.py, add_ob.py; trees, bunker check and soften are run after."""
import json, os, subprocess, sys
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union, polygonize
sys.path.insert(0, os.path.dirname(__file__))
from course import NINES
run = lambda *a: subprocess.run([sys.executable, *a], check=True)
SHIFT = json.load(open('isabella/shift.json')) if os.path.exists('isabella/shift.json') else {}
DROP = json.load(open('isabella/drop.json')) if os.path.exists('isabella/drop.json') else []
els = json.load(open('isabella.osm.json'))['elements']
xy = lambda p: (p['lon'] * 91700, p['lat'] * 110900)
def shape(e):
    ws = [e['geometry']] if e['type'] == 'way' else [m['geometry'] for m in e['members'] if m.get('role', 'outer') in ('outer', '')]
    if e.get('tags', {}).get('golf') == 'hole': return LineString([xy(p) for p in e['geometry']])
    return unary_union(list(polygonize(unary_union([LineString([xy(p) for p in w]) for w in ws if len(w) >= 2])))).buffer(0)
owner = {w: k for k, n in NINES.items() for w in n['ways']}
holes = {e['id']: e for e in els if e.get('tags', {}).get('golf') == 'hole'}
lines = [(owner[i], shape(e)) for i, e in holes.items()]
for key, n in NINES.items():
    mine = []
    for i, w in enumerate(n['ways']):
        h = json.loads(json.dumps(holes[w])); h['tags']['ref'] = str(i + 1); mine.append(h)
    for e in els:
        if e.get('tags', {}).get('golf') == 'hole': continue
        s = shape(e)
        if s.is_empty: continue
        near = min(lines, key=lambda l: l[1].distance(s.centroid))[0]
        water = e['tags'].get('golf') in ('water_hazard', 'lateral_water_hazard') or e['tags'].get('natural') == 'water'
        if near == key or (water and any(k == key and l.distance(s) < 40 for k, l in lines)): mine.append(e)
    json.dump({'elements': mine}, open(f'isabella/{key}.osm.json', 'w'), separators=(',', ':'))
    cfg = {'id': f'isabella-{key}', 'name': f"Isabella Golf Course – {n['name']}", 'location': 'Hot Springs Village, AR',
           'par': n['par'], 'hcp': n['hcp'], 'shift': SHIFT, 'drop': DROP,
           'tees': [{'name': t, 'rating': r, 'slope': s, 'yards': y} for t, (r, s, y) in n['tees'].items()]}
    json.dump(cfg, open(f'isabella/{key}.config.json', 'w'), indent=1)
    out = f'../data/isabella-{key}.json'
    run('build_course.py', f'isabella/{key}.osm.json', f'isabella/{key}.config.json', out)
    run('add_ob.py', 'isabella.boundary.osm.json', 'isabella.roads_houses.osm.json', f'isabella/{key}.config.json', out)

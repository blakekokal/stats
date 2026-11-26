# Colonial Country Club (Fort Worth, TX; private)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers, ponds and the 18 hole
lines (with par). Only what lies inside the course boundary (way 27865544) is kept; the short-game areas and
range tees are dropped with `trim_far.py`. The outlines sit 0.3 m east and 1.3 m south of the Esri imagery
(bunker fit; the greens agree) and are shifted onto it.

Bunkers: the sand check judged by eye: five OSM bunkers on grass (one on #1's green) are dropped (`drop`);
the others it would drop are shaded sand; its finds are roofs and courts, plus two practice-area bunkers.

Scorecard from GolfPass (15181; its 21496 is a Colonial CC in Florida); its pars match OpenStreetMap's hole
tags (par 70). Combination tees left out. Its tee table rates other lengths; ratings only where close:
III = Gold (6527), II = White (6043); men's.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.3795,32.7135,-97.3620,32.7250" -o map.json`
2. `python3 tools/colonial/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py colonial.osm.json colonial.config.json ../data/colonial.json`
   - `python3 trim_far.py ../data/colonial.json`
   - `python3 fetch_tiles.py 19 32.7145 -97.3782 32.7238 -97.3631 colonial/m19.png`
   - `python3 add_ob.py colonial.boundary.osm.json colonial.roads_houses.osm.json colonial.config.json ../data/colonial.json`
   - `python3 trees_from_imagery.py ../data/colonial.json colonial/m19.png ../data/colonial.json`
   - from the repo root: `python3 tools/soften_shapes.py data/colonial.json` and `python3 tools/elevation.py colonial`

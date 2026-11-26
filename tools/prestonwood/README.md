# Prestonwood Country Club – Creek (Dallas, TX; private)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers, ponds, the creek and the
18 hole lines (with par). Only what lies inside the course boundary (way 300531170) is kept; the practice
greens and short-game area are dropped with `trim_far.py`.

OSM's greens were drawn about 3 m north-west of its bunkers, so one shift doesn't fit both: everything moves
0.5 m west and 1.0 m north (bunker fit), and the greens (and so the pins) a further 1.8 m east and 2.5 m south
(`greenShift` in the config, a `build_course.py` option; `fit_shift.py ... green`, checked by eye).

One OSM bunker on grass is dropped (`drop`); the sand check's other drops are shaded sand and its finds are
roofs and paths.

Scorecard from GolfPass (2858, The Clubs of Prestonwood - The Creek); its pars match OpenStreetMap's hole tags
(par 71). Combination tees left out. Men's ratings; Green's is for 5514 yards (the card's Green is 5590).

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.8155,32.9525,-96.8050,32.9700" -o map.json`
2. `python3 tools/prestonwood/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py prestonwood.osm.json prestonwood.config.json ../data/prestonwood.json`
   - `python3 trim_far.py ../data/prestonwood.json`
   - `python3 fetch_tiles.py 19 32.9536 -96.8141 32.9689 -96.8066 prestonwood/m19.png`
   - `python3 add_ob.py prestonwood.boundary.osm.json prestonwood.roads_houses.osm.json prestonwood.config.json ../data/prestonwood.json`
   - `python3 trees_from_imagery.py ../data/prestonwood.json prestonwood/m19.png ../data/prestonwood.json`
   - from the repo root: `python3 tools/soften_shapes.py data/prestonwood.json` and `python3 tools/elevation.py prestonwood`

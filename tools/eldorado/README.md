# Eldorado Country Club (McKinney, TX; private)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers, ponds and the 18 hole
lines (with par). The course boundary is two ways, 548019653 and 603232845 (#2, across the road), joined;
only what lies inside is kept. The practice greens are dropped with `trim_far.py`, the range and a practice
area by #1's tee (mapped as fairways) with `drop`. The outlines sit 1.2 m west and 2.2 m south of the Esri
imagery (bunker fit) and are shifted onto it.

- #9's green is tagged as a bunker in OSM: `retype` in the config (a `build_course.py` option) makes it a green.
- Bunkers: OSM's are all on sand; four real bunkers the sand check found are added (`keep_found_bunkers.py`).
- #5's tee sits on the edge of OSM's boundary, so it shows inside the OB area.

Scorecard from GolfPass (3150); its pars match OpenStreetMap's hole tags (par 72). Black's rating is the men's;
White's (73.9 for 6188 yards, barely below Black's) is presumably the women's, so not given; Green's is the
women's. The Players tees have none.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.6615,33.1720,-96.6395,33.1865" -o map.json`
2. `python3 tools/eldorado/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py eldorado.osm.json eldorado.config.json ../data/eldorado.json`
   - `python3 trim_far.py ../data/eldorado.json`
   - `python3 fetch_tiles.py 19 33.1731 -96.6601 33.1856 -96.6411 eldorado/m19.png`
   - `hazards_from_imagery.py` + `bunkers_from_imagery.py ... checked.json`, then
     `python3 keep_found_bunkers.py ../data/eldorado.json checked.json ../data/eldorado.json 33.174959,-96.658925 33.176513,-96.658264 33.180625,-96.658278 33.182897,-96.651624`
   - `python3 add_ob.py eldorado.boundary.osm.json eldorado.roads_houses.osm.json eldorado.config.json ../data/eldorado.json`
   - `python3 trees_from_imagery.py ../data/eldorado.json eldorado/m19.png ../data/eldorado.json`
   - from the repo root: `python3 tools/soften_shapes.py data/eldorado.json` and `python3 tools/elevation.py eldorado`

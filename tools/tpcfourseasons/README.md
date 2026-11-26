# TPC Four Seasons Las Colinas (Irving, TX; private/resort)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers, ponds and the 18
hole lines (no par tags: pars from the card; the lines' lengths match its Byron Nelson tees). Only what lies
inside the course boundary (relation 5281830) is kept: Cottonwood Valley and Las Colinas Country Club next
door are left out. The range and practice greens are dropped with `trim_far.py`. The outlines sit 0.8 m
east and 1.3 m south of the Esri imagery (bunker fit; the greens agree) and are shifted onto it.

Scorecard from GolfPass (15024, TPC Las Colinas), par 70. Six of its nine tees kept. Its tee table rates
other lengths; ratings only where close: Byron Nelson = its Black (7166), White (5836), Red = Red (W) (5030,
the women's).

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.9635,32.8580,-96.9450,32.8810" -o map.json`
2. `python3 tools/tpcfourseasons/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py tpcfourseasons.osm.json tpcfourseasons.config.json ../data/tpcfourseasons.json`
   - `python3 trim_far.py ../data/tpcfourseasons.json`
   - `python3 fetch_tiles.py 19 32.8593 -96.9623 32.8797 -96.9462 tpcfourseasons/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: one OSM bunker on
     sunlit grass dropped (`drop`); the others it would drop are in shade; its finds are roofs.
   - `python3 add_ob.py tpcfourseasons.boundary.osm.json tpcfourseasons.roads_houses.osm.json tpcfourseasons.config.json ../data/tpcfourseasons.json`
   - `python3 trees_from_imagery.py ../data/tpcfourseasons.json tpcfourseasons/m19.png ../data/tpcfourseasons.json`
   - from the repo root: `python3 tools/soften_shapes.py data/tpcfourseasons.json` and `python3 tools/elevation.py tpcfourseasons`

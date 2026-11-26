# TPC Craig Ranch (McKinney, TX; private)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, ponds and the 18 hole
lines (with par). Only what lies inside the course boundary (way 448674021) is kept; the range, practice
greens and short-game area east of #1 and #2 are dropped with `trim_far.py`. The outlines sit 0.5 m east
and 1.3 m south of the Esri imagery (bunker fit; the greens agree) and are shifted onto it.

OpenStreetMap was mapped in 2019, before the 2020-21 renovation: its bunkers miss the sand in the imagery,
so the bunkers come from the imagery (`hazards_from_imagery.py`, its bunkers only: `swap_bunkers.py`,
which also cuts the sand out of the six greens it overlaps, #3, 6, 7, 12, 14 and 15; those greens may
want a touch-up in the editor). `greens_from_imagery.py` couldn't tell the greens from the fairways
here, so the other greens are OSM's.

Scorecard from GolfPass (22200); its pars match OpenStreetMap's hole tags (par 72); its handicaps differ
from OSM's and are used. Six named tees kept (the I-IV rows look like combinations). Ratings only where
the tee table's length is close: Tpc = PGA Tour (7414), Craig Ranch (6688), West = Forward (5145). The
club's own card (tpc.com) is blocked from this environment.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.7295,33.1285,-96.7165,33.1535" -o map.json`
2. `python3 tools/tpccraigranch/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py tpccraigranch.osm.json tpccraigranch.config.json ../data/tpccraigranch.json`
   - `python3 trim_far.py ../data/tpccraigranch.json 15 45 33.1330,-96.7230,33.1385,-96.7180`
   - `python3 fetch_tiles.py 19 33.1296 -96.7283 33.1525 -96.7176 tpccraigranch/m19.png`
   - `python3 hazards_from_imagery.py ../data/tpccraigranch.json tpccraigranch/m19.png imagery.json`, then
     `python3 swap_bunkers.py ../data/tpccraigranch.json imagery.json ../data/tpccraigranch.json`
   - `python3 add_ob.py tpccraigranch.boundary.osm.json tpccraigranch.roads_houses.osm.json tpccraigranch.config.json ../data/tpccraigranch.json`
   - `python3 trees_from_imagery.py ../data/tpccraigranch.json tpccraigranch/m19.png ../data/tpccraigranch.json`
   - from the repo root: `python3 tools/soften_shapes.py data/tpccraigranch.json` and `python3 tools/elevation.py tpccraigranch`

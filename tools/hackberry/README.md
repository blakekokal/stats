# Hackberry Creek Country Club (Irving, TX; private)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers, ponds, the creek and the
18 hole lines (with par). Only what lies inside the course boundary (relation 8111659) is kept; the practice
greens and range tee are dropped with `trim_far.py`. The outlines sit 0.3 m east and 1.0 m south of the Esri
imagery (bunker fit; the greens agree) and are shifted onto it.

#5 has no green in OSM: `green_from_seed.py` grows it in the imagery and moves #5's pin onto it. #13's back tee
lies just outside OSM's course boundary, so it is in the OB area. OSM's bunkers are all on sand (the sand check's
finds are roofs and paths).

Scorecard from GolfPass (3055); its pars match OpenStreetMap's hole tags (par 72); its handicaps differ from OSM's
and are used. Combination tees left out. Ratings matched by total yards: Texas = Gold (7013), Black = Blue (6562),
White, Copper = Red (W) (5471, the women's); Silver has none.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.9850,32.8995,-96.9635,32.9160" -o map.json`
2. `python3 tools/hackberry/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py hackberry.osm.json hackberry.config.json ../data/hackberry.json`
   - `python3 fetch_tiles.py 19 32.9006 -96.9835 32.9147 -96.9650 hackberry/m19.png`
   - `python3 green_from_seed.py ../data/hackberry.json hackberry/m19.png ../data/hackberry.json 32.91214,-96.96682 --tol 12`
   - `python3 trim_far.py ../data/hackberry.json`
   - `python3 add_ob.py hackberry.boundary.osm.json hackberry.roads_houses.osm.json hackberry.config.json ../data/hackberry.json`
   - `python3 trees_from_imagery.py ../data/hackberry.json hackberry/m19.png ../data/hackberry.json`
   - from the repo root: `python3 tools/soften_shapes.py data/hackberry.json` and `python3 tools/elevation.py hackberry`

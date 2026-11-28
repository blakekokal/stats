# Ridglea Country Club – South (Fort Worth, TX; private)

OpenStreetMap ("Ridglea Country Club - Championship Golf Course", relation 9348785) has all 18 hole lines with par,
greens, fairways (multipolygons), tee boxes, bunkers and ponds. The Esri imagery catches the course mid-rebuild:
bare, freshly shaped greens and bunker pits not yet filled with sand. OSM's shapes match those new pads and pits,
so they're kept as mapped (no shift; the sand check's 21 "on grass" bunkers are the empty pits). Worth rechecking
when the imagery is updated.

Scorecard from GolfPass (2926, Ridglea Country Club - South Course); its pars and lengths match OSM's (par 72).
Ratings matched by total yards (the tee table calls Black Gold); Blue's length differs from the table's, so it has
none; White's is the women's.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.4410,32.6830,-97.4250,32.6960" -o map.json`
2. `python3 tools/ridglea/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py ridglea.osm.json ridglea.config.json ../data/ridglea.json`
   - `python3 trim_far.py ../data/ridglea.json`
   - `python3 fetch_tiles.py 19 32.6835 -97.4405 32.6955 -97.4255 ridglea/m19.png`
   - `python3 add_ob.py ridglea.boundary.osm.json ridglea.roads_houses.osm.json ridglea.config.json ../data/ridglea.json`
   - `python3 trees_from_imagery.py ../data/ridglea.json ridglea/m19.png ../data/ridglea.json`
   - from the repo root: `python3 tools/soften_shapes.py data/ridglea.json` and `python3 tools/elevation.py ridglea`

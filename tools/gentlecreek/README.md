# Gentle Creek Country Club (Prosper, TX; private)

OpenStreetMap ("Gentle Creek Country Club", relation 17951191) has all 18 hole lines with par, greens, fairways
(multipolygons), tee boxes, bunkers and ponds. The outlines sit 0.2 m east and 1.5 m south of the Esri imagery
(bunker fit) and are shifted onto it. Every OSM bunker is on sand; one greenside bunker the imagery shows is added
(`keep_found_bunkers.py`). `trim_far.py` drops the practice greens.

Scorecard from GolfPass (25491, Gentle Creek Golf Club); its pars match OSM's (par 72). Ratings matched by total
yards; White's length differs from the tee table's, so it has none; Red's is the women's.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.7670,33.2465,-96.7450,33.2600" -o map.json`
2. `python3 tools/gentlecreek/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py gentlecreek.osm.json gentlecreek.config.json ../data/gentlecreek.json`
   - `python3 trim_far.py ../data/gentlecreek.json`
   - `python3 fetch_tiles.py 19 33.2470 -96.7665 33.2595 -96.7455 gentlecreek/m19.png`
   - `python3 hazards_from_imagery.py ../data/gentlecreek.json gentlecreek/m19.png haz.json`,
     `python3 bunkers_from_imagery.py ../data/gentlecreek.json haz.json gentlecreek/m19.png chk.json`, then
     `python3 keep_found_bunkers.py ../data/gentlecreek.json chk.json ../data/gentlecreek.json 33.248583,-96.753358`
   - `python3 add_ob.py gentlecreek.boundary.osm.json gentlecreek.roads_houses.osm.json gentlecreek.config.json ../data/gentlecreek.json`
   - `python3 trees_from_imagery.py ../data/gentlecreek.json gentlecreek/m19.png ../data/gentlecreek.json`
   - from the repo root: `python3 tools/soften_shapes.py data/gentlecreek.json` and `python3 tools/elevation.py gentlecreek`

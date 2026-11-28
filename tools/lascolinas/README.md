# Las Colinas Country Club (Irving, TX; private)

OpenStreetMap ("Las Colinas Country Club", way 25921985) has the 18 hole lines (no par tags), greens, one tee box
per hole, bunkers and ponds, but almost no fairways: `fill_from_imagery.py --fairways missing --tees` traces them
from the Esri imagery (approximate; worth tidying in the editor). The outlines sit 1.0 m east and 1.3 m south of
the imagery (between the bunker and green fits) and are shifted onto it. Eleven OSM bunkers on grass are dropped
(`drop`) and one greenside bunker the imagery shows is added (`keep_found_bunkers.py`).

Scorecard from GolfPass (3053), par 71. Only White's length matches the tee table's (men's rating), so the other
tees have none.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.9515,32.8505,-96.9290,32.8655" -o map.json`
2. `python3 tools/lascolinas/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py lascolinas.osm.json lascolinas.config.json ../data/lascolinas.json`
   - `python3 trim_far.py ../data/lascolinas.json`
   - `python3 fetch_tiles.py 19 32.8510 -96.9510 32.8650 -96.9295 lascolinas/m19.png`
   - `python3 fill_from_imagery.py ../data/lascolinas.json lascolinas/m19.png ../data/lascolinas.json --fairways missing --tees --paths lascolinas.paths.osm.json`
   - `python3 hazards_from_imagery.py ../data/lascolinas.json lascolinas/m19.png haz.json`,
     `python3 bunkers_from_imagery.py ../data/lascolinas.json haz.json lascolinas/m19.png chk.json`, then
     `python3 keep_found_bunkers.py ../data/lascolinas.json chk.json ../data/lascolinas.json 32.860875,-96.946841`
   - `python3 add_ob.py lascolinas.boundary.osm.json lascolinas.roads_houses.osm.json lascolinas.config.json ../data/lascolinas.json`
   - `python3 trees_from_imagery.py ../data/lascolinas.json lascolinas/m19.png ../data/lascolinas.json`
   - from the repo root: `python3 tools/soften_shapes.py data/lascolinas.json` and `python3 tools/elevation.py lascolinas`

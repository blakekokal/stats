# Split Rail Golf Club (Aledo, TX)

OpenStreetMap ("Split Rail Links & Golf Club", relation 3987831) has all 18 hole lines with par, greens, fairways
(multipolygons), tee boxes, bunkers and ponds. #6's green is tagged as a tee (`retype`). The outlines sit 1.3 m east
and 0.2 m south of the Esri imagery (bunker and green fits agree) and are shifted onto it. One OSM bunker on grass is
dropped (`drop`) and two the imagery shows are added (`keep_found_bunkers.py`); the many small sandy scrapes in the
native areas are left out.

Scorecard from GolfPass (22607); its pars match OSM's. Its tee table swaps the Black and Gold names, so ratings are
matched by total yards. Red's is the women's.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.6540,32.6910,-97.6315,32.7060" -o map.json`
2. `python3 tools/splitrail/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py splitrail.osm.json splitrail.config.json ../data/splitrail.json`
   - `python3 trim_far.py ../data/splitrail.json`
   - `python3 fetch_tiles.py 19 32.6915 -97.6535 32.7055 -97.6320 splitrail/m19.png`
   - `python3 hazards_from_imagery.py ../data/splitrail.json splitrail/m19.png haz.json`,
     `python3 bunkers_from_imagery.py ../data/splitrail.json haz.json splitrail/m19.png chk.json`, then
     `python3 keep_found_bunkers.py ../data/splitrail.json chk.json ../data/splitrail.json 32.69308,-97.645168 32.695613,-97.647589`
   - `python3 add_ob.py splitrail.boundary.osm.json splitrail.roads_houses.osm.json splitrail.config.json ../data/splitrail.json`
   - `python3 trees_from_imagery.py ../data/splitrail.json splitrail/m19.png ../data/splitrail.json`
   - from the repo root: `python3 tools/soften_shapes.py data/splitrail.json` and `python3 tools/elevation.py splitrail`

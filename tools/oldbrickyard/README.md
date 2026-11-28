# Old Brickyard Golf Course (Ferris, TX)

OpenStreetMap ("Old Brickyard Golf Course", way 1176385017) has all 18 hole lines with par, greens, fairways
(multipolygons), tee boxes, ponds and six bunkers. The outlines sit 3.0 m east and 1.3 m north of the Esri imagery
(fitted to the greens: too few bunkers for the bunker fit) and are shifted onto it. The imagery's sand check, judged
by eye: four OSM bunkers on grass are dropped (`drop`; two of them redrawn a few metres away) and four bunkers it
found are added (`keep_found_bunkers.py`).

Scorecard from GolfPass (22899); its pars match OSM's (par 71). Its tee table rates other lengths than the card's
tees, so no ratings are given.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.6670,32.5370,-96.6580,32.5515" -o map.json`
2. `python3 tools/oldbrickyard/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py oldbrickyard.osm.json oldbrickyard.config.json ../data/oldbrickyard.json`
   - `python3 trim_far.py ../data/oldbrickyard.json`
   - `python3 fetch_tiles.py 19 32.5378 -96.6668 32.5512 -96.6582 oldbrickyard/m19.png`
   - `python3 hazards_from_imagery.py ../data/oldbrickyard.json oldbrickyard/m19.png haz.json`,
     `python3 bunkers_from_imagery.py ../data/oldbrickyard.json haz.json oldbrickyard/m19.png chk.json`, then
     `python3 keep_found_bunkers.py ../data/oldbrickyard.json chk.json ../data/oldbrickyard.json 32.540267,-96.660144 32.543126,-96.66072 32.544554,-96.662619 32.548676,-96.663817`
   - `python3 add_ob.py oldbrickyard.boundary.osm.json oldbrickyard.roads_houses.osm.json oldbrickyard.config.json ../data/oldbrickyard.json`
   - `python3 trees_from_imagery.py ../data/oldbrickyard.json oldbrickyard/m19.png ../data/oldbrickyard.json`
   - from the repo root: `python3 tools/soften_shapes.py data/oldbrickyard.json` and `python3 tools/elevation.py oldbrickyard`

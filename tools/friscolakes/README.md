# Frisco Lakes Golf Club (Frisco, TX)

OpenStreetMap ("Frisco Lakes Golf Course", relation 8837816) has all 18 hole lines with par, greens, fairways
(multipolygons), tee boxes, bunkers and ponds. The outlines sit 0.9 m east and 1.3 m south of the Esri imagery
(bunker and green fits agree) and are shifted onto it. One OSM bunker on grass is dropped (`drop`); the sand
check's other finds were roofs and roads. `trim_far.py` drops the practice greens.

Scorecard from GolfPass (22711); its pars match OSM's (par 72). Ratings matched by total yards: the tee table's
lengths are within 25 yards of the card's tees (it calls Ghost Black and Black Gold); Green's is the women's.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.9200,33.1295,-96.8895,33.1460" -o map.json`
2. `python3 tools/friscolakes/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py friscolakes.osm.json friscolakes.config.json ../data/friscolakes.json`
   - `python3 trim_far.py ../data/friscolakes.json`
   - `python3 fetch_tiles.py 19 33.1300 -96.9195 33.1455 -96.8900 friscolakes/m19.png`
   - `python3 add_ob.py friscolakes.boundary.osm.json friscolakes.roads_houses.osm.json friscolakes.config.json ../data/friscolakes.json`
   - `python3 trees_from_imagery.py ../data/friscolakes.json friscolakes/m19.png ../data/friscolakes.json`
   - from the repo root: `python3 tools/soften_shapes.py data/friscolakes.json` and `python3 tools/elevation.py friscolakes`

# Cedar Crest Golf Course (Dallas, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
the pond and the 18 hole lines. The outlines sit under 1 m off the Esri imagery
(fitting all bunkers to the sand; 84% then on sand) and are shifted onto it.

Scorecard from GolfPass. Gold, Silver and Ruby play to par 71 with #10 a 456-yd par 5;
the Tournament and Black tees play #10 as a par 4 (par 70, as OpenStreetMap tags it), and
the card gives no hole yardages for them, so they are left out. Men's ratings.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.8020,32.7185,-96.7855,32.7285" -o map.json`
2. From `tools/`: `python3 cedarcrest/osm_to_geom.py map.json`, then
   - `python3 build_course.py cedarcrest.osm.json cedarcrest.config.json ../data/cedarcrest.json`
   - `python3 add_ob.py cedarcrest.boundary.osm.json cedarcrest.roads_houses.osm.json cedarcrest.config.json ../data/cedarcrest.json`
   - `python3 fetch_tiles.py 19 32.7185 -96.8020 32.7285 -96.7855 m19.png`; bunkers checked with
     `hazards_from_imagery.py` + `bunkers_from_imagery.py`: kept as OSM has them (the two it calls
     grass are in tree shade; what it would add is dirt, a path and a bare lot).
   - `python3 trees_from_imagery.py ../data/cedarcrest.json m19.png ../data/cedarcrest.json`
   - from the repo root: `python3 tools/soften_shapes.py data/cedarcrest.json` (last step of the build)
     and `python3 tools/elevation.py cedarcrest`

Four practice greens are dropped (`drop` in the config).

# Ridgeview Ranch Golf Club (Plano, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers and 17 of the 18 hole lines
(with par and handicap). Only what lies inside the course boundary (relation 9848761) is kept; the practice green
and range tee are dropped with `trim_far.py`. The outlines sit 1.3 m west and 3.0 m south of the Esri imagery
(bunker fit; the greens roughly agree) and are shifted onto it.

- #18 has no hole line in OSM, though its green, fairway and four tee boxes are mapped: `osm_to_geom.py` adds it
  from the back tee box through the middle of its fairway (a dogleg right) to its green, 420 yards (card: 423).
- Bunkers: the sand check, judged by eye: 22 OSM bunkers on grass (filled in since mapping) or drawn off their sand
  are dropped (`drop`); three of those are redrawn from the imagery (`keep_found_bunkers.py`). The big waste area
  by #6 is kept.

Scorecard from GolfPass (3237); its pars and handicaps match OpenStreetMap's hole tags (par 72). Men's ratings, each
for its own length (Copper = its Gold, 7025 yards).

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.7515,33.1025,-96.7320,33.1230" -o map.json`
2. `python3 tools/ridgeview/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py ridgeview.osm.json ridgeview.config.json ../data/ridgeview.json`
   - `python3 trim_far.py ../data/ridgeview.json`
   - `python3 fetch_tiles.py 19 33.1034 -96.7501 33.1219 -96.7331 ridgeview/m19.png`
   - `hazards_from_imagery.py` + `bunkers_from_imagery.py ... checked.json`, then
     `python3 keep_found_bunkers.py ../data/ridgeview.json checked.json ../data/ridgeview.json 33.115975,-96.746482 33.116376,-96.746094 33.117042,-96.744814`
   - `python3 add_ob.py ridgeview.boundary.osm.json ridgeview.roads_houses.osm.json ridgeview.config.json ../data/ridgeview.json`
   - `python3 trees_from_imagery.py ../data/ridgeview.json ridgeview/m19.png ../data/ridgeview.json`
   - from the repo root: `python3 tools/soften_shapes.py data/ridgeview.json` and `python3 tools/elevation.py ridgeview`

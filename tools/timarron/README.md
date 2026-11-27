# Timarron Country Club (Southlake, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers, ponds, the creek and the 18
hole lines (with par). #10 (way 943329397) is tagged ref=4, name=10 in OSM, which made it look like a 17-hole map:
`osm_to_geom.py` takes its number from the name. Only what lies inside the course boundary (relation 9794821) is
kept; the range and practice green are dropped with `trim_far.py` (in a box). The outlines sit 0.5 m east and 1.8 m
south of the Esri imagery (bunker fit; the greens roughly agree) and are shifted onto it. OSM's bunkers are all on
sand.

Scorecard from GolfPass (3327); its pars match OpenStreetMap's hole tags except #1 (OSM: par 4; card: par 5, 538
yards), so the card's are used (par 72). Combination tees left out. Ratings where the tee table's length fits:
Black (7012), Green (5309, men's); Copper and White have none.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.1540,32.9115,-97.1275,32.9280" -o map.json`
2. `python3 tools/timarron/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py timarron.osm.json timarron.config.json ../data/timarron.json`
   - `python3 trim_far.py ../data/timarron.json 15 45 32.9155,-97.1370,32.9215,-97.1335`
   - `python3 fetch_tiles.py 19 32.9125 -97.1525 32.9267 -97.1288 timarron/m19.png`
   - `python3 add_ob.py timarron.boundary.osm.json timarron.roads_houses.osm.json timarron.config.json ../data/timarron.json`
   - `python3 trees_from_imagery.py ../data/timarron.json timarron/m19.png ../data/timarron.json`
   - from the repo root: `python3 tools/soften_shapes.py data/timarron.json` and `python3 tools/elevation.py timarron`

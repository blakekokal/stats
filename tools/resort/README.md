# The Resort Golf Club (Fort Worth, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par). Only what lies inside the course boundary (way 1272769256) is kept.
The imagery is winter (dormant grass) and the sand is tan, so the bunker fit fails; the shift,
0 m east and 1.8 m north, is fitted to the greens (`fit_shift.py ... green`).

Scorecard from GolfPass (22701); its pars match OpenStreetMap's hole tags (par 72). Men's ratings;
Red has only the women's. (GolfPass lists the Black tee as 6626 yards; its holes add up to 6636.)

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.4975,32.9415,-97.4810,32.9595" -o map.json`
2. `python3 tools/resort/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py resort.osm.json resort.config.json ../data/resort.json`
   - `python3 fetch_tiles.py 19 32.9431 -97.4955 32.9580 -97.4827 resort/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: the
     bunkers it would drop are tan sand or in shade (real bunkers) and its finds are roofs, so OSM's are kept as they are.
   - `python3 add_ob.py resort.boundary.osm.json resort.roads_houses.osm.json resort.config.json ../data/resort.json`
   - `python3 trees_from_imagery.py ../data/resort.json resort/m19.png ../data/resort.json`
   - from the repo root: `python3 tools/soften_shapes.py data/resort.json` and `python3 tools/elevation.py resort`

Dropped (`drop` in the config): the 19th hole (a bonus par 3 by the clubhouse: its green and three tees),
the range tee, and the practice greens (with the fairway round one and a practice bunker).

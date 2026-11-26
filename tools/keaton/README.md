# Grover C. Keaton Golf Course (Dallas, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds, the creek and the 18 hole lines (with par and handicap). Only what lies inside the course
boundary (way 27130579) is kept. The outlines sit on the Esri imagery as they are (no shift:
the greens sit on the picture; the course has only five bunkers, all on sand).

Scorecard from GolfPass (2866, listed as "Keeton Park Golf Course", 2323 N Jim Miller Rd); its pars
and handicaps match OpenStreetMap's hole tags (par 72). Its tee table rates older lengths (Blue 6521,
White 6062, Red 5054 yards) that match none of the card's tees, so no ratings are given.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.7140,32.7480,-96.7020,32.7615" -o map.json`
2. `python3 tools/keaton/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py keaton.osm.json keaton.config.json ../data/keaton.json`
   - `python3 fetch_tiles.py 19 32.7488 -96.7128 32.7606 -96.7032 keaton/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: the two it
     would drop are on (tan) sand and it finds none, so OSM's five are kept.
   - `python3 add_ob.py keaton.boundary.osm.json keaton.roads_houses.osm.json keaton.config.json ../data/keaton.json`
   - `python3 trees_from_imagery.py ../data/keaton.json keaton/m19.png ../data/keaton.json`
   - from the repo root: `python3 tools/soften_shapes.py data/keaton.json` and `python3 tools/elevation.py keaton`

Dropped (`drop` in the config): three practice greens and a practice tee by the clubhouse, and a
target green on the range.

# Lantana Golf Club (Lantana, TX)

Built with no yardage book: OpenStreetMap has the greens, tee boxes, fairways,
bunkers and ponds (well mapped: after a 2 m shift north, 91% of the bunkers sit
on sand in the Esri imagery), but no hole lines. The routing was worked out from
the scorecard and is in `holes.py`: each hole's tee boxes and green. The pars it
gives (4,4,5,3,4,4,5,3,4 / 4,3,4,5,4,3,5,4,4) and the back tee to green
distances match the club's card (within about 10 yd of the Black tees).

Scorecard (tees, ratings, slopes, pars, handicaps) from GolfPass; the Players
combination tee has no published rating, so it is left out.

1. The OpenStreetMap export (Overpass was down, so the plain API):
   `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.133,33.072,-97.114,33.107" -o map.json`
2. From `tools/lantana/`: `python3 osm_to_geom.py map.json` writes
   `../lantana.osm.json` (with the hole lines), `../lantana.boundary.osm.json` and
   `../lantana.roads_houses.osm.json`. Hole lines bend with the fairway; #12's
   dogleg is set by hand (`holes.BENDS`).
3. From `tools/`:
   - `python3 build_course.py lantana.osm.json lantana.config.json ../data/lantana.json`
   - `python3 add_ob.py lantana.boundary.osm.json lantana.roads_houses.osm.json lantana.config.json ../data/lantana.json`
   - `python3 fetch_tiles.py 19 33.0740 -97.1305 33.1052 -97.1162 m19.png`, then
     `python3 trees_from_imagery.py ../data/lantana.json m19.png ../data/lantana.json`
   - from the repo root: `python3 tools/elevation.py lantana`

The practice putting green by the clubhouse is left out (`holes.PRACTICE_GREEN`).

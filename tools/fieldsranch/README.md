# Fields Ranch – East and West (PGA Frisco, Frisco, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, bunkers, ponds, some
tee boxes (21 for 36 holes; the others start at the hole line's tee end) and both courses'
36 hole lines. The hole lines carry no course name: each set of 18 lies wholly inside its
course's boundary (Fields Ranch - East Course / - West Course), which tells them apart.
Like Bear Creek, each course file has both courses' shapes and its own 18 holes.

The bunkers are tan native sand, so the imagery's sand mask finds few of them: the best
fit (1 m) is applied, and the bunkers were checked by eye rather than with
bunkers_from_imagery.py (they sit on the bunkers in the picture).

Scorecards from GolfPass. East: the card's pars and handicaps are used (OSM tags #6 as a
par 5 and #18 as a par 4); ratings from 18Birdies, whose tee totals match the card exactly.
West: pars match OSM; ratings from Golf Course Gurus, whose totals match the card exactly.
Combination tees are left out.

1. The OpenStreetMap export, in two halves: bboxes -96.8700,33.1975,-96.8530,33.2165 and
   -96.8530,33.1975,-96.8365,33.2165 (`api/0.6/map.json`), merged into map.json.
2. From `tools/`: `python3 fieldsranch/osm_to_geom.py map.json`, then for east and west:
   `python3 build_course.py fieldsranch-<c>.osm.json fieldsranch-<c>.config.json ../data/fieldsranch-<c>.json`
3. `python3 fieldsranch/trim.py ../data/fieldsranch-east.json ../data/fieldsranch-west.json` drops
   The Swing, the range targets and practice greens (inside the East's OSM boundary).
4. For each: `python3 add_ob.py fieldsranch.boundary.osm.json fieldsranch.roads_houses.osm.json fieldsranch-<c>.config.json ../data/fieldsranch-<c>.json`
5. `python3 fetch_tiles.py 19 33.1975 -96.8700 33.2165 -96.8365 m19.png`, then
   `python3 trees_from_imagery.py ../data/fieldsranch-<c>.json m19.png ../data/fieldsranch-<c>.json`
6. From the repo root: `python3 tools/elevation.py fieldsranch-east` and `fieldsranch-west`.

# Coyote Ridge Golf Club (Carrollton, TX)

Built from the course's yardage book (`yardage-book.pdf`, the vector one, without
the Apple Maps picture) with the shared scripts in `tools/`. OpenStreetMap has only
the course boundary. `course.py` holds the scorecard and the middle of each green
in the imagery.

The greens were found without tracing: each hole page's bunkers and trees, turned by
its north arrow, were slid over the sand and tree canopy in the zoom-19 imagery and
the best spot taken (#7 and #11 searched near their neighbours, as the first pass put
them in houses). The book joins 17 of the 18 pages into one plan through shared trees,
and those greens agree with that plan to 1.1 m, which confirms the routing.

1. `python3 ../fetch_tiles.py 19 33.0230 -96.9455 33.0390 -96.9308 m19.png` — the zoom-19 imagery.
2. From `tools/`: `python3 build_from_book.py coyoteridge coyoteridge/yardage-book.pdf coyoteridge/m19.png ../data/coyoteridge.json [check.png]`
3. OB: the OpenStreetMap export
   `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.948,33.021,-96.928,33.041" -o map.json`,
   then `python3 coyoteridge/osm_boundary.py map.json` and
   `python3 add_ob.py coyoteridge.boundary.osm.json coyoteridge.roads_houses.osm.json coyoteridge.config.json ../data/coyoteridge.json`;
   trees outside the boundary were then removed (no trees in OB).
4. From the repo root: `python3 tools/elevation.py coyoteridge`.

Bunkers checked against the imagery (`hazards_from_imagery.py` + `bunkers_from_imagery.py`):
the three it calls grass are real bunkers in shade (grey sand), and the ten it would add
are range target circles and roofs, so the book's bunkers are kept as they are.

Scorecard from GolfPass; #14's Black yardage is the book's 221 (GolfPass has 211), which
gives the 7,013 the book and GolfNow show.

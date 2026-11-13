Squaw Creek isn't mapped in OpenStreetMap beyond its boundary, so it was built by hand:

1. `build.py` places each hole: green positions found in the imagery, matched to the flags on the
   club's scorecard map (`scorecard-map.webp`) with an affine fit; tees at the scorecard yardage
   from the green, toward where the map shows the tee. One tee box per tee set.
2. `seed.py` writes the course with seed greens (small circles), seed fairways (strips along each
   hole) and the lake (dark, smooth water in the imagery).
3. `detect_sand.py … - 200 55 12`, `trace_turf.py … 20 10 0 25`, `clip.py` (trims leftover
   fairway strips to open grass), `clean_course.py`, then `add_ob.py` with the OSM boundary.

The scripts expect the z19 imagery mosaic from `fetch_tiles.py 19 32.7505 -97.6512 32.7655 -97.6392`
in a `sq/` folder beside them.

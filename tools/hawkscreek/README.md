# Hawks Creek Golf Club (Westworth Village, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par). Only what lies inside the course boundary (relation 7463411) is kept.
The outlines sit 0.5 m east and 1.5 m south of the Esri imagery (measured by fitting all bunkers to the sand)
and are shifted onto it.

Scorecard from GolfPass (12709); its pars match OpenStreetMap's hole tags and its rated yards match the hole yards. Men's ratings, but Silver is rated for women only. Shady Oaks is next door: only what lies inside Hawks Creek's boundary is kept.

Some OSM hole lines start from a middle tee box (the back tees are drawn), so a line can be shorter than the
back tee's yards.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.4380,32.7540,-97.4190,32.7675" -o map.json`
2. `python3 tools/hawkscreek/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py hawkscreek.osm.json hawkscreek.config.json ../data/hawkscreek.json`
   - `python3 fetch_tiles.py 19 32.7554001 -97.4357656 32.7660624 -97.4208105 hawkscreek/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: every OSM bunker is on sand;
     its 15 new finds are dormant grass, paths and a car park, so nothing is added.
   - `python3 add_ob.py hawkscreek.boundary.osm.json hawkscreek.roads_houses.osm.json hawkscreek.config.json ../data/hawkscreek.json`
   - `python3 trees_from_imagery.py ../data/hawkscreek.json hawkscreek/m19.png ../data/hawkscreek.json`
   - from the repo root: `python3 tools/soften_shapes.py data/hawkscreek.json` and `python3 tools/elevation.py hawkscreek`

Dropped (`drop` in the config): nothing.

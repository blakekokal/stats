# Oak Hollow Golf Course (McKinney, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par). Only what lies inside the course boundary (way 595547029) is kept.
The outlines sit 0 m west and 1.0 m south of the Esri imagery (measured by fitting its five bunkers to the sand; the greens agree)
and are shifted onto it.

Scorecard from GolfPass (3149); its pars match OpenStreetMap's hole tags (par 70). Men's ratings; Gold has no published rating.

Some OSM hole lines start from a middle tee box (the back tees are drawn), so a line can be shorter than the
back tee's yards.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.6270,33.2215,-96.6105,33.2315" -o map.json`
2. `python3 tools/oakhollow/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py oakhollow.osm.json oakhollow.config.json ../data/oakhollow.json`
   - `python3 fetch_tiles.py 19 33.2230249 -96.6253114 33.2298893 -96.612051 oakhollow/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: the course has only five
     bunkers; the two it would drop are on sand, and its one new find is by a road, so OSM's are kept as they are.
   - `python3 add_ob.py oakhollow.boundary.osm.json oakhollow.roads_houses.osm.json oakhollow.config.json ../data/oakhollow.json`
   - `python3 trees_from_imagery.py ../data/oakhollow.json oakhollow/m19.png ../data/oakhollow.json`
   - from the repo root: `python3 tools/soften_shapes.py data/oakhollow.json` and `python3 tools/elevation.py oakhollow`

Dropped (`drop` in the config): nothing.

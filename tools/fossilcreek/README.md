# The Golf Club at Fossil Creek (Fort Worth, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par). Only what lies inside the course boundary (relation 15710500) is kept.
The outlines sit 0.25 m east and 1.5 m south of the Esri imagery (measured by fitting all bunkers to the sand)
and are shifted onto it.

Scorecard from GolfPass (2924); its pars match OpenStreetMap's hole tags. Ratings matched to tees by total yards (Palmer = Black 6865, Tournament = Blue 6457, Club = White 6006). Men's ratings, but Forward is rated for women only.

Some OSM hole lines start from a middle tee box (the back tees are drawn), so a line can be shorter than the
back tee's yards.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.3140,32.8460,-97.2870,32.8630" -o map.json`
2. `python3 tools/fossilcreek/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py fossilcreek.osm.json fossilcreek.config.json ../data/fossilcreek.json`
   - `python3 fetch_tiles.py 19 32.848161 -97.3114037 32.8614746 -97.2895905 fossilcreek/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: of the three OSM bunkers it
     would drop, one is on dormant grass (in `drop`); one is in tree shade and one is drawn round its sand, so they stay.
     Its 19 new finds are roofs, yards and dormant grass, so nothing is added.
   - `python3 add_ob.py fossilcreek.boundary.osm.json fossilcreek.roads_houses.osm.json fossilcreek.config.json ../data/fossilcreek.json`
   - `python3 trees_from_imagery.py ../data/fossilcreek.json fossilcreek/m19.png ../data/fossilcreek.json`
   - from the repo root: `python3 tools/soften_shapes.py data/fossilcreek.json` and `python3 tools/elevation.py fossilcreek`

Dropped (`drop` in the config): the practice green by the clubhouse, a bunker on grass, the fairway round a chipping green no hole plays to and a fairway sliver by the water.

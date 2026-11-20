# Sky Creek Ranch Golf Club (Keller, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par). Only what lies inside the course boundary (way 356055952) is kept.
The outlines sit 0.25 m east and 2.25 m south of the Esri imagery (fitting all bunkers to the sand;
the imagery is winter, the greens agree) and are shifted onto it.

Scorecard from GolfPass (12714); its pars match OpenStreetMap's hole tags. Its Professional rating is
for 6953 yds though its hole yards add to 7029. Men's ratings; Forward is rated for women only.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.2230,32.9100,-97.1860,32.9330" -o map.json`
2. `python3 tools/skycreek/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py skycreek.osm.json skycreek.config.json ../data/skycreek.json`
   - `python3 fetch_tiles.py 19 32.9183 -97.2188 32.928 -97.1891 skycreek/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: both OSM bunkers
     it would drop are on sand, and its 13 new finds are houses, paths and dormant grass, so OSM's
     bunkers are kept as they are.
   - `python3 add_ob.py skycreek.boundary.osm.json skycreek.roads_houses.osm.json skycreek.config.json ../data/skycreek.json`
   - `python3 trees_from_imagery.py ../data/skycreek.json skycreek/m19.png ../data/skycreek.json`
   - from the repo root: `python3 tools/soften_shapes.py data/skycreek.json` and `python3 tools/elevation.py skycreek`

Dropped (`drop` in the config): the two practice greens by the clubhouse.

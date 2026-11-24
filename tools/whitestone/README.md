# Whitestone Golf Club (Benbrook, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par). Only what lies inside the course boundary (way 448822379) is kept.
The outlines sit 0.75 m east and 2.0 m south of the Esri imagery (measured by fitting the greens; the bunkers agree)
and are shifted onto it.

Scorecard from GolfPass (22642); its pars match OpenStreetMap's hole tags. Its ratings are for tees about 150 yds shorter than its hole yards add to (Gold 7117 vs 7268, Blue 6615 vs 6774, White 6084 vs 6235, Red 5201 vs 5351); matched by name. Men's ratings, but Red is rated for women only.

Some OSM hole lines start from a middle tee box (the back tees are drawn), so a line can be shorter than the
back tee's yards.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.5070,32.6510,-97.4850,32.6690" -o map.json`
2. `python3 tools/whitestone/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py whitestone.osm.json whitestone.config.json ../data/whitestone.json`
   - `python3 fetch_tiles.py 19 32.6525581 -97.5044238 32.6674016 -97.4867644 whitestone/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: its sand is brown and the
     imagery is winter, so the check calls 22 OSM bunkers grass, but every one is a bunker in the picture; all are kept.
     Its 14 new finds are roofs and yards, so nothing is added.
   - `python3 add_ob.py whitestone.boundary.osm.json whitestone.roads_houses.osm.json whitestone.config.json ../data/whitestone.json`
   - `python3 trees_from_imagery.py ../data/whitestone.json whitestone/m19.png ../data/whitestone.json`
   - from the repo root: `python3 tools/soften_shapes.py data/whitestone.json` and `python3 tools/elevation.py whitestone`

Dropped (`drop` in the config): the three practice greens by the clubhouse and a lone tee by the maintenance yard.

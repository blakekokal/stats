# Waterchase Golf Club (Fort Worth, TX)

Built with no yardage book, from OpenStreetMap (the course's boundary, way 28382130, has no name):
greens, fairways, tee boxes, bunkers, ponds and the 18 hole lines (with par). Only what lies inside the
boundary is kept; the short course and practice greens south of #1 and #2 are dropped with
`trim_far.py`. The imagery is winter and the sand dull, so the bunker fit fails; the shift, 0.3 m west
and 1.0 m north, is fitted to the greens (`fit_shift.py ... green`).

Scorecard from GolfPass (22702); its pars match OpenStreetMap's hole tags (par 72). Its tee table rates
other lengths (Black 7289, Gold 7006, Blue 6661, White 6175, Green 5524, Red 4941 yards) than the card's
tees, so no ratings are given.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.1645,32.7590,-97.1475,32.7795" -o map.json`
2. `python3 tools/waterchase/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py waterchase.osm.json waterchase.config.json ../data/waterchase.json`
   - `python3 trim_far.py ../data/waterchase.json 15 45 32.7600,-97.1570,32.7656,-97.1490`
   - `python3 fetch_tiles.py 19 32.7601 -97.1635 32.7785 -97.1484 waterchase/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: winter imagery,
     dull sand (it would drop 29 of 50, on sand in the picture), so OSM's are kept.
   - `python3 add_ob.py waterchase.boundary.osm.json waterchase.roads_houses.osm.json waterchase.config.json ../data/waterchase.json`
   - `python3 trees_from_imagery.py ../data/waterchase.json waterchase/m19.png ../data/waterchase.json`
   - from the repo root: `python3 tools/soften_shapes.py data/waterchase.json` and `python3 tools/elevation.py waterchase`

# Riverside Golf Club (Grand Prairie, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par, which matches the club's card). The outlines sit
0.5 m east and 1.8 m south of the Esri imagery (measured by fitting all bunkers to the
sand) and are shifted onto it. The imagery is winter, dormant grass, so only about half
the bunker area reads as sand; the fit is still clear.

Scorecard from GolfPass (2972). Men's ratings; Red is rated for women only.

#13 and #18 share one big double green: their pins are the ends of their own hole lines
(`pinAtLineEnd` in the config), not the middle of the double green.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.0687,32.7914,-97.0527,32.8168" -o map.json`
2. From `tools/riverside/`: `python3 osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py riverside.osm.json riverside.config.json ../data/riverside.json`
   - `python3 fetch_tiles.py 19 32.7924 -97.0675 32.8158 -97.0544 riverside/m19.png`; bunkers checked with
     `hazards_from_imagery.py` + `bunkers_from_imagery.py`: four OSM bunkers drawn on plain grass,
     beside the real ones, are dropped; the other four it flags sit on sand in shade or half on a
     neighbouring bunker and are kept; nothing added (bare dirt, pale fairway).
   - `python3 add_ob.py riverside.boundary.osm.json riverside.roads_houses.osm.json riverside.config.json ../data/riverside.json`
   - `python3 trees_from_imagery.py ../data/riverside.json riverside/m19.png ../data/riverside.json`
   - from the repo root: `python3 tools/soften_shapes.py data/riverside.json` and `python3 tools/elevation.py riverside`

Dropped (`drop` in the config): two practice greens, the four grass bunkers, and seven ponds
and river reaches outside the course boundary.

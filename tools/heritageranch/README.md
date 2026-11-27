# Heritage Ranch Golf & Country Club (Fairview, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways (mostly multipolygon relations), tee boxes,
bunkers, ponds and the 18 hole lines (with par). The course boundary is three ways (570328263, 570328257 and
570328258; the survey counted 11 holes from the first alone), joined; only what lies inside is kept. The practice
greens and range tee are dropped with `trim_far.py`; the chipping area by the clubhouse, a fairway sliver and one
OSM bunker on grass with `drop`. The outlines sit 2.0 m east and 0.5 m south of the Esri imagery (bunker fit; the
greens agree) and are shifted onto it.

Scorecard from GolfPass (22891); its pars match OpenStreetMap's hole tags (par 72). Combination tees left out. Its
tee table names the tees differently; ratings matched by total yards (men's): Black = its Blue (6988), Blue = its
White (6472), White = Bronze (6051), Gold, Red, Green.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.6000,33.1295,-96.5815,33.1510" -o map.json`
2. `python3 tools/heritageranch/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py heritageranch.osm.json heritageranch.config.json ../data/heritageranch.json`
   - `python3 trim_far.py ../data/heritageranch.json`
   - `python3 fetch_tiles.py 19 33.1301 -96.5990 33.1505 -96.5826 heritageranch/m19.png`
   - `python3 add_ob.py heritageranch.boundary.osm.json heritageranch.roads_houses.osm.json heritageranch.config.json ../data/heritageranch.json`
   - `python3 trees_from_imagery.py ../data/heritageranch.json heritageranch/m19.png ../data/heritageranch.json`
   - from the repo root: `python3 tools/soften_shapes.py data/heritageranch.json` and `python3 tools/elevation.py heritageranch`

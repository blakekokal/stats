# Indian Creek Golf Club – Creek and Lakes (Carrollton, TX)

Built with no yardage book, from OpenStreetMap, which maps both courses in full: greens,
fairways, tee boxes, bunkers, ponds and all 36 hole lines (tagged `golf:course:name` =
"Creek Course" / "Lakes Course", with par and handicap). The two courses share one boundary
and one set of outlines (like Bear Creek), so both course files hold every feature and the
app marks them as sharing (`shares` in `js/app.js`). The outlines sit on the Esri imagery
as they are (no shift needed).

Scorecard (tees, men's ratings, slopes, yardages) from GolfPass. Pars and handicaps from
OpenStreetMap; they match GolfPass except Creek holes 10 and 12, whose handicaps GolfPass has
the other way round (10 and 12 instead of 12 and 10). GolfPass's Creek card also lists tee
lengths ~200 yd longer than its own hole yardages add up to; the hole yardages are used.

1. The OpenStreetMap export (the plain API, in four parts to stay under its node limit):
   `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=<b>" -o m_<b>.json` for
   `-96.95,32.99,-96.92,33.01`, `-96.92,32.99,-96.89,33.01`, `-96.95,33.01,-96.92,33.03`, `-96.92,33.01,-96.89,33.03`.
2. From `tools/indiancreek/`: `python3 osm_to_geom.py m_*.json` writes `../indiancreek.osm.json`,
   `../indiancreek.boundary.osm.json` and `../indiancreek.roads_houses.osm.json`.
3. From `tools/`, for `c` in `creek` and `lakes`:
   - `python3 build_course.py indiancreek.osm.json indiancreek-$c.config.json ../data/indiancreek-$c.json`
   - `python3 add_ob.py indiancreek.boundary.osm.json indiancreek.roads_houses.osm.json indiancreek-$c.config.json ../data/indiancreek-$c.json`
   - `python3 fetch_tiles.py 19 32.9945 -96.9445 33.0125 -96.9265 indiancreek/m19.png` (once), then
     `python3 trees_from_imagery.py ../data/indiancreek-$c.json indiancreek/m19.png ../data/indiancreek-$c.json`
   - from the repo root: `python3 tools/elevation.py indiancreek-$c`

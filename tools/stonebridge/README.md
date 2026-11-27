# Stonebridge Ranch Country Club – Dye (McKinney, TX; private)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers (including Pete Dye's long
waste areas), ponds and the 18 hole lines (with par). The course boundary is two ways, 518448847 and 595547874
(#3 and #4, across the road; the survey counted 17 holes from the first alone), joined. The practice area east of
the clubhouse is dropped with `trim_far.py` (in a box, which keeps the big waste bunker between #1 and #10), a
practice green by #2's tee and one OSM bunker on grass with `drop`. The imagery is winter and the sand dull, so the
outlines are fitted to the greens: 1.7 m west and 1.0 m south of the Esri imagery, shifted onto it.

Scorecard from GolfPass (3153, the Dye Course); its pars match OpenStreetMap's hole tags (par 72); its handicaps
differ from OSM's and are used. The Bold combination is left out. Ratings where the tee table's length fits (within
1%): Black, Gold, Blue men's; Green and Red women's; White's is for 6304 yards (card: 6139), so none.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.7250,33.1865,-96.7070,33.2045" -o map.json`
2. `python3 tools/stonebridge/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py stonebridge.osm.json stonebridge.config.json ../data/stonebridge.json`
   - `python3 trim_far.py ../data/stonebridge.json 15 45 33.1935,-96.7145,33.1990,-96.7090`
   - `python3 fetch_tiles.py 19 33.1870 -96.7240 33.2040 -96.7075 stonebridge/m19.png`
   - `python3 add_ob.py stonebridge.boundary.osm.json stonebridge.roads_houses.osm.json stonebridge.config.json ../data/stonebridge.json`
   - `python3 trees_from_imagery.py ../data/stonebridge.json stonebridge/m19.png ../data/stonebridge.json`
   - from the repo root: `python3 tools/soften_shapes.py data/stonebridge.json` and `python3 tools/elevation.py stonebridge`

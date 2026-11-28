# Dallas Athletic Club – Blue (Dallas, TX; private)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers, ponds, the creek and
the hole lines. One boundary (way 28469868) holds both courses; the hole lines carry no course name: ways
698070915-698136064 (with handicap tags) are the Blue's, 893752399-893752417 the Gold's. The practice area
and short holes in the middle of the site are dropped with `trim_far.py` (in a box, counting the Gold's
holes too). The outlines sit 3.0 m east and 0.5 m south of the Esri imagery (bunker fit; the greens roughly
agree) and are shifted onto it.

Only the **Blue** is live. The Gold's hole lines agree with GolfPass's card (2854) except #16-#18: OSM has a
423-yard par 4, a 198-yard par 3 and a 608-yard par 5 (ending at the clubhouse), the card a 571-yard par 5,
a 141-yard par 3 and a 454-yard par 4. The TXGA's Dec 2024 Winter Classic yardages (571, 141, 425) confirm the
card, so it's OSM's last three holes that are off; the imagery doesn't settle their routing (a green near #15/#16
belongs to no OSM hole). Needs the club's course map.

Bunkers: the imagery's sand check, judged by eye: 20 OSM bunkers on grass with no sand are dropped (`drop`;
many by greens reshaped since), the rest are tan sand or shaded; two white greenside bunkers it found are
added (`keep_found_bunkers.py`).

Scorecard from GolfPass (2865); its pars match OpenStreetMap's hole tags (par 72); its handicaps differ from
OSM's and are used. Its tee table rates other lengths than the card's star tees, so no ratings are given.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.6555,32.8360,-96.6340,32.8525" -o map.json`
2. `python3 tools/dac/osm_to_geom.py map.json`
3. From `tools/` (imagery: `python3 fetch_tiles.py 19 32.8370 -96.6542 32.8515 -96.6354 dac/m19.png`):
   - `python3 build_course.py dac-blue.osm.json dac-blue.config.json ../data/dac-blue.json`
   - the Gold's holes, for the trim: build `dac-gold.osm.json` with a config like the Blue's (Gold pars
     4,3,5,4,3,4,4,4,4,4,5,4,5,4,3,4,3,5, same shift) to `gold.json`, then
     `python3 trim_far.py ../data/dac-blue.json 15 45 32.8398,-96.6515,32.8452,-96.6430 gold.json`
   - `hazards_from_imagery.py`, `bunkers_from_imagery.py ... checked.json`, then
     `python3 keep_found_bunkers.py ../data/dac-blue.json checked.json ../data/dac-blue.json 32.85042,-96.648304 32.850449,-96.648905`
   - `add_ob.py dac.boundary.osm.json dac.roads_houses.osm.json dac-blue.config.json ../data/dac-blue.json`, `trees_from_imagery.py`
4. From the repo root: `python3 tools/soften_shapes.py data/dac-blue.json` and `python3 tools/elevation.py dac-blue`

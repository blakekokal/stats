# Maridoe Golf Club (Carrollton, TX; private)

OpenStreetMap ("Maridoe Golf Club", way 321513687) has all 18 hole lines with greens, tee boxes, bunkers, fairways
and ponds, but its hole numbers are not the club's. GolfPass's card (2813, par 72; the course rebuilt in 2017) fits
once renumbered: OSM's 9-12, 5, 6, 16, 17, 8 are the card's 1-9 and OSM's 1-4, 13, 14, 15, 7, 18 its 10-18. Every
hole's par then matches (OSM tags its #7, the card's 604-yard 17th, par 4), the lengths are within a few percent of
the Red tees, #1 and #10 start and #9 and #18 finish by the clubhouse, and every green is 34-122 m from the next tee.
`osm_to_geom.py` does the renumbering.

The imagery is winter (dormant fairways, dull sand), so the shift (1.8 m west, 0.3 m north) is fitted to the greens.
Of OSM's bunkers, one on grass and two drawn in a pond are dropped (`drop`) and one by #8's green is added from the
imagery (`keep_found_bunkers.py`). `trim_far.py` drops the practice greens. The card's tee table (Plate, One-Four)
rates lengths that match none of its seven yardage rows, so no ratings are given.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.8800,32.9585,-96.8620,32.9700" -o map.json`
2. `python3 tools/maridoe/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py maridoe.osm.json maridoe.config.json ../data/maridoe.json`
   - `python3 trim_far.py ../data/maridoe.json`
   - `python3 fetch_tiles.py 19 32.9585 -96.8800 32.9700 -96.8620 maridoe/m19.png`
   - `python3 hazards_from_imagery.py ../data/maridoe.json maridoe/m19.png haz.json` and
     `python3 bunkers_from_imagery.py ../data/maridoe.json haz.json maridoe/m19.png chk.json`, then
     `python3 keep_found_bunkers.py ../data/maridoe.json chk.json ../data/maridoe.json 32.961406,-96.864599`
   - `python3 add_ob.py maridoe.boundary.osm.json maridoe.roads_houses.osm.json maridoe.config.json ../data/maridoe.json`
   - `python3 trees_from_imagery.py ../data/maridoe.json maridoe/m19.png ../data/maridoe.json`
   - from the repo root: `python3 tools/soften_shapes.py data/maridoe.json` and `python3 tools/elevation.py maridoe`

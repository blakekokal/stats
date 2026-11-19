# The Trails of Frisco Golf Club (Frisco, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par, which matches the club's card). Only what lies
inside the course boundary (way 274445699) is kept.

The Esri imagery is winter: the fairways are dormant and tan, so the sand test reads them
as sand and a bunker fit is fooled (it said 8 m north). The greens are overseeded and
bright green, so the shift is fitted to them instead: the outlines sit 1.25 m east and
0.25 m north of the imagery and are shifted onto it. On that fit OSM's bunkers sit right
on the real ones (darker than the dormant grass), so they are kept as drawn; the imagery
check would have dropped 21 and added 15 houses and pools, so it is not used.

Scorecard from GolfPass (22710). It names the rated tees Championship, Back, Middle and
Forward; matched by total yards to Black, Blue, White and Red.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.8851,33.1606,-96.8611,33.1811" -o map.json`
2. `python3 tools/trailsfrisco/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py trailsfrisco.osm.json trailsfrisco.config.json ../data/trailsfrisco.json`
   - `python3 fetch_tiles.py 19 33.1639 -96.8822 33.1783 -96.8641 trailsfrisco/m19.png`
   - `python3 add_ob.py trailsfrisco.boundary.osm.json trailsfrisco.roads_houses.osm.json trailsfrisco.config.json ../data/trailsfrisco.json`
   - `python3 trees_from_imagery.py ../data/trailsfrisco.json trailsfrisco/m19.png ../data/trailsfrisco.json`
   - from the repo root: `python3 tools/soften_shapes.py data/trailsfrisco.json` and `python3 tools/elevation.py trailsfrisco`

Dropped (`drop` in the config): three practice greens, a second, bigger outline OSM draws
round #16's green (out over the creek), and one bunker on plain grass.

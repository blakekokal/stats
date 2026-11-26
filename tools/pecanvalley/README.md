# Pecan Valley Golf Course – Hills (Fort Worth, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers, ponds
and the hole lines (with par and `golf:course:name`). One boundary (relation 8908077) holds both
the Hills and River courses; each config picks its holes by `courseName`. Mira Vista's holes next
door lie outside the boundary and are left out.

Only the **Hills** is live. OSM's River course has no fairways on #4, #5, #7, #8, #9, #10, #14
and #15 and no greens on #9 and #14 (both greens are plain in the imagery); the winter imagery
doesn't show its fairways, so it waits for summer imagery or a yardage book.
`pecanvalley-river.config.json` is ready for it.

The imagery is winter (dormant grass) and the sand tan, so the bunker fit fails; the shift,
0 m east and 1.0 m north, is fitted to the greens (`fit_shift.py ... green`).

Scorecards from GolfPass: Hills (2910), par 72, pars match OSM; men's ratings, the White/Red
combination tee left out. River (2919), par 70, pars match OSM.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-97.4660,32.6500,-97.4400,32.6700" -o map.json`
2. `python3 tools/pecanvalley/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py pecanvalley.osm.json pecanvalley-hills.config.json ../data/pecanvalley-hills.json`
   - `python3 fetch_tiles.py 19 32.6516 -97.4628 32.6647 -97.4424 pecanvalley/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: four OSM
     bunkers on sunlit grass with no sand are dropped (`drop`); the others it would drop are tan sand or
     in shade; its finds are bare ground, so none are added.
   - `python3 add_ob.py pecanvalley.boundary.osm.json pecanvalley.roads_houses.osm.json pecanvalley-hills.config.json ../data/pecanvalley-hills.json`
   - `python3 trees_from_imagery.py ../data/pecanvalley-hills.json pecanvalley/m19.png ../data/pecanvalley-hills.json`
   - from the repo root: `python3 tools/soften_shapes.py data/pecanvalley-hills.json` and `python3 tools/elevation.py pecanvalley-hills`

Dropped (`drop`): the driving range (mapped as a fairway with a green), its two tees and a practice
bunker, the practice green by the clubhouse (with the fairway round it), and the four bunkers above.

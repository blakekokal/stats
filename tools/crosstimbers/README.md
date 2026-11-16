# Cross Timbers Golf Course (Azle, TX)

Traced from Esri World Imagery, with no OpenStreetMap outlines.

1. `python3 ../fetch_tiles.py 19 32.8725 -97.5730 32.8873 -97.5582 m19.png` — the imagery.
2. `python3 feat.py` — colour and texture per pixel (`feat.npz`).
3. `python3 seg.py` — masks for water, trees, turf, greens and fairways (`masks.npz`).
4. `python3 build.py ../../data/crosstimbers.json` — the course file.

`holes.py` holds what was worked out by eye: each hole's line (back tee, bends,
green) in zoom-18 mosaic pixels, the bunker positions, and the scorecard. The
routing was matched to the scorecard yardages; there are no tee boxes visible
in the imagery, so each tee's box is placed on the hole's first leg at its
scorecard yardage. Trees are the dark pixels within 60 m of a hole, split by
nearest hole.

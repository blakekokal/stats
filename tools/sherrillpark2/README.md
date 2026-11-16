# Sherrill Park Golf Course – Course 2 (Richardson, TX)

OpenStreetMap has only the club's boundary. Course 2 is the eighteen south of
East Lookout Drive (Course 1 is to the north).

1. `python3 ../fetch_tiles.py 18 32.9775 -96.6960 32.9967 -96.6832 m18.png` — the Esri imagery (both courses).
2. `python3 parse_book.py book.pdf` — reads the yardage book (a Shot Pattern PDF; hole n is page 3+2n)
   into `book.json`: each hole's green point, every marked tee, the scale and the north arrow, in page points.
3. `mkdir book && pdfimages -png book.pdf book/im` — the book's own picture of each hole.
4. `python3 build.py ../../data/sherrillpark2.json [check.png]` — the course file, and a picture to check it by eye.

What comes from where:

- **Tees**: a 10 m x 7 m box at every tee the book marks, lying along the hole. The book's page is
  turned by its north arrow and scaled by its yardage, with its green point on the middle of the
  green traced from the imagery; the tees land on the tee pads in the imagery.
- **Hole lines**: tee to green, with one bend on a dogleg (where the book's distance is more than
  6 yards longer than straight), placed in the middle of the pictured strip so the line is as long as the book says.
- **Fairways**: the green winter turf in the book's pictures, within 27 m of the hole's line,
  25 yards past the last tee and 13 m short of the green; at most three pieces a hole, none on par 3s.
- **Greens, ponds, bunkers**: from the Esri imagery. `holes.py` has a point on each green
  (numbered from a GPS app's routing map), the club's scorecard and the pale ground that is not sand.
- No trees: they are drawn in the app.

# Shot Tracker

A golf stat tracker for Bridlewood Golf Club (Flower Mound, TX) and Bear Creek
Golf Club – West and East (DFW Airport, TX) and Cowboys Golf Club (Grapevine, TX) and Tangle Ridge Golf Club (Grand Prairie, TX) and Squaw Creek Golf Course (Willow Park, TX) and Cross Timbers Golf Course (Azle, TX) and Sherrill Park Golf Course #1 and #2 (Richardson, TX) and Tour 18 Golf Course Dallas (Flower Mound, TX) and Lantana Golf Club (Lantana, TX) and Lake Park Golf Course – Championship and Executive (9 holes) (Lewisville, TX) and Coyote Ridge Golf Club (Carrollton, TX) and Firewheel Golf Park – Lakes (Garland, TX) and Texas Star Golf Course (Euless, TX) and Iron Horse Golf Course (North Richland Hills, TX) and Indian Creek Golf Club – Creek and Lakes (Carrollton, TX) and Fields Ranch – East and West (PGA Frisco, Frisco, TX) and Cedar Crest Golf Course (Dallas, TX) and Stevens Park Golf Course (Dallas, TX) and Tierra Verde Golf Club (Arlington, TX) and Riverside Golf Club (Grand Prairie, TX) and Prairie Lakes Golf Course – Red, White and Blue nines (Grand Prairie, TX) and Cottonwood Valley Golf Course (Irving, TX) and The Trails of Frisco Golf Club (Frisco, TX) and The Golf Club at Twin Creeks (Allen, TX) and Woodbridge Golf Club (Sachse, TX) and Buffalo Creek Golf Club (Heath, TX) and The Tribute Golf Club and Old American Golf Club (The Colony, TX) and Sky Creek Ranch Golf Club (Keller, TX) and Rockwall Golf & Athletic Club (Rockwall, TX) and The Golf Club at Fossil Creek (Fort Worth, TX) and Whitestone Golf Club (Benbrook, TX) and Hawks Creek Golf Club (Westworth Village, TX) and Oak Hollow Golf Course (McKinney, TX) and Tenison Park Golf Course – Highlands and Glen (Dallas, TX) and The Resort Golf Club and Pecan Valley Golf Course – Hills (Fort Worth, TX) and Texas Rangers Golf Club (Arlington, TX) and Grover C. Keaton Golf Course (Dallas, TX) and Duck Creek Golf Club (Garland, TX) and The Courses at Watters Creek – Traditions (Plano, TX) and Rusted Rail Golf Club (Crandall, TX) and The Golf Club at Champions Circle and Waterchase Golf Club (Fort Worth, TX); pick the course on New Round or GPS Overview. It shows each hole on
satellite imagery with mapped outlines for fairway, rough, bunker, water and
green, and a movable target for measuring distances. GPS is optional: the
**GPS** button on a hole shows where the phone is (a blue dot) and its distance
to the pin, and **Shot here** records a shot finishing at that spot (the **+**
button records the crosshair as always; putts are not recorded by GPS). It only
works while the app is open on screen.

It is a static site with no build step: open `index.html` through any web
server, or host the repo with GitHub Pages.

    python3 -m http.server 8000

## Using it

- **Home**: version number, tee choice and the list of holes.
- **Holes**: each hole is shown with the tee at the bottom and the green at
  the top, with only that hole's fairways, green and tees outlined (plus any
  bunker or water near it). A crosshair dot stays a third of the way down the screen; pan, zoom
  or rotate the map under it to see how far that spot is from the tee, how far
  is left to the pin, and the strokes gained by a tee shot finishing there.
  The top-right corner shows the expected strokes for the hole. Tapping it opens
  the handicap levels to compare to (tap one to set the benchmark) and the
  scorecard filled in with what that handicap level is expected to shoot on
  each hole, front nine, back nine and round, from the scorecard yardage for
  your tees. **Lines** shows or hides the outlines.
  **Width** measures the fairway
  along an arc through the crosshair (every point on it is the same distance
  from the tee). **Arc** draws a dispersion arc there, 10 to 80 yards wide in
  total, set with the slider. **Comp** (left side) compares 2–3 clubs on one
  target line: each is drawn as an arc at its yardage, sized to its arc width,
  with the average strokes gained over the spots that arc covers. Drag a club's
  dot to give it its own line (tap it to put it back); lines reset after each shot. The tee and pin dots can be dragged. The tee
  starts on the hole's tee box whose yardage is closest to the scorecard's for
  the chosen tees.
- **Course** (admin accounts only, listed in `config.js` by email hash; the
  Course tab and Edit boundaries are hidden for everyone else, and only an
  admin's saved edits are used): fix or redraw any outline. Anything inside no outline is rough.
- **Edit boundaries** (GPS Overview, ☰ menu): edits only the boundaries of the hole
  on screen (the ones its map outlines). Tap one to select it, drag the ✥ in its middle to move the
  whole shape, the ⤡ at its corner (or Size − / +) to resize it, drag its white points (drag a small dot
  between two to add a point; tap a point to delete it), change its type,
  cut it in two between two corners (✂ Cut; on the course OB line, a
  cut through OB cuts off the OB beyond it as its own shape, and a cut across
  the course picks the stretch of line between them to drag as one unit), or delete it. A
  cut-out in the course OB is removed by tapping one of its corners, then
  **Delete cutout**. **Draw new boundary** picks a type (fairway, rough, bunker, water,
  recovery, tee box, green, OB) and adds corners where you tap. A rough
  boundary overrides fairway and recovery. Fairways, tee boxes, greens and rough drawn or edited
  there stay tied to that hole. Tee boxes are labelled with the tee sets that play
  from them and their yardage. ‹ › move between holes while editing; one Save keeps the edits
  from every hole on this device.
- **Out of bounds**: everything outside the course boundary (from OpenStreetMap,
  built with `tools/add_ob.py`) is OB, drawn as one white line. A shot finishing
  there is stroke and distance: a penalty stroke and the next shot from the same
  spot (−2 strokes gained), and the SG heat map and Comp arcs score it that way.
- **Stats**: strokes gained per 18 holes by category (off the tee, approach,
  around the green, putting), plus fairways, greens in regulation and putts,
  compared to any handicap level (defaults to the one on your profile).
- **Account**: log in with the same account as the coaching app. Your
  strokes-gained handicap is saved on that shared profile.
- **Settings**: offline imagery, backup, rounds.

## Recording a hole

Tap **+** to record where each shot finished. When a shot reaches the green,
move the crosshair onto the hole and tap **Set pin**; putts are then recorded in
feet. Tap **Holed** to finish. A shot that finishes in water costs a penalty
stroke.

## Published course outlines

An admin's outline edits (Course page or Edit boundaries) are saved on the
device and published to the `course_edits` table, which everyone can read and
only admins can write, so they go live for every account. The table is created
once by running `COURSE_EDITS_SQL` (`js/store.js`) in the Supabase SQL editor.
Reset to original on the Course page takes a course's published edits down.

## Live view

While scoring a round (logged in), the **Live** button on the hole screen opens
a box with a Live on/off switch and a share link (`#/live/<id>`). Anyone with
the link, logged in or not, sees the round read-only: they can step through the
holes, tap a shot for its distance, club and strokes gained, open the scorecard
and tap **Refresh** (it also refreshes by itself every 20 seconds while live).
Every shot recorded or edited is copied to the `live_rounds` table. Live is on
from the start of a round until it is turned off or the round ends; off freezes
what viewers see, and the finished round is always posted when it is submitted,
so the link keeps working afterwards. The table is created once by running
`LIVE_SQL` (`js/store.js`) in the Supabase SQL editor: only the owner can write
a row, and rows can only be read one at a time by their share id.

## Coaching

The **Coaching** button on Home is the coaching app's Coaching section
(`js/coaching`, ported from its `v6/js/coaching` modules and page markup). It
uses the same accounts and the coaching app's own tables (`coach_students`,
`coach_teams`, `coach_notes`, `coach_messages`, `coach_drill_assignments`,
`coach_combine_assignments`, `coach_requests`, `notifications`, `profiles`), so
anything done in one app shows in the other.

- **Students** see their coach's feedback, assigned drills and combines (and
  mark them done), goals and handicap, messages, and their invite code.
- **Coaches** (role `coach` on the profile, or an admin) get activity, notes,
  assignments, messages, students and teams. Opening a student shows their
  dashboard and rounds **from this app's GPS rounds**, plus notes, goals, bag
  and schedule. A round opens read-only on the hole screen, and students who
  are playing right now are listed under **Live now** with a Watch button.
- Assigned combines and drills open in **Practice and Learning** (below).

A coach reads a student's rounds through two database functions that only
answer for students on the caller's roster. Create them once by running
`COACHING_SQL` (`js/store.js`) in the Supabase SQL editor (after `LIVE_SQL`).

## My Bag, Performance Analysis, Practice and Learning

These Home buttons are also the coaching app's own pages (`js/bag`,
`js/performance`, `js/practice`, `js/learn`, `js/combines`, with their markup in
`js/coaching/markup-more.js` and pictures in `assets/`). All of the coaching
app's pages are built once into `#coachroot` (`js/coaching/root.js`) and shown
one at a time; they use the coaching app's tables, so combines, practice
sessions, plans and the bag are the same in both apps.

- **My Bag**: tap a club to edit its carry, total and ¾ yardages, label and
  arc width (the arc width is this app's, used by Arc → Auto on a hole); add,
  remove or import clubs (CSV, or Excel when online), plus Find Yardages,
  Wedge Gapping, Speed and the Gap Visualizer. The bag is saved on the shared
  profile and is what the hole screen's club list uses.
- **Performance Analysis**: built from the last 10 rounds played **in this
  app**, compared to the handicap level on your profile; the Combines page uses
  the shared combine scores.
- **Practice and Learning**: combines (evaluation test, putting, short game,
  wedges, line drill, driver), practice plans, log and swing journal, drills,
  and the learning tools.
- Not brought over: the coaching app's own round entry, Help page and viewing
  the whole app as a student.

## Accounts and sync

Accounts are the ones in the coaching app's Supabase project (`config.js`).
This app keeps its rounds in its own table there, `shot_tracker_docs`, which is
created once by running the SQL in `SETUP_SQL` (`js/store.js`) in the Supabase
SQL editor. Rounds are saved on the device and synced whenever you are logged
in; each document syncs whole and the most recently changed copy wins.

## Expected strokes

`js/expected-data.js` is generated from the expected-strokes workbook (strokes
to hole out by lie, distance and handicap level):

    python3 tools/build_expected.py expected_strokes.xlsx js/expected-data.js

## Course data

`data/bridlewood.json` is generated from OpenStreetMap by
`tools/build_course.py` (inputs: `tools/bridlewood.osm.json`, an Overpass
export, and `tools/bridlewood.config.json`, the scorecard and fixes).

    python3 tools/build_course.py tools/bridlewood.osm.json tools/bridlewood.config.json data/bridlewood.json

Course outlines © OpenStreetMap contributors (ODbL). Imagery © Esri and its
data providers, loaded from Esri World Imagery at run time.

## Adding a course

1. Export its OpenStreetMap golf features (`nwr["golf"]`, water and the
   `leisure=golf_course` outline) and its roads and buildings with Overpass.
2. Write `tools/<id>.config.json` (pars, handicaps, tees; `courseName` picks
   one course where several share the grounds).
3. `python3 tools/build_course.py <osm> <config> data/<id>.json`, then
   `python3 tools/add_ob.py <osm> <roads_houses> <config> data/<id>.json`.
4. Optional, when OSM is out of date or loose: download the imagery with
   `tools/fetch_tiles.py`, replace the bunkers with the sand it shows using
   `tools/detect_sand.py`, fit the fairways and greens to the turf with
   `tools/trace_turf.py`, then run `add_ob.py` again.
5. `python3 tools/clean_course.py data/<id>.json` merges overlapping outlines.
6. Add it to `COURSES` in `js/app.js`.

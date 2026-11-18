#!/bin/sh
# Cowboys: redraw the greens and the fairway round each green from the zoom-19
# imagery, then soften only the shapes that changed. Run from the repo root.
#   sh tools/cowboys/rebuild_greens.sh
set -e
T=$(mktemp -d)
python3 tools/greens_from_imagery.py data/cowboys.json "$T/new.json" "$T/check" "$T/tiles"
python3 - "$T" <<'PY'
import json, subprocess, sys
T = sys.argv[1]
d = json.load(open(f'{T}/new.json')); ch = json.load(open(f'{T}/new.json.changed'))
json.dump({**d, 'features': [d['features'][i] for i in ch]}, open(f'{T}/changed.json', 'w'))
subprocess.run(['python3', 'tools/soften_shapes.py', f'{T}/changed.json'], check=True)
soft = json.load(open(f'{T}/changed.json'))['features']
for i, f in zip(ch, soft): d['features'][i] = f
json.dump(d, open('data/cowboys.json', 'w'), separators=(',', ':'))
PY
echo "pictures of each green: $T/check"

#!/usr/bin/env bash
# Run before every merge into main (after merging the latest main in).
# Catches the things that have broken the live app when two sessions release
# at once: an empty or mangled js/version.js, a version that doesn't match
# What's New, duplicate versions, leftover merge-conflict markers, and
# JavaScript that doesn't parse. With --page it also loads the start page in
# a headless browser and fails on any page error (a blank app).
#
#   tools/check_release.sh          # quick checks
#   tools/check_release.sh --page   # plus load the app (needs Playwright)
set -u
cd "$(dirname "$0")/.."
fail=0
bad() { echo "FAIL: $*"; fail=1; }

# 1. js/version.js exports a version.
ver=$(sed -n "s/^export const VERSION = '\([0-9][0-9.]*\)';$/\1/p" js/version.js)
[ -n "$ver" ] || bad "js/version.js has no \"export const VERSION = 'x.y.z';\" line (it is $(wc -c < js/version.js) bytes)"

# 2. The newest What's New entry is that version, and no version appears twice.
top=$(grep -o "^  \['[0-9][0-9.]*'" js/coach.js | head -1 | tr -d " ['")
[ "$top" = "$ver" ] || bad "What's New (js/coach.js CHANGES) starts with '$top' but js/version.js says '$ver'"
dups=$(grep -o "^  \['[0-9][0-9.]*'" js/coach.js | tr -d " ['" | sort | uniq -d)
[ -z "$dups" ] || bad "What's New has the same version more than once: $dups"

# 3. Higher than what's live on main (skipped if main can't be read).
if git fetch -q origin main 2>/dev/null; then
  mainver=$(git show origin/main:js/version.js 2>/dev/null | sed -n "s/^export const VERSION = '\([0-9][0-9.]*\)';$/\1/p")
  if [ -n "$mainver" ] && [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    newest=$(printf '%s\n%s\n' "$mainver" "$ver" | sort -V | tail -1)
    { [ "$newest" = "$ver" ] && [ "$ver" != "$mainver" ]; } || bad "version $ver is not higher than main's $mainver (merge main in, then bump from main's number)"
  fi
fi

# 4. No merge-conflict markers left anywhere in the app.
markers=$(grep -rlE '^(<<<<<<<|>>>>>>>)( |$)|^=======$' js css index.html sw.js 2>/dev/null)
[ -z "$markers" ] || bad "merge-conflict markers in: $markers"

# 5. Every module parses.
for f in $(find js -name '*.js'); do
  out=$(node --input-type=module --check < "$f" 2>&1) || bad "$f does not parse: $(echo "$out" | grep -m1 Error)"
done

# 6. Optional: the app actually starts.
if [ "${1:-}" = "--page" ]; then
  port=8799
  python3 -m http.server $port >/dev/null 2>&1 & srv=$!
  sleep 1
  node -e "
    const { chromium } = require('playwright');
    (async () => {
      const b = await chromium.launch(); const p = await b.newPage(); const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.goto('http://localhost:$port/'); await p.waitForTimeout(3000);
      const txt = await p.innerText('body');
      await b.close();
      if (errs.length) { console.log('FAIL: page error: ' + errs[0]); process.exit(1); }
      if (!txt.includes('v$ver')) { console.log('FAIL: the start page does not show v$ver (blank app?)'); process.exit(1); }
    })();" || fail=1
  kill $srv 2>/dev/null
fi

[ $fail = 0 ] && echo "OK: release $ver looks good" || exit 1

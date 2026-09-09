#!/usr/bin/env bash
# Downloads the free Unsplash photography used by the site into client/public/images.
# Re-run any time to refresh assets. Each URL is verified before download.
set -u
DIR="$(cd "$(dirname "$0")/.." && pwd)/client/public/images"
mkdir -p "$DIR"

fetch() {
  local id="$1" out="$2" w="${3:-1600}" q="${4:-78}"
  local url="https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=${q}"
  if curl -sfL -m 60 "$url" -o "$DIR/$out"; then
    echo "OK   $out"
  else
    echo "FAIL $out ($id)"
  fi
}

# Hero & feature imagery
fetch 1473448912268-2022ce9509d8 hero.jpg 2000 80
fetch 1441974231531-c6227db76b6e project-greenvalley.jpg 1600 78
fetch 1439066615861-d1af74d74000 project-lakeview.jpg 1600 78
fetch 1486406146926-c627a92ad1ab project-metro.jpg 1600 78
fetch 1470071459604-3b5ec3a7fe05 highlight.jpg 1600 78
fetch 1521737604893-d14cc237f11d about.jpg 1400 78
fetch 1564013799919-ab600027ffc6 cta-home.jpg 2000 80
fetch 1449034446853-66c86144b0ad invest-city.jpg 1600 78

# Categories
fetch 1600596542815-ffad4c1539a9 cat-residential.jpg 1200 76
fetch 1497366754035-f200968a6e72 cat-commercial.jpg 1200 76
fetch 1560518883-ce09059eeffa cat-investment.jpg 1200 76
fetch 1494526585095-c41746248156 cat-large.jpg 1200 76

# Gallery
fetch 1465447142348-e9952c393450 gallery-boulevard.jpg 1400 76
fetch 1476514525535-07fb3b4ae5f1 gallery-lake.jpg 1400 76
fetch 1541888946425-d81bb19240f5 gallery-construction.jpg 1400 76
fetch 1503387762-592deb58ef4e gallery-plan.jpg 1400 76
fetch 1500382017468-9049fed747ef gallery-park.jpg 1400 76
fetch 1580587771525-78b9dba3b914 gallery-villa.jpg 1400 76
fetch 1556761175-b413da4baf72 gallery-sitevisit.jpg 1400 76
fetch 1477959858617-67f85cf4f1df gallery-city.jpg 1400 76
fetch 1448375240586-882707db888b gallery-forest.jpg 1400 76

# Testimonial avatars
fetch_avatar() {
  local g="$1" n="$2" out="$3"
  if curl -sfL -m 40 "https://randomuser.me/api/portraits/${g}/${n}.jpg" -o "$DIR/$out"; then
    echo "OK   $out"
  else
    echo "FAIL $out"
  fi
}
fetch_avatar men 32 avatar-1.jpg
fetch_avatar women 44 avatar-2.jpg
fetch_avatar men 75 avatar-3.jpg
fetch_avatar women 68 avatar-4.jpg
fetch_avatar men 41 avatar-5.jpg

echo "--- done ---"
ls -la "$DIR" | awk '{print $5, $9}'

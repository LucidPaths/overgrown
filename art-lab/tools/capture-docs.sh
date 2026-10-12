#!/usr/bin/env bash
# Regenerates every image in docs/art/lab/img from the running dev server (npm run dev, port 4230).
# Usage: bash tools/capture-docs.sh   (from art-lab/). Needs PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers.
set -euo pipefail
U=http://127.0.0.1:4230
O=../docs/art/lab/img
mkdir -p "$O" out/cap
shot() { node tools/shot.mjs "$1" "$2" "$3" "$4" 1 sketchDone "${5:-300}" > /dev/null; }
seq1() { node tools/seq.mjs "$1" "$2" 1 100 "$3" "$4" "$5" "$6" "${7:-0}"; mv "$2-00.png" "$2.png"; }

# the prototype at real size
seq1 "$U/?bot=1" "$O/desktop-day" 1280 720 1 3200
seq1 "$U/?hour=18.3" "$O/desktop-dusk" 1280 720 1 4000
seq1 "$U/?hour=22" "$O/desktop-night" 1280 720 1 8000
seq1 "$U/?hour=6.4" "$O/desktop-dawn" 1280 720 1 4000
seq1 "$U/?bot=1" out/cap/phone-day 390 844 3 3500 1
seq1 "$U/?hour=20.6" out/cap/phone-night 390 844 3 6000 1
# biomes (static camera, no sim)
shot "$U/?mode=static&x=1600&y=980&clock=2" "$O/biome-border-forest-river-meadow.png" 1280 720
shot "$U/?mode=static&x=-700&y=900&clock=2" "$O/biome-forest.png" 1280 720
shot "$U/?mode=static&x=-1720&y=-720&clock=2" "$O/biome-coast.png" 1280 720
shot "$U/?mode=static&x=3808&y=-2150&clock=2" "$O/biome-highlands-border.png" 1280 720
shot "$U/?mode=static&seed=4&x=-1280&y=256&clock=2" "$O/biome-snow-ridges.png" 1280 720
shot "$U/?mode=static&x=1500&y=1100&clock=2&scale=1" "$O/world-wide-1x.png" 1280 720
# species and motion (stage: posed, deterministic)
S="$U/?mode=stage&clear=9"
shot "$S&anim=idle&t=0.3&w=1280&h=500&scale=4&yaw=0,40,180&sp=34&rowsp=44&lift=6" "$O/species-lineup.png" 1280 500
shot "$S&anim=idle&t=0.3&w=1280&h=200&scale=2&yaw=20&sp=26&lift=10" "$O/species-lineup-1x-game-scale.png" 1280 200
shot "$S&anim=idle&t=0.3&w=1280&h=500&scale=4&yaw=0,40,180&sp=34&rowsp=44&lift=6&lean=0&tilt=0" "$O/explore-no-lean-no-tilt.png" 1280 500
shot "$S&anim=walk&ts=0,0.125,0.25,0.375,0.5,0.625,0.75,0.875&species=0,4,6&yaw=60&w=1280&h=500&scale=4&sp=38&rowsp=56&lift=8" "$O/motion-walk.png" 1280 500
shot "$S&anim=run&ts=0,0.125,0.25,0.375,0.5,0.625,0.75,0.875&species=1,5,8&yaw=90&w=1280&h=500&scale=4&sp=38&rowsp=56&lift=8" "$O/motion-run.png" 1280 500
shot "$S&anim=attack&ts=0,0.15,0.3,0.36,0.42,0.5,0.6,0.75,0.9&species=0,3,6&yaw=0&w=1280&h=500&scale=4&sp=34&rowsp=56&lift=8" "$O/motion-attack.png" 1280 500
shot "$S&anim=dodge&ts=0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9&species=0,5&yaw=90&w=1280&h=360&scale=4&sp=30&rowsp=60&lift=8" "$O/motion-dodge.png" 1280 360
shot "$S&anim=hurt&ts=0,0.1,0.2,0.35,0.5,0.7,0.9&species=4,7&yaw=30&w=1000&h=360&scale=4&sp=34&rowsp=60&lift=8" out/cap/hurt.png 1000 360
shot "$S&anim=death&ts=0,0.15,0.3,0.45,0.6,0.75,1.2&species=4,7&yaw=30&w=1000&h=360&scale=4&sp=34&rowsp=60&lift=8" out/cap/death.png 1000 360
# a fight in the live game, eight frames
node tools/seq.mjs "$U/?bot=1" out/cap/fight 10 220 1280 720 1 500
python3 tools/compose.py

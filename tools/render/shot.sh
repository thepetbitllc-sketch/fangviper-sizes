#!/bin/bash
# shot.sh <base> <outname> <cards> : renders compose2 to tools/render/out/<outname>.png with a transparent background
OUT="D:/new/fangviper-sizes/tools/render/out/$2.png"; mkdir -p "$(dirname "$OUT")"
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --hide-scrollbars --default-background-color=00000000 --window-size=1254,1254 --virtual-time-budget=15000 --screenshot="$(cygpath -w "$OUT")" "http://localhost:5180/tools/render/compose2.html?base=$1&cards=$3&clear=${4:-0}&fill=${5:-}" 2>&1 | grep -q written && echo "saved $2" || echo "FAILED $2"

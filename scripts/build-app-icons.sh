#!/usr/bin/env bash
# Renders the app icon set from one SVG mark into mobile/assets/.
#
#   icon.png               1024×1024 opaque      iOS icon, web favicon source
#   adaptive-icon.png      1024×1024 transparent Android foreground (glyph in the 66% safe zone)
#   adaptive-icon-mono.png 1024×1024 transparent Android 13+ themed icon (white glyph)
#   splash-icon.png        1024×1024 transparent splash (on #0b0d12, see app.json)
#   favicon.png            48×48 opaque
#   web/public/favicon.svg the same mark for the website tab
#
# The mark is three stacked chevrons in the app's palette; icon.svg is the
# editable source and the PNGs are the shipped truth. The in-app Drill button
# draws the same chevrons inline (components/ChevronsIcon.web.tsx) — keep the
# path in CHEVRONS in step with it. Needs rsvg-convert (brew install librsvg).
#
# After running: cd mobile && bunx expo prebuild --clean --platform android
# (mobile/android is gitignored; the icons only reach the APK via prebuild/EAS).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/mobile/assets"

BG="#0b0d12"
FG="#ffffff"

# Three chevrons in a 100×100 box, stroked so the ends are round like the
# in-app glyph. Fits inside Android's 66% adaptive safe zone once scaled.
CHEVRONS='M22 18 L50 36 L78 18 M22 40 L50 58 L78 40 M22 62 L50 80 L78 62'

# $1 = background ("none" for transparent), $2 = glyph colour
mark() {
	cat <<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="$1"/>
  <g transform="translate(512 512) scale(5.4) translate(-50 -49)">
    <path d="$CHEVRONS" fill="none" stroke="$2" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
SVG
}

render() { # svg-on-stdin, size, out
	rsvg-convert -w "$1" -h "$1" -o "$2"
	echo "   ✓ $(basename "$2") ($1px)"
}

echo "→ Rendering app icons into $ASSETS"
mark "$BG" "$FG" >"$ASSETS/icon.svg"
render 1024 "$ASSETS/icon.png" <"$ASSETS/icon.svg"
render 48 "$ASSETS/favicon.png" <"$ASSETS/icon.svg"
mark none "$FG" | render 1024 "$ASSETS/adaptive-icon.png"
mark none "$FG" | render 1024 "$ASSETS/splash-icon.png"
mark none "$FG" | render 1024 "$ASSETS/adaptive-icon-mono.png"
cp "$ASSETS/icon.svg" "$ROOT/web/public/favicon.svg"
echo "   ✓ web/public/favicon.svg"

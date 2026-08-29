#!/usr/bin/env bash
# Renders the app icon set from one SVG mark into mobile/assets/.
#
#   icon.png               1024×1024 opaque      iOS icon, web favicon source
#   adaptive-icon.png      1024×1024 transparent Android foreground (glyph in the 66% safe zone)
#   adaptive-icon-mono.png 1024×1024 transparent Android 13+ themed icon (white glyph)
#   splash-icon.png        1024×1024 transparent splash (on #0b0d12, see app.json)
#   favicon.png            48×48 opaque
#
# The mark is a bold "D" with an accent bar in the app's palette. Text is set
# in a system bold sans and rasterised here, so the PNGs are the shipped truth
# and icon.svg is the editable source. Needs rsvg-convert (brew install librsvg).
#
# After running: cd mobile && bunx expo prebuild --clean --platform android
# (mobile/android is gitignored; the icons only reach the APK via prebuild/EAS).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/mobile/assets"

BG="#0b0d12"
FG="#ffffff"
ACCENT="#7c9cff"
FONT="Avenir Next, Avenir, Helvetica Neue, Helvetica, Arial, sans-serif"

# $1 = background ("none" for transparent), $2 = glyph colour, $3 = bar colour
mark() {
	cat <<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="$1"/>
  <text x="512" y="648" text-anchor="middle" font-family="$FONT" font-weight="800"
        font-size="500" fill="$2">D</text>
  <rect x="412" y="700" width="200" height="36" rx="8" fill="$3"/>
</svg>
SVG
}

render() { # svg-on-stdin, size, out
	rsvg-convert -w "$1" -h "$1" -o "$2"
	echo "   ✓ $(basename "$2") ($1px)"
}

echo "→ Rendering app icons into $ASSETS"
mark "$BG" "$FG" "$ACCENT" >"$ASSETS/icon.svg"
render 1024 "$ASSETS/icon.png" <"$ASSETS/icon.svg"
render 48 "$ASSETS/favicon.png" <"$ASSETS/icon.svg"
mark none "$FG" "$ACCENT" | render 1024 "$ASSETS/adaptive-icon.png"
mark none "$FG" "$ACCENT" | render 1024 "$ASSETS/splash-icon.png"
mark none "$FG" "$FG" | render 1024 "$ASSETS/adaptive-icon-mono.png"

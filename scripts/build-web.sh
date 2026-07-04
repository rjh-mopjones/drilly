#!/usr/bin/env bash
# Production web build for Vercel.
#
# Replaces the old Vite-based `web/` SPA with the Expo Web export of the
# mobile/ codebase so both surfaces share one set of components, theme,
# manifest, reader, settings, and content pipeline.
#
# Output layout (after this script runs, ready for Vercel to serve):
#   mobile/dist/index.html              ← Expo Web SPA shell
#   mobile/dist/_expo/static/js/…       ← bundled JS + assets
#   mobile/dist/favicon.ico
#   mobile/dist/manifest.json           ← runtime manifest (mirrored from web/public)
#   mobile/dist/patterns.md             ← source content (mirrored from web/public)
#   mobile/dist/operating-systems-interview-primer.md
#   mobile/dist/operating-systems-cheatsheet.html  ← A4 print cheat sheet (attached to the Operating Systems primer via cheatSheetUrl)
#   mobile/dist/concurrency-interview-primer.md
#   mobile/dist/concurrency-cheatsheet.html  ← A4 print cheat sheet (attached to the Concurrency primer via cheatSheetUrl)
#   mobile/dist/api-design-interview-primer.md
#   mobile/dist/api-design-cheatsheet.html  ← A4 print cheat sheet (attached to the API Design primer via cheatSheetUrl)
#   mobile/dist/ood-patterns-interview-primer.md
#   mobile/dist/ood-patterns-cheatsheet.html  ← A4 print cheat sheet (attached to the OOD & Design Patterns primer via cheatSheetUrl)
#   mobile/dist/testing-interview-primer.md
#   mobile/dist/testing-cheatsheet.html  ← A4 print cheat sheet (attached to the Testing & QA primer via cheatSheetUrl)
#   mobile/dist/front-end-interview-primer.md
#   mobile/dist/front-end-cheatsheet.html  ← A4 print cheat sheet (attached to the Front End primer via cheatSheetUrl)
#   mobile/dist/data-engineering-interview-primer.md
#   mobile/dist/data-engineering-cheatsheet.html  ← A4 print cheat sheet (attached to the Data Engineering primer via cheatSheetUrl)
#   mobile/dist/security-interview-primer.md
#   mobile/dist/security-cheatsheet.html  ← A4 print cheat sheet (attached to the Security primer via cheatSheetUrl)
#   mobile/dist/neetcode-150.md
#   mobile/dist/java-interview-primer.md
#   mobile/dist/go-interview-primer.md
#   mobile/dist/rust-interview-primer.md
#   mobile/dist/python-interview-primer.md
#   mobile/dist/kotlin-interview-primer.md
#   mobile/dist/cpp-interview-primer.md
#   mobile/dist/postgres-interview-primer.md
#   mobile/dist/db-theory-primer.md
#   mobile/dist/sql-questions.md
#   mobile/dist/cassandra-interview-primer.md
#   mobile/dist/redis-interview-primer.md
#   mobile/dist/yugabyte-interview-primer.md
#   mobile/dist/csharp-interview-primer.md
#   mobile/dist/aws-interview-primer.md
#   mobile/dist/gcp-interview-primer.md
#   mobile/dist/linux-interview-primer.md
#   mobile/dist/kubernetes-interview-primer.md
#   mobile/dist/observability-interview-primer.md
#   mobile/dist/terraform-interview-primer.md
#   mobile/dist/docker-interview-primer.md
#   mobile/dist/cicd-interview-primer.md
#   mobile/dist/networking-interview-primer.md
#   mobile/dist/git-interview-primer.md
#   mobile/dist/ai-engineering-primer.md
#   mobile/dist/how-llms-work-interview-primer.md
#   mobile/dist/how-llms-work-cheatsheet.html ← A4 print cheat sheet (attached to the Large Language Models primer via cheatSheetUrl, Machine Learning category)
#   mobile/dist/ml-fundamentals-interview-primer.md
#   mobile/dist/ml-fundamentals-cheatsheet.html ← A4 print cheat sheet (attached to the ML Fundamentals primer via cheatSheetUrl, Machine Learning category)
#   mobile/dist/classical-algorithms-interview-primer.md
#   mobile/dist/classical-algorithms-cheatsheet.html ← A4 print cheat sheet (attached to the Classical Algorithms primer via cheatSheetUrl, Machine Learning category)
#   mobile/dist/deep-learning-interview-primer.md
#   mobile/dist/deep-learning-cheatsheet.html ← A4 print cheat sheet (attached to the Deep Learning primer via cheatSheetUrl, Machine Learning category)
#   mobile/dist/mlops-interview-primer.md
#   mobile/dist/mlops-cheatsheet.html ← A4 print cheat sheet (attached to the MLOps primer via cheatSheetUrl, Machine Learning category)
#   mobile/dist/sql-postgres-cheatsheet.html   ← standalone A4 print cheat sheet (Cheat Sheets category, externalUrl)
#   mobile/dist/cassandra-cheatsheet.html      ← standalone A4 print cheat sheet (attached to the Cassandra primer via cheatSheetUrl)
#   mobile/dist/redis-cheatsheet.html          ← standalone A4 print cheat sheet (attached to the Redis primer via cheatSheetUrl)
#   mobile/dist/yugabyte-cheatsheet.html       ← standalone A4 print cheat sheet (attached to the YugabyteDB primer via cheatSheetUrl)
#   mobile/dist/java-cheatsheet.html           ← standalone A4 print cheat sheet (Cheat Sheets category, externalUrl)
#   mobile/dist/csharp-cheatsheet.html         ← standalone A4 print cheat sheet (Cheat Sheets category, externalUrl)
#   mobile/dist/go-cheatsheet.html             ← standalone A4 print cheat sheet (Cheat Sheets category, externalUrl)
#   mobile/dist/cpp-cheatsheet.html            ← standalone A4 print cheat sheet (Cheat Sheets category, externalUrl)
#   mobile/dist/aws-cheatsheet.html            ← standalone A4 print cheat sheet (Cheat Sheets category, externalUrl)
#   mobile/dist/gcp-cheatsheet.html            ← standalone A4 print cheat sheet (Cheat Sheets category, externalUrl)
#   mobile/dist/linux-cheatsheet.html          ← standalone A4 print cheat sheet (attached to the Linux primer via cheatSheetUrl)
#   mobile/dist/kubernetes-cheatsheet.html     ← standalone A4 print cheat sheet (attached to the Kubernetes primer via cheatSheetUrl)
#   mobile/dist/observability-cheatsheet.html  ← standalone A4 print cheat sheet (attached to the Observability primer via cheatSheetUrl)
#   mobile/dist/terraform-cheatsheet.html      ← standalone A4 print cheat sheet (attached to the Terraform primer via cheatSheetUrl)
#   mobile/dist/docker-cheatsheet.html         ← standalone A4 print cheat sheet (attached to the Docker primer via cheatSheetUrl)
#   mobile/dist/cicd-cheatsheet.html           ← standalone A4 print cheat sheet (attached to the CI/CD primer via cheatSheetUrl)
#   mobile/dist/networking-cheatsheet.html     ← standalone A4 print cheat sheet (attached to the Networking primer via cheatSheetUrl)
#   mobile/dist/git-cheatsheet.html            ← standalone A4 print cheat sheet (attached to the Git primer via cheatSheetUrl)
#   mobile/dist/system-design-cheatsheet.html  ← standalone A4 print cheat sheet (Cheat Sheets category, externalUrl)
#   mobile/dist/finance-domain-interview-primer.md
#   mobile/dist/finance-domain-cheatsheet.html ← A4 print cheat sheet (attached to the Finance Domain primer via cheatSheetUrl, Computational Finance category)
#   mobile/dist/quant-methods-interview-primer.md
#   mobile/dist/quant-methods-cheatsheet.html ← A4 print cheat sheet (attached to the Quantitative Methods primer via cheatSheetUrl, Computational Finance category)
#   mobile/dist/high-frequency-finance-interview-primer.md
#   mobile/dist/high-frequency-finance-cheatsheet.html ← A4 print cheat sheet (attached to the High-Frequency Finance primer via cheatSheetUrl, Computational Finance category)
#   mobile/dist/cpp-finance-interview-primer.md
#   mobile/dist/cpp-finance-cheatsheet.html ← A4 print cheat sheet (attached to the C++ for Financial Math primer via cheatSheetUrl, Computational Finance category)
#   mobile/dist/system-design-patterns-primer.md
#   mobile/dist/dsa-patterns-primer.md
#   mobile/dist/sql-patterns-primer.md
#
# The mobile app fetches the markdown + manifest from the same Vercel
# URL via mobile/lib/content.ts:REMOTE_BASE, so keeping `manifest.json`
# and `*.md` at the deploy root is non-negotiable.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/mobile"
WEB_PUBLIC="$ROOT/web/public"
OUT="$MOBILE/dist"

echo "→ Exporting Expo Web SPA"
cd "$MOBILE"
bunx expo export --platform web --clear

echo "→ Mirroring web/public/* (manifest + markdown) into $OUT"
for f in service-worker.js manifest.json patterns.md operating-systems-interview-primer.md concurrency-interview-primer.md api-design-interview-primer.md ood-patterns-interview-primer.md testing-interview-primer.md security-interview-primer.md front-end-interview-primer.md data-engineering-interview-primer.md finance-domain-interview-primer.md quant-methods-interview-primer.md high-frequency-finance-interview-primer.md cpp-finance-interview-primer.md neetcode-150.md java-interview-primer.md go-interview-primer.md rust-interview-primer.md python-interview-primer.md kotlin-interview-primer.md cpp-interview-primer.md postgres-interview-primer.md db-theory-primer.md sql-patterns-primer.md sql-questions.md cassandra-interview-primer.md redis-interview-primer.md yugabyte-interview-primer.md csharp-interview-primer.md aws-interview-primer.md gcp-interview-primer.md linux-interview-primer.md kubernetes-interview-primer.md observability-interview-primer.md terraform-interview-primer.md docker-interview-primer.md cicd-interview-primer.md networking-interview-primer.md git-interview-primer.md ai-engineering-primer.md how-llms-work-interview-primer.md ml-fundamentals-interview-primer.md classical-algorithms-interview-primer.md deep-learning-interview-primer.md mlops-interview-primer.md sql-postgres-cheatsheet.html cassandra-cheatsheet.html redis-cheatsheet.html yugabyte-cheatsheet.html java-cheatsheet.html csharp-cheatsheet.html go-cheatsheet.html cpp-cheatsheet.html aws-cheatsheet.html gcp-cheatsheet.html linux-cheatsheet.html kubernetes-cheatsheet.html observability-cheatsheet.html terraform-cheatsheet.html docker-cheatsheet.html cicd-cheatsheet.html networking-cheatsheet.html git-cheatsheet.html system-design-cheatsheet.html finance-domain-cheatsheet.html quant-methods-cheatsheet.html high-frequency-finance-cheatsheet.html cpp-finance-cheatsheet.html operating-systems-cheatsheet.html concurrency-cheatsheet.html api-design-cheatsheet.html ood-patterns-cheatsheet.html testing-cheatsheet.html security-cheatsheet.html front-end-cheatsheet.html data-engineering-cheatsheet.html how-llms-work-cheatsheet.html ml-fundamentals-cheatsheet.html classical-algorithms-cheatsheet.html deep-learning-cheatsheet.html mlops-cheatsheet.html system-design-patterns-primer.md dsa-patterns-primer.md; do
	if [ -f "$WEB_PUBLIC/$f" ]; then
		cp "$WEB_PUBLIC/$f" "$OUT/$f"
		echo "   ✓ $f"
	fi
done

# favicon.svg / icons.svg too, so the web app keeps its existing branding
for f in favicon.svg icons.svg; do
	if [ -f "$WEB_PUBLIC/$f" ]; then
		cp "$WEB_PUBLIC/$f" "$OUT/$f"
	fi
done

# Self-hosted JetBrains Mono (code font), served at /fonts/ and precached
# by the service worker so code blocks render correctly offline.
if [ -d "$WEB_PUBLIC/fonts" ]; then
	mkdir -p "$OUT/fonts"
	cp "$WEB_PUBLIC/fonts/"*.woff2 "$OUT/fonts/" 2>/dev/null || true
	echo "   ✓ fonts/ ($(ls "$WEB_PUBLIC/fonts" | wc -l | tr -d ' ') files)"
fi

# Inject the @font-face declarations + preloads into <head>. Expo's
# +html.tsx strips custom <style>/<link> on export, so we do it here as a
# deterministic post-step. Without this the MONO_FONT family has nothing
# to resolve to and code falls back to the platform monospace.
echo "→ Injecting JetBrains Mono @font-face into index.html"
FONT_HEAD=$(
	cat <<'HTML'
<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href="/fonts/jetbrains-mono-400-normal.woff2" />
<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href="/fonts/jetbrains-mono-700-normal.woff2" />
<style id="drilly-fonts">
@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/jetbrains-mono-400-normal.woff2') format('woff2');}
@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:700;font-display:swap;src:url('/fonts/jetbrains-mono-700-normal.woff2') format('woff2');}
@font-face{font-family:'JetBrains Mono';font-style:italic;font-weight:400;font-display:swap;src:url('/fonts/jetbrains-mono-400-italic.woff2') format('woff2');}
</style>
HTML
)
# Insert before </head>. Use a python one-liner for a safe literal replace
# (sed chokes on the multiline payload + slashes in the CSS).
OUT="$OUT" FONT_HEAD="$FONT_HEAD" python3 - <<'PY'
import os
path = os.path.join(os.environ["OUT"], "index.html")
html = open(path, encoding="utf-8").read()
if "drilly-fonts" not in html:
    html = html.replace("</head>", os.environ["FONT_HEAD"] + "\n</head>", 1)
    open(path, "w", encoding="utf-8").write(html)
    print("   ✓ @font-face injected")
else:
    print("   • already present, skipped")
PY

echo "→ Build complete: $OUT"

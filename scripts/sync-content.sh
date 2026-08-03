#!/usr/bin/env bash
# Re-sync content files from a local Obsidian vault into web/public/.
# Run after editing the canonical notes in Obsidian. The committed
# copies in web/public/ are what Vercel reads at build time.
# Also bundles into mobile/assets/content/ for the Android app's
# offline fallback.
#
# Configure the vault path via the VAULT_PATH env var, e.g.
#   VAULT_PATH=~/Documents/my-vault/notes ./scripts/sync-content.sh
set -euo pipefail

VAULT="${VAULT_PATH:-$HOME/notes}"
if [ ! -d "$VAULT" ]; then
	echo "Vault not found at $VAULT" >&2
	echo "Set VAULT_PATH to your Obsidian vault directory." >&2
	exit 1
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/web/public"
MOBILE="$ROOT/mobile/assets/content"

# FROZEN: sd-14 migration. patterns.md is being restructured in-repo (14-section
# format). The vault copy is the OLD 16-section monolith, so syncing it would
# silently revert the whole migration. Unfreeze once the migration is complete
# AND the vault note has been updated from web/public/patterns.md, not the
# other way round.
# cp "$VAULT/System-Design-Patterns.md"             "$WEB/patterns.md"
cp "$VAULT/Neet-150-Pattens.md" "$WEB/neetcode-150.md"
cp "$VAULT/Java Interview Primer - 100 Questions.md" "$WEB/java-interview-primer.md"
# Kotlin primer is authored directly in web/public (no vault source yet).
echo "Synced 2 files from $VAULT into $WEB/ (patterns.md frozen, see above)"

# Mirror to mobile/assets/content/ if mobile exists
if [ -d "$ROOT/mobile" ]; then
	mkdir -p "$MOBILE"
	cp "$WEB/patterns.md" "$MOBILE/patterns.md"
	cp "$WEB/neetcode-150.md" "$MOBILE/neetcode-150.md"
	cp "$WEB/java-interview-primer.md" "$MOBILE/java-interview-primer.md"
	cp "$WEB/kotlin-interview-primer.md" "$MOBILE/kotlin-interview-primer.md"
	# Bundled-fallback manifest — kept in lockstep with web/public so a fresh
	# install with no network still has the same source list that was current
	# at build time.
	if [ -f "$WEB/manifest.json" ]; then
		cp "$WEB/manifest.json" "$MOBILE/manifest.json"
	fi
	echo "Mirrored to $MOBILE/"

	# Mirror parser source — mobile inlines it (instead of using the workspace dep)
	# so EAS cloud builds don't need to resolve workspace:* refs.
	#
	# mobile/lib/parser.ts is GENERATED. Never hand-edit it alone: this line
	# overwrites it from packages/parser/src/parser.ts on the next sync, which
	# will silently revert changes such as SOURCES.patterns.sectionOrder. Edit
	# the upstream copy and re-run this script, or edit both together.
	cp "$ROOT/packages/parser/src/parser.ts" "$ROOT/mobile/lib/parser.ts"
	echo "Mirrored parser.ts → $ROOT/mobile/lib/"
fi

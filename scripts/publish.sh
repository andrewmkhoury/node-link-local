#!/usr/bin/env bash
# Publish a new version: bump version, tag, publish to npm, push.
# Usage: ./scripts/publish.sh [patch|minor|major]   (default: patch)
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUMP="${1:-patch}"
case "$BUMP" in
  patch|minor|major) ;;
  *) echo "Usage: $0 [patch|minor|major]" >&2; exit 1 ;;
esac

echo "Bumping $BUMP..."
npm version "$BUMP" -m "Release v%s"

echo "Publishing to npm..."
npm publish --registry https://registry.npmjs.org/ --access public

echo "Pushing..."
git push && git push --tags

echo "Done."

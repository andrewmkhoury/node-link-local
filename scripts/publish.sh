#!/usr/bin/env bash
# Release script: test → version bump → git tag → npm publish → git push.
#
# Usage:
#   ./scripts/publish.sh            # defaults to 'patch'
#   ./scripts/publish.sh patch
#   ./scripts/publish.sh minor
#   ./scripts/publish.sh major
#
# Versioning scheme: standard semver (MAJOR.MINOR.PATCH), tagged as vX.Y.Z.
#   patch — bug fixes, no API changes
#   minor — new backwards-compatible features
#   major — breaking changes
#
# Prerequisites:
#   - Logged in to npm:  npm login  (or NPM_TOKEN set in env)
#   - On a clean main branch with no uncommitted changes
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUMP="${1:-patch}"
case "$BUMP" in
  patch|minor|major) ;;
  *) echo "Usage: $0 [patch|minor|major]" >&2; exit 1 ;;
esac

# Ensure clean working tree
if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌ Working tree is dirty. Commit or stash changes first." >&2
  exit 1
fi

# Ensure on main
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "❌ Must be on main branch (currently on '$BRANCH')." >&2
  exit 1
fi

# Ensure npm auth
if ! npm whoami --registry https://registry.npmjs.org/ &>/dev/null; then
  echo "❌ Not logged in to npm. Run: npm login" >&2
  exit 1
fi

echo "🧪 Running tests..."
npm test

# bump version + create annotated tag vX.Y.Z
echo "📦 Bumping $BUMP version..."
NEW_VERSION="$(npm version "$BUMP" --message "Release v%s" | tr -d 'v')"
echo "   → v${NEW_VERSION}"

echo "🚀 Publishing to npm..."
npm publish --registry https://registry.npmjs.org/ --access public

echo "⬆️  Pushing commit and tag..."
git push origin main
git push origin "v${NEW_VERSION}"

echo ""
echo "✅ Released v${NEW_VERSION}"
echo "   https://www.npmjs.com/package/node-link-local"

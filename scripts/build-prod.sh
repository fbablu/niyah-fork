#!/usr/bin/env bash
# Production iOS build with an auto-incrementing build number.
#
# Why this script exists: eas.json uses appVersionSource "local", so the build
# number comes from app.config.js (`process.env.BUILD_NUMBER`). We set it ONCE
# here (epoch seconds — always increasing, never collides, no manual edits) so
# the main app AND every apple-targets extension read the SAME value during
# prebuild. App Store rejects the upload if the app and its extensions disagree,
# so BUILD_NUMBER must be stable for the whole build — hence an env var, not an
# inline timestamp in app.config.js (which re-evaluates per target).
#
# Usage:  bash scripts/build-prod.sh        # or: pnpm build:prod
set -euo pipefail

# Load client env (Firebase project id, Google client ids, etc.) — required for
# app.config.js to evaluate. Stale pnpm-global eas-cli breaks config reads, so
# the build itself goes through `npx eas`.
set -a
# shellcheck disable=SC1091
source .env
set +a

export BUILD_NUMBER="$(date +%s)"
echo "▸ Building production IPA with BUILD_NUMBER=$BUILD_NUMBER (epoch seconds)"

npx eas build --platform ios --profile production --local

echo
echo "✓ Build done. Submit with:"
echo "    npx eas submit --platform ios --profile production --path ./build-<timestamp>.ipa"
echo "  (verify the app + all 5 .appex CFBundleVersions == $BUILD_NUMBER before submitting)"

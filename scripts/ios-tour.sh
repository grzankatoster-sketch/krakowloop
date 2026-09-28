#!/usr/bin/env bash
# The iOS tester in one go: an EAS simulator build of the current code, then the Maestro tour on a
# GitHub macOS runner (APP_URL=<.tar.gz> skips the build) (.github/workflows/ios-tester.yml), then its screenshots into $1 (default ios-tour-out).
set -euo pipefail
OUT="${1:-ios-tour-out}"
GH="${GH:-gh}"
REPO="$(git config --get remote.origin.url | sed -E 's#.*github.com[:/]##; s#\.git$##')"

if [ -z "${APP_URL:-}" ]; then
echo "building for the simulator..."
BUILD_JSON="$(npx -y eas-cli@latest build --platform ios --profile e2e-test --non-interactive --wait --json 2>/dev/null)"
APP_URL="$(printf '%s' "$BUILD_JSON" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const b=JSON.parse(s)[0];console.log(b.artifacts.applicationArchiveUrl||b.artifacts.buildUrl)})")"
fi
echo "app: $APP_URL"

BEFORE="$("$GH" run list -R "$REPO" --workflow ios-tester.yml --limit 1 --json databaseId -q '.[0].databaseId // 0')"
"$GH" workflow run ios-tester.yml -R "$REPO" --ref "$(git branch --show-current)" -f app_url="$APP_URL"
RUN="$BEFORE"
while [ "$RUN" = "$BEFORE" ]; do sleep 5; RUN="$("$GH" run list -R "$REPO" --workflow ios-tester.yml --limit 1 --json databaseId -q '.[0].databaseId')"; done
echo "run: https://github.com/$REPO/actions/runs/$RUN"
"$GH" run watch "$RUN" -R "$REPO" --interval 30 > /dev/null 2>&1 || true
rm -rf "$OUT"
"$GH" run download "$RUN" -R "$REPO" -D "$OUT"
"$GH" run view "$RUN" -R "$REPO" --json conclusion -q .conclusion

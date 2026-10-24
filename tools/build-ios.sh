#!/usr/bin/env bash
# Build the native iOS app from the same local web files used by Android.
# Requires macOS, Xcode command-line tools, CocoaPods, and Node.js 22+.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/build-ios"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "iOS builds require macOS and Xcode." >&2
  exit 1
fi
command -v xcodebuild >/dev/null || { echo "Install Xcode and its command-line tools first." >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/www"
cp "$ROOT/index.html" "$ROOT/Version" "$ROOT/manifest.json" "$ROOT/cloud-config.js" "$ROOT/rest.png" "$ROOT/snake-loading.gif" "$ROOT/icon-192.png" "$ROOT/icon-512.png" "$ROOT/icon-192-maskable.png" "$ROOT/icon-512-maskable.png" "$OUT/www/"
cp -r "$ROOT/css" "$ROOT/js" "$ROOT/vendor" "$ROOT/fonts" "$OUT/www/"
cp "$ROOT/tools/ios/package.json" "$OUT/package.json"

cd "$OUT"
npm install --no-audit --no-fund --ignore-scripts

cat > capacitor.config.json <<'JSON'
{
  "appId": "com.roguelineage.rattracker",
  "appName": "Tracker",
  "webDir": "www",
  "backgroundColor": "#0d0e10",
  "ios": { "contentInset": "automatic" }
}
JSON

npx cap add ios --packagemanager SPM
npx cap sync ios
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$OUT/derived" \
  CODE_SIGNING_ALLOWED=NO \
  build

cp -R "$OUT/derived/Build/Products/Release-iphonesimulator/App.app" "$OUT/Tracker.app"
echo "Simulator app: $OUT/Tracker.app"
echo "Xcode workspace: $OUT/ios/App/App.xcworkspace"

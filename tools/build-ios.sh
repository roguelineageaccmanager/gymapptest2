#!/usr/bin/env bash
# Build the native iOS app from the same local web files used by Android.
# Requires macOS, Xcode, and Node.js 22+ (uses Swift Package Manager).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/build-ios"
TARGET="${IOS_BUILD_TARGET:-simulator}"
APP_ID="${IOS_BUNDLE_ID:-com.roguelineage.rattracker}"

if [ "$TARGET" != simulator ] && [ "$TARGET" != ad-hoc ]; then
  echo "IOS_BUILD_TARGET must be simulator or ad-hoc." >&2
  exit 1
fi
if [[ ! "$APP_ID" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "IOS_BUNDLE_ID must be a reverse-DNS identifier." >&2
  exit 1
fi

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

if [ "$TARGET" = simulator ]; then
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
else
  : "${IOS_TEAM_ID:?Set IOS_TEAM_ID to the Apple Developer team ID}"
  : "${IOS_PROFILE_NAME:?Set IOS_PROFILE_NAME to the registered-device Ad Hoc profile name}"
  ARCHIVE="$OUT/Tracker.xcarchive"
  EXPORT="$OUT/export"
  xcodebuild \
    -project ios/App/App.xcodeproj \
    -scheme App \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE" \
    -derivedDataPath "$OUT/derived" \
    CODE_SIGN_STYLE=Manual \
    CODE_SIGN_IDENTITY="Apple Distribution" \
    DEVELOPMENT_TEAM="$IOS_TEAM_ID" \
    PRODUCT_BUNDLE_IDENTIFIER="$APP_ID" \
    PROVISIONING_PROFILE_SPECIFIER="$IOS_PROFILE_NAME" \
    archive
  IOS_TEAM_ID="$IOS_TEAM_ID" IOS_BUNDLE_ID="$APP_ID" IOS_PROFILE_NAME="$IOS_PROFILE_NAME" IOS_EXPORT_OPTIONS="$OUT/ExportOptions.plist" python3 <<'PY'
import os
import plistlib

options = {
    "method": "ad-hoc",
    "teamID": os.environ["IOS_TEAM_ID"],
    "signingStyle": "manual",
    "provisioningProfiles": {
        os.environ["IOS_BUNDLE_ID"]: os.environ["IOS_PROFILE_NAME"]
    },
    "stripSwiftSymbols": True,
    "compileBitcode": False,
}
with open(os.environ["IOS_EXPORT_OPTIONS"], "wb") as file:
    plistlib.dump(options, file)
PY
  xcodebuild -exportArchive \
    -archivePath "$ARCHIVE" \
    -exportPath "$EXPORT" \
    -exportOptionsPlist "$OUT/ExportOptions.plist"
  IPA="$(find "$EXPORT" -maxdepth 1 -name '*.ipa' -print -quit)"
  test -n "$IPA" || { echo "Xcode did not produce an IPA." >&2; exit 1; }
  cp "$IPA" "$OUT/Tracker.ipa"
  echo "Ad Hoc iPhone app: $OUT/Tracker.ipa"
fi
echo "Xcode project: $OUT/ios/App/App.xcodeproj"

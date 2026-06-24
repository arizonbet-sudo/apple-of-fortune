#!/usr/bin/env bash
set -euo pipefail

# Builds a standalone, installable Android APK for Apple of Fortune on CI
# (GitHub Actions). The JS bundle is embedded (assembleRelease), and the
# release build is signed with the auto-generated debug keystore from the
# Expo prebuild template, so the APK installs on any phone via sideload.

APP_DIR="artifacts/apple-of-fortune"
cd "$APP_DIR"

# The in-app icon uploader commits whatever the phone image picker returns,
# which is frequently a JPEG saved under a .png name. aapt2 then refuses to
# compile it ("file failed to compile"). Re-encode the launcher icons into
# genuine, profile-stripped RGBA PNGs so the build is robust to any uploaded
# image format. ImageMagick is preinstalled on GitHub-hosted Ubuntu runners.
echo "==> Sanitize launcher icons (force valid RGBA PNG for aapt2)"
sanitize_png() {
  local f="$1"
  [ -f "$f" ] || return 0
  local tool=""
  if command -v magick >/dev/null 2>&1; then tool="magick"
  elif command -v convert >/dev/null 2>&1; then tool="convert"; fi
  if [ -z "$tool" ]; then
    echo "WARN: ImageMagick not found; leaving $f untouched"
    return 0
  fi
  if "$tool" "$f" -strip -background none -alpha on PNG32:"$f.fixed"; then
    mv "$f.fixed" "$f"
    echo "    re-encoded $f -> $(file -b "$f" 2>/dev/null || echo PNG)"
  else
    echo "ERROR: failed to re-encode $f" >&2
    rm -f "$f.fixed"
    exit 1
  fi
}
sanitize_png assets/images/icon.png
sanitize_png assets/images/adaptive-icon.png

echo "==> Expo prebuild (android)"
pnpm exec expo prebuild --platform android --no-install

echo "==> Bump Gradle JVM memory for the release build"
echo "org.gradle.jvmargs=-Xmx5g -XX:MaxMetaspaceSize=1g" >> android/gradle.properties

echo "==> Gradle assembleRelease"
cd android
chmod +x ./gradlew
./gradlew assembleRelease --no-daemon --stacktrace
cd ..

APK="$(find android/app/build/outputs/apk/release -name '*.apk' | head -1)"
if [ -z "$APK" ]; then
  echo "ERROR: no APK produced" >&2
  exit 1
fi
echo "==> APK built: $APK"
mkdir -p dist
cp "$APK" dist/app-release.apk
ls -la dist/

echo "==> Publish APK as a GitHub Release asset (direct download link)"
TAG="apk-build-${GITHUB_RUN_NUMBER:-manual}"
if command -v gh >/dev/null 2>&1 && [ -n "${GH_TOKEN:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
  gh release create "$TAG" dist/app-release.apk \
    --repo "$GITHUB_REPOSITORY" \
    --title "Apple of Fortune APK (build ${GITHUB_RUN_NUMBER:-manual})" \
    --notes "Open this page on your Android phone and tap app-release.apk under Assets to install." \
  || gh release upload "$TAG" dist/app-release.apk --repo "$GITHUB_REPOSITORY" --clobber
  echo "==> Release published: https://github.com/${GITHUB_REPOSITORY}/releases/tag/${TAG}"
  echo "==> Direct APK link: https://github.com/${GITHUB_REPOSITORY}/releases/download/${TAG}/app-release.apk"
else
  echo "WARN: gh CLI or token not available; APK is still uploaded as a build artifact."
fi

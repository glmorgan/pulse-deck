#!/bin/bash
#
# Builds the native window host into the plugin's bin/ directory.
#
# Produces a universal binary so the packaged plugin runs on Apple Silicon and Intel alike.
# Requires only the Command Line Tools — no full Xcode. macOS only; on any other platform the
# plugin falls back to a Chromium --app= window.
#
# NOTE: the result is ad-hoc signed, which is fine for a plugin you built yourself. Distributing
# it needs a Developer ID certificate and notarization, or Gatekeeper refuses to run it on
# someone else's machine and the plugin quietly falls back to a browser.
#
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="native/pulse-host.swift"
OUT_DIR="com.glenmorgan.pulsedeck.sdPlugin/bin"
OUT="$OUT_DIR/pulse-host"
# NSPanel(.nonactivatingPanel) and underPageBackgroundColor need 12; the manifest allows 10.15,
# so findHosts() treating a missing or unlaunchable host as "use a browser" is what covers the gap.
MIN_MACOS="12"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "skipping: the native host is macOS only"
  exit 0
fi

mkdir -p "$OUT_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for arch in arm64 x86_64; do
  echo "  compiling ${arch}"
  # -swift-version 5 avoids Swift 6 strict-concurrency errors against AppKit's singletons.
  swiftc -swift-version 5 -O \
    -target "${arch}-apple-macos${MIN_MACOS}" \
    -o "$TMP/pulse-host-$arch" "$SRC"
done

lipo -create -output "$OUT" "$TMP/pulse-host-arm64" "$TMP/pulse-host-x86_64"
chmod +x "$OUT"

# swiftc ad-hoc signs the arm64 output (arm64 macOS requires a signature) but not the
# cross-compiled x86_64 one, and lipo does not re-sign what it produces — leaving a binary that
# claims "Signature=adhoc" yet fails codesign --verify with "not signed at all". Both slices still
# run, but an invalid signature blocks notarization and is not worth shipping.
codesign --force --sign - --timestamp=none "$OUT" 2>/dev/null

echo "built $OUT"
lipo -archs "$OUT" | sed 's/^/  architectures: /'
echo "  size: $(stat -f '%z' "$OUT") bytes"
if codesign --verify "$OUT" 2>/dev/null; then
  echo "  signature: ad-hoc, verifies"
else
  echo "  signature: INVALID — investigate before distributing"
fi

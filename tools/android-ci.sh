#!/usr/bin/env bash
set -euo pipefail
# The emulator runner executes each script line independently; keep branching here.
export ANDROID_E2E_SKIP_EMULATOR=1
if [ "${ANDROID_TEST_SCOPE:-all}" = "notifications" ]; then
  exec bash tools/android-e2e.sh notifications.spec.js
fi
if [ "${ANDROID_TEST_SCOPE:-all}" = "keyboard" ]; then
  exec bash tools/android-e2e.sh chat-keyboard.spec.js
fi
if [ "${ANDROID_TEST_SCOPE:-all}" = "progress" ]; then
  exec bash tools/android-e2e.sh progress-camera.spec.js
fi
exec bash tools/android-e2e.sh

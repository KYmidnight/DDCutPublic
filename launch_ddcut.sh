#!/bin/bash
# DDCut launch script for Linux
# The LD_PRELOAD shim is REQUIRED — without it, Electron's tcmalloc crashes ddcut
# with 'Attempt to free invalid pointer' due to aligned allocator mismatch.
# See: UI/lib/src/tcmalloc_shim.c for details.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHIM="$SCRIPT_DIR/UI/lib/tcmalloc_shim.so"

if [ ! -f "$SHIM" ]; then
    echo "ERROR: tcmalloc_shim.so not found at $SHIM"
    echo "Run build_linux.sh to build it, or:"
    echo "  cd UI/lib && gcc -shared -fPIC -o tcmalloc_shim.so src/tcmalloc_shim.c -ldl"
    exit 1
fi

# Load nvm if available (DDCut needs Node 10.11.0)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

export LD_PRELOAD="$SHIM"
export DISPLAY="${DISPLAY:-:0}"

cd "$SCRIPT_DIR/UI"

# Pre-built UI bundle must exist
if [ ! -f app/index.js ]; then
    echo "ERROR: app/index.js not found. Run the webpack build first:"
    echo "  cd UI && npx webpack --config=scripts/webpack.app.config.js --env=production --app=ddcut"
    exit 1
fi

exec node_modules/electron/dist/electron --no-sandbox .
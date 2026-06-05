#!/bin/bash
# DDCut Linux Build Script for Ubuntu 22.04+
# Run this after cloning: git clone --recurse-submodules https://github.com/KYmidnight/DDCutPublic.git
set -e

DDCUT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== DDCut Linux Build Script ==="
echo "DDCut directory: $DDCUT_DIR"
echo ""

# 1. System dependencies
echo "[1/8] Installing system dependencies..."
sudo apt update
sudo apt install -y build-essential cmake git curl \
    libssl-dev libusb-1.0-0-dev \
    libgl1-mesa-dev libx11-dev libxext-dev \
    libxrender-dev libxtst-dev libxi-dev

# 2. Node.js 10.11.0 via nvm
echo "[2/8] Setting up Node.js 10.11.0..."
if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 10.11.0
nvm use 10.11.0
nvm alias default 10.11.0

# 3. Upgrade vcpkg (critical — submodule pins old Feb 2020 version with Boost 1.72)
echo "[3/8] Upgrading vcpkg (required for modern Boost 1.91+ and GCC 13+ compatibility)..."
cd "$DDCUT_DIR/vcpkg"
git checkout master
git pull origin master
./bootstrap-vcpkg.sh -disableMetrics
./vcpkg install boost-asio boost-thread boost-system boost-iostreams boost-filesystem \
    catch2 jsoncpp minizip openssl spdlog tiny-process-library zlib \
    --triplet x64-linux

# 4. Build tiny-process-library with -fPIC (needed for shared library linking)
echo "[4/8] Building tiny-process-library..."
if [ ! -d "$HOME/tiny-process-library" ]; then
    git clone https://github.com/eidheim/tiny-process-library ~/tiny-process-library
fi
cd "$HOME/tiny-process-library"
rm -rf build && mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS="-fPIC" -DCMAKE_POLICY_VERSION_MINIMUM=3.5
cmake --build .
sudo cmake --install .

# 5. Build tcmalloc shim (REQUIRED for Electron — prevents crash)
echo "[5/8] Building tcmalloc shim..."
cd "$DDCUT_DIR/UI/lib"
gcc -shared -fPIC -o tcmalloc_shim.so src/tcmalloc_shim.c -ldl
echo "  tcmalloc_shim.so built successfully"

# 6. Build DDCut C++ addon
echo "[6/8] Building DDCut C++ addon..."
cd "$DDCUT_DIR"
rm -rf build && mkdir build && cd build
cmake -DVCPKG_TARGET_TRIPLET=x64-linux \
      -DCMAKE_TOOLCHAIN_FILE=../vcpkg/scripts/buildsystems/vcpkg.cmake \
      -DCMAKE_EXPORT_COMPILE_COMMANDS:BOOL=ON \
      ../src
cmake --build . --config Release
cp RelWithDebInfo/ddcut.node ../UI/app/Backend/ddcut.node

# 7. Install frontend dependencies and build webpack bundle
echo "[7/8] Installing Electron frontend..."
cd "$DDCUT_DIR/UI"
npm install --ignore-scripts

echo "  Building webpack bundle..."
npx webpack --config=scripts/webpack.app.config.js --env=production --app=ddcut

# 8. USB permissions
echo "[8/8] Setting up USB permissions..."
sudo usermod -a -G dialout $USER 2>/dev/null || true

echo ""
echo "=== BUILD COMPLETE ==="
echo ""
echo "To run DDCut:"
echo "  bash $DDCUT_DIR/launch_ddcut.sh"
echo ""
echo "IMPORTANT: Always use launch_ddcut.sh (or LD_PRELOAD) to run DDCut."
echo "Without the tcmalloc shim, Electron crashes with 'Attempt to free invalid pointer'."
echo ""
echo "Note: Log out and back in for USB (dialout) group to take effect."
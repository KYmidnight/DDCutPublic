#!/bin/bash
# DDCut Linux Build Script for Ubuntu 26.04+
# Run this after cloning: git clone --recurse-submodules -b linux-modern-boost https://github.com/KYmidnight/DDCutPublic.git
set -e

DDCUT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# If run from inside DDCutPublic, use current dir
if [ -f "src/CMakeLists.txt" ]; then
    DDCUT_DIR="$(pwd)"
fi

echo "=== DDCut Linux Build Script ==="
echo "DDCut directory: $DDCUT_DIR"
echo ""

# 1. System dependencies
echo "[1/6] Installing system dependencies..."
sudo apt update
sudo apt install -y build-essential cmake git curl \
    libssl-dev libusb-1.0-0-dev \
    libgl1-mesa-dev libx11-dev libxext-dev \
    libxrender-dev libxtst-dev libxi-dev

# 2. Node.js 10.11.0 via nvm
echo "[2/6] Setting up Node.js 10.11.0..."
if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 10.11.0
nvm use 10.11.0
nvm alias default 10.11.0

# 3. Upgrade vcpkg (critical — submodule pins old Feb 2020 version with Boost 1.72)
echo "[3/6] Upgrading vcpkg (required for modern Boost 1.91 + GCC 15 compatibility)..."
cd "$DDCUT_DIR/vcpkg"
git checkout master
git pull origin master
./bootstrap-vcpkg.sh -disableMetrics
./vcpkg install boost-asio boost-thread boost-system boost-iostreams boost-filesystem \
    catch2 jsoncpp minizip openssl spdlog tiny-process-library zlib \
    --triplet x64-linux

# 4. Build tiny-process-library with -fPIC (not available in modern vcpkg)
echo "[4/6] Building tiny-process-library..."
if [ ! -d "$HOME/tiny-process-library" ]; then
    git clone https://github.com/eidheim/tiny-process-library ~/tiny-process-library
fi
cd "$HOME/tiny-process-library"
rm -rf build && mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS="-fPIC" -DCMAKE_POLICY_VERSION_MINIMUM=3.5
cmake --build .
sudo cmake --install .

# 5. Build DDCut C++ addon
echo "[5/6] Building DDCut..."
cd "$DDCUT_DIR"
rm -rf build && mkdir build && cd build
cmake -DVCPKG_TARGET_TRIPLET=x64-linux \
      -DCMAKE_TOOLCHAIN_FILE=../vcpkg/scripts/buildsystems/vcpkg.cmake \
      -DCMAKE_EXPORT_COMPILE_COMMANDS:BOOL=ON \
      ../src
cmake --build . --config Release
cp RelWithDebInfo/ddcut.node ../UI/app/Backend/ddcut.node

# 6. Install frontend
echo "[6/6] Installing Electron frontend..."
cd "$DDCUT_DIR/UI"
npm install --ignore-scripts
sudo chown root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox

# USB permissions
sudo usermod -a -G dialout $USER

echo ""
echo "=== BUILD COMPLETE ==="
echo ""
echo "To run DDCut:"
echo "  source ~/.nvm/nvm.sh"
echo "  cd $DDCUT_DIR/UI"
echo "  DISPLAY=:0 node scripts/start.js"
echo ""
echo "Important: Log out and back in for USB (dialout) group to take effect."
echo "GhostGunner firmware note: The connection code handles controllers"
echo "that don't re-send the Grbl startup banner (e.g., in Alarm state)."
echo "If 'Connecting' takes ~5 seconds, that's normal."
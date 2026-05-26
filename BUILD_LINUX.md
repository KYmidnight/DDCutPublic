# Building DDCut on Linux (Ubuntu 26.04)

This branch contains patches to build DDCut on modern Linux with GCC 15+ and Boost 1.90+.

## What Changed

The original DDCutPublic repo uses vcpkg pinned to a Feb 2020 commit with Boost 1.72.0, which is incompatible with GCC 15+. This branch:

1. **Upgrades vcpkg** to latest master (Boost 1.91.0)
2. **Fixes Boost.Asio deprecated APIs** (io_service→io_context, resolver::query→direct resolve, io_context::work→executor_work_guard)
3. **Updates CMakeLists.txt** for modern vcpkg target names
4. **Removes Windows-only `-Wa,-mbig-obj`** flag that breaks Linux x86_64

## Prerequisites

```bash
# System dependencies
sudo apt install -y build-essential cmake git curl \
    libssl-dev libusb-1.0-0-dev \
    libgl1-mesa-dev libx11-dev libxext-dev \
    libxrender-dev libxtst-dev libxi-dev

# Node.js 10.11.0 via nvm (required for the addon build system)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 10.11.0
nvm use 10.11.0
nvm alias default 10.11.0
```

## Build Instructions

```bash
# 1. Clone this branch
git clone --recurse-submodules -b linux-modern-boost https://github.com/KYmidnight/DDCutPublic.git
cd DDCutPublic

# 2. Upgrade vcpkg (required - the submodule pins an old version)
cd vcpkg
git checkout master
git pull origin master
./bootstrap-vcpkg.sh -disableMetrics
cd ..

# 3. Install vcpkg dependencies
cd vcpkg
./vcpkg install boost-asio boost-thread boost-system boost-iostreams boost-filesystem \
    catch2 jsoncpp minizip openssl spdlog tiny-process-library zlib \
    --triplet x64-linux
cd ..

# 4. Build tiny-process-library with -fPIC (if not using vcpkg version)
git clone https://github.com/eidheim/tiny-process-library ~/tiny-process-library
cd ~/tiny-process-library && mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS="-fPIC" -DCMAKE_POLICY_VERSION_MINIMUM=3.5
cmake --build .
sudo cmake --install .
cd ~/DDCutPublic

# 5. CMake configure
mkdir -p build && cd build
cmake -DVCPKG_TARGET_TRIPLET=x64-linux \
      -DCMAKE_TOOLCHAIN_FILE=../vcpkg/scripts/buildsystems/vcpkg.cmake \
      -DCMAKE_EXPORT_COMPILE_COMMANDS:BOOL=ON \
      ../src

# 6. Build
cmake --build . --config Release

# 7. Copy addon to UI
cp RelWithDebInfo/ddcut.node ../UI/app/Backend/ddcut.node

# 8. Install frontend dependencies
cd ../UI
npm install --ignore-scripts

# 9. Fix Electron sandbox
sudo chown root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox

# 10. Run!
DISPLAY=:0 node scripts/start.js
```

## Tested On

- Ubuntu 26.04 LTS (kernel 7.0.0-15-generic)
- GCC 15.2
- Boost 1.91.0 (via vcpkg)
- Node.js 10.11.0 (via nvm)
- Panasonic ToughBook CF-31 (i5-7300U)

## Known Issues

- Segfault on `Initialize()` when no GhostGunner USB device is connected (expected)
- `DDUtil` test executable fails to link (tiny-process-library symbol mismatch) — not needed for operation
- Node 10.11.0 is very old; some npm packages may need `--ignore-scripts`
- The Electron version bundled in the UI is outdated; may need updating for modern Linux desktops

## Files Modified

| File | Change |
|------|--------|
| `src/CMakeLists.txt` | Modern vcpkg targets, include paths, cmake_policy CMP0167 |
| `src/Common/CMakeLists.txt` | jsoncpp target name fix |
| `src/Files/CMakeLists.txt` | jsoncpp target name fix |
| `src/Services/CMakeLists.txt` | jsoncpp target name fix |
| `src/Settings/CMakeLists.txt` | jsoncpp target name fix |
| `src/CMake/FindFilesystem.cmake` | Removed `-Wa,-mbig-obj` |
| `src/Common/FileDownloader.cpp` | Boost.Asio modernization |
| `src/Services/Client/RestClient.cpp` | Boost.Asio modernization |
| `src/Services/Client/RestClient.h` | Resolve() signature update |
| `src/Ghost/GRBL/SerialConnection.cpp` | executor_work_guard, std::bind |
| `.gitignore` | Exclude upgraded vcpkg dir |

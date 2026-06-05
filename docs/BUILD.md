# Building DDCut on Linux

## Automated Build (Recommended)

```bash
git clone --recurse-submodules https://github.com/KYmidnight/DDCutPublic.git
cd DDCutPublic
bash build_linux.sh
```

This single script handles everything: system dependencies, nvm/Node.js, vcpkg upgrade, building the tcmalloc shim, compiling the C++ addon, building the webpack bundle, and installing npm packages.

Expect 20-40 minutes on first run (compiling Boost, OpenSSL, etc. from source via vcpkg).

## Manual Build Steps

### 1. System Dependencies

```bash
sudo apt update
sudo apt install -y build-essential cmake git curl \
    libssl-dev libusb-1.0-0-dev \
    libgl1-mesa-dev libx11-dev libxext-dev \
    libxrender-dev libxtst-dev libxi-dev
```

### 2. Node.js (via nvm)

DDCut's Electron frontend requires Node.js 10.11.0:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 10.11.0
nvm use 10.11.0
nvm alias default 10.11.0
```

### 3. vcpkg Dependencies

The git submodule pins vcpkg to a Feb 2020 commit with Boost 1.72, which doesn't compile on GCC 13+. You **must** upgrade it:

```bash
cd vcpkg
git checkout master
git pull origin master
./bootstrap-vcpkg.sh -disableMetrics
./vcpkg install boost-asio boost-thread boost-system boost-iostreams boost-filesystem \
    catch2 jsoncpp minizip openssl spdlog tiny-process-library zlib \
    --triplet x64-linux
cd ..
```

> **Note:** This takes 20-40 minutes on first run as it compiles Boost, OpenSSL, etc. from source.

### 4. tiny-process-library (Manual -fPIC Build)

The vcpkg version of tiny-process-library may not be compiled with `-fPIC`, which is required for linking into a shared library (Node.js addon). Build it manually:

```bash
git clone https://github.com/eidheim/tiny-process-library ~/tiny-process-library
cd ~/tiny-process-library
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS="-fPIC" -DCMAKE_POLICY_VERSION_MINIMUM=3.5
cmake --build .
sudo cmake --install .
cd $DDCUT_DIR
```

### 5. tcmalloc Shim (CRITICAL)

This shim **must** be built. Without it, DDCut will crash within seconds when running under Electron:

```bash
cd UI/lib
gcc -shared -fPIC -o tcmalloc_shim.so src/tcmalloc_shim.c -ldl
cd ../..
```

**What it does:** Electron 5 statically links Google's tcmalloc, which overrides `malloc`/`free`. When Boost.Asio allocates memory using `std::aligned_alloc()` (glibc) and frees it using `std::free()` (intercepted by tcmalloc), tcmalloc doesn't recognize the pointer and aborts. The shim redirects `aligned_alloc()` and `posix_memalign()` through `memalign()`, which tcmalloc handles correctly.

See `UI/lib/src/tcmalloc_shim.c` for detailed documentation.

### 6. Build the C++ Addon

```bash
mkdir -p build && cd build
cmake -DVCPKG_TARGET_TRIPLET=x64-linux \
      -DCMAKE_TOOLCHAIN_FILE=../vcpkg/scripts/buildsystems/vcpkg.cmake \
      -DCMAKE_EXPORT_COMPILE_COMMANDS:BOOL=ON \
      ../src
cmake --build . --config Release
cp RelWithDebInfo/ddcut.node ../UI/app/Backend/ddcut.node
cd ..
```

> **Note:** The `DDUtil` test binary will fail to link (`undefined reference` errors for tiny-process-library with wrong C++11 ABI). This is expected and harmless — only `ddcut.node` is needed.

### 7. Install Electron Frontend

```bash
cd UI
npm install --ignore-scripts
```

> `--ignore-scripts` prevents Electron from trying to download its binary twice (it's already included in the npm package).

### 8. Build the Webpack Bundle

The Electron app needs pre-compiled JavaScript bundles (`app/index.js` and `app/app.js`). Without these, Electron will exit immediately with usage info:

```bash
# Still in the UI directory from step 7
npx webpack --config=scripts/webpack.app.config.js --env=production --app=ddcut
```

This produces `app/index.js` and `app/app.js` from `src/index.js` and `src/Renderer/renderApp.js`.

### 9. USB Permissions

Your user needs dialout group access to communicate with the Ghost Gunner:

```bash
sudo usermod -a -G dialout $USER
# Log out and back in for this to take effect
```

Or for immediate effect without logout:
```bash
sudo chmod 666 /dev/ttyACM0  # temporary, reset on reboot
```

## Running DDCut

Always use the launch script, which sets up the required `LD_PRELOAD`:

```bash
bash launch_ddcut.sh
```

Or manually:

```bash
cd UI
LD_PRELOAD=/path/to/DDCutPublic/UI/lib/tcmalloc_shim.so \
DISPLAY=:0 \
node_modules/electron/dist/electron --no-sandbox .
```

**The `LD_PRELOAD` is non-negotiable.** Without it, the app will crash within seconds with `"tcmalloc: Attempt to free invalid pointer"`.

## Development Mode

For live-reloading during development, use the webpack dev server instead of the production build:

```bash
cd UI
nvm use 10.11.0
node scripts/start.js
```

This compiles the UI on-the-fly with hot reload. The `LD_PRELOAD` environment variable is still required (it's inherited by child processes).

## Troubleshooting

### Build Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `json/json.h: No such file or directory` | vcpkg include path misconfigured | Make sure you ran `./vcpkg install` successfully |
| `undefined reference to ... CMake target` | Old vcpkg target names | Make sure you're using the updated `CMakeLists.txt` from this repo |
| `-Wa,-mbig-obj` assembler error | x86_64 doesn't support this flag | Fixed in the updated `FindFilesystem.cmake` |
| `DDUtil` link failure (tiny-process-library ABI) | C++11 string ABI mismatch | Expected — DDUtil is a test binary, not needed |
| `cmake_policy SET CMP0167` warning | Old CMake policy | Fixed in updated CMakeLists.txt |
| `app/index.js not found` | Webpack bundle not built | Run `npx webpack --config=scripts/webpack.app.config.js --env=production --app=ddcut` |

### Runtime Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `tcmalloc: Attempt to free invalid pointer` | Running without the LD_PRELOAD shim | Add `LD_PRELOAD=path/to/tcmalloc_shim.so` or use `launch_ddcut.sh` |
| `Cannot open display :0` | No X11 display | Set `DISPLAY=:0` or use Xvfb |
| `The SUID sandbox helper binary was found, but is not owned by root` | Electron sandbox | Add `--no-sandbox` flag |
| `connection_status: -1` | No Ghost Gunner connected | Plug in the device, check `/dev/ttyACM*` |
| `connection_status: 2` then disconnects | Ghost Gunner in Alarm state | Send `$X` unlock command, or restart the controller |
| Electron exits with usage info | Missing `app/index.js` webpack bundle | Run the webpack build step (step 8 above) |

### Rebuilding After Source Changes

**C++ changes** (only rebuild the addon):

```bash
cd build
cmake --build . --config Release
cp RelWithDebInfo/ddcut.node ../UI/app/Backend/ddcut.node
```

**JavaScript/UI changes** (rebuild webpack):

```bash
cd UI
npx webpack --config=scripts/webpack.app.config.js --env=production --app=ddcut
```

**CMakeLists.txt changes** (full rebuild):

```bash
rm -rf build && mkdir build && cd build
cmake -DVCPKG_TARGET_TRIPLET=x64-linux \
      -DCMAKE_TOOLCHAIN_FILE=../vcpkg/scripts/buildsystems/vcpkg.cmake \
      ../src
cmake --build . --config Release
cp RelWithDebInfo/ddcut.node ../UI/app/Backend/ddcut.node
```

## Windows Build (Legacy)

For Windows builds, see the original [DDCut repo](https://github.com/DDCut/DDCut). The Windows build instructions previously in this file are outdated and target Win32/Visual Studio 2019.

### Original Windows Notes

- Node 10.11.0 32-bit is required
- Visual Studio 2019 with CMake
- vcpkg with `x86-windows-static` triplet
- See `vcpkg.txt` for the full dependency list
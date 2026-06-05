# DDCut

DDCut is cross-platform software for the Ghost Gunner CNC mill by Defense Distributed. This fork adds Linux support, fixes for modern compilers (GCC 15, Clang 19+), and a critical Electron/tcmalloc crash fix.

## Quick Start (Linux)

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/KYmidnight/DDCutPublic.git
cd DDCutPublic

# Build (installs deps, builds C++ addon + tcmalloc shim, installs npm packages)
bash build_linux.sh

# Run
bash launch_ddcut.sh
```

**⚠️ Important:** Always run DDCut via `launch_ddcut.sh` (or with `LD_PRELOAD` pointing to `tcmalloc_shim.so`). Without the shim, Electron's bundled tcmalloc will crash DDCut with `"Attempt to free invalid pointer"`. See [the crash fix details](#electron-tcmalloc-crash-fix) below.

## The Electron/tcmalloc Crash Fix

Electron 5 statically links Google's tcmalloc, which overrides `malloc`/`free`/`new`/`delete`. When Boost.Asio allocates memory internally using `std::aligned_alloc()` (glibc) and later frees it via `std::free()` (intercepted by tcmalloc), tcmalloc doesn't recognize the pointer and aborts with `"Attempt to free invalid pointer 0x7XXX0000880"`. The `0880` offset is the alignment prefix from `aligned_alloc`.

The fix has two parts:

1. **`tcmalloc_shim.so` (LD_PRELOAD)** — Redirects `aligned_alloc()` and `posix_memalign()` through tcmalloc's own `memalign()`, which allocates from the same pool that `free()` deallocates from. This is the critical fix for running under Electron.
2. **CMake flags** (`-DBOOST_ASIO_HAS_STD_ALIGNED_ALLOC=0 -DBOOST_ASIO_HAS_BOOST_ALIGN=0`) — Forces Boost.Asio to use `::operator new`/`::operator delete` instead of `std::aligned_alloc`/`std::free`. Helps for standalone Node runs and reduces the mismatch surface.

The shim source is at [`UI/lib/src/tcmalloc_shim.c`](UI/lib/src/tcmalloc_shim.c).

## Build from Source (Linux)

For detailed build instructions, see [docs/BUILD.md](docs/BUILD.md).

### Prerequisites

- Ubuntu 22.04+ (tested on 26.04 with GCC 15)
- CMake 3.12+
- Node.js 10.11.0 (installed by build script via nvm)
- X11 display (or Xvfb for headless)

### Manual Build

```bash
# 1. Clone
git clone --recurse-submodules https://github.com/KYmidnight/DDCutPublic.git
cd DDCutPublic

# 2. Build the tcmalloc shim
cd UI/lib && gcc -shared -fPIC -o tcmalloc_shim.so src/tcmalloc_shim.c -ldl && cd ../..

# 3. Install vcpkg dependencies (or run vcpkg manually — see build_linux.sh)
#    The build_linux.sh script handles this automatically

# 4. Build the C++ addon
mkdir build && cd build
cmake -DVCPKG_TARGET_TRIPLET=x64-linux \
      -DCMAKE_TOOLCHAIN_FILE=../vcpkg/scripts/buildsystems/vcpkg.cmake \
      ../src
cmake --build . --config Release
cp RelWithDebInfo/ddcut.node ../UI/app/Backend/ddcut.node

# 5. Install Electron frontend
cd ../UI && npm install --ignore-scripts

# 6. Run
LD_PRELOAD=$(pwd)/lib/tcmalloc_shim.so DISPLAY=:0 node_modules/electron/dist/electron --no-sandbox .
```

## Design

DDCut2 is a C++ daemon that communicates via USB with Ghost Gunner CNC mills. It has an HTML/CSS/JS front-end that communicates with the daemon via a N-API Node.js add-on.

### Architecture

- **Back-end (C++):** Maintains state, handles all logic, communicates with the hardware
- **Integration (Node.js N-API):** `NodeWrapper.cpp` bridges the daemon to JavaScript
- **Front-end (Electron/HTML/CSS/JS):** User interface, communicates with daemon via the add-on

### Key Bug Fixes in This Fork

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `"Attempt to free invalid pointer"` crash on startup | Boost.Asio aligned allocator vs Electron's tcmalloc | tcmalloc_shim.so + CMake flags |
| Deadlock on disconnect | `Disconnect()` holds mutex while joining io thread | Unlock mutex before join, destroy port first |
| Segfault on async read after disconnect | `read_cb` re-arms `async_read_some` on destroyed port | Null-check `m_port` and `m_work` before re-arming |
| Grbl banner timeout (no connection) | Controller won't re-send banner if already running | Send soft reset (0x18), retry 3 times, then assume running |
| Build failure with GCC 15+ | Boost 1.72 incompatibility, deprecated `io_service` API | Modern vcpkg, ported to `io_context`, modern `resolve()` API |
| CMake target errors | Old vcpkg target names (`jsoncpp_lib`, `minizip::minizip`) | Updated to `JsonCpp::JsonCpp`, `unofficial::minizip::minizip` |

## License

See [UI/LICENSE](UI/LICENSE) for license information.
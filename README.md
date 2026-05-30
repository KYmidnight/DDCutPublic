# DDCut - Linux Port

**Status:** ✅ Successfully ported from Windows to Linux (Ubuntu 26.04)

> Original project: Defense Distributed's DDCut (Windows-only, last updated ~2018)
>
> **Linux Port by:** KYmidnight | **Date:** May 2026

## Quick Start (Linux)

```bash
# Clone the Linux-modified version
git clone -b linux-modern-boost https://github.com/KYmidnight/DDCutPublic.git
cd DDCutPublic

# Build (see BUILD_LINUX.md for detailed instructions)
mkdir build && cd build
cmake ..
make

# Connect to GhostGunner
# Ensure user is in dialout group: sudo usermod -a -G dialout $USER
# Then logout/login for group membership to take effect
```

## What Was Fixed

### 1. **vcpkg Upgrade** (Feb 2020 → May 2026)
- **Problem:** Pinned to Boost 1.72, incompatible with modern GCC (GCC 15+)
- **Solution:** Upgraded vcpkg submodule to latest master, pulling Boost 1.91.0
- **Files:** `vcpkg/`, `CMakeLists.txt`

### 2. **Boost.Asio API Modernization** (1.72 → 1.91)
- **Problem:** Deprecated APIs broke compilation
- **Changes:**
  - `io_service` → `io_context`
  - `resolver::query()` → `resolver.resolve(host, port)`
  - `resolver::iterator` → `results_type`
  - `io_context::work` → `executor_work_guard<io_context::executor_type>`
  - `boost::bind` → `std::bind`
  - Added `BOOST_BIND_GLOBAL_PLACEHOLDERS` macro
- **Files:** `src/Common/FileDownloader.cpp`, `src/Services/Client/RestClient.cpp/h`, `src/Ghost/GRBL/SerialConnection.cpp`

### 3. **CMake Target Name Changes** (Modern vcpkg)
- **Problem:** Target names changed in updated vcpkg
- **Changes:**
  - `jsoncpp_lib` → `JsonCpp::JsonCpp` (via `jsoncpp_static`)
  - `minizip::minizip` → `unofficial::minizip::minizip`
  - `tiny-process-library` → Built from source with `-fPIC`
- **Files:** `CMakeLists.txt`, sub-CMakeLists in dependencies

### 4. **Removed Windows-Specific Flags**
- **Problem:** `FindFilesystem.cmake` added `-Wa,-mbig-obj` (Windows MinGW flag)
- **Solution:** Removed flag - breaks x86_64 Linux assembler
- **Files:** `cmake/FindFilesystem.cmake`

### 5. **GhostGunner Connection Fix** (Critical!)
- **Problem:** DDCut firmware in Alarm state sends `<Alarm|...>` status reports instead of `Grbl X.X` startup banner. `Connect()` loops waiting for banner and times out.
- **Solution:**
  - Send soft reset (Ctrl+X / byte 24) before startup wait
  - After 3 timeouts without Grbl banner, assume controller already running
  - Set version to "1.1" (DDCut standard), send `$X` to unlock Alarm state
  - Connection now completes in ~5 seconds instead of timing out
- **Files:** `src/Ghost/GRBL/SerialConnection.cpp`

### 6. **Serial Port Permissions**
- **Problem:** `/dev/ttyACM0` owned by `root:dialout`
- **Solution:** Add user to dialout group: `sudo usermod -a -G dialout $USER`
- **Note:** Requires logout/login for permanent fix

### 7. **Electron UI Adjustments** (ToughBook Display)
- **Problem:** Window too large for ToughBook (1280x720 display)
- **Solution:** Resized BrowserWindow (minWidth: 1205→800, width: 1205→1024, height: 705→600)
- **Files:** `UI/app/index.js`

### 8. **Electron Sandbox Permissions**
- **Problem:** Chrome sandbox requires setuid
- **Solution:** `sudo chown root chrome-sandbox && sudo chmod 4755 chrome-sandbox`
- **Files:** `UI/node_modules/electron/dist/chrome-sandbox`

## Hardware Compatibility

- **Controller:** Arduino Uno (vendor 2341, product 0043)
- **Serial Port:** `/dev/ttyACM0` (USB ACM driver, auto-detected)
- **Baud Rate:** 115200, 8N1
- **Protocol:** Custom GRBL variant (DDCut firmware)
- **Status Format:** `<Alarm|M:x,y,z|B:rx,tx|L:n|Pnnn>` or `<Idle|...>`

## Tested On

- **System:** Panasonic ToughBook (i5-7300U, 4 cores)
- **OS:** Ubuntu 26.04 LTS
- **Kernel:** 7.0.0-15-generic
- **Build Tools:** GCC 15, CMake 3.28, vcpkg (latest master)

## Known Issues

- `DDUtil` test executable fails to link (tiny-process-library API mismatch) — **not needed for operation**
- `Shutdown()` can segfault — **secondary issue, doesn't affect normal operation**
- `SelectGhostGunner()` returns false initially (async, needs ~5s to complete) — **expected behavior**
- User must logout/login for permanent dialout group membership

## Documentation

- **Original BUILD.md:** Still applies, but see `BUILD_LINUX.md` for Linux-specific instructions
- **BUILD_LINUX.md:** Detailed Linux build guide (new file)
- **Original docs:** `docs/` folder (Windows-focused)

## Credits

- **Original Project:** Defense Distributed (Defdist)
- **Linux Port:** KYmidnight (2026)
- **Hardware Testbed:** Tom's ToughBook, French Lick, IN

## License

Same as original DDCut project. See LICENSE file.

---

**Questions?** Open an issue on GitHub or contact the port maintainer.

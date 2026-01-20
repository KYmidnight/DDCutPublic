# NEW BUILD INSTRUCTIONS
## 1. Setup Dependencies
  - Install Node & npm (https://nodejs.org/en/blog/release/v10.11.0/)
    - Node should be version 10.11.0 and **MUST BE THE 32 BIT VERSION**
    - npm should be version 6.14.4
  - Install C++ 17 Compatible Compiler and CMake
    - Easiest way to do this is to install Visual Studio 2019, and then perform all actions in their Developer Tools Console 

## 2. Clone down the repo with submodules
  - git clone --recurse-submodules <repo url>

## 3. Configure vcpkg
  - If the vcpkg folder is empty (which it should not be if you cloned with submodules), delete the vcpkg folder and clone vcpkg from github
    - git clone https://github.com/microsoft/vcpkg.git
    - cd vcpkg
    - git checkout 769f5bc
  - (WINDOWS)
    - bootstrap-vcpkg.bat
    - vcpkg install --overlay-triplets=../custom-triplets @../vcpkg.txt --triplet x86-windows-static
  - OSX
    - ./bootstrap-vcpkg.sh
    - ./vcpkg install --overlay-triplets=../custom-triplets @../vcpkg.txt --triplet x64-osx_dd
  - LINUX
    - ./bootstrap-vcpkg.sh
    - ./vcpkg install --overlay-triplets=../custom-triplets @../vcpkg.txt --triplet x64-linux

## 4. From root directory:
  - (Windows) mkdir build && cd build && cmake -DVCPKG_TARGET_TRIPLET=x86-windows-static -DCMAKE_TOOLCHAIN_FILE=../vcpkg/scripts/buildsystems/vcpkg.cmake -DCMAKE_EXPORT_COMPILE_COMMANDS:BOOL=ON -A Win32 -DOPENSSL_ROOT_DIR:PATH=../vcpkg/installed/x86-windows-static ../src
  - (OS X) mkdir -p build && cd build && cmake -DVCPKG_TARGET_TRIPLET=x64-osx_dd -DCMAKE_TOOLCHAIN_FILE=../vcpkg/scripts/buildsystems/vcpkg.cmake -DCMAKE_EXPORT_COMPILE_COMMANDS:BOOL=ON ../src
  - (Linux) mkdir -p build && cd build && cmake -DVCPKG_TARGET_TRIPLET=x64-linux -DCMAKE_TOOLCHAIN_FILE=../vcpkg/scripts/buildsystems/vcpkg.cmake -DCMAKE_EXPORT_COMPILE_COMMANDS:BOOL=ON ../src

  - cmake --build . --config Release

## 5. From UI directory:
  - npm install 
  - node scripts/start.js - this will launch the current frontend build

## 6. Build installer:
  - From UI directory:
    - npm run release
    - Build can be found in UI/dist
    - NOTE: This process will seem to fail, but the executable will build succesfully to UI/dist. This local executable will not contain any API functionality (because we rely on Github's build to insert API creds')

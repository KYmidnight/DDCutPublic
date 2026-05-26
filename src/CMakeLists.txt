cmake_minimum_required(VERSION 3.12.4)
cmake_policy(SET CMP0167 NEW)
set(CMAKE_OSX_DEPLOYMENT_TARGET
    "10.12"
    CACHE STRING "Minimum OS X deployment version")

set(DDCUT_VERSION 1.0.5)
project(ddcut VERSION ${DDCUT_VERSION})

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CMAKE_BUILD_TYPE RelWithDebInfo)
set(CMAKE_MAP_IMPORTED_CONFIG_MINSIZEREL MinSizeRel Release)
set(CMAKE_MAP_IMPORTED_CONFIG_RELWITHDEBINFO "RelWithDebInfo;Release;")

if(WIN32)
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /std:c++17 /MP")
  #set(CMAKE_GENERATOR_PLATFORM "Win32")
  string(REPLACE "/MD" "/MT" CMAKE_CXX_FLAGS_RELEASE
                 "${CMAKE_CXX_FLAGS_RELEASE}")
  string(REPLACE "/MD" "/MT" CMAKE_CXX_FLAGS_RELWITHDEBINFO
                 "${CMAKE_CXX_FLAGS_RELWITHDEBINFO}")
else(WIN32)
  if(APPLE)
    set(CMAKE_CXX_FLAGS
        "${CMAKE_CXX_FLAGS} -std=c++17 -stdlib=libc++ -Wdeprecated-declarations -Wnonportable-include-path"
    )
    set(CMAKE_EXE_LINKER_FLAGS
        "${CMAKE_EXE_LINKER_FLAGS} -framework CoreFoundation -framework IOKit")
  else(APPLE)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++17")
  endif(APPLE)
endif(WIN32)

set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/${CMAKE_BUILD_TYPE})
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

# Dependencies
set(CMAKE_MODULE_PATH ${CMAKE_CURRENT_SOURCE_DIR}/CMake)
string(TOUPPER "${CMAKE_BUILD_TYPE}" BUILD_TYPE_SUFFIX)
if(BUILD_TYPE_SUFFIX MATCHES "DEBUG")
  set(IMPORT_BUILD_TYPE "DEBUG")
else()
  set(IMPORT_BUILD_TYPE "RELEASE")
endif()

find_package(Boost REQUIRED COMPONENTS iostreams system thread filesystem)
find_package(Catch2 CONFIG REQUIRED)

if(NOT APPLE)
  find_package(Filesystem REQUIRED)
endif(NOT APPLE)

find_package(jsoncpp CONFIG REQUIRED)
# jsoncpp: use jsoncpp_static (modern vcpkg) or jsoncpp_lib (legacy)
if(TARGET jsoncpp_static)
  set(jsoncpp_LIBRARIES jsoncpp_static)
elseif(TARGET jsoncpp_lib)
  set(jsoncpp_LIBRARIES jsoncpp_lib)
endif()
find_package(unofficial-minizip CONFIG REQUIRED)
set(minizip_LIBRARIES unofficial::minizip::minizip)
find_package(OpenSSL REQUIRED)
find_package(spdlog CONFIG REQUIRED)
set(spdlog_LIBRARIES spdlog::spdlog)
find_package(Threads REQUIRED)
find_package(unofficial-tiny-process-library CONFIG REQUIRED)
set(tinyprocesslibrary_LIBRARIES unofficial::tiny-process-library::tiny-process-library)
find_package(ZLIB REQUIRED)

include(NodeJS)
nodejs_init()

add_definitions(-DDDCUT_VERSION="${DDCUT_VERSION}")

if(WIN32)
  add_definitions(-DWIN32_LEAN_AND_MEAN)
endif()

include_directories(
  ${VCPKG_INSTALLED_DIR}/${VCPKG_TARGET_TRIPLET}/include
  ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/deps/ghc/include
  ${CMAKE_CURRENT_SOURCE_DIR}/deps/optional/include)

set(CMAKE_INSTALL_NAME_DIR "@executable_path")
set(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)

add_subdirectory(Common)
add_subdirectory(Ghost)
add_subdirectory(Files)
add_subdirectory(Services)
add_subdirectory(Settings)

if(WIN32)
  set(DDCUT_SRC "")
else(WIN32)
  # Modern vcpkg: use target_link_libraries instead of source-file linking
  set(DDCUT_SRC "")
endif(WIN32)

list(
  APPEND
  DDCUT_SRC
  "${CMAKE_CURRENT_SOURCE_DIR}/DDCutDaemon.cpp"
  $<TARGET_OBJECTS:ddcut-common>
  $<TARGET_OBJECTS:ddcut-files>
  $<TARGET_OBJECTS:ddcut-firmware>
  $<TARGET_OBJECTS:ddcut-ghost>
  $<TARGET_OBJECTS:ddcut-ghost-drivers>
  $<TARGET_OBJECTS:ddcut-ghost-display>
  $<TARGET_OBJECTS:ddcut-services>
  $<TARGET_OBJECTS:ddcut-settings>
  $<TARGET_OBJECTS:ddcut-ghost-grbl>)

add_library(DDCutDaemon STATIC ${DDCUT_SRC})
set_property(TARGET DDCutDaemon PROPERTY POSITION_INDEPENDENT_CODE 1)
target_link_libraries(
  DDCutDaemon
  INTERFACE JsonCpp::JsonCpp
  PRIVATE JsonCpp::JsonCpp
          ZLIB::ZLIB
          ${minizip_LIBRARIES}
          unofficial::tiny-process-library::tiny-process-library
          OpenSSL::Crypto
          OpenSSL::SSL
          Threads::Threads
          Boost::system
          Boost::thread
          Boost::filesystem
          spdlog::spdlog)

if(NOT APPLE)
  target_link_libraries(DDCutDaemon PRIVATE std::filesystem)
endif(NOT APPLE)

if(WIN32)
  target_link_libraries(DDCutDaemon PRIVATE setupapi crypt32)
endif(WIN32)

add_nodejs_module(${PROJECT_NAME} "${CMAKE_CURRENT_SOURCE_DIR}/NodeWrapper.cpp")
set_target_properties(
  ${PROJECT_NAME}
  PROPERTIES MACOSX_RPATH ON
             BUILD_WITH_INSTALL_RPATH 1
             INSTALL_NAME_DIR "@executable_path")
target_link_libraries(${PROJECT_NAME} DDCutDaemon)

add_executable(DDUtil "DDCutTest.cpp")
target_link_libraries(DDUtil DDCutDaemon)

#add_subdirectory(Tests)

add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:ddcut> ${CMAKE_CURRENT_LIST_DIR}/../UI/app/Backend/ddcut.node
)

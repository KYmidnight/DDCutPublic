add_subdirectory(Drivers)
add_subdirectory(GRBL)
add_subdirectory(Display)
add_subdirectory(Firmware)

set(
  cxx-sources
  GhostConnector.cpp
  GhostErrorHandler.cpp
  GhostException.cpp
  MillingManager.cpp
  Status/MillingError.cpp
)
set(
  cxx-headers
  GhostConnector.h
  GhostErrorHandler.h
  GhostException.h
  GhostGunnerFinder.h
  GhostGunner.h
  MillingManager.h
  Status/ConnectionStatus.h
  Status/MillingError.h
  Status/MillingStatus.h
)

if(WIN32)
  list(APPEND cxx-sources GhostGunnerFinder_win.cpp)
elseif(APPLE)
  list(APPEND cxx-sources GhostGunnerFinder_osx.cpp)
else()
  list(APPEND cxx-sources GhostGunnerFinder_linux.cpp)
endif()

add_library(ddcut-ghost OBJECT ${cxx-sources} ${cxx-headers})
set_property(TARGET ddcut-ghost PROPERTY POSITION_INDEPENDENT_CODE 1)
target_link_libraries(ddcut-ghost PUBLIC ddcut-ghost-grbl)

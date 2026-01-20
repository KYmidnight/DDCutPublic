set(
  cxx-sources
  AVRDude.cpp
  FirmwareManager.cpp
  FirmwareUpdater.cpp
  FirmwareVersion.cpp
)
set(
  cxx-headers
  AVRDude.h
  FirmwareManager.h
  FirmwareUpdater.h
  FirmwareVersion.h
)
add_library(ddcut-firmware OBJECT ${cxx-sources} ${cxx-headers})
set_property(TARGET ddcut-firmware PROPERTY POSITION_INDEPENDENT_CODE 1)
target_link_libraries(ddcut-firmware PUBLIC ddcut-ghost-grbl PRIVATE unofficial::tiny-process-library::tiny-process-library)

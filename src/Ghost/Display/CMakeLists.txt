set(
  cxx-sources
  GhostDisplayManager.cpp
)
set(
  cxx-headers
  GhostDisplayManager.h
  LineType.h
)
add_library(ddcut-ghost-display OBJECT ${cxx-sources} ${cxx-headers})
set_property(TARGET ddcut-ghost-display PROPERTY POSITION_INDEPENDENT_CODE 1)

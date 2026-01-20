set(cxx-sources drivers.cpp)
set(cxx-headers drivers.h)

add_library(ddcut-ghost-drivers OBJECT ${cxx-sources} ${cxx-headers})
set_property(TARGET ddcut-ghost-drivers PROPERTY POSITION_INDEPENDENT_CODE 1)

set(
  cxx-sources
  archive.cpp
  DDException.cpp
  DDFile.cpp
  GCodeFile.cpp
  GCodeLine.cpp
  job.cpp
  manifest.cpp
  operation.cpp
  yaml.cpp
)
set(
  cxx-headers
  archive.h
  DDException.h
  DDFile.h
  GCodeFile.h
  GCodeLine.h
  job.h
  manifest.h
  operation.h
  yaml.h
)
add_library(ddcut-files OBJECT ${cxx-sources} ${cxx-headers})
set_property(TARGET ddcut-files PROPERTY POSITION_INDEPENDENT_CODE 1)
target_link_libraries(ddcut-files PUBLIC minizip::minizip ZLIB::ZLIB Boost::filesystem)

set(
  cxx-sources
  FileDownloader.cpp
  Logger.cpp
  ThreadManager.cpp
  Util/FileUtil.cpp
  Util/OSUtil.cpp
)
set(
  cxx-headers
  CommonHeaders.h
  Defs.h
  FileDownloader.h
  Logger.h
  ThreadManager.h
  Models/Axis.h
  Models/Measurement.h
  Models/Range.h
  Models/URL.h
  Util/FileUtil.h
  Util/JsonUtil.h
  Util/MathUtil.h
  Util/OSUtil.h
  Util/StringUtil.h
  Util/Queue_Threadsafe.h
  Util/CommonTypes.h
  Util/DD_Utils.h
  )

add_library(ddcut-common OBJECT ${cxx-sources} ${cxx-headers})
set_property(TARGET ddcut-common PROPERTY POSITION_INDEPENDENT_CODE 1)
target_link_libraries(ddcut-common PUBLIC JsonCpp::JsonCpp)
target_link_libraries(ddcut-common PRIVATE spdlog::spdlog Boost::headers)

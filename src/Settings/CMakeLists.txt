set(
  cxx-sources
  SettingManager.cpp
)
set(
  cxx-headers
  JogKeys.h
  Setting.h
  SettingManager.h
  WalkthroughType.h
)
add_library(ddcut-settings OBJECT ${cxx-sources} ${cxx-headers})
set_property(TARGET ddcut-settings PROPERTY POSITION_INDEPENDENT_CODE 1)
target_compile_definitions(ddcut-settings PRIVATE REST_CLIENT)
target_link_libraries(ddcut-settings PUBLIC jsoncpp_lib)

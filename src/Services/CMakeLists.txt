set(
  cxx-sources
  CustSupportService.cpp
  FirmwareUpdateService.cpp
  Client/RestClient.cpp
  Models/AvailableFirmware.cpp
)
set(
  cxx-headers
  CustSupportService.h
  FirmwareUpdateService.h
  Client/RestClient.h
  Models/AvailableFirmware.h
)

add_library(ddcut-services OBJECT ${cxx-sources} ${cxx-headers})
set_property(TARGET ddcut-services PROPERTY POSITION_INDEPENDENT_CODE 1)
target_compile_definitions(ddcut-services PRIVATE REST_CLIENT DDCUT_AUTH_KEY="${DDCUT_AUTH_KEY}")
target_link_libraries(ddcut-services OpenSSL::Crypto OpenSSL::SSL Boost::headers JsonCpp::JsonCpp ddcut-common ddcut-firmware)

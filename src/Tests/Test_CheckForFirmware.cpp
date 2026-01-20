#include <catch.hpp>

#include <Services/FirmwareUpdateService.h>

TEST_CASE("DDRestClient::CheckForFirmwareUpdates")
{
    FirmwareVersion version = FirmwareVersion::Parse("[grbl:1.1h GG:3A PCB:3B VFD:3A YMD:20200101]");
    FirmwareUpdateService::Request req{
        "1.0.5",
        "",
        version
    };
    auto response = FirmwareUpdateService::Invoke(req);

    REQUIRE(response.available.size() == 1);
}
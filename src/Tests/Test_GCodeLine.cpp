#include <catch.hpp>

#include <Files/GCodeLine.h>

TEST_CASE("GCodeLine")
{
    GCodeLine line("");

    // $H - Home
    line = GCodeLine("$H");
    REQUIRE(line.GetType() == GCodeLine::TYPE_GRBL);
    REQUIRE(line.GetGroup() == GCodeLine::GROUP_GRBL_HOME);
    REQUIRE(line.IsBlocking());
    REQUIRE(line.IsHome());

    // $HX - Home X-axis
    line = GCodeLine("$HX");
    REQUIRE(line.GetType() == GCodeLine::TYPE_GRBL);
    REQUIRE(line.GetGroup() == GCodeLine::GROUP_GRBL_HOME);
    REQUIRE(line.IsBlocking());
    REQUIRE(line.IsHome());

    // $HX - Home Y-axis
    line = GCodeLine("$HY");
    REQUIRE(line.GetType() == GCodeLine::TYPE_GRBL);
    REQUIRE(line.GetGroup() == GCodeLine::GROUP_GRBL_HOME);
    REQUIRE(line.IsBlocking());
    REQUIRE(line.IsHome());

    // $HX - Home Z-axis
    line = GCodeLine("$HZ");
    REQUIRE(line.GetType() == GCodeLine::TYPE_GRBL);
    REQUIRE(line.GetGroup() == GCodeLine::GROUP_GRBL_HOME);
    REQUIRE(line.IsBlocking());
    REQUIRE(line.IsHome());

    // $L - Level
    line = GCodeLine("$L");
    REQUIRE(line.GetType() == GCodeLine::TYPE_GRBL);
    REQUIRE(line.GetGroup() == GCodeLine::GROUP_GRBL_LEVEL);
    REQUIRE(line.IsBlocking());
    REQUIRE(line.IsLevel());

    // G4 PXX
    line = GCodeLine("G4P0");
    REQUIRE(line.GetType() == GCodeLine::TYPE_GCODE);
    REQUIRE(line.GetGroup() == GCodeLine::GROUP_G_NON_MODAL);
    REQUIRE(line.IsBlocking());
}
#include <catch.hpp>

#include "DDCutDaemon.h"
#include <Ghost/GRBL/Protocol/Protocol.h>
using namespace std;

TEST_CASE("Protocol") {
	// TODO: Implement
	auto connector = GhostConnector::Initialize();
	auto ghost = *connector->GetAvailableGhostGunners().begin();
	auto& path = ghost.GetPath();
	while (!connector->IsConnected()) {
		this_thread::sleep_for(200ms);
	}

	auto state = make_shared<ConnectionState>();
	auto cereal = make_shared<SerialConnection>( path, state );
	auto proto = Protocol{ cereal, state };
	auto& buffer = state->GetBuffer();

	buffer.push( GCodeLine{"G0"} );
	REQUIRE(buffer.num_lines() == 1);
	proto.ProcessResponse("");
	REQUIRE(buffer.num_lines() == 1);
	proto.ProcessResponse("ok");
	REQUIRE(buffer.num_lines() == 0);

	buffer.push(GCodeLine{ "abcde" });
	try {
		proto.ProcessResponse("error:1");
		REQUIRE(false);	// Previous line should throw
	}
	catch (GhostException e) {
		REQUIRE(buffer.num_lines() == 0);
		REQUIRE(e.getType() == e.GRBL_ERROR);
	}

	buffer.push(GCodeLine{ "G0G53X500" });
	try {
		proto.ProcessResponse("ALARM:2");
		REQUIRE(false);	// Previous line should throw
	}
	catch (GhostException e) {
		REQUIRE(e.getType() == e.ALARM_LIMIT);
	}

	buffer.push(GCodeLine{ "G38.2 Z-2 F30" });
	try {
		proto.ProcessResponse("ALARM:5");
		REQUIRE(false);	// Previous line should throw
	}
	catch (GhostException e) {
		REQUIRE(e.getType() == e.ALARM_PROBE);
	}
}

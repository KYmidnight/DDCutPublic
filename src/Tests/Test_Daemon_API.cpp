#include <catch.hpp>
#include "DDCutDaemon.h"
using namespace std;
const auto testFolderPath = "D:\\Programming\\DD-cut-Ghost-Gunner\\DDCut Test Code\\"s;
const auto repoFolderPath = "D:\\Programming\\DD-cut-Ghost-Gunner\\"s;
const auto cutCodesFolderPath = "D:\\Programming\\DD-cut-Ghost-Gunner\\Extra-DDCut\\USB-Backup\\"s;

TEST_CASE("DDCutDaemon") {
	// Setup connection
	DDCutDaemon& demon = DDCutDaemon::GetInstance();
	demon.Initialize();
	while (demon.GetGhostGunnerStatus() != EGhostGunnerStatus::connected) {
		std::cout << "Not connected\n";
		this_thread::sleep_for(250ms);
	}
	REQUIRE(demon.GetConnection()->IsConnected());
	LogCout("Next Daemon Test\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");

	SECTION("Check startup position") {
		auto startupPos = demon.GetStatus()->GetPosition().GetMachinePosition();
		REQUIRE(demon.GetStatus()->GetState() == "Alarm");
		REQUIRE(startupPos.GetX().millimeters() == -0.0);
		REQUIRE(startupPos.GetY().millimeters() == -0.0);
		REQUIRE(startupPos.GetZ().millimeters() == -0.0);

		demon.ExecuteCommand("$H");
		demon.ExecuteCommand("?");
		auto homePos = demon.GetStatus()->GetPosition().GetMachinePosition();
		REQUIRE(demon.GetStatus()->GetState() == "Idle");
		REQUIRE(homePos.GetX().millimeters() == -86.0);
		REQUIRE(homePos.GetY().millimeters() == -0.5);
		REQUIRE(homePos.GetZ().millimeters() == -0.5);
		demon.GetStatus()->GetWorkCoordinates();
	}

	SECTION("Set & Unset WCS Offsets") {
		// Set offsets
		// Check that we can change to new WCS modal
		demon.ExecuteCommand("$X");
		demon.ExecuteCommand("$RST=#");
		REQUIRE(!demon.HasNonzeroWCS());
		demon.ExecuteCommand("G10 L2 P2 X-5 Y-5 Z-5");
		REQUIRE(demon.HasNonzeroWCS());
		demon.ExecuteCommand("G55");
		static_cast<void>(demon.GetReadWrites());	// Discard all previous responses
		demon.ExecuteCommand("$G");
		auto reads = demon.GetReadWrites();
		auto foundG55 = false;
		for (auto& line : reads) {
			if (line.second.find("G55") != string::npos) { foundG55 = true; break; }
		}
		REQUIRE(foundG55);

		// Lambda to check offsets
		auto checkOffsets = [ ] (string& line, float desired = 0.0) {
			auto n = line.find(':');
			line.erase(0, n + 1);
			auto stream = stringstream{ line };
			auto temp = string{ };
			while (getline(stream, temp, ',')) {
				auto offset = stof(temp);
				REQUIRE(offset == desired);
			}
		};

		// Verify that offsets are in place
		static_cast<void>(demon.GetReadWrites());	// Discard all previous responses
		demon.ExecuteCommand("$#");
		reads = demon.GetReadWrites();
		for (auto& line : reads) {
			if (line.second.find("[G55") != string::npos) { checkOffsets(line.second, -5.0); }
		}

		// Clear offsets
		demon.ExecuteCommand("$RST=#");
		static_cast<void>(demon.GetReadWrites());	// Discard all previous responses
		demon.ExecuteCommand("$#");
		reads = demon.GetReadWrites();
		foundG55 = false;
		for (auto& line : reads) {
			if (line.second[0] == '[') { checkOffsets(line.second); }
		}
	}

	SECTION("Run Cut Codes") {
		demon.ExecuteCommand("$H");
		static_cast<void>(demon.GetReadWrites());	// Discard all previous responses

		// Common code to run a .dd file
		auto runCodeThroughStep = [ &demon ] (const string& filepath, const int stepNum) {
			demon.SetDDFile(filepath);
			demon.SelectJob(0);
			auto steps = demon.GetAllSteps();
			auto hasErrorOrAlarm = false;

			// Check for errors/alarms
			auto processResponse = [ &demon, &hasErrorOrAlarm ] () {
				auto lines = demon.GetReadWrites();
				for (auto& line : lines) {
					line.second = StringUtil::ToLower(line.second);
					if (line.second.find("error") != string::npos || line.second.find("alarm") != string::npos) {
						hasErrorOrAlarm = true;
					}
				}
			};

			// Iterate through all GCode steps and wait for responses
			for (auto i = 0; i <= stepNum; ++i) {
				if (!steps[i]->HasGCodes()) { continue; }
				demon.StartMilling(i);
				while (demon.MillingInProgress()) {
					processResponse();
				}
			}

			// Ensure spindle is disengaged if it isn't already
			demon.ExecuteCommand("S0");
			demon.ExecuteCommand("G4 P2");
			demon.ExecuteCommand("M5");

			return !hasErrorOrAlarm;
		};

		SECTION("AR-15 Cut Code") {
			auto filepath = cutCodesFolderPath + "Cutting Codes\\AR15\\GG3 AR15 V2.dd";
			REQUIRE(runCodeThroughStep(filepath, 25));
			demon.Shutdown();
		}

		SECTION("AR-308 Cut Code") {
			auto filepath = cutCodesFolderPath + "Cutting Codes\\AR308\\GG3 AR308.dd";
			REQUIRE(runCodeThroughStep(filepath, 25));
			demon.Shutdown();
		}

		SECTION("1911 Cut Code") {
			auto filepath = cutCodesFolderPath + "Cutting Codes\\M1911\\GG3 1911 v2.dd";
			REQUIRE(runCodeThroughStep(filepath, 22));
			demon.Shutdown();
		}

		SECTION("P80 Cut Code") {
			auto filepath = cutCodesFolderPath + "Cutting Codes\\P80\\GG3 P80 V2.dd";
			REQUIRE(runCodeThroughStep(filepath, 27));
			demon.Shutdown();
		}

		SECTION("Error First Step GCode") {
			auto filepath = repoFolderPath + "Test DD Files\\trigger_soft_limit_error_first_step.dd";
			REQUIRE(!runCodeThroughStep(filepath, 1));	// Has error/alarm returns true
			demon.Shutdown();
		}

		SECTION("Check Broken .dd File") {
			auto filepath = repoFolderPath + "Test DD Files\\Missing_files.dd";
			REQUIRE(!demon.IsValidDDFile(filepath));	// Should return file as invalid
		}

		SECTION("Probe Alarm Allows Retry") {
			auto filepath = repoFolderPath + "Test DD Files\\Test Probing\\Test Probing.dd";
			REQUIRE(!runCodeThroughStep(filepath, 2));	// Should have error/alarm
			auto millingError = demon.GetMillingStatus().GetError();
			REQUIRE(millingError.has_value());
			cout << "Error #: " << millingError.value().error_id << endl;
			REQUIRE(millingError.value().AllowRetry());
			demon.Shutdown();
		}
	}

	SECTION("Alarm") {
		demon.ExecuteCommand("$H");
		demon.ExecuteCommand("G0 Y20");
		auto error = demon.GetMillingStatus().GetError();
		REQUIRE(error.has_value());
		REQUIRE(error->type == MillingError::Alarm);
		REQUIRE((error->error_id == 1 || error->error_id == 2));
		demon.Shutdown();
	}

	SECTION("Error") {
		demon.ExecuteCommand("$X");
		static_cast<void>(demon.GetReadWrites());	// Discard all previous responses
		demon.ExecuteCommand("abcdefg");
		this_thread::sleep_for(200ms);

		auto hasErrorOrAlarm = false;
		auto lines = demon.GetReadWrites();
		for (auto& line : lines) {
			line.second = StringUtil::ToLower(line.second);
			if (line.second.find("error") != string::npos || line.second.find("alarm") != string::npos) {
				hasErrorOrAlarm = true;
			}
		}
		REQUIRE(hasErrorOrAlarm);
	}

	SECTION("Check .dd File Data") {
		auto filepath = testFolderPath + "ar15_additional_files\\ar15_additional_files.dd";
		demon.SetDDFile(filepath);
		REQUIRE(demon.HasAdditionalContent());
		auto jobs = demon.GetJobs();
		REQUIRE(jobs[0].GetTitle() == "AR-15 - mill trigger well, mill selector, drill trigger and hammer pin holes - V3 ");
		REQUIRE(jobs[0].GetPrompt() == "Manufacture a mil-spec AR-15 lower.  The 80% lower receiver MUST already have the rear take down well milled.  Lower receivers without the rear take down well milled will require additional milling. ");
		demon.SelectJob(0);
		auto steps = demon.GetAllSteps();
		REQUIRE(steps[0]->GetTitle() == "Verify GG Empty");
		REQUIRE(steps[0]->GetPrompt() == "Please read and understand the Ghost Gunner Operator's Manual before proceeding.  Remove magnetic chip cover and verify nothing is installed in Ghost Gunner.  The 5/32\" drill is too long and CANNOT BE INSTALLED or it will crash into the build plate.  The 1/4\" end mill can remain installed because it is shorter.");
		REQUIRE(steps[0]->GetImage() == "Image/1A - Remove Cover.jpg");
		REQUIRE(steps[0]->GetFile() == "Code/01_Home_Tool_Install.txt");
	}
}
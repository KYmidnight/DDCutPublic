#include "DDCutDaemon.h"

#include <Common/Defs.h>
#include "Settings/SettingManager.h"
#include "Ghost/MillingManager.h"
#include "Ghost/Display/GhostDisplayManager.h"
#include "Ghost/GhostGunnerFinder.h"
#include "Ghost/Firmware/FirmwareManager.h"
#include "Files/DDFile.h"
#include "Common/Util/FileUtil.h"
#include "Files/DDException.h"
#include <Common/Logger.h>
#include "Common/ThreadManager.h"
#include <Common/FileDownloader.h>
#include <tl/optional.hpp>
#include <Ghost/GRBL/GhostConnection.h>
#include <Ghost/GRBL/Jogging/JogManager.h>
#include <Ghost/Drivers/drivers.h>
#include <json/json.h>
#include "Common/Util/FileUtil.h"

#include <ghc/filesystem.h>

using namespace std;
using namespace DDLogger;

// TODO: This should always fail gracefully.

//////////////////////////////////////////////////////
// Daemon
//////////////////////////////////////////////////////

DDCutDaemon::DDCutDaemon()
	: m_shutdown(false),
	m_pConnector(nullptr),
	m_pFirmwareUpdater(nullptr),
	m_nextFirmwareUpdateId(1),
	m_pDDFile(),
	m_pJob(),
	m_mutex()
{
}

DDCutDaemon::~DDCutDaemon()
{
	Shutdown();
}

DDCutDaemon& DDCutDaemon::GetInstance()
{
	static DDCutDaemon instance;
	return instance;
}

void DDCutDaemon::Initialize()
{
	ThreadManager::SetCurrentThreadName("MAIN_THREAD");
	DD_LOG_SYNC("-------------------------------------");
	DD_LOG_F("INITIALIZING DDCUT V %s", DDCUT_VERSION);

	// 1. Initialize Setting Manager (this will read and cache preferences)
	SettingManager::GetInstance();
	m_pConnector = GhostConnector::Initialize();
	m_pMillingManager = unique::make_unique<MillingManager>();
	m_pFirmwareUpdater = FirmwareUpdater::Initialize(m_pConnector);


}

void DDCutDaemon::Shutdown()
{
	Lock lock(m_mutex);
	if (!m_shutdown)
	{
		DD_LOG("SHUTTING DOWN");
		m_shutdown = true;

		m_pFirmwareUpdater.reset();
		m_pMillingManager.reset();
		m_pConnector.reset();
		DD_LOG_SYNC("FINISHED SHUTDOWN");
		DD_LOG_SYNC("-------------------------------------");
		DDLogger::Flush();
		DDLogger::Shutdown();
	}
}

//////////////////////////////////////////////////////
// DDFile
//////////////////////////////////////////////////////

tl::optional<std::string> DDCutDaemon::SetDDFile(const std::string& ddFilePath)
{
	DD_LOG("File path: " + ddFilePath);

	try
	{
		std::shared_ptr<DDFile> pDDFile = std::make_shared<DDFile>(ddFilePath);
		if (pDDFile->GetJobs().empty())
		{
			return "No jobs found in archive";
		}
		else
		{
			m_pMillingManager->SetManualOperationFlag(false);	// Clear manual operation flag to allow for automatic soft resets if needed
			m_pDDFile = pDDFile;
			return tl::nullopt;
		}
	}
	catch (const std::exception& exception)
	{
		DD_LOG("Exception thrown: " + std::string(exception.what()));
		return tl::make_optional(std::string(exception.what()));
	}
}

bool DDCutDaemon::CreateNewDDFile(const std::string& fileName, const std::string& path)
{
	std::string filepath = path + "\\" + fileName + ".dd";
	std::shared_ptr<DDFile> pDDFile = std::make_shared<DDFile>();
	pDDFile->CreateNewDDFile(fileName, path);
	SetDDFile(filepath);
}

bool DDCutDaemon::AddNewFileToDDFile(const std::string& filepath, const std::string& fileType)
{
	try 
	{
		m_pDDFile->AddFile(filepath, fileType);
		return true;
	}
	catch (const std::exception& exception)
	{
		return false;
	}
}

bool DDCutDaemon::ExtractAdditionalDdContentsIntoDirectory(const std::string& destination) const noexcept {
	DD_LOG("Extracting additional dd contents into directory: " + destination);

	try {
		auto fileList = m_pDDFile->ListFiles();

		// Remove-Erase idiom: https://infogalactic.com/info/Erase%E2%80%93remove_idiom
		fileList.erase(
			remove_if(fileList.begin(), fileList.end(),
				[ ] (auto& path) { return path.find("Additional Files/") == string::npos; })
			, fileList.end());

		auto unzippedContent = vector<unsigned char>{ };
		for (auto& path : fileList) {
			if (path.empty()) { continue; }
			unzippedContent.clear();
			m_pDDFile->ReadFile(path, unzippedContent);
			path.erase(0, path.find_first_of('/') + 1);
			if (path.back() == '/') {
				FileUtility::MakeDirectory(destination, path);
				continue;
			}
		#ifdef WIN32
			constexpr auto delimiter = '\\';
		#else
			constexpr auto delimiter = '/';
		#endif // WIN32
			auto copyFile = ofstream{ destination + delimiter + path, std::ios_base::out | std::ios_base::binary | std::ios::trunc };
			for (auto& line : unzippedContent) { copyFile << line; }
		}

		return true;
	}
	catch (const std::exception& exception) {
		DD_LOG("Exception thrown: " + std::string(exception.what()));
		return false;
	}
}

bool DDCutDaemon::HasAdditionalContent() const noexcept {
	DD_LOG("Checking for additional .dd content.");
	try {
		if (!m_pDDFile) { DD_LOG("No dd file."); return false; }
		DD_LOG("Path: " + m_pDDFile->GetPath());
		auto fileList = m_pDDFile->ListFiles();
		
		// ListFiles() was inconsistent here in development with showing directories as their own item
		// Check for both "Additional Files/" by itself and "Additional Files/*" as first item
		auto checkFirstFile = fileList[0].find("Additional Files/");
		auto index = find(fileList.begin(), fileList.end(), "Additional Files/");
		return checkFirstFile != string::npos || index != fileList.end();
	}
	catch (const std::exception& exception) {
		DD_LOG("Exception thrown: " + std::string(exception.what()));
		return false;
	}
}

bool DDCutDaemon::IsValidDDFile(const std::string& ddFilePath) const
{
	try
	{
		DDFile ddFile(ddFilePath);

		return !ddFile.GetJobs().empty();
	}
	catch (const std::exception& exception)
	{
		DD_LOG("Exception thrown: " + std::string(exception.what()));
		return false;
	}
}

//////////////////////////////////////////////////////
// GhostGunner
//////////////////////////////////////////////////////

bool DDCutDaemon::SetSelectedGhostGunner(const GhostGunner& ghostGunner) noexcept
{
	m_pFirmwareUpdater->ResetFirmware();

	return m_pConnector->SetSelectedGhostGunner(ghostGunner);
}

tl::optional<SoftLimits> DDCutDaemon::GetSoftLimits(const GhostConnection::Ptr& pConnection) const
{
	assert(pConnection != nullptr);

	try
	{
		return pConnection->GetSettings(false).GetSoftLimits();
	}
	catch (std::exception& e)
	{
		DD_LOG("Exception thrown: " + std::string(e.what()));
		return tl::nullopt;
	}
}



//////////////////////////////////////////////////////
// Jobs
//////////////////////////////////////////////////////

void DDCutDaemon::SelectJob(const size_t jobIndex)
{
	DD_LOG_F("jobIndex: %lu", jobIndex);

	if (m_pDDFile != nullptr)
	{
		const std::vector<Job>& jobs = m_pDDFile->GetJobs();
		if (jobs.size() > jobIndex)
		{
			m_pMillingManager->ClearError();
			std::string jobName = jobs[jobIndex].GetTitle();
			// if (state.grbl_version.compare(jobs[0].getMinFirmwareVersion()) < 0) // TODO: Check minimum firmware version.
			m_pJob = &m_pDDFile->GetJob(jobName);
		}
	}
}

bool DDCutDaemon::IsSubmanifestUsed() {
	bool submanifestUsed = m_pJob->IsSubmanifestUsed();
	return submanifestUsed;
}

void DDCutDaemon::AddNewOperation(const int stepIndex)
{
	std::string jobName = m_pJob -> GetTitle();
	DD_LOG("AddNewOperation - jobName: " + jobName);
	DD_LOG("AddNewOperation - stepIndex: " + to_string(stepIndex));
	m_pDDFile->AddNewOperation(jobName, stepIndex);
	std::vector<Operation::Ptr> operations = m_pJob->GetOperations();

	DD_LOG("Looping operations");
	for (auto step : operations)
	{
		DD_LOG(step->GetTitle());
	}
	DD_LOG("Done looping operations");
	m_pDDFile->WriteUserChangesToDisk(); 
}

void DDCutDaemon::SetNewOperationsValues(const std::map<std::string, std::string> newOperationsValues, int stepIndex) 
{
	m_pDDFile->SetChangesToOperations(newOperationsValues, m_pJob->GetTitle(), stepIndex);
	m_pDDFile->WriteUserChangesToDisk();
}

void DDCutDaemon::DeleteOperation(const int stepIndex)
{
	m_pJob->DeleteOperation(stepIndex);
	m_pDDFile->WriteUserChangesToDisk();
}

void DDCutDaemon::MoveOperation(const int prevStepIndex, const int nextStepIndex)
{
	DD_LOG("MoveOperation fired!");
	DD_LOG("prevStepIndex: " + to_string(prevStepIndex));
	DD_LOG("nextStepIndex: " + to_string(nextStepIndex));
	m_pJob->MoveOperation(prevStepIndex, nextStepIndex);
	m_pDDFile->WriteUserChangesToDisk();
}

void DDCutDaemon::AddNewJob(const std::string& jobName, const std::string& jobDescription, const int& jobIndex)
{
	m_pDDFile->AddNewJob(jobName, jobDescription, jobIndex);
	m_pDDFile->WriteUserChangesToDisk();
}

bool DDCutDaemon::GetWriteStatus()
{
	bool writeInProgress = m_pDDFile->GetWriteStatus();
	return writeInProgress;
}

std::vector<Job> DDCutDaemon::GetJobs() const { return m_pDDFile != nullptr ? m_pDDFile->GetJobs() : std::vector<Job>(); }
//////////////////////////////////////////////////////
// FeedRate
//////////////////////////////////////////////////////

int DDCutDaemon::GetFeedRate() const
{
	int feedRate = -1;

	auto pConnection = m_pConnector->GetNoLockConnection();
	if (pConnection != nullptr)
	{
		feedRate = pConnection->GetFeedRateSlider();
	}

	return feedRate;
}

bool DDCutDaemon::SetFeedRate(const int feedRate)
{
	auto pConnection = m_pConnector->GetNoLockConnection();
	if (pConnection != nullptr)
	{
		DD_LOG_F("FeedRate slider changed from %d to %d", pConnection->GetFeedRateSlider(), feedRate);
		pConnection->SetFeedRateSlider(feedRate);
		return true;
	}

	return false;
}



//////////////////////////////////////////////////////
// Settings
//////////////////////////////////////////////////////

bool DDCutDaemon::GetEnableSlider() const
{
	return SettingManager::GetInstance().GetEnableSlider();
}

bool DDCutDaemon::GetPauseAfterGCode() const
{
	return SettingManager::GetInstance().GetPauseAfterGCode();
}

int DDCutDaemon::GetMinFeedRate() const
{
	return SettingManager::GetInstance().GetMinFeedRate();
}

int DDCutDaemon::GetMaxFeedRate() const
{
	return SettingManager::GetInstance().GetMaxFeedRate();
}

bool DDCutDaemon::GetDisableLimitCatch() const
{
	return SettingManager::GetInstance().GetDisableLimitCatch();
}

bool DDCutDaemon::GetShowEditButtonSetting() const
{
	return SettingManager::GetInstance().GetShowEditButtonSetting();
}

bool DDCutDaemon::GetEnableEditButton() const
{
	return SettingManager::GetInstance().GetEnableEditButton();
}

bool DDCutDaemon::UpdateSettings(const std::list<Setting>& settings) const
{
	SettingManager::GetInstance().UpdateSettings(settings);
	return true;
}

bool DDCutDaemon::HasNonzeroWCS() const noexcept {
	auto machine = m_pConnector->GetNoLockConnection();
	if (!machine) { return false; }
	
	auto offsets = machine->GetOffsets();
	if (offsets.size() == 0) { return false; }
	for (auto& offset: offsets) {
		if ((offset.first[0] != 'G' || offset.first[1] != '5')) { continue; }
		else if (offset.first == "G59") { continue; }	// Treat G59 as special register for intentional carry-over between jobs
		if (offset.second.x != 0.0f) { return true; }
		if (offset.second.y != 0.0f) { return true; }
		if (offset.second.z != 0.0f) { return true; }
	}

	return false;
}

bool DDCutDaemon::AllowWcsClearPrompt() const noexcept {
	if (!m_pJob) { return true; }
	return m_pJob->AllowWcsClearPrompt();
}

void DDCutDaemon::ClearG54ThroughG58(const bool allowRetry) const noexcept {
	auto machine = m_pConnector->GetNoLockConnection();
	if (!machine) { DD_LOG("Offset clearing failed."); return; }

	auto lock = machine->GetLock();
	try {
		auto offsets = machine->GetOffsets();
		if (offsets.size() == 0) { DD_LOG("Offset clearing failed."); return; }

		// Iterate over G54 - G58 and clear each register individually if it's non-zero
		for (auto& offset : offsets) {
			if ((offset.first[0] != 'G' || offset.first[1] != '5')
				|| offset.first == "G59"	// Treat G59 as special register for intentional carry-over between jobs
				|| offset.second == Point3{}) {
				continue;
			}
			else {
				auto zeroOutWcsCommand = "G10 L2 P"s;
				zeroOutWcsCommand += offset.first[2] - 3;	// G54 through G59 correspond to P1 through P6
				zeroOutWcsCommand += " X0 Y0 Z0";
				machine->ExecuteCommand(GCodeLine{ zeroOutWcsCommand });
			}
		}
	}
	catch (std::exception e) {
		DD_LOG("Exception thrown while clearing WCS values: "s + e.what());
		if (allowRetry) {
			machine->ExecuteCommand(GCodeLine{ "$X"s });
			ClearG54ThroughG58(false);
		}
	}

}

string DDCutDaemon::WcsValueCheck() const noexcept {
	if (!m_pJob) { return ""; }

	auto valueChecks = m_pJob->WcsValueChecks();
	if (valueChecks.size() == 0) { return ""; }

	auto machine = m_pConnector->GetNoLockConnection();
	if (!machine) { return ""; }

	auto offsets = machine->GetOffsets();
	if (offsets.size() == 0) { return ""; }

	for (auto& check: valueChecks) {
		auto it = find_if(offsets.begin(), offsets.end(), [ check ] (auto& offPair) { return stoi(offPair.first.substr(1)) == check.first; });
		if (it == offsets.end()) { continue; }

		auto& point = it->second;
		auto diff = point - check.second;
		auto reportingPrecision = 0.001f;	// Give latitude for floating point imprecision
		if (abs(diff.x) > reportingPrecision || abs(diff.y) > reportingPrecision || abs(diff.z) > reportingPrecision) {
			return m_pJob->WcsCheckFailedMessage();
		}
	}
	return "";
}

//////////////////////////////////////////////////////
// Firmware
//////////////////////////////////////////////////////

bool DDCutDaemon::need_to_set_eeprom_versions(const AvailableFirmware& upgrade) noexcept(false)
{
	tl::optional<FirmwareVersion> installed_firmware = m_pFirmwareUpdater->GetInstalledFirmware();
	if (!installed_firmware.has_value()) {
		throw std::runtime_error("Missing installed firmware version");
	}

	const auto EEPROMNotSet = installed_firmware.value().GetYMD() <= "20200307";
	const auto firmwareHasNewLogic = upgrade.GetYMD() >= "20200512";
	const auto setEEPROM = EEPROMNotSet && firmwareHasNewLogic;

	return setEEPROM;
}

bool DDCutDaemon::UploadFirmware(const AvailableFirmware& firmware)
{
	DD_LOG("Uploading firmware " + firmware.VERSION);

	try {
		if (!firmware.FILE_328P.empty())
		{
			std::thread uploadThread(
				[this, firmware]() {
					try {
						auto pConnection = m_pConnector->GetConnection();
						FirmwareManager::GetInstance().UploadFirmware(
							pConnection,
							firmware.FILE_32M1.empty() ? tl::nullopt : tl::make_optional(URL(firmware.FILE_32M1)),
							URL(firmware.FILE_328P)
						);

						m_pFirmwareUpdater->ResetFirmware();

						pConnection->Reconnect();

						auto lock = pConnection->GetLock();

						// Clears and restores all of the EEPROM data used by Grbl.
						// This includes $$ settings, $# parameters, $N startup lines, and $I build info string.
						// Note that this doesn't wipe the entire EEPROM, only the data areas Grbl uses.
						pConnection->ExecuteCommand(GCodeLine("$RST=*"));

						if (need_to_set_eeprom_versions(firmware)) {
							if (pConnection->IsConnected()) {
								pConnection->ExecuteCommand(GCodeLine{ "$90=96" });
								pConnection->ExecuteCommand(GCodeLine{ "$92=97" });
							}
						}

					} catch (std::exception&) { }
				}
			);
			uploadThread.detach();

			return true;
		}
    } catch (...) {
	}

	return false;
}

bool DDCutDaemon::UploadCustomFirmware(const string& path328P, const string& path32M1) {
	DD_LOG("Uploading custom firmware.");

	try {
		if (!path328P.empty()) {
			std::thread uploadThread(
				[ this, path32M1, path328P ] () {
				try {
					auto pConnection = m_pConnector->GetConnection();
					FirmwareManager::GetInstance().UploadCustomFirmware(pConnection, path32M1, path328P);

					m_pFirmwareUpdater->ResetFirmware();

					pConnection->Reconnect();

					auto lock = pConnection->GetLock();

					// Clears and restores all of the EEPROM data used by Grbl.
					// This includes $$ settings, $# parameters, $N startup lines, and $I build info string.
					// Note that this doesn't wipe the entire EEPROM, only the data areas Grbl uses.
					pConnection->ExecuteCommand(GCodeLine("$RST=*"));

					if (pConnection->IsConnected()) {
						pConnection->ExecuteCommand(GCodeLine{ "$90=96" });
						pConnection->ExecuteCommand(GCodeLine{ "$92=97" });
					}
				}
				catch (std::exception&) { return false; }
			}
			);
			uploadThread.detach();

			return true;
		}
	}
	catch (...) { return false; }
}

int DDCutDaemon::GetFirmwareUploadStatus() const
{
	return FirmwareManager::GetInstance().GetFirmwareUploadStatus();
}

tl::optional<FirmwareVersion> DDCutDaemon::GetFirmwareVersion() const
{
    return m_pFirmwareUpdater->GetInstalledFirmware();
}

std::vector<AvailableFirmware> DDCutDaemon::GetAvailableFirmwareUpdates() const
{
    return m_pFirmwareUpdater->GetAvailableFirmware();
}

bool DDCutDaemon::FirmwareUpdateAvailable() const noexcept
{
    return m_pFirmwareUpdater->IsUpdateAvailable();
}

bool DDCutDaemon::FirmwareMeetsMinimumVersion() const noexcept {
	if (!m_pJob) { return true; }
	const auto& minVersion = m_pJob->GetMinFirmwareVersion();

	tl::optional<FirmwareVersion> installed_firmware = m_pFirmwareUpdater->GetInstalledFirmware();
	if (!installed_firmware.has_value()) {
		return true;
	}

	return minVersion <= installed_firmware.value().GetYMD();
}

bool DDCutDaemon::DDCutMeetsMinimumVersion(const string& version) const noexcept {
	if (!m_pJob) { return true; }

	try {
		auto currentVersion = StringUtil::Split(version, ".");
		auto targetVersion = StringUtil::Split(m_pJob->GetMinimumDDCutVersion(), ".");

		for (auto i = 0; i < currentVersion.size() && i < targetVersion.size(); ++i) {
			if (stoi(currentVersion[i]) < stoi(targetVersion[i])) { return false; }
		}
		return true;
	}
	catch (std::exception e) {
		DD_LOG("Error processing DD Cut Minimum version check.");
		return false;
	}
}

//////////////////////////////////////////////////////
// Walkthroughs
//////////////////////////////////////////////////////

bool DDCutDaemon::ShouldWalkthroughDisplay(const EWalkthroughType& walkthroughType) const
{
	return SettingManager::GetInstance().GetShowWalkthrough(walkthroughType);
}

void DDCutDaemon::SetShowWalkthrough(const EWalkthroughType& walkthroughType, const bool show)
{
	SettingManager::GetInstance().SetShowWalkthrough(walkthroughType, show);
}


//////////////////////////////////////////////////////
// Miscellaneous
//////////////////////////////////////////////////////

CustSupportService::Response DDCutDaemon::SendCustomerSupportRequest(
	const std::string& name,
	const std::string& email,
	const std::string& message,
	const std::string& version,
	const bool includeLogs) const
{

	CustSupportService::Response response;
	response.success = false;

	if (name.empty()) {
		response.errors.insert({ "name", "Name field is required." });
		return response;
	}
	else if (email.empty()) {
		response.errors.insert({ "email", "E-mail address field is required." });
		return response;
	}

	try
	{
		CustSupportService::Request request;
		request.name = name;
		request.email = email;
		request.description = message;
		request.dd_version = version;

		auto firmware = Json::Value{ };
		auto machine = m_pConnector->GetNoLockConnection();
		if (!machine) {
			firmware = "No machine connected."s;
		}
		else {
			auto& firmManager = FirmwareManager::GetInstance();
			auto firmVersion = firmManager.GetFirmwareVersion(machine->GetGhostGunner(), *machine->GetSerial());
			firmware = firmVersion.ToJSON();
		}
		request.firmware = firmware;

		if (includeLogs) {
			request.log_text = DDLogger::ReadLog();
		} else {
			request.log_text = "<NO LOGS INCLUDED>";
		}

		return CustSupportService::Invoke(request);
	}
	catch(...)
	{
		CustSupportService::Response response;
		response.success = false;
		response.errors.insert({ "NET_ERROR", "Unable to connect." });
		return response;
	}
}

std::string DDCutDaemon::GetLogPath() const
{
	DDLogger::Flush();
	return DDLogger::GetLogPath();
}

RealTimeStatusPtr DDCutDaemon::GetStatus()
{
	auto pConnection = m_pConnector->GetConnection();
	if (pConnection != nullptr)
	{
		try
		{
			return pConnection->QueryStatus();
		}
		catch (GhostException& e)
		{
			DD_LOG_F("GetStatus error: %s", e.what());
		}
		catch (...)
		{
			DD_LOG("GetStatus error: Unknown error");
		}
	}

	return nullptr;
}

void DDCutDaemon::Jog(const EJogDirection direction, const bool continuous, const double distance_mm) noexcept
{
	auto pConnection = m_pConnector->GetConnection();
	if (pConnection != nullptr)
	{
		::Jog(pConnection, direction, continuous, distance_mm);
	}
}

void DDCutDaemon::CancelJog() noexcept
{
	auto pConnection = m_pConnector->GetConnection();
	if (pConnection != nullptr)
	{
		StopJogging(pConnection);
	}
	else {
		DD_LOG("Failed to stop jogging. Connection unavailable.");
	}
}

JogKeys DDCutDaemon::GetJogKeys() const
{
	return SettingManager::GetInstance().GetJogKeys();
}

void DDCutDaemon::SetJogKeys(const JogKeys& jogKeys)
{
	SettingManager::GetInstance().SetJogKeys(jogKeys);
}

void DDCutDaemon::ExecuteCommand(const std::string& command) noexcept
{
	try
	{
		if (command == "!"s || command == "~"s || command == "|"s) {
			auto ghost = m_pConnector->GetNoLockConnection();
			if (!ghost) { return; }
			ghost->ExecuteRealtime(command[0]);
			return;
		}
		else {
			auto pConnection = m_pConnector->GetConnection();
			if (pConnection == nullptr) { return; }
			pConnection->ExecuteCommand(GCodeLine{ command }, true);
		}
			
	}
	catch (std::exception& e)
	{
		GhostDisplayManager::AddLine(ELineType::ERR, StringUtil::Format("ExecuteCommand error: %s", e.what()));
		DD_LOG_F("ExecuteCommand error: %s", e.what());
	}
	catch (...)
	{
		DD_LOG("ExecuteCommand error: Unknown error");
	}
}

void DDCutDaemon::ExecuteRealtime(const uint8_t command)
{
	auto pConnection = m_pConnector->GetConnection();
	if (pConnection != nullptr)
	{
		try
		{
			pConnection->ExecuteRealtime(command);
		}
		catch (GhostException & e)
		{
			DD_LOG_F("ExecuteRealtime error: %s", e.what());
		}
		catch (...)
		{
			DD_LOG("ExecuteRealtime error: Unknown error");
		}
	}
}

//////////////////////////////////////////////////////
// Navigation
//////////////////////////////////////////////////////

std::vector<Operation::Ptr> DDCutDaemon::GetAllSteps() const
{
	if (m_pJob != nullptr)
	{
		return m_pJob->GetOperations();
	}

	return std::vector<Operation::Ptr>();
}

Operation::Ptr DDCutDaemon::GetStep(const int stepIndex) const
{
	if (m_pJob != nullptr)
	{
		return m_pJob->GetOperation(stepIndex);
	}

	return nullptr;
}

bool DDCutDaemon::StartMilling(const int stepIndex)
{
	GhostDisplayManager::Clear();
	auto machine = m_pConnector->GetNoLockConnection();
	return m_pMillingManager->MillOperationAsync(machine, m_pDDFile, m_pJob, stepIndex);
}

bool DDCutDaemon::RunManualGCodeFile(const string& filePath)
{ 
	if (m_pMillingManager->InProgress()) { return false; }
	GhostDisplayManager::Clear();
	auto codeFile = FilePathToGCode(filePath);
	auto machine = m_pConnector->GetNoLockConnection();
	return m_pMillingManager->RunAsyncGCodeBatch(machine, codeFile.DestructivelyExtractFile());
}

MillingStatus DDCutDaemon::GetMillingStatus(const bool clearError)
{
	auto machine = m_pConnector->GetNoLockConnection();
	return m_pMillingManager->GetMillingStatus(machine, clearError);
}

std::vector<std::pair<ELineType, std::string>> DDCutDaemon::GetReadWrites() const
{
	return GhostDisplayManager::GetLines();
}

bool DDCutDaemon::EmergencyStop() const
{
	DD_LOG("Emergency Stop pressed!");

	auto pConnection = m_pConnector->GetNoLockConnection();
	if (pConnection != nullptr && pConnection->IsConnected())
	{
		pConnection->EmergencyStop();
		return true;
	}

	return false;
}

bool DDCutDaemon::InstallDrivers() const
{
    return Drivers::InstallDrivers();
}

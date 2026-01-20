#pragma once
#include "Common/CommonHeaders.h"
#include <Settings/Setting.h>
#include <Settings/WalkthroughType.h>
#include <Settings/JogKeys.h>
#include <Files/DDFile.h>
#include <Files/job.h>
#include <Ghost/Firmware/FirmwareUpdater.h>
#include <Ghost/Firmware/FirmwareVersion.h>
#include <Ghost/GhostGunner.h>
#include <Ghost/Display/LineType.h>
#include <Ghost/GRBL/Status/RealTimeStatus.h>
#include <Ghost/GRBL/Jogging/JogDirection.h>
#include <Ghost/Status/ConnectionStatus.h>
#include <Ghost/GhostConnector.h>
#include <Ghost/GRBL/Settings/GhostSettings.h>
#include <Ghost/Status/MillingStatus.h>
#include <Ghost/MillingManager.h>
#include <Services/FirmwareUpdateService.h>
#include <Services/CustSupportService.h>

/*
* Daemon that runs in the background and provides an API for the front-end electron application to communicate with.
*/
class DDCutDaemon
{
public:
	//////////////////////////////////////////////////////
	// Daemon
	//////////////////////////////////////////////////////

	// Gets the singleton instance of the daemon.
	static DDCutDaemon& GetInstance();
	~DDCutDaemon();

	void Initialize();

	void Shutdown();



	//////////////////////////////////////////////////////
	// DDFile
	//////////////////////////////////////////////////////

	// Gets the currently selected .dd file.
	std::shared_ptr<DDFile> GetDDFile() const noexcept { return m_pDDFile; }

	// Sets the currently selected .dd file to the given path. Returns error if unsuccessful.
	tl::optional<std::string> SetDDFile(const std::string& ddFilePath);
	bool CreateNewDDFile(const std::string& fileName, const std::string& path);
	bool AddNewFileToDDFile(const std::string& filepath, const std::string& fileType);
	bool ExtractAdditionalDdContentsIntoDirectory(const std::string& destination) const noexcept;
	bool HasAdditionalContent() const noexcept;

	// Returns true if the .dd file has at least one job.
	bool IsValidDDFile(const std::string& ddFilePath) const;

	// Creates blank operation from UI edit mode and writes to disk
	void AddNewOperation(const int stepIndex);

	// Used to set new user inputed operations values to memory and disk.
	void SetNewOperationsValues(const std::map<std::string, std::string> newOperationValues, int stepIndex);
	
	void DeleteOperation(const int stepIndex);

	void MoveOperation(const int prevStepIndex, const int nextStepIndex);

	//////////////////////////////////////////////////////
	// GhostGunner
	//////////////////////////////////////////////////////

	// Gets the status of the connection to the GhostGunner.
	EGhostGunnerStatus GetGhostGunnerStatus() const noexcept { return m_pConnector->GetStatus(); }

	// Searches for GhostGunners connected through USB.
	std::list<GhostGunner> GetAvailableGhostGunners() const noexcept { return m_pConnector->GetAvailableGhostGunners(); }

	// Sets the selected GhostGunner. Returns true if successful.
	bool SetSelectedGhostGunner(const GhostGunner& ghostGunner) noexcept;

	// Determines if the given GhostGunner is the selected one.
	bool IsSelectedGhostGunner(const GhostGunner& ghostGunner) const noexcept { return m_pConnector->IsSelectedGhostGunner(ghostGunner); }

	GhostConnection::Ptr GetConnection() noexcept { return m_pConnector->GetConnection(); }

	tl::optional<SoftLimits> GetSoftLimits(const GhostConnection::Ptr& pConnection) const;

	bool EstopEngaged() {
		auto gunner = GetConnection();		// Null reference implies disconnected machine, not E-Stop
		return gunner ? gunner->EstopEngaged() : false;
	}

	//////////////////////////////////////////////////////
	// Jobs
	//////////////////////////////////////////////////////

	// Get all jobs
	// std::vector<Job> GetJobs() const { return m_pDDFile != nullptr ? m_pDDFile->GetJobs() : std::vector<Job>(); }
	std::vector<Job> GetJobs() const;
	// Get currently selected job
	Job* GetSelectedJob() const noexcept { return m_pJob; }

	// Set job selection
	void SelectJob(const size_t jobIndex);
	bool IsSubmanifestUsed();
	void AddNewJob(const std::string& jobName, const std::string& jobDescription, const int& jobIndex);
	bool GetWriteStatus();

	//////////////////////////////////////////////////////
	// FeedRate
	//////////////////////////////////////////////////////

	int GetFeedRate() const;

	bool SetFeedRate(const int feedRate);

	//////////////////////////////////////////////////////
	// Firmware
	//////////////////////////////////////////////////////

	// Begins uploading firmware to the GhostGunner asynchronously.
	bool UploadFirmware(const AvailableFirmware& firmware);

	bool UploadCustomFirmware(const std::string& path328P, const std::string& path32M1);

	// The status of the firmware upload. 0-100 indicates the percentage completed. -1 indicates a failure during upload.
	int GetFirmwareUploadStatus() const;

	// Returns the firmware version of the currently connected GhostGunner.
	tl::optional<FirmwareVersion> GetFirmwareVersion() const;

	// Checks for firmware updates, and returns all available updates for the user to choose.
	std::vector<AvailableFirmware> GetAvailableFirmwareUpdates() const;

	// Returns true if the newest published firmware version is better than what is installed on the selected machine
	bool FirmwareUpdateAvailable() const noexcept;

	// Returns false if and only if a minimum firmware version is specified and the machine does not meet that value
	bool FirmwareMeetsMinimumVersion() const noexcept;

	// Returns false if and only if a minimum DD Cut version is specified and the application does not meet that value
	bool DDCutMeetsMinimumVersion(const std::string& version) const noexcept;

	//////////////////////////////////////////////////////
	// Settings
	//////////////////////////////////////////////////////

	bool GetEnableSlider() const;
	bool GetPauseAfterGCode() const;
	int GetMinFeedRate() const;
	int GetMaxFeedRate() const;
	bool GetDisableLimitCatch() const;
	bool GetShowEditButtonSetting() const;
	bool GetEnableEditButton() const;

	// Replaces the currently saved settings with the ones passed in.
	bool UpdateSettings(const std::list<Setting>& settings) const;

	// Any errors result in a report of "false" 
	bool HasNonzeroWCS() const noexcept;

	// Returns false if manifest specifies skipping check to clear WCS registers
	bool AllowWcsClearPrompt() const noexcept;

	// Clear G54 - G58
	// G59 is considered a special register to transfer WCS offsets between jobs, so this may be desirable to keep
	// Other offsets may also be kept for certain projects for GCode compatibility mode (Ex. G28)
	// In other words, we may want to reset G54 - G58 without clearing ALL offsets with "RST=#" or "RST=*"
	void ClearG54ThroughG58(const bool allowRetry = true) const noexcept;

	// Check values stored in WCS registers against values specified the manifest file
	// An empty string indicates either a successful check or a failure to collect the necessary data
	// A non-empty string indicates failure with a message intended to be forwarded to the user
	// G59 is always ignored and is considered a special purpose register for carrying values across jobs
	std::string WcsValueCheck() const noexcept;

	//////////////////////////////////////////////////////
	// Navigation
	//////////////////////////////////////////////////////

	std::vector<Operation::Ptr> GetAllSteps() const;

	Operation::Ptr GetStep(const int stepIndex) const;

	bool StartMilling(const int stepIndex);
	bool RunManualGCodeFile(const std::string& filePath);

	// Gets the status of the milling for the given step. 0-100 indicates the percentage completed. -1 indicates a failure during upload.
	MillingStatus GetMillingStatus(const bool clearError = false);

	std::vector<std::pair<ELineType, std::string>> GetReadWrites() const;

	// Software emergency stop; sends | command to GRBL controller
	bool EmergencyStop() const;

	//////////////////////////////////////////////////////
	// Walkthroughs
	//////////////////////////////////////////////////////

	// Determines if the given walkthrough should display. For example, if WalkthroughType == editor, this will return true if this is the first time using the editor.
	bool ShouldWalkthroughDisplay(const EWalkthroughType& walkthroughType) const;

	// Sets the given walkthrough as displayed, so it is not automatically displayed the next time the user takes the same action.
	void SetShowWalkthrough(const EWalkthroughType& walkthroughType, const bool show);



	//////////////////////////////////////////////////////
	// Miscellaneous
	//////////////////////////////////////////////////////

	// Sends a customer support request with the given message.
	CustSupportService::Response SendCustomerSupportRequest(
		const std::string& name,
		const std::string& email,
		const std::string& message,
		const std::string& version,
		const bool includeLogs
	) const;

	// Path to Log files
	std::string GetLogPath() const;

	// Get up-to-date machine status data
	RealTimeStatusPtr GetStatus();

	// Jog the machine
	void Jog(const EJogDirection direction, const bool continuous, const double distance_mm) noexcept;

	// Send cancel jog command to GRBL
	void CancelJog() noexcept;

	// Manage hotkeys for jogging
	JogKeys GetJogKeys() const;
	void SetJogKeys(const JogKeys& jogKeys);

	// Send a command to GRBL controller
	// Locking is done internally, so you shouldn't need to worry about coordinating threads
	void ExecuteCommand(const std::string& command) noexcept;

	// Send a real-time command to GRBL controller (?, ~, !, |)
	// Locking is done internally, so you shouldn't need to worry about coordinating threads
	void ExecuteRealtime(const uint8_t command);

	bool InstallDrivers() const;

	bool MillingInProgress() const noexcept { return m_pMillingManager->InProgress(); }
	void SetManualOperationFlag(const bool isInManualMode) { m_pMillingManager->SetManualOperationFlag(isInManualMode); }
	bool GetManualOperationFlag() { return m_pMillingManager->GetManualOperationFlag(); }

	std::unique_ptr<FirmwareUpdater>& GetFirmwareUpdaterRef() { return m_pFirmwareUpdater; }
private:
	using Clock = std::chrono::system_clock;
	using Time = Clock::time_point;
	using Lock = std::unique_lock<std::mutex>;

	DDCutDaemon();

	bool need_to_set_eeprom_versions(const AvailableFirmware& upgrade) noexcept(false);

	std::atomic_bool m_shutdown;
	std::shared_ptr<GhostConnector> m_pConnector;
	std::unique_ptr<MillingManager> m_pMillingManager;
	std::unique_ptr<FirmwareUpdater> m_pFirmwareUpdater;

	int m_nextFirmwareUpdateId;
	DDFile::Ptr m_pDDFile;
	Job* m_pJob = nullptr;
	mutable std::mutex m_mutex;
};

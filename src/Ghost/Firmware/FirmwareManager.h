#pragma once

#include "Common/CommonHeaders.h"
#include <ghc/filesystem.h>
#include <Common/Models/URL.h>
#include <Common/Util/OSUtil.h>
#include <Ghost/GRBL/GhostConnection.h>
#include <Ghost/Firmware/AVRDude.h>
#include <Ghost/Firmware/FirmwareVersion.h>

// Forward Declarations
class GhostGunner;
class SerialConnection;

// Manages firmware; ties together other related services
class FirmwareManager
{
public:
	static FirmwareManager& GetInstance();

	FirmwareVersion GetFirmwareVersion(const GhostGunner& ghostGunner, SerialConnection& connection) const;

	void UploadFirmware(
		const GhostConnection::Ptr& pConnection,
		const tl::optional<URL>& firmware32m1URLOpt,
		const URL& firmware328pURL
	) noexcept;

	void UploadCustomFirmware(
		const GhostConnection::Ptr& pConnection,
		const std::string& firmware32m1URLOpt,
		const std::string& firmware328pURL) noexcept;

	int GetFirmwareUploadStatus() const { return m_uploadStatus.load(); }

private:
	void Update(
		const GhostConnection::Ptr& pConnection,
		const tl::optional<URL>& firmware32m1URLOpt,
		const URL& firmware328pURL
	);

	void UpdateCustom(
		const GhostConnection::Ptr& pConnection,
		const std::string& firmware32m1URLOpt,
		const std::string& firmware328pURL);

	void Download(
		const tl::optional<URL>& firmware32m1URLOpt,
		const URL& firmware328pURL
	) const;

	fs::path GetFirmwarePath() const
	{
		auto path = OSUtility::GetDataDirectory() / "firmware";
		fs::create_directories(path);
		return path;
	}

	void SetStatus(const int status)
	{
		if (status < m_uploadStatus)
		{
			m_uploadStatus = status;
			return;
		}

		while (m_uploadStatus < status)
		{
			m_uploadStatus++;
			Sleep(25);
		}
	}

	mutable std::map<std::string, FirmwareVersion> m_versionCache;
	std::atomic_int m_uploadStatus;

	FirmwareManager() = default;
};

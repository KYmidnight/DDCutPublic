#pragma once

#include "Common/CommonHeaders.h"
#include <Common/Defs.h>
#include <Ghost/Status/ConnectionStatus.h>
#include <Ghost/GRBL/GhostConnection.h>

// This class manages the initialization, selection, and connection of a ghost gunner machine
// Use this to get access to the current machine and it's functionallity
class GhostConnector
{
public:
	using Ptr = std::shared_ptr<GhostConnector>;

	static GhostConnector::Ptr Initialize();
	~GhostConnector();

	EGhostGunnerStatus GetStatus() const noexcept { return m_status; }
	bool IsConnected() const noexcept { return m_status == EGhostGunnerStatus::connected; }

	std::shared_ptr<GhostConnection> GetConnection() noexcept { return m_pGhost; }
	std::shared_ptr<GhostConnection> GetNoLockConnection() noexcept { return m_pGhost; }
	bool IsSelectedGhostGunner(const GhostGunner& ghostGunner) const noexcept;
	bool SetSelectedGhostGunner(const GhostGunner& ghostGunner) noexcept;
	std::list<GhostGunner> GetAvailableGhostGunners() const noexcept;

private:
	GhostConnector() : m_shutdown(false), m_status(notConnected) { }

	static void Thread_Connect(GhostConnector* pConnector);

	// Checks for plugged-in devices and tries connecting to the first one.
	void TryConnect();

	// Checks the connected device, and disconnects if it's been unplugged.
	void CheckUnplugged();

	GhostConnection::Ptr m_pGhost = nullptr;
	std::atomic_bool m_shutdown;
	std::atomic<EGhostGunnerStatus> m_status;

	std::thread m_initializeThread;
};

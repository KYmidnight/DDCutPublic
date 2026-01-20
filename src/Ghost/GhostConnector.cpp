#include <Ghost/GhostConnector.h>

#include <Common/ThreadManager.h>
#include <Common/Logger.h>
#include <Ghost/GhostGunnerFinder.h>
#include <Ghost/GRBL/GhostConnection.h>

std::shared_ptr<GhostConnector> GhostConnector::Initialize()
{
	std::shared_ptr<GhostConnector> pConnector(new GhostConnector());
	pConnector->m_initializeThread = std::thread(GhostConnector::Thread_Connect, pConnector.get());
	return pConnector;
}

GhostConnector::~GhostConnector()
{
	m_shutdown = true;
	if (m_initializeThread.joinable()) {
		m_initializeThread.join();
	}

	try {
		if (m_pGhost != nullptr && m_pGhost->IsConnected()) {
			m_pGhost->Reset(false);
			DD_LOG("reset() complete.");
			m_pGhost->Disconnect();
			DD_LOG("Disconnected.");
		}
	}
	catch (...) {
		DD_LOG("Exception thrown.");
	}

	DD_LOG_SYNC("GhostConnector stopped.");
}

// Auto-detect and connect to GhostGunner
void GhostConnector::Thread_Connect(GhostConnector* pConnector)
{
	ThreadManager::SetCurrentThreadName("CONNECT_THREAD");

	bool previouslyFailed = false;
	while (!pConnector->m_shutdown) {
		try {
			// If not connected, look for a compatible device and connect to it.
			if (pConnector->m_status != connected) {
				pConnector->TryConnect();
			}

			// If connected to a device, make sure it hasn't been unplugged.
			if (pConnector->m_status == connected) {
				pConnector->CheckUnplugged();
			}
		}
		catch (std::exception& e) {
			if (!previouslyFailed) {
				previouslyFailed = true;
				DD_LOG(std::string("Failed to connect: ") + e.what());
			}
		}

		std::this_thread::sleep_for(std::chrono::milliseconds(200));
	}
}

void GhostConnector::TryConnect()
{
	assert(m_status != connected);

	std::list<GhostGunner> availableGhostGunners = GhostGunnerFinder().GetAvailableGhostGunners();
	if (!availableGhostGunners.empty()) {
		if (!IsSelectedGhostGunner(availableGhostGunners.front())) {
			SetSelectedGhostGunner(availableGhostGunners.front());
		}
	}
}

void GhostConnector::CheckUnplugged()
{
	assert(m_status == connected);
	assert(m_pGhost != nullptr);

	std::list<GhostGunner> pluggedInGhostGunners = GhostGunnerFinder().GetAvailableGhostGunners();
	for (auto iter = pluggedInGhostGunners.cbegin(); iter != pluggedInGhostGunners.cend(); iter++) {
		if (iter->GetPath() == m_pGhost->GetPath()) {
			// Device still plugged in. No need to disconnect.
			return;
		}
	}

	DD_LOG_F("GhostGunner %s unplugged", m_pGhost->GetPath().c_str());

	m_status = notConnected;
	m_pGhost->Disconnect();
	m_pGhost = nullptr;
}

bool GhostConnector::SetSelectedGhostGunner(const GhostGunner& ghostGunner) noexcept
{
	if (!IsSelectedGhostGunner(ghostGunner)) {
		DD_LOG_F("Selecting Ghost Gunner: %s", ghostGunner.GetPath().c_str());

		try {
			if (m_status != connectionFailed) {
				m_status = connecting;
			}

			m_pGhost = GhostConnection::Connect(ghostGunner);
			m_status = connected;
			DD_LOG_F("Selected Ghost Gunner: %s", ghostGunner.GetPath().c_str());
			DDLogger::Flush();
			return true;
		}
		catch (std::exception& e) {
			DD_LOG_F("Failed to select Ghost Gunner (%s): %s", ghostGunner.GetPath().c_str(), e.what());

			EGhostGunnerStatus new_status = connectionFailed;
			if (GhostException* ghost_exception = dynamic_cast<GhostException*>(&e)) {
				// When device is first plugged in, OS may fail to open handle to it.
				// If this occurs, keep it in connecting status and it should succeed next time.
				if (ghost_exception->getType() == GhostException::FAILED_OPEN) {
					new_status = connecting;
				}
			}

			m_status = new_status;
		}
	}

	return false;
}

bool GhostConnector::IsSelectedGhostGunner(const GhostGunner& ghostGunner) const noexcept
{
	if (m_pGhost != nullptr) {
		return m_pGhost->GetGhostGunner() == ghostGunner;
	}

	return false;
}

std::list<GhostGunner> GhostConnector::GetAvailableGhostGunners() const noexcept
{
	try {
		return GhostGunnerFinder().GetAvailableGhostGunners();
	} catch (std::exception& e) {
		DD_LOG(e.what());
	}

	return {};
}
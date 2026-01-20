#pragma once

#include "Common/CommonHeaders.h"
#include <Files/DDFile.h>
#include <Files/job.h>
#include <Files/operation.h>
#include <Ghost/GhostConnector.h>
#include <Ghost/GRBL/GhostConnection.h>
#include <Ghost/Status/MillingStatus.h>
#include <Ghost/Status/MillingError.h>

// This class manages milling operations where a collection of GCode is processed as a single unit
// This spins up the GCode program and manages progress & error tracking
// Handling is slightly different based upon how the program is launched (Is it a .dd file or through the manaul entry window?)
class MillingManager
{
public:
	MillingManager() = default;
	~MillingManager();

	bool MillOperationAsync(GhostConnection::Ptr pConnection, const DDFile::Ptr& pDDFile, const Job* pJob, const int stepIndex);
	bool RunAsyncGCodeBatch(GhostConnection::Ptr pConnection, std::vector<GCodeLine>&& gcodes) noexcept;

	bool InProgress() const noexcept { return m_inProgress.load(std::memory_order_acquire); }
	MillingStatus GetMillingStatus(GhostConnection::Ptr pConnection, const bool clearError);
	void ClearError() noexcept {
		std::lock_guard<std::mutex> lock{ m_ErrorMutex };
		m_error.reset();
	}
	void SetManualOperationFlag(const bool isManualOperationMode) { m_ManualOperation.store(isManualOperationMode, std::memory_order_release); }
	bool GetManualOperationFlag() { return m_ManualOperation.load(std::memory_order_acquire); }

private:
	mutable std::mutex m_ErrorMutex;
	std::thread m_thread;
	tl::optional<MillingError> m_error{ tl::nullopt };
	std::atomic_bool m_inProgress{ false };
	std::atomic_bool m_ManualOperation{ false };

	void Thread_MillOperation(GhostConnection::Ptr pConnection, Operation::Ptr pOperation );
	void Thread_MillCodeBlock(GhostConnection::Ptr pConnection, std::vector<GCodeLine> gcodes, const bool shouldResetOnCompletion = false, const bool isManualProgram = false) noexcept;

	void RunGCode(const GhostConnection::Ptr& pConnection, const std::vector<GCodeLine>& gcodes, const bool shouldResetOnCompletion = false, const bool isManualProgram = false) noexcept;
	void RunOperation(const GhostConnection::Ptr& pConnection, const Operation::Ptr& pOperation) noexcept;
	void CheckForError(GhostConnection::Ptr pConnection) noexcept;
	bool BusyOrDisconnected(const GhostConnection::Ptr pConnection) const noexcept;
};
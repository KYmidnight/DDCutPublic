#include "MillingManager.h"
#include <Common/Defs.h>
#include <Common/Logger.h>
#include <Common/ThreadManager.h>
#include <Ghost/GhostErrorHandler.h>
#include <Ghost/GhostException.h>
#include <Settings/SettingManager.h>
#include <Ghost/GRBL/Commands/ContourMapping.h>
#include <Ghost/Display/GhostDisplayManager.h>
using namespace DDLogger;

MillingManager::~MillingManager()
{
    if (m_thread.joinable()) {
        m_thread.join();
    }

    DD_LOG_SYNC("MillingManager stopped");
}

bool MillingManager::MillOperationAsync(GhostConnection::Ptr pConnection, const DDFile::Ptr& pDDFile, const Job* pJob, const int stepIndex) {
    DD_LOG_F("Sending GCodeFile for operation with index: %d", stepIndex);
    if (BusyOrDisconnected(pConnection)) { return false; }

    if (!pJob) {
        DD_LOG("Error: Job not found.");
        return false;
    }

    Operation::Ptr pOperation = pJob->GetOperation(stepIndex);
    if (pOperation == nullptr || !pOperation->Load(pDDFile)) {
        DD_LOG_F("Failed to load operation at index %d!", stepIndex);
        return false;
    }

    if (m_thread.joinable()) { m_thread.join(); }
    m_inProgress.store(true, std::memory_order_release);
    m_ManualOperation.store(false, std::memory_order_release);
    m_thread = std::thread(&MillingManager::Thread_MillOperation, this, pConnection, pOperation);

    return true;
}

bool MillingManager::RunAsyncGCodeBatch(GhostConnection::Ptr pConnection, std::vector<GCodeLine>&& gcodes) noexcept {
    DD_LOG("Executing manual GCode Batch.");
    if (BusyOrDisconnected(pConnection)) { return false; }

    if (m_thread.joinable()) { m_thread.join(); }
    m_inProgress.store(true, std::memory_order_release);
    m_ManualOperation.store(true, std::memory_order_release);

    m_thread = std::thread(&MillingManager::Thread_MillCodeBlock, this, pConnection, std::move(gcodes), false, true);

    return true;
}

bool MillingManager::BusyOrDisconnected(const GhostConnection::Ptr pConnection) const noexcept {
    if (InProgress()) {
        DD_LOG("Milling is already in progress!");
        return true;
    }

    if (pConnection == nullptr) {
        DD_LOG("No connection available!");
        return true;
    }
    return false;
}

void MillingManager::Thread_MillOperation( GhostConnection::Ptr pConnection, Operation::Ptr pOperation) {
    RunGCode(pConnection, pOperation->GetGCodeFile().getLines(), pOperation->GetReset());
}

void MillingManager::Thread_MillCodeBlock(GhostConnection::Ptr pConnection, std::vector<GCodeLine> gcodes, const bool shouldResetOnCompletion, const bool isManualProgram) noexcept {
    RunGCode(pConnection, gcodes, shouldResetOnCompletion, isManualProgram);
}

void MillingManager::RunGCode(const GhostConnection::Ptr& pConnection, const std::vector<GCodeLine>& gcodes, const bool shouldResetOnCompletion, const bool isManualProgram) noexcept {
    ThreadManager::SetCurrentThreadName("MILLING_THREAD");
    DD_LOG("MILLING THREAD - Start");
    {
        std::lock_guard<std::mutex> lock{ m_ErrorMutex };
        m_error.reset();
    }

    auto optionalError = tl::optional<MillingError>{ tl::nullopt };
    try {
        // Execute
        pConnection->ExecuteProgram(gcodes, isManualProgram);

        if (pConnection->IsTimedOut()) {
            DD_LOG("Timeout exceeded.");
            throw GhostException(GhostException::TIMEOUT);
        }
        else if (shouldResetOnCompletion) {
            DD_LOG("Calling reset().");
            pConnection->Reset();
        }
    }
    catch (const GhostException& e) {
        DD_LOG_F("GhostException thrown during ReadWriteCycle: %s", e.what());

        auto ghostExcept = GhostException{ e.getType(), e.GetRawDetailMessage() };

        if (!pConnection->GetError().has_value()) {
            MillingError error = GhostErrorHandler::GetError(pConnection, ghostExcept);
            if (ghostExcept.getType() != GhostException::SOFTWARE_ESTOP) {
                optionalError = error;
                std::lock_guard<std::mutex> lock{ m_ErrorMutex };
                m_error = error;
                M113();
                GhostDisplayManager::AddLine(ELineType::WRITE, e.what());
            }
        }
    }

    if (optionalError.has_value()) {
        DD_LOG("Error message: " + m_error.value().description);
    }

    m_inProgress.store(false, std::memory_order_release);
    DD_LOG("MILLING THREAD - End");
}

void MillingManager::CheckForError(GhostConnection::Ptr pConnection) noexcept
{
    if (pConnection == nullptr) {
        return;
    }

    try {
        pConnection->ReadResponse(false);
    }
    catch (...) {}

    auto error = pConnection->GetError();
    if (error.has_value()) {
        m_error = error;
        if (m_error.value().IsProbeFailure()) {
            pConnection->ProbeReset();
            return;
        }

        if (m_ManualOperation.load(std::memory_order_acquire)) { return; }  // Ignore E-stop in manual entry mode

        DD_LOG("Resetting connection");
        try {
            pConnection->Reset(!m_ManualOperation.load(std::memory_order_acquire));  // Disable automatic soft reset while in manual operation mode
        }
        catch (...) {
            m_error = ErrorCodes::GetAlarm(ALARM_CODE_MACHINE_LOCKED);
        }

        if (pConnection->GetState().GetAlarm() == ALARM_CODE_ESTOP) {
            DD_LOG("E-stop depressed");
            m_error = ErrorCodes::GetAlarm(ALARM_CODE_ESTOP);
        }
    }

    if (m_error.has_value()) {
        pConnection->GetProgress().Reset();
    }
}

MillingStatus MillingManager::GetMillingStatus(GhostConnection::Ptr pConnection, const bool clearError)
{
    std::lock_guard<std::mutex> lock{ m_ErrorMutex };

    if (!InProgress()) {
        CheckForError(pConnection);
    }

    if (m_error.has_value()) {
        MillingError retError = m_error.value();
        if (clearError) {
            DD_LOG("Milling error cleared");
            m_error.reset();
        }

        m_inProgress.store(false, std::memory_order_release);
        return MillingStatus::Failed(retError);
    }

    if (InProgress()) {
        if (pConnection != nullptr) {
            return MillingStatus::InProgress(pConnection->GetProgress());
        }

        DD_LOG("Lost connection to GhostGunner");
        MillingError disconnected_error{ MillingError::Error, -1, "Connection Error", "Lost Connection to GhostGunner" };
        return MillingStatus::Failed(disconnected_error);
    }

    return MillingStatus::Completed();
}
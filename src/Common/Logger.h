#pragma once

#include "Common/CommonHeaders.h"
#include <Common/Util/StringUtil.h>

// Logging utilities
namespace DDLogger {

void Log(const std::string& function, const size_t line, const std::string& message);
std::string GetLogPath();
std::string ReadLog();
void Flush();
void Shutdown();
inline void LogCout(const std::string& text) { std::cout << text << std::endl; }

#define DD_LOG(message) DDLogger::Log(__FUNCTION__, __LINE__, message);  DDLogger::Flush()
#define MILL_LOG(message) DDLogger::Log(__FUNCTION__, __LINE__, message);  DDLogger::Flush()
#define DD_LOG_F(message, ...) DDLogger::Log(__FUNCTION__, __LINE__, StringUtil::Format(message, __VA_ARGS__))
#define DD_LOG_SYNC(message) DDLogger::Log(__FUNCTION__, __LINE__, message); DDLogger::Flush()
};

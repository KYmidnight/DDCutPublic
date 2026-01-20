#pragma once

#include "Common/CommonHeaders.h"

/*
exception class for handling GhostGunner specific errors
NO_ACCESS
NO_DEVICE,
FAILED_OPEN
FAILED_GET
FAILED_SET
FAILED_WRITE,
NOT_TTY
NOT_OPEN,
GRBL_ERROR
ALARM
ALARM_LIMIT
ALARM_PROBE,
UNKNOWN_COMMAND
TIMEOUT
*/
class GhostException : public std::exception
{
public:
	enum EGhostException
	{
		NO_ACCESS,
		NO_DEVICE,
		FAILED_OPEN,
		FAILED_GET,
		FAILED_SET,
		FAILED_WRITE,
		NOT_TTY,
		NOT_OPEN,
		GRBL_ERROR,
		ALARM,
		ALARM_LIMIT,
		ALARM_PROBE,
		UNKNOWN_COMMAND,
		M100_OUTOFRANGE,
		M101_FAIL,
    M102_INVALID_EXPRTK_EXPRESSION,
    M102_OFFSETS_FAIL,
    M102_INVALID_DEST_REGISTER,
    M106_BOOL_TEST_FAIL,
    M106_MALFORMED_TEST,
    M107_INVALID_SOURCE_REGISTER,
    M107_OFFSETS_FAIL,
    M108_INVALID_DEST_REGISTER,
    M108_KEY_NOT_FOUND,
		M112_FAIL,
		TIMEOUT,
		NO_PROBE_COORD,
		INVALID_MODE,
		SOFTWARE_ESTOP,
		ESTOP_PUSHED,
		MACHINE_LOCKED
	};
private:
	EGhostException m_type;

	std::string m_errorDetail;
	std::string m_combinedMessage;
	std::string GetTypeMessage() const;

public:
	explicit GhostException(const EGhostException t);
	GhostException(const EGhostException t, const std::string& s);
	const char* what() const noexcept;
	EGhostException getType() const;
	std::string GetRawDetailMessage() const;
};

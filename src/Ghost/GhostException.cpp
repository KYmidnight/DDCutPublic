#include "GhostException.h"
#include <Common/Logger.h>
#include "Common/CommonHeaders.h"

GhostException::GhostException(const EGhostException t)
	: GhostException(t, "")
{

}

GhostException::GhostException(const EGhostException t, const std::string& s)
	: m_type(t),
	m_errorDetail(s),
	m_combinedMessage()
{
	const std::string errorMessage = GetTypeMessage();
	if (m_type == M106_BOOL_TEST_FAIL) 
	{
		m_combinedMessage = m_errorDetail;
	}
	else if (!m_errorDetail.empty())
	{
		m_combinedMessage = errorMessage + " - " + m_errorDetail;
	}
	else
	{
		m_combinedMessage = errorMessage;
	}
}

std::string GhostException::GetTypeMessage() const
{
	switch (m_type)
	{
		case NO_ACCESS:
			return "no access to /dev";
		case NO_DEVICE:
			return "no Ghost Gunner found";
		case FAILED_OPEN:
			return "failed to open connection to Ghost Gunner";
		case FAILED_GET:
			return "failed to get properties of Ghost Gunner";
		case FAILED_SET:
			return "failed to set properties of Ghost Gunner";
		case FAILED_WRITE:
			return "failed to write to Ghost Gunner";
		case NOT_TTY:
			return "not a tty connection";
		case NOT_OPEN:
			return "connection to Ghost Gunner not open";
		case GRBL_ERROR:
			return "Not a valid GRBL command.";
		case ALARM:
			return "Alarm: unknown";
		case ALARM_LIMIT:
			return "Alarm: hard/soft limit hit";
		case ALARM_PROBE:
			return "Alarm: probe fail";
		case UNKNOWN_COMMAND:
			return "Not a recognized G/M/$ or other command";
		case TIMEOUT:
			return "timeout";
    case M100_OUTOFRANGE:
      return "M100 command failed with result out of range.  Please verify that Probe has same units (inches or mm) as M100 call.";
    case M101_FAIL:
      return "M101 Command failed";
    case M102_INVALID_EXPRTK_EXPRESSION:
      return "M102 Syntax Error - Invalid exprtk expression";
    case M102_OFFSETS_FAIL:
      return "M102 Failed - Could not get offsets";
    case M102_INVALID_DEST_REGISTER:
      return "M102 Syntax Error - Invalid destination register. Must be G54-59(X,Y,Z)";
    case M106_BOOL_TEST_FAIL:
      return "";
    case M106_MALFORMED_TEST:
      return "M106 Syntax Error - M106 command is malformed. Please verify M106 syntax.";
    case M107_INVALID_SOURCE_REGISTER:
      return "M107 Syntax Error - Invalid source register. Must be G54-59(X,Y,Z)";
    case M107_OFFSETS_FAIL:
      return "M107 Failed - Could not get offsets";
    case M108_INVALID_DEST_REGISTER:
      return "M108 Syntax Error - Invalid destination register. Must be G54-59(X,Y,Z)";
    case M108_KEY_NOT_FOUND:
      return "M108 Error - No value found with this key";
		case NO_PROBE_COORD:
			return "No Probe coordinates were found to return to.";
		case ESTOP_PUSHED:
			return "Emergency stop pushed";
		case SOFTWARE_ESTOP:
			return "Software E-Stop pushed";
		default:
			return "";
	}
}

std::string GhostException::GetRawDetailMessage() const
{
	return m_errorDetail;
}

const char* GhostException::what() const noexcept
{
	DD_LOG(m_combinedMessage);
	return m_combinedMessage.c_str();
}

GhostException::EGhostException GhostException::getType() const
{
	return m_type;
}



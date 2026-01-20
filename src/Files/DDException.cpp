#include "DDException.h"

DDException::DDException(const EExceptionType t) : m_type(t) { }

DDException::DDException(const EExceptionType t, const std::string& s)
	: m_type(t)
	, m_buffer()
{
    if (m_type == NOT_FOUND)
	{
        m_buffer = "File not found: " + s;
    }
	else if (m_type == NOT_FOUND_INZ)
	{
        m_buffer = "File not found in archive: " + s;
    }
	else if (m_type == BAD_MANIFEST)
	{
        m_buffer = "Bad manifest: " + s;
    }
	else if (m_type == NOT_OPEN)
	{
        m_buffer = "File was not open";
    }
	else
	{
        m_buffer = "DD archive error";
    }
}

const char* DDException::what() const noexcept
{
    return m_buffer.c_str();
}

DDException::EExceptionType DDException::GetType()
{
	return m_type;
}

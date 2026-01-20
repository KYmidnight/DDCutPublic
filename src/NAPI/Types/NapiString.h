#pragma once

#include <NAPI/NapiUtil.h>

class NapiString
{
public:
	napi_value napi;

	NapiString(napi_env env, napi_value value) : m_env(env), napi(value) { }

	static NapiString Create(napi_env env, const std::string& value)
	{
		napi_value napiValue;
		ASSERT_OK(napi_create_string_utf8(env, value.c_str(), value.size(), &napiValue));
		return NapiString(env, napiValue);
	}

	std::string Get()
	{
		char cstr[1024];
		size_t cstrLength;
		ASSERT_OK(napi_get_value_string_utf8(m_env, napi, cstr, 1024, &cstrLength));
		return std::string(cstr, cstrLength);
	}

private:
	napi_env m_env;
};
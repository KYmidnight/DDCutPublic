#pragma once

#include "Common/CommonHeaders.h"
#include <Ghost/GRBL/SerialConnection.h>
#include <Common/Util/CommonTypes.h>


void M107(const std::string& args);
float getM107InternalMemoryValue(std::string);

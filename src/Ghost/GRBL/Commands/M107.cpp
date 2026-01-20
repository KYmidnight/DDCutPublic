#include "M107.h"
#include <Ghost/GRBL/exprtk.hpp>
#include <Common/Util/OSUtil.h>
#include <Common/Logger.h>
#include <Ghost/GhostException.h>
#include <DDCutDaemon.h>
#include <Ghost/GRBL/Regex.h>
#include <Ghost/GRBL/GhostConnection.h>
#include <Ghost/Display/GhostDisplayManager.h>
#include <list>

using namespace DDLogger;
using std::string;
using std::to_string;

Point3 LoadPoint(const string& wcs_name);

std::map<std::string, float> m107_internal_memory;

// Command: M107 <varname> (G5[4-9](X,Y,Z), <number>)
// Example : M107 foo G55X
// Name : Write WCS value to internal variable
// Summary : (Supported in DDcut Only) 

/***
 * RULES
 * 1. Variable name should have no digits and must not end in G or g
 * 2. Second param can be either G5[4-9](X,Y,Z) or an arbitrary numeric string
 * 3. Numeric string can be either a float or an int
 **/

void M107(const string& args) {
	MILL_LOG("START M107");

  //Get the command without whitespace or the preceding "M107"
  //There is code meant to perform this elsewhere which we use in other M-commands, e.g. M100, but that code also strips items in parens, which we want
  //to preserve here since they could be part of the exprtk expression.
	std::string line = args;
  line = std::regex_replace(line, std::regex("M107"), "");
  line = std::regex_replace(line, std::regex("m107"), "");
  line = std::regex_replace(line, std::regex("\\s+"), "");

  char lastC;
  string var_name = "";
  int m107_type = 0;

  for(int x = 0; x < line.size(); x++) {
    char c = line[x];

    if(x > 0) {
      lastC = line[x-1];  
      var_name.append(1, lastC);
    }
    
    if(isdigit(c)) {
      if(lastC == 'G' || lastC == 'g') {
        m107_type = 1;
        var_name = var_name.substr(0, var_name.size() - 1);
      }
      else {
        m107_type = 2;
      }
      break;
    }
  }

  line = line.substr(var_name.size(), line.size()-2);
  GhostDisplayManager::AddLine(ELineType::ERR, var_name);
  GhostDisplayManager::AddLine(ELineType::ERR, line);

  float value_to_write;

  //Get the value to write
  if(m107_type == 1) {
    if(line.size() != 4) {
      GhostDisplayManager::AddLine(ELineType::ERR, "M107 Syntax Error - Invalid source register. Must be G54-59(X,Y,Z)");
      throw GhostException(GhostException::M107_INVALID_SOURCE_REGISTER);
    }

    std::regex source_reg_regex("[Gg]5[4-9][X-Zx-z]");
    if(!std::regex_match(line, source_reg_regex))
    {
      GhostDisplayManager::AddLine(ELineType::ERR, "M107 Syntax Error - Invalid source register. Must be G54-59(X,Y,Z)");
      throw GhostException(GhostException::M107_INVALID_SOURCE_REGISTER);
    }

    auto machine = DDCutDaemon::GetInstance().GetConnection();
    auto offsets = machine->GetOffsets();
    if (offsets.size() == 0) 
    { 
      GhostDisplayManager::AddLine(ELineType::ERR, "M107 Failed - Could not get offsets");
      throw GhostException(GhostException::M107_OFFSETS_FAIL);
    }

    //Transform line to all uppercase
    for (auto & c: line) c = toupper(c);

    const string wcs_name = line.substr(0, 3);
    const char wcs_axis = line[3];

    value_to_write = GetAxisValue(LoadPoint(wcs_name), wcs_axis);
  }
  else {
    value_to_write = std::stof(line);
  }
  
  m107_internal_memory[var_name] = value_to_write;

  MILL_LOG("END M107");
	GhostDisplayManager::AddLine(ELineType::READ, "M107 Complete");
}

Point3 LoadPoint(const string& wcs_name) {
	auto machine = DDCutDaemon::GetInstance().GetConnection();
	auto offsets = machine->GetOffsets();
	auto FindIn1 = [ wcs_name ] (auto& offset) { return offset.first == wcs_name; };
	auto it = std::find_if(offsets.begin(), offsets.end(), FindIn1);

	if (it != offsets.end()) {
		const Point3 point = it->second;
		MILL_LOG("WCS found: " + wcs_name + ": " + to_string(point.x) + ", " + to_string(point.y) + ", " + to_string(point.z));
    return point;
	}
}

float getM107InternalMemoryValue(const string varname) {
  if(m107_internal_memory.find(varname) == m107_internal_memory.end()) {
    //throw GhostException(GhostException::M108_KEY_NOT_FOUND);
    return 0;
  }
  else {
    return m107_internal_memory[varname];
  }
}

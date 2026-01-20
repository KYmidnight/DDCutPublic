#include "M108.h"
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

// Command: M108 G5[4-9](X,Y,Z) <varname> 
// Example : M108 G55X foo
// Name : Write internal variable to WCS value
// Summary : (Supported in DDcut Only) 

void M108(const string& args) {
	MILL_LOG("START M108");

  //Get the command without whitespace or the preceding "M108"
  //There is code meant to perform this elsewhere which we use in other M-commands, e.g. M100, but that code also strips items in parens, which we want
  //to preserve here since they could be part of the exprtk expression.
	std::string line = args;
  line = std::regex_replace(line, std::regex("M108"), "");
  line = std::regex_replace(line, std::regex("m108"), "");
  line = std::regex_replace(line, std::regex("\\s+"), "");

  //Extract the dest register
  std::string dest_register = line.substr(0,4);
  std::regex dest_reg_regex("[Gg]5[4-9][X-Zx-z]");
  if(!std::regex_match(dest_register, dest_reg_regex))
  {
		GhostDisplayManager::AddLine(ELineType::ERR, "M108 Syntax Error - Invalid destination register. Must be G54-59(X,Y,Z)");
		throw GhostException(GhostException::M108_INVALID_DEST_REGISTER);
  }
  line.erase(0,4);

  MILL_LOG("DEST_REG: " + dest_register);
  MILL_LOG("VARIABLE: " + line);

  float memory_value = getM107InternalMemoryValue(line);

  // Update the destination register
  int dest_offset = (dest_register.at(2) - '0') - 3;
  string dest_coord = dest_register.substr(3,1);
	const string output = "G10 L2 P" + to_string(dest_offset) + " " + dest_coord + to_string(memory_value);
	DDCutDaemon::GetInstance().ExecuteCommand(output);

	MILL_LOG("END M108");
	GhostDisplayManager::AddLine(ELineType::READ, "M108 Complete");
}

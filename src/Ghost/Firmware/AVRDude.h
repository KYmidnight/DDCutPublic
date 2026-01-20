#pragma once

#include <Ghost/GRBL/GhostConnection.h>
#include <ghc/filesystem.h>

#define INFO_BUFFER_SIZE 32767

// Used to flash GRBL firmware
// Has multiple steps, executes command line scripts, and accessess files packaged with application
class AVRDude
{
public:
	static void Execute32m1(const GhostConnection::Ptr& pConnection, const fs::path& hexFile);
	static void Execute328p(const GhostConnection::Ptr& pConnection, const fs::path& hexFile);

	static fs::path GetDriversPath();

private:
	static fs::path GetAVRDudePath();

	int Execute(const GhostConnection::Ptr& pConnection,
		const fs::path& hexFilePath,
		const int baudrate,
		const std::string& device,
		const std::string& programmer
	) const;
};

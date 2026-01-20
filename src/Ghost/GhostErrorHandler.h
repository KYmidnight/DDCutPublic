#pragma once

#include "Common/CommonHeaders.h"
#include <Ghost/GRBL/GhostConnection.h>
#include <Ghost/Status/MillingError.h>
#include <Ghost/GhostException.h>

// Access and handle certain milling errors
class GhostErrorHandler
{
public:
	static MillingError GetError(
		const GhostConnection::Ptr& pConnection,
		const GhostException& exception
	);
};
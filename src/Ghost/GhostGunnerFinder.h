#pragma once

#include "GhostGunner.h"

// Find connected Ghost Gunners
// Implementation is OS specific
// There is a tie-in here for selecting the Mock GRBL for testing purposes
class GhostGunnerFinder
{
public:
	std::list<GhostGunner> GetAvailableGhostGunners() const;
};

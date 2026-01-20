#pragma once

#include "JogDirection.h"
#include <Ghost/GRBL/GhostConnection.h>

// Jogging commands
void Jog( GhostConnection::Ptr pConnection, const EJogDirection direction,
	const bool continuous, const double distance_mm ) noexcept;

void StopJogging(GhostConnection::Ptr pConnection) noexcept;

double CalculateDistance( GhostConnection::Ptr pConnection, const EJogDirection direction,
	const bool continuous, const double distance_mm ) noexcept;

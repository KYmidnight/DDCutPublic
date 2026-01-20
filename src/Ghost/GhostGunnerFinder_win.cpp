#include "GhostGunnerFinder.h"
#include <winioctl.h>
#include "GhostException.h"
#include <Common/Util/StringUtil.h>
#include <Common/Logger.h>

class DeviceInfo
{
public:
	static DeviceInfo GetDeviceInfo()
	{
		HDEVINFO info = SetupDiGetClassDevs(&GUID_DEVINTERFACE_SERENUM_BUS_ENUMERATOR, NULL, NULL, DIGCF_PRESENT);
		return DeviceInfo(info);
	}

	~DeviceInfo()
	{
		if (devInfo != INVALID_HANDLE_VALUE)
		{
			SetupDiDestroyDeviceInfoList(devInfo);
		}
	}

	explicit DeviceInfo(HDEVINFO info) : devInfo(info) { }
	DeviceInfo(const DeviceInfo&) = delete;

	HDEVINFO devInfo;
};

//#define USE_MOCK_GRBL

#ifdef USE_MOCK_GRBL

std::list<GhostGunner> GhostGunnerFinder::GetAvailableGhostGunners() const { 
	std::list<GhostGunner> availableGhostGunners;
	availableGhostGunners.push_back(GhostGunner("\\MockGhostGunner\\", "#12345"));
	return availableGhostGunners;
}

#else

std::list<GhostGunner> GhostGunnerFinder::GetAvailableGhostGunners() const
{
	std::list<GhostGunner> availableGhostGunners;

	DeviceInfo hdi = DeviceInfo::GetDeviceInfo();
	if (hdi.devInfo != INVALID_HANDLE_VALUE)
	{
		SP_DEVINFO_DATA spdid;
		spdid.cbSize = sizeof(SP_DEVINFO_DATA);

		int i = 0;
		while (true)
		{
			if (!SetupDiEnumDeviceInfo(hdi.devInfo, i, &spdid))
			{
				const DWORD err = GetLastError();
				if (err == ERROR_NO_MORE_ITEMS)
				{
					break;
				}
				else
				{
					throw GhostException(GhostException::NO_ACCESS, std::to_string(err));
				}
			}
			else
			{
				CHAR nameBuf[MAX_PATH];
				CHAR serialBuf[MAX_PATH];
				DWORD valueType;
				DWORD valueSize;
				if (SetupDiGetDeviceRegistryProperty(hdi.devInfo, &spdid, SPDRP_FRIENDLYNAME, &valueType, (PBYTE)nameBuf, MAX_PATH, &valueSize)
					&& SetupDiGetDeviceInstanceId(hdi.devInfo, &spdid, serialBuf, MAX_PATH, &valueSize))
				{
					const std::string nameStr = nameBuf;
					const std::string serialNumber = serialBuf;
					const std::string formattedSerialNumber = serialNumber.substr(serialNumber.find_last_of('\\') + 1);

					std::smatch sm;
					const std::regex RXARDUINO("^Arduino Uno \\((.*)\\)$");
					if (std::regex_match(nameStr, sm, RXARDUINO))
					{
						const std::string path = "\\\\.\\" + sm[1].str();
						availableGhostGunners.push_back(GhostGunner(path, formattedSerialNumber));
					}

					// TODO: RegisterDeviceNotifications - Will need to create a fake window to handle message loop
				}
				else
				{
					const DWORD err = GetLastError();
					throw GhostException(GhostException::NO_ACCESS, std::to_string(err));
				}
			}

			++i;
		}
	}

	return availableGhostGunners;
}

#endif	// USE_MOCK_GRBL

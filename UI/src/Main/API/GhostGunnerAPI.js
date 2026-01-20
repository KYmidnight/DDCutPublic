import APIUtility from "./APIUtility";

const ddcut = require("ddcut");
const electron = require("electron");
var jogging = false;

class GhostGunnerAPI {
    static Initialize() {
        electron.ipcMain.on('Ghost::GetAvailableGhosts', function (event) {
            var availableGhostGunners = ddcut.GetAvailableGhostGunners();
            event.returnValue = availableGhostGunners;
        });
        electron.ipcMain.on('Ghost::ChooseGhost', function (event, path, serialNumber) {
            ddcut.SelectGhostGunner(path, serialNumber);
        });

        electron.ipcMain.on('Ghost::Jog', function (event, direction, continuous, distance_mm) {
            if (!jogging) {
                try {
                    const parsed_distance = parseFloat(distance_mm);

                    jogging = true;

                    ddcut.Jog({
                        direction: direction,
                        continuous: continuous,
                        distance_mm: parsed_distance
                    });
                } catch (_) {

                }
            }
        });

        electron.ipcMain.on('Ghost::CancelJog', function (event) {
            ddcut.CancelJog();
            jogging = false;
            event.returnValue = null;
        });

        electron.ipcMain.on('Ghost::ExecuteCommand', function (event, command) {
            ddcut.ExecuteCommand(command);
            event.returnValue = null;
        });

        electron.ipcMain.on('Ghost::ExecuteRealtime', function (event, command) {
            ddcut.ExecuteRealtime(command.charCodeAt(0));
        });

        electron.ipcMain.on('Ghost::SetManualEntryMode', function (event, manualEntryModeFlag) {
            ddcut.SetManualEntryMode(manualEntryModeFlag);
            event.returnValue = null;
        });

        electron.ipcMain.on('Ghost::GetShuttleKeys', function (event) {
            APIUtility.handleAsyncApiResponse(event, 'Ghost::GetShuttleKeys', ddcut.GetJogKeys);
        });

        electron.ipcMain.on('Ghost::SetShuttleKeys', function (event, shuttleKeys) {
            event.returnValue = ddcut.SetJogKeys(shuttleKeys);
        });

        electron.ipcMain.on('Ghost::GetStatus', function (event) {
            event.sender.send('Jobs::ReadWrites', ddcut.GetReadWrites());
            event.sender.send("DD_UpdateRealtimeStatus", ddcut.GetStatus());
        });

        electron.ipcMain.on('Ghost::GetMachineConfig', function (event) {
            APIUtility.handleAsyncApiResponse(
                event,
                'Ghost::GetMachineConfig',
                ddcut.GetMachineConfig
            );
        });

        electron.ipcMain.on('Ghost::GetGhostGunnerStatus', function (event) {
            APIUtility.handleAsyncApiResponse(
                event,
                'Ghost::GetGhostGunnerStatus',
                ddcut.GetGhostGunnerStatus
            );
        });

        electron.ipcMain.on('Ghost::UploadGCodeFile', function (event, gCodeFile) {
            APIUtility.handleAsyncApiResponse(
                event,
                'Ghost::UploadGCodeFile',
                () => {
                    console.log('-----');
                    console.log(`gCodeFile: ${gCodeFile}`);
                    ddcut.RunManualGCodeFile(gCodeFile);
                    console.log('-----');
                }
            );
        });

        electron.ipcMain.on('Ghost::HasNonzeroWCS', function (event) {
            event.returnValue = ddcut.HasNonzeroWCS();
        });

        electron.ipcMain.on('Ghost::AllowWcsClearPrompt', function (event) {
            event.returnValue = ddcut.AllowWcsClearPrompt();
        });

        electron.ipcMain.on('Ghost::ClearG54ThroughG58', function (event) {
            ddcut.ClearG54ThroughG58();
        });

        electron.ipcMain.on('Ghost::WcsValueCheck', function (event) {
            event.returnValue = ddcut.WcsValueCheck();
        });
    }
}

export default GhostGunnerAPI;

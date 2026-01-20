const ddcut = require("ddcut");
const electron = require("electron");
const globalAny = global;
var mainWindow = null;
var ggStatus = 0;
var milling = false;
var currentContainer = "Dashboard";

import SettingsAPI from "./API/SettingsAPI";
import FirmwareAPI from "./API/FirmwareAPI";
import FileAPI from "./API/FileAPI";
import GhostGunnerAPI from "./API/GhostGunnerAPI";
import JobsAPI from "./API/JobsAPI";
import LogsAPI from "./API/LogsAPI";
import SupportAPI from "./API/SupportAPI";
import WalkthroughAPI from "./API/WalkthroughAPI";

function InitializeAPIs() {
    SettingsAPI.Initialize();
    FirmwareAPI.Initialize();
    FileAPI.Initialize();
    GhostGunnerAPI.Initialize();
    JobsAPI.Initialize();
    LogsAPI.Initialize();
    SupportAPI.Initialize();
    WalkthroughAPI.Initialize();
    electron.ipcMain.on("DD_SetCurrentPage", function (event, container) {
        currentContainer = container;
    });
    electron.ipcMain.on("DD_GetCurrentPage", function (event) {
        event.returnValue = currentContainer;
    });
}

function CheckConnectionStatus() {
    if (mainWindow != null) {
        let newStatus = ddcut.GetGhostGunnerStatus();

        console.log(JSON.stringify(newStatus));
        if (newStatus.connection_status != ggStatus || milling != newStatus.milling) {
            ggStatus = newStatus.connection_status;
            milling = newStatus.milling;
            mainWindow.webContents.send("DD_UpdateGGStatus", newStatus.connection_status, newStatus.milling);
        }
    }
}

var connectionStatusIntervalId = null;
class DDController {
    static Initialize() {
        ddcut.Initialize(function () {
            InitializeAPIs();
            let filePath = "";

            if (process.argv.length > 1 && process.argv[1].length > 1) {
                filePath = process.argv[1];
                global.job_passed_in = ddcut.SetDDFile(process.argv[1]).length === 0;
            }

            electron.ipcMain.on("GetPassedInFilePath", function (event) {
                const jobPassedIn = global.job_passed_in;
                global.job_passed_in = false;
                event.returnValue = jobPassedIn ? filePath : null;
            });

            electron.ipcMain.on("GetPassedInJobs", function (event) {
                const value = global.job_passed_in;
                

                event.returnValue = value ? ddcut.GetJobs() : null;
            });

            ddcut.InstallDrivers();

            connectionStatusIntervalId = setTimeout(function check_status() {
                CheckConnectionStatus();
                connectionStatusIntervalId = setTimeout(check_status, 100);
            }, 100);
            
            globalAny.initialized = true;
        });
    }

    static SetWindow(window) {
        mainWindow = window;
    }

    static Shutdown() {
        clearTimeout(connectionStatusIntervalId);
        ddcut.Shutdown();
    }
}

export default DDController;
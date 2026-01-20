const ddcut = require("ddcut");
const electron = require("electron");

class FileAPI {
    static Initialize() {
        electron.ipcMain.on('Logs::GetLogFile', function (event) {
            event.returnValue = ddcut.GetLogPath();
        });

        electron.ipcMain.on('Logs::LogString', function (event, string) {
            event.returnValue = ddcut.LogString(string);    // I think this can be an array as well: [str1, str2, str3, ...]
        });
    }
}

export default FileAPI;

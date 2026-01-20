const ddcut = require("ddcut");
const electron = require("electron");

class WalkthroughAPI {
    static Initialize() {
        electron.ipcMain.on('Walkthrough::ShouldDisplay', function (event, walkthroughType) {
            event.returnValue = ddcut.ShouldShowWalkthrough(walkthroughType);
        });
        electron.ipcMain.on('Walkthrough::SetShowWalkthrough', function (event, walkthroughType, value) {
            event.returnValue = ddcut.SetShowWalkthrough(walkthroughType, value);
        });
    }
}

export default WalkthroughAPI;

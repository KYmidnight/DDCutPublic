const ddcut = require("ddcut");
const electron = require("electron");
const path = require('path');
const fs = require('fs');

class FileAPI {

    static Initialize() {
        let execPath = path.dirname(process.execPath);
        let filePath;
        
        electron.ipcMain.on('File::OpenFileDialog', function (event) {
            electron.dialog.showOpenDialog({
                //defaultPath: path.join(execPath, 'Cutting Code'),
                properties: ['openFile', 'treatPackageAsDirectory'],
                filters: [{ name: "DD Files", extensions: ["dd"] }]
            }, function (files) {
                if (files) {
                    filePath = String(files);
                    let error = ddcut.SetDDFile(files[0]);
                    if (error.length === 0) {
                        let returnValue = ddcut.GetJobs();
                        console.log("openfile - returnValue: " + JSON.stringify(returnValue));
                        event.sender.send("ShowJobSelection", returnValue);
                    }
                    else {
                        event.sender.send("InvalidDDFile", files[0], error);
                    }
                }
            });
        });

        electron.ipcMain.on('File::PickNewDDFileDirectory', function (event) {
            electron.dialog.showOpenDialog({
                properties: ['openDirectory']
            }, function (directory) {
                if (directory && directory.length > 0) {
                    event.returnValue = directory[0];
                    let fileName = "New File";
                    filePath = directory[0] + "\\" + fileName + ".dd";
                    ddcut.CreateNewDDFile(fileName, directory[0]);
                    let returnValue = ddcut.GetJobs()
                    event.sender.send("ShowJobSelection", returnValue);
                } else {
                    event.returnValue = null;
                }
            });
        });

        electron.ipcMain.on('File::UploadFileToDDFile', function (event, fileType) {
            let filePickerArgs;
            if (fileType === "image") {
                filePickerArgs = {
                    properties: ['openFile', 'treatPackageAsDirectory'],
                    filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "gif", "bmp"] }]
                }
            } else {
                filePickerArgs = {
                    properties: ['openFile', 'treatPackageAsDirectory'],
                    filters: [{ name: "GCode File", extensions: ["txt", "nc", "gcode"] }]
                }
            }
            electron.dialog.showOpenDialog(filePickerArgs, function (files) {
                if (files) {
                    filePath = String(files);
                    let successful = ddcut.AddNewFileToDDFile(filePath, fileType);
                    if (successful) {
                        event.sender.send("FileUploadSuccessful", filePath);
                    } else {
                        event.sender.send("FileUploadFailed");
                    }
                }
            });
        });

        electron.ipcMain.on('File::DoubleClickSetFilePath', function(event, path) {
            filePath = path;
        });

        electron.ipcMain.on("File::GetExistingJobs", function (event) {
            let returnValue = ddcut.GetJobs();
            console.log("returnValue: " + JSON.stringify(returnValue));
            event.returnValue = returnValue;
        });

        electron.ipcMain.on('File::FetchFilePath', function (event) {
            event.returnValue = filePath;
        })

        electron.ipcMain.on('File::OpenGCodeFileDialog', function (event) {
            electron.dialog.showOpenDialog({
                properties: ['openFile', 'treatPackageAsDirectory'],
                filters: [{ name: "G-Code Files", extensions: ["*"] }]
            }, function (files) {
                if (files) {
                    event.sender.send("GCodeFileSelected", files[0]);
                }
            });
        });

        electron.ipcMain.on('File::ExtractAdditionalContent', function (event) {
            let path = electron.dialog.showOpenDialog({ properties: ['openDirectory', 'treatPackageAsDirectory', 'createDirectory'] },
                function (path) {
                    if (path) {
                        electron.shell.openItem(path + "\\.");
                        event.returnValue = ddcut.ExtractAdditionalContentsInto(path[0]);
                    }
                });
        });

        electron.ipcMain.on('File::HasAdditionalContent', function (event) {
            event.returnValue = ddcut.HasAdditionalContent();
        });

        electron.ipcMain.on("File::ReadFile", function (event, fileName) {
            console.log("Reading file: " + fileName);
            fs.readFile(fileName, 'utf-8', function (err, data) {
                event.sender.send('File::FileOpened', data);
            });
        });
    }
}

export default FileAPI;

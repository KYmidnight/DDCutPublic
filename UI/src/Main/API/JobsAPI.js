const ddcut = require("ddcut");
const electron = require("electron");
const DDController = require("../DDController");
const logger = require("electron-log");

class JobsAPI {
    static Initialize() {
        let selectedJobName;

        electron.ipcMain.on('Jobs::SetJobName', function (event, jobName) {
            selectedJobName = jobName;
        });

        electron.ipcMain.on('Jobs::FetchJobName', function (event) {
            event.returnValue = selectedJobName;
        });

        electron.ipcMain.on('Jobs::SelectJob', function (event, jobIndex) {
            if (ddcut.SetSelectedJob(jobIndex) === true) {
                event.sender.send('Jobs::JobSelected');
            }
            else {
                event.sender.send('Jobs::JobSelectionFailed');
            }
        });

        electron.ipcMain.on('Jobs::SubmanifestUsed', function (event) {
            event.returnValue = ddcut.IsSubmanifestUsed();
        })

        electron.ipcMain.on('Jobs::GetJobsFromPath', function (event, path) {
            let error = ddcut.SetDDFile(path);
            if (error.length === 0) { event.returnValue = ddcut.GetJobs(); }
            else { event.returnValue = error; }     // Jobs will be an error string instead of an array
        });

        electron.ipcMain.on('Jobs::GetSteps', function (event) {
            let steps = ddcut.GetAllSteps();
            // console.log("steps: " + JSON.stringify(steps));
            event.returnValue = steps;
        });

        electron.ipcMain.on('Jobs::GetStep', function (event, stepIndex) {
            let step = ddcut.GetStep(stepIndex);
            event.returnValue = step;
        });

        electron.ipcMain.on('Jobs::SetStepValues', function (event, newOperationValues, stepIndex) {
            const keys = Object.keys(newOperationValues);
            // console.log(JSON.stringify(newOperationValues));
            if (ddcut.SetStepValues(newOperationValues, keys, stepIndex) == true) {
                // console.log("SetStepValue successfully initiated!");
            }
        });

        electron.ipcMain.on('Jobs::AddNewOperation', function (event, stepIndex) {
            // console.log("AddNewOperation fired!");
            if (ddcut.AddNewOperation(stepIndex) == true) {

            }
        });

        electron.ipcMain.on('Jobs::DeleteOperation', function (event, stepIndex) {
            // console.log("deleteOperation fired!");
            if (ddcut.DeleteOperation(stepIndex) == true) {

            }
        });

        electron.ipcMain.on('Jobs::MoveOperation', function (event, prevStepIndex, nextStepIndex) {
            // console.log("moveOperation fired!");
            if (ddcut.MoveOperation(prevStepIndex, nextStepIndex) == true) {

            }
        });

        electron.ipcMain.on('Jobs::AddNewJob', function (event, jobName, jobDescription, jobIndex) {
            // console.log("AddNewJob fired!");
            if (ddcut.AddNewJob(jobName, jobDescription, jobIndex) == true) {
                // console.log("JobsAPI - AddNewJobSuccessful");
            }
        });

        electron.ipcMain.on('Jobs::StartMilling', function (event, stepIndex) {
            event.sender.send("ShowMillingCode");
            JobsAPI.milling = true;
            ddcut.StartMilling(stepIndex);
        });

        electron.ipcMain.on('Jobs::GetProgress', function (event, stepIndex) {
            event.sender.send('Jobs::ReadWrites', ddcut.GetReadWrites());
            let status = ddcut.GetMillingStatus(stepIndex);
            JobsAPI.milling = status.milling;

            // logger.debug("GetProgress result: " + JSON.stringify(status));
            event.sender.send('Jobs::GetProgressResponse', status);
        });

        electron.ipcMain.on("Jobs::GetWriteStatus", function (event) {
            let status = ddcut.GetWriteStatus();
            // console.log("status: " + status);
            event.sender.send("Jobs::HandleWriteStatus", status);
            if (status == false) {
                event.sender.send("Jobs::WriteEditsSuccessful")
            }
        });

        electron.ipcMain.on('Jobs::EmergencyStop', function (event, stepIndex) {
            event.returnValue = ddcut.EmergencyStop();
        });
    }
}

export default JobsAPI;

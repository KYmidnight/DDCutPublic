import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Menu from '../../components/Menu';
import {Button, Grid, Tooltip, Typography} from "@material-ui/core";
import withStyles from '@material-ui/core/styles/withStyles';
import path from "path";
import {ipcRenderer, shell} from "electron";
import JobSelection from '../../components/Modals/JobSelection';
import {Redirect} from 'react-router-dom';
import SupportCenter from '../../components/Support/SupportCenter';
import Alert from '../../components/Modals/Alert';
import app from 'app';
import ReactMarkdown from 'react-markdown'
import packageJSON from '../../../../package.json';
const ddcut = require("ddcut");

const styles = theme => ({
    main: {
        width: '80%',
        height: '65%',
        marginTop: 'auto',
        marginBottom: 'auto',
        marginLeft: 'auto',
        marginRight: 'auto',
        position: 'absolute',
        borderLeft: app.dashboard.border,
        borderRight: app.dashboard.border,
        borderBottom: app.dashboard.border,
    },
    dashboardStyle: {
        backgroundImage: `url(${app.dashboard.background})`,
        backgroundSize: 'cover',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        position: 'fixed',
        left: 0,
        top: 0,
        z: -1,
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        display: 'flex',
        verticalAlign: 'middle',
    },
    topLeft: {
        width: 'calc(40% - 60px)',
        height: '65%',
        marginTop: 'auto',
        marginBottom: 'auto',
        marginLeft: 'calc(-20% - 30px)',
        position: 'absolute',
        borderTop: app.dashboard.border,
    },
    topRight: {
        width: 'calc(40% - 60px)',
        height: '65%',
        marginTop: 'auto',
        marginBottom: 'auto',
        marginLeft: 'calc(20% + 30px)',
        position: 'absolute',
        borderTop: app.dashboard.border,
    },
    runButton: {
        '&:disabled': {
            opacity: 0.5
        }
    },
    news: {
        overflow: 'auto',
        width: '100%',
        height: '100%',
        border: '#FFFFFF 1px solid',
        color: '#FFFFFF'
    }
});

function Dashboard(props) {
    const { classes, status, settings } = props;
    const [availableJobs, setAvailableJobs] = React.useState(new Array());
    const [showJobSelection, setShowJobSelection] = React.useState(false);
    const [navigateToMilling, setNavigateToMilling] = React.useState(false);
    const [openCustomerSupport, setOpenCustomerSupport] = React.useState(false);
    const [alertMessage, setAlertMessage] = React.useState("");
    const [showNewFileAlert, setShowNewFileAlert] = React.useState(false);
    const [enableEditButton, setEnableEditButton] = React.useState(false);
    const [newsContent, setNewsContent] = React.useState({});

    const firmware = ipcRenderer.sendSync("Firmware::GetFirmwareVersion");

    ipcRenderer.removeAllListeners("DDFileDoubleClick");
    ipcRenderer.on("DDFileDoubleClick", (event, path) => {
        ipcRenderer.sendSync('Logs::LogString', "command line:");
        ipcRenderer.sendSync('Logs::LogString', path.cl);
        ipcRenderer.sendSync('Logs::LogString', "working directory:");
        ipcRenderer.sendSync('Logs::LogString', path.wd);

        ipcRenderer.removeAllListeners("Jobs::JobSelected");
        ipcRenderer.on("Jobs::JobSelected", (event) => {
            setNavigateToMilling(true);
        });
        
        ipcRenderer.send('File::DoubleClickSetFilePath', path);
        let jobs = ipcRenderer.sendSync('Jobs::GetJobsFromPath', path);
        if (typeof jobs !== "string") {
            setAvailableJobs(jobs);
            setShowJobSelection(true);
        }
        else {
            setAlertMessage("DD file error: " + jobs);  // Jobs is an error string instead
        }
    });

    function showFilePicker() {
        ipcRenderer.removeAllListeners("Jobs::JobSelected");
        ipcRenderer.on("Jobs::JobSelected", (event) => {
            setNavigateToMilling(true);
        });

        ipcRenderer.removeAllListeners("ShowJobSelection");
        ipcRenderer.on("ShowJobSelection", (event, jobs) => {
            setAvailableJobs(jobs);
            setShowJobSelection(true);
        });

        ipcRenderer.removeAllListeners("InvalidDDFile");
        ipcRenderer.on("InvalidDDFile", (event, filename, error) => {
            setAlertMessage("DD file error: " + error);
        });

        ipcRenderer.send('File::OpenFileDialog');
    }

    function onClickRun() {
        if (status === 2 || enableEditButton) {
            if (enableEditButton) {
                setShowNewFileAlert(true);
            } else {
                showFilePicker();
            }
        }
    }

    function onCloseJobSelection(event) {
        setShowJobSelection(false);
    }

    function onClickHelp() {
        setOpenCustomerSupport(true);
    }

    function getRunImage() {
        if (status === 2 || enableEditButton == true) {
            return (
                <img
                    style={{ marginTop: '20px', height: '14vh' }}
                    src={path.join(__dirname, app.dashboard.buttons + 'run.png')}
                    onMouseOver={e => e.currentTarget.src = path.join(__dirname, app.dashboard.buttons + 'run_hover.png')}
                    onMouseOut={e => e.currentTarget.src = path.join(__dirname, app.dashboard.buttons + 'run.png')}
                    onClick={onClickRun}
                />
            );
        } else {
            return (
                <img
                    style={{ marginTop: '20px', height: '14vh' }}
                    src={path.join(__dirname, app.dashboard.buttons + 'run.png')}
                />
            );
        }
    }

    function getRunButton() {
        if (status != 2 && enableEditButton == false) {
            return (
                <Tooltip
                    disableFocusListener={true}
                    disableTouchListener={true}
                    title={app.dashboard.run.tooltip}
                >
                    <span>
                        <Button className={classes.runButton} style={{ backgroundColor: "transparent" }} disabled={true}>
                            {getRunImage()}
                        </Button>
                    </span>
                </Tooltip>
            );
        } else {
            return (
                <span>
                    <Button className={classes.runButton} style={{ backgroundColor: "transparent" }} disabled={false}>
                        {getRunImage()}
                    </Button>
                </span>
            );
        }
    }

    function refreshJobs() {
        let jobs = ipcRenderer.sendSync("File::GetExistingJobs");
        console.log("refreshJobs - jobs: " + JSON.stringify(jobs));
        setAvailableJobs(jobs);
    }

    function handleNewFileYes() {
        ipcRenderer.removeAllListeners("Jobs::JobSelected");
        ipcRenderer.on("Jobs::JobSelected", (event) => {
            setNavigateToMilling(true);
        });

        ipcRenderer.removeAllListeners("ShowJobSelection");
        ipcRenderer.on("ShowJobSelection", (event, jobs) => {
            setAvailableJobs(jobs);
            setShowJobSelection(true);
        });
        let filepath = ipcRenderer.sendSync('File::PickNewDDFileDirectory')
        console.log("filepath: " + JSON.stringify(filepath));
        setShowNewFileAlert(false);
    }

    function handleNewFileNo() {
        setShowNewFileAlert(false);
        showFilePicker();
    }

    function getEnableEditButtonValue() {
        if (settings) {
            return settings.enableEditButton;
        } else {
            return false;
        }
    }

    function getNewsContent() {
        if (Object.keys(newsContent).length != 0) {
            try {
                return newsContent.message;
            } catch {
                return "Failed to get news."
            }
        }
    }

    setTimeout(function() {
        const jobs = ipcRenderer.sendSync('GetPassedInJobs');
        const filePath = ipcRenderer.sendSync("GetPassedInFilePath");

        if (filePath != null) {
            ipcRenderer.send('File::DoubleClickSetFilePath', filePath);
        }
        
        if (jobs != null) {
            ipcRenderer.removeAllListeners("Jobs::JobSelected");
            ipcRenderer.on("Jobs::JobSelected", (event) => {
                setNavigateToMilling(true);
            });
            setAvailableJobs(jobs);
            setShowJobSelection(true);
        }
    },
    500);

    useEffect(() => {
        console.log("useEffect Fired!");
        if (settings) {
            setEnableEditButton(settings.enableEditButton);
        }
    }, [settings && settings.enableEditButton]);

    useEffect(() => {
        fetch('https://ddservices.deathathletic.com/latestnews')
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(data => {
          console.log(data);
          setNewsContent(data);
           // Process and display the data
        })
        .catch(error => {
          console.error('There has been a problem with your fetch operation:', error);
        });
      
    }, [])

    if (navigateToMilling) {
        ipcRenderer.removeAllListeners("DDFileDoubleClick");
        return (<Redirect to='/milling' />);
    }

    console.log("Settings: " + JSON.stringify(settings));

    return (
        <section className={classes.dashboardStyle} >
			<Alert open={alertMessage.length > 0} message={alertMessage} onOk={(event) => { setAlertMessage("") }} onCancel={(e) => { setAlertMessage("")}} />
            <Alert open={showNewFileAlert} message="Would you like to create a new file?" yesNo={true} onOk={handleNewFileYes} onCancel={handleNewFileNo} />

            <Menu />
            <JobSelection open={showJobSelection} onClose={onCloseJobSelection} jobs={availableJobs} status={status} refreshJobs={refreshJobs} enableEditButton={enableEditButton} />

            <div className={classes.topLeft} />
            <div className={classes.topRight} />
            <div className={classes.main}>
                <div style={{ position: "absolute", width: "100%" }}>
                    <center>
                        <img src={path.join(__dirname, app.dashboard.logo)} width="88px" style={{ marginTop: "-44px" }} />
                    </center>
                </div>
                <Grid container direction='column' alignItems='center' justify='center' style={{ height: '100%'}}>
                    <Grid container
                        spacing={8}
                        direction="row"
                        justify="center"
                        alignItems="center"
                        style={{height: '30%'}}
                    >
                        <Grid item xs={4}>
                            <center>
                                <Button style={{ backgroundColor: "transparent" }} id="store">
                                    <img
                                        style={{ marginTop: '20px', marginLeft: '30px', height: '14vh' }}
                                        src={path.join(__dirname, app.dashboard.buttons + 'store.png')}
                                        onMouseOver={e => e.currentTarget.src = path.join(__dirname, app.dashboard.buttons + 'store_hover.png')}
                                        onMouseOut={e => e.currentTarget.src = path.join(__dirname, app.dashboard.buttons + 'store.png')}
                                        onClick={() => { shell.openExternal(app.dashboard.store.url) }}
                                    />
                                </Button>
                            </center>
                        </Grid>
                        <Grid item xs={4}>
                            <center>
                                <div id="run-code">
                                    {getRunButton()}
                                </div>
                            </center>
                        </Grid>
                        <Grid item xs={4}>
                            <center>
                                <Button style={{ backgroundColor: "transparent" }}>
                                    <img
                                        style={{ marginTop: '20px', marginRight: '30px', height: '14vh' }}
                                        src={path.join(__dirname, app.dashboard.buttons + 'help.png')}
                                        onMouseOver={e => e.currentTarget.src = path.join(__dirname, app.dashboard.buttons + 'help_hover.png')}
                                        onMouseOut={e => e.currentTarget.src = path.join(__dirname, app.dashboard.buttons + 'help.png')}
                                        onClick={onClickHelp}
                                    />
                                </Button>
                            </center>
                        </Grid>
                    </Grid>
                    <Grid container justify='center' alignItems='center' style={{height: '25%', marginTop: '100px', color: 'white'}}>
                        <Grid item style={{width: '80%', height: '100%'}}>
                            <Typography style={{marginBottom: '5px', fontSize: '15px', fontWeight: 'bold'}} variant='body1'>Latest News:</Typography>
                            <div style={{padding: '0 10px', fontFamily: 'sans-serif', fontSize: '14px'}} className={classes.news}>
                                <ReactMarkdown>{getNewsContent()}</ReactMarkdown>
                            </div>
                        </Grid>
                    </Grid>
                </Grid>
            </div>

            <SupportCenter open={openCustomerSupport} onClose={() => { setOpenCustomerSupport(false) }} />
        </section>
    );
}

Dashboard.propTypes = {
    classes: PropTypes.object.isRequired,
    status: PropTypes.number.isRequired
};

export default withStyles(styles)(Dashboard);

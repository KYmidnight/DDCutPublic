import React from "react";
import {Grid, Typography, Button} from "@material-ui/core";
import {ipcRenderer, shell} from "electron";
import FirmwareUpdater from "../../FirmwareUpdater";
import {version} from '../../../../../../package.json';
import Alert from '../../../Modals/Alert';
import withStyles from "@material-ui/core/styles/withStyles";

const os = require('os');
const releaseRawString = os.release();

const RedTextTypography = withStyles({
    root: {
        color: "#f44336"
    }
})(Typography);

class Software extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            firmware: null,
            path328p: "",
            path32m1: "",
            alertMessage: "",
            disableUpdate: false
        };

        this.getVersion = this.getVersion.bind(this);
        this.selectGCodeFile = this.selectGCodeFile.bind(this);
        this.checkForMacOS = this.checkForMacOS.bind(this);
    }

    checkForMacOS() {
        let platform = process.platform;
        const splitStr = releaseRawString.split('.');
        const releaseNumber = splitStr[0] + "." + splitStr[1];
        
        if ( ((platform === 'darwin') && (releaseNumber > 17.7)) ) {        // 17.7 is underlying darwin version that maps to MacOS's last 10.13 release
            this.setState({
                disableUpdate: true
            });
        }
    }

    componentDidMount() {
        this.checkForMacOS();
    }

    getVersion() {
        if (this.props.firmware != null) {
            if (this.props.firmware.dd != null) {
                return (
                    <React.Fragment>
                        {"DD: " + this.props.firmware.dd}<br />
                        {"GRBL: " + this.props.firmware.grbl}
                    </React.Fragment>
                )
            } else {
                return (
                    <React.Fragment>
                        {"GRBL: " + this.props.firmware.grbl}<br />
                        {"FW: " + this.props.firmware.ymd}<br />
                        {"GG: " + this.props.firmware.gg}<br />
                        {"PCB: " + this.props.firmware.pcb}
                    </React.Fragment>
                )
            }
        } else {
            return "Not Connected";
        }
    }

    showFirmwareUploadButtons() {
        if (this.state.disableUpdate) {
            return ( 
                <RedTextTypography variant='subtitle1'>
                    <p>
                        ATTENTION: due to a problem inherent to Mac OSX 10.14 and beyond, DDCut cannot currently update your Ghost Gunner's firmware on these operating systems.
                    </p>
                    <p>
                        This update can be performed using the following alternate methods:
                    </p>
                        <ol>
                            <li>Connect your Ghost Gunner to a computer running Windows 7 or above and perform the firmware update</li>
                            <li>Connect your Ghost Gunner to a Mac running OSX 10.13 and perform the firmware update.</li>
                            <li>Sign up for the Ghost Gunner 3-S upgrade program at https://ghostgunner.net/upgrade. Both your Ghost Gunner’s hardware and firmware will be upgraded while at the factory.</li>
                        </ol>
                    <p>
                        We apologize for the inconvenience and are working on a permanent solution for this. Please contact support@ghostgunner.net with any questions.
                    </p>

                </RedTextTypography>
            );
        } else {
            if (this.state.path328p) {
                return (
                    <Grid item xs={6}>
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={ () => {
                                let success = ipcRenderer.sendSync('Firmware::UploadCustomFirmware', this.state.path328p, this.state.path32m1);
                                this.setState({ alertMessage: "Upload succeded == " + success  });
                                }
                            }
                            fullWidth
                        >
                            Upload Custom Firmware
                        </Button>
                    </Grid>
                );
            } else {
                return ( 
                    <Grid item xs={6}>
                        <FirmwareUpdater 
                            refreshFirmwareVersion={() => { this.props.updateMachineStatus("refresh", "refresh") }} 
                            firmwarePreselected={false} 
                            firmwareAvailable={this.props.firmwareAvailable} 
                            checkFirmwareUpdates={this.props.checkFirmwareUpdates} 
                            setSelectedTab={() => {return} } 
                        />
                    </Grid>
                );
            }
        }
    }

    showCustomFirmwareButton() {

        if (this.state.disableUpdate) {
            return;
        } else {
            if (this.state.path328p) {
                return (<Typography variant='subtitle1'>{this.state.path328p}</Typography>);
            } else {
                return (
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={ () => {
                            this.props.setSelectedTab(3);
                            } 
                        }
                        fullWidth
                    >
                        Manual Firmware Upload
                    </Button>
                )
            }
        }
    }

    selectGCodeFile() {
        ipcRenderer.once('GCodeFileSelected', (event, gCodeFilePath) => {
            let gCodeFilePathDisplay = gCodeFilePath;

            // if (gCodeFilePathDisplay.length > 60) {
            //     gCodeFilePathDisplay = gCodeFilePathDisplay.substr(gCodeFilePathDisplay.length - 60);
            //     gCodeFilePathDisplay = `...${gCodeFilePathDisplay.substr(gCodeFilePathDisplay.indexOf(path.sep))}`;
            // }

            // this.setState({gCodeFilePath: gCodeFilePath, gCodeFilePathDisplay: gCodeFilePathDisplay});
            console.log(gCodeFilePathDisplay);
        });
        ipcRenderer.send('File::OpenGCodeFileDialog');
    }

    // setAlertMessage(success) {
    //     this.setState({
    //         alertMessage: "Upload succeded == " + success
    //     });
    // }

    render() {
        return (
            <React.Fragment>
                {/* Version */}
                <Grid container spacing={1}>
                    <Grid item xs={7}>
                        <Typography variant='subtitle1'>DDCut Software Version:</Typography>
                    </Grid>
                    <Grid item xs={5}>
                        <Typography variant='subtitle1'><b>{version}</b></Typography>
                    </Grid>
                    <Grid item xs={7}>
                        <Typography variant='subtitle1'>Ghost Gunner Firmware Version:</Typography>
                    </Grid>
                    <Grid item xs={5}>
                        <Typography variant='subtitle1'><b>{this.getVersion()}</b></Typography>
                    </Grid>
                </Grid>
                <br /><br />

                <Grid container spacing={1}>
                    <Grid item xs={3} />
                    <Alert
                        open={this.state.alertMessage.length > 0}
                        message={this.state.alertMessage}
                        yesNo={false}
                        onOk={(event) => { this.setState({ alertMessage: '' }) }}
                        onCancel={(event) => {}}
                    />
                        {this.showFirmwareUploadButtons()}
                    <Grid item xs={3} />
                </Grid>
                <br />
                <Grid container spacing={1}>
                    <Grid item xs={3} />
                    <Grid item xs={6}>
                        {this.showCustomFirmwareButton()}
                    </Grid>
                    <Grid item xs={3} />
                    <br /><br />
                    <Grid item xs={3} />
                    <Grid item xs={6}>
                        <Button 
                           variant="contained"
                           color="secondary"
                           fullWidth
                           onClick={ () => {
                                shell.openExternal("https://ghostgunner.net/downloads")
                           }} 
                        >
                            Software Update
                        </Button>
                    </Grid>
                    <Grid item xs={3} />
                </Grid>
                <br /><br />
            </React.Fragment>
        );
    }
}

Software.propTypes = {};

export default Software;

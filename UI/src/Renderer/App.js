import * as React from 'react';
import {createMuiTheme, MuiThemeProvider} from '@material-ui/core/styles';
import {ipcRenderer} from 'electron';
import Routes from './Routes';
import {Color, Titlebar} from 'custom-electron-titlebar';
import BottomToolbar from './components/BottomToolbar';
import Alert from './components/Modals/Alert';
import app from 'app';
import './styles/global.scss';
import os from 'os';
import packageJSON from '../../package.json'

const theme = createMuiTheme({
    palette: {
        secondary: {
            main: app.colors.secondary,
        },
        primary: {
            main: '#ffffff',
            dark: '#333333',
        },
        text: {
            primary: app.colors.textPrimary,
            secondary: app.colors.textSecondary,
            disabled: "#444444"
        },
        background: {
            paper: "#000000"
        },
    },
    typography: {
        useNextVariants: true,
        // Use the system font instead of the default Roboto font.
        fontFamily: app.fonts.join(','),
        root: {
            fontWeight: app.font.weight
        },
        body1: {
            fontSize: 14,
            fontWeight: app.font.weight
        },
        h6: {
            fontWeight: app.font.weight
        }
    },
    props: {
        MuiButtonBase: {
            disableRipple: true
        },
        MuiDialog: {
            TransitionProps: {
                enter: false,
                exit: false,
                timeout: 0
            }
        }
    },
    overrides: {
        MuiFormControl: {
            root: {
                backgroundColor: app.colors.form
            },
            marginDense: true,
            fullWidth: true
        },
        MuiDialog: {
            paper: {
                border: app.modal.border,
                color: app.modal.color,
                backgroundImage: `url(${app.modal.background})`
            }
        },
        MuiFab: {
            root: {
                fontFamily: app.fonts.join(','),
                fontWeight: app.font.weight
            }
        },
        MuiCssBaseline: {
            '@global': {
                '*::webkit-scrollbar': {
                    width: '10px',
                    backgroundColor: app.colors.scrollbar
                },
                '@font-weight': app.font.weight
            },
        },
    }
});

export default class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            ghostGunnerStatus: 0,
            millingInProgress: false,
            firmware: null,
            alertMessage: '',
            walkthrough_showing: false,
            showOperationsWindow: false,
            firmwareAvailable: false,
            feedRate: 100
        };

        this.updateStatus = this.updateStatus.bind(this);
        this.closeOperationsWindow = this.closeOperationsWindow.bind(this);
        this.setOperationsWindowOpen = this.setOperationsWindowOpen.bind(this);
        this.checkFirmwareUpdates = this.checkFirmwareUpdates.bind(this);
        this.updateFeedrate = this.updateFeedrate.bind(this);
        this.updateSetting = this.updateSetting.bind(this);

        if (!props.data) {
            document.title = "DDCut V";

            let titlebar = new Titlebar({
                backgroundColor: Color.fromHex('#333333'),
                icon: app.titlebar.icon,
                menu: null,
                titleHorizontalAlignment: "left"
            });
        }
    }

    updateFeedrate(newFeedRate) {
        ipcRenderer.send('Settings::SetFeedRate', newFeedRate);
        this.setState({feedRate: newFeedRate});
    }

    getFirmwareYMD(versionStr) {
        let ymd;
        let regex = /(?<=YMD:).........?.?.?.?/i;
        let result = versionStr.match(regex);

        if (result) {
            ymd = result[0];
            return ymd;
        }

        return "";
    }

    isNewFirmwareAvailable(availableUpdates) {
        if (this.state.firmware && (availableUpdates.length != 0)) {
            let firmwareYMD = this.getFirmwareYMD(availableUpdates[0].version);
            let newFirmwareAvailable = ((availableUpdates.length != 0) && (firmwareYMD != this.state.firmware.ymd));
            return newFirmwareAvailable;
        }
        return false;
    }

    updateFirmwareAvailable(availableUpdates) {
        let newFirmwareAvailable = this.isNewFirmwareAvailable(availableUpdates);
        if (newFirmwareAvailable) {
            this.setState({ firmwareAvailable: true });
            return;
        } else {
            this.setState({ firmwareAvailable: false });
        }
        return;
    }

    checkFirmwareUpdates(iteration) {
        ipcRenderer.removeAllListeners("Firmware::UpdatesAvailable"); 
        ipcRenderer.on("Firmware::UpdatesAvailable", (event, availableUpdates) => {
            this.updateFirmwareAvailable(availableUpdates);
            if (!this.state.firmwareAvailable && (iteration < 10)) {
                setTimeout(() => this.checkFirmwareUpdates(iteration + 1), 2000);
            }
        });
        ipcRenderer.send("Firmware::GetAvailableFirmwareUpdates");

    }

	componentDidMount() {
        ipcRenderer.sendSync('Logs::LogString', 'DDCut Version: ' + packageJSON.version);
		if (ipcRenderer.sendSync("Walkthrough::ShouldDisplay", "Dashboard")) {
            this.setState({
                walkthrough_showing: true
            });
            window.ShowDashboardWalkthrough(app.machine_name, () => {
                this.setState({
                    walkthrough_showing: false
                });
            });
            ipcRenderer.send("Walkthrough::SetShowWalkthrough", "Dashboard", false);
        }

        ipcRenderer.removeAllListeners("DD_UpdateGGStatus");
        ipcRenderer.on("DD_UpdateGGStatus", this.updateStatus);
        let settings = ipcRenderer.sendSync("Settings::GetSettings");
        this.setState({settings: ipcRenderer.sendSync("Settings::GetSettings")});
        this.checkFirmwareUpdates(0);
	}

    componentDidUpdate(prevProps, prevState) {
        if (this.state.firmware != prevState.firmware) {
            if (this.state.firmware) {
                ipcRenderer.sendSync('Logs::LogString', 'GRBL: ' + this.state.firmware.grbl);
                ipcRenderer.sendSync('Logs::LogString', 'FW: ' + this.state.firmware.ymd);
                ipcRenderer.sendSync('Logs::LogString', 'GG: ' + this.state.firmware.gg);
                ipcRenderer.sendSync('Logs::LogString', 'PCB: ' + this.state.firmware.pcb);
            }
        }
    }

    updateSetting(updatedSetting, updatedSettingValue) {
        let settings = this.state.settings;
        settings[updatedSetting] = updatedSettingValue;
        this.setState({settings: settings});
        console.log("updateSetting: " + JSON.stringify(this.state.settings));
    }  

    closeOperationsWindow() {
        this.setState({
            showOperationsWindow: false
        });
    }

    setOperationsWindowOpen() {
        this.setState({
            showOperationsWindow: true
        });
    }

   /* componentDidUpdate() {
        console.log("componentDidUpdate fired!");
        this.checkFirmwareUpdates(9);
    }*/

	componentWillUnmount() {
        ipcRenderer.removeAllListeners("DD_UpdateGGStatus");
    }

    updateStatus(event, newConnectionStatus, newMillingStatus) {
        if (newConnectionStatus != this.state.ghostGunnerStatus || newMillingStatus != this.state.millingInProgress) {
            if (newConnectionStatus == 2 || newConnectionStatus == "refresh") {
                if (newConnectionStatus == "refresh") {
                    newConnectionStatus = this.state.ghostGunnerStatus;
                    newMillingStatus = this.state.millingInProgress;
                }
                newMillingStatus = this.state.millingInProgress;
                const firmware = ipcRenderer.sendSync("Firmware::GetFirmwareVersion");
                this.setState({
                    ghostGunnerStatus: newConnectionStatus,
                    firmware: firmware,
                    millingInProgress: newMillingStatus,
                    alertMessage: ''
                });
            } else {
                let alertMessage = this.state.alertMessage;
                if (newConnectionStatus === -1 && this.state.ghostGunnerStatus != newConnectionStatus) {
                    alertMessage = "DDCut found a Ghost Gunner, but cannot connect to it. On GG3 units, verify the emergency stop button is not engaged"
                        + " (twist the red knob clockwise until it pops out). On all units: verify another program isn't already connected to GG (unplug and reconnect GG's USB cable). Contact support if this problem persists.";
                }

                this.setState({
                    ghostGunnerStatus: newConnectionStatus,
                    firmware: null,
                    millingInProgress: false,
                    alertMessage: alertMessage
                });
            }
        }
        this.checkFirmwareUpdates(9);
    }

    render() {
        if (os.platform != 'darwin') {
            document.getElementsByClassName('window-appicon')[0].style.width = "20px";
            document.getElementsByClassName('window-appicon')[0].style.height = "20px";
            document.getElementsByClassName('window-appicon')[0].style.backgroundSize = "20px 20px";
            document.getElementsByClassName('window-appicon')[0].style.marginLeft = "5px";
        } else {
            document.getElementsByClassName('window-title')[0].style.marginLeft = "55px";
        }

        return (
            <React.Fragment>
                <MuiThemeProvider theme={theme}>
                    <Alert
                        open={this.state.alertMessage.length > 0 && this.state.walkthrough_showing === false}
                        message={this.state.alertMessage}
                        yesNo={false}
                        onOk={(event) => { this.setState({ alertMessage: '' }) }}
                        onCancel={(event) => {}}
                    />
                    <Routes 
                        status={this.state.ghostGunnerStatus} 
                        showOperationsWindow={this.state.showOperationsWindow}   
                        feedRate={this.state.feedRate}
                        updateFeedRate={this.updateFeedrate} 
                        settings={this.state.settings}
                    />
                    <BottomToolbar
                        status={this.state.ghostGunnerStatus}
                        milling={this.state.millingInProgress}
                        firmware={this.state.firmware}
                        firmwareAvailable={this.state.firmwareAvailable}
                        set_walkthrough_showing={(showing) => { this.setState({ walkthrough_showing: showing }); }}
                        closeOperationsWindow={this.closeOperationsWindow}
                        setOperationsWindowOpen={this.setOperationsWindowOpen}
                        checkFirmwareUpdates={this.checkFirmwareUpdates}
                        updateMachineStatus={this.updateStatus}
                        feedRate={this.state.feedRate}
                        updateFeedRate={this.updateFeedrate}
                        updateSetting={this.updateSetting}
                    />
                </MuiThemeProvider>
            </React.Fragment>
        );
    }
}


import React from 'react';
import PropTypes from 'prop-types';
import path from 'path';
import withStyles from '@material-ui/core/styles/withStyles';
import {Button, Dialog, DialogContent, DialogTitle, Grid, IconButton, Tab, Tabs, Tooltip} from '@material-ui/core';
import Operations from './Operations.js';
import ShuttleSettings from './ShuttleSettings.js';
import Alert from '../Alert'
import {ipcRenderer} from 'electron';

const styles = theme => ({
    close: {
        marginTop: theme.spacing(-1),
        marginBottom: theme.spacing(1)
    }
});

class Shuttle extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            open: false,
            realTimeStatus: null,
            manualEntry: "",
            step: 0,
            selectedTab: 0,
            milling: false,
            showResetAlert: false,
            isGG2: this.props.firmware ? !this.props.firmware.grbl.startsWith('1.1') : null
        };

        this.showDialog = this.showDialog.bind(this);
        this.closeDialog = this.closeDialog.bind(this);
        this.setMilling = this.setMilling.bind(this);
        this.getBindingsTab = this.getBindingsTab.bind(this);
    }

    getBindingsTab() {
        if (this.state.isGG2) {
            return (
                <Tooltip title='Jogging disabled on GG2' fontSize='small'>
                    <span>
                        <Tab label="Key Bindings" disabled={ this.state.isGG2 } />
                    </span>
                </Tooltip>
            )
        } else {
            return (<Tab label="Key Bindings" disabled={ this.state.isGG2 } />);
        }
    }

    showDialog() {
        this.setState({
            open: true,
            selectedTab: 0
        });
        this.props.setOperationsWindowOpen();
    }

    closeDialog() {
        if (this.state.milling) {
            this.setState({ showResetAlert: true });
        } else {
            this.setState({
                open: false
            });
            this.props.closeOperationsWindow();
        }
    }

    setMilling(status) {
        this.setState({ milling: status });
    }

    componentDidUpdate(prevProps) {
        if ((this.props.firmware !== prevProps.firmware) && this.props.firmware) {
            this.setState({isGG2: !this.props.firmware.grbl.startsWith('1.1')})
        }
    }

    render() {
        function displaySelected(component) {
            if (component.state.selectedTab == 0) {
                return <Operations closeDialog={component.closeDialog} firmware={component.props.firmware} open={component.state.open} milling={component.state.milling} setMilling={component.setMilling} feedRate={component.props.feedRate} updateFeedRate={component.props.updateFeedRate} />
            } else {
                return <ShuttleSettings closeDialog={component.closeDialog} />
            }
        }

        function getTooltip(component) {
            if (component.props.milling) {
                return 'Disabled while machine is running';
            }

            return "";
        }


        if (this.props.status != 2 || this.props.firmware == null || this.props.firmware.grbl == null) {
            if (this.state.open) {
                setTimeout(this.closeDialog, 0);
            }

            return "";
        }

        const tooltip = getTooltip(this);
        const disabled = tooltip.length > 0;

        return (
            <React.Fragment>

                <Alert
                    open={this.state.showResetAlert}
                    message={"Your machine is currently executing gcode. Closing this window will reset your machine.\n\nAre you sure you want to close this window?"}
                    yesNo={true}
                    onOk={(event) => {
                        ipcRenderer.send("Ghost::ExecuteCommand", '|');
                        this.setState({ showResetAlert: false, open: false });
                        this.props.closeOperationsWindow();
                        }
                    }
                    onCancel={(event) => { this.setState({ showResetAlert: false }) }}
                    title={"Reset Machine?"}
                />

                <Tooltip
                    disableHoverListener={!disabled}
                    disableFocusListener={true}
                    disableTouchListener={true}
                    title={tooltip}
                >
                    <span>
                        <IconButton onClick={this.showDialog} disabled={disabled}>
                            <img src={path.join(__dirname, './static/img/joystick.png')} style={{ width: '20px', height: '20x' }} />
                        </IconButton>
                    </span>
                </Tooltip>

                <Dialog
                    id="shuttle-dialog"
                    open={this.state.open}
                    aria-labelledby="form-dialog-title"
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle id="form-dialog-title">
                        <Grid container>
                            <Grid item xs={1} />
                            <Grid item xs={10}>
                                <center>
                                    Manual Operations
                                </center>
                            </Grid>
                            <Grid item xs={1}>
                                <Button onClick={this.closeDialog}>X</Button>
                            </Grid>
                        </Grid>
                    </DialogTitle>
                    <DialogContent className={'no-scroll'}>
                        <Tabs
                            value={this.state.selectedTab}
                            onChange={(e, value) => { this.setState({ selectedTab: value }); }}
                            indicatorColor="secondary"
                            textColor="primary"
                            centered
                        >
                            <Tab label="Operations" />
                            {this.getBindingsTab()}
                        </Tabs>
                        {displaySelected(this)}
                    </DialogContent>
                </Dialog>
            </React.Fragment>
        );
    }
}

Shuttle.propTypes = {
    milling: PropTypes.bool.isRequired,
    status: PropTypes.number.isRequired,
    firmware: PropTypes.object
};

export default withStyles(styles)(Shuttle);

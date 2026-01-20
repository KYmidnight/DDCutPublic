import React from 'react';
import PropTypes from 'prop-types';
import {ipcRenderer} from 'electron';
import {Button, Dialog, DialogTitle, DialogContent, Grid, Select, TextField, Typography, LinearProgress} from '@material-ui/core';
import Raw from '../../ImageRaw/Raw';
import app from 'app';
import Alert from '../Alert'
import Slider from "@material-ui/core/Slider";
import DialogContentText from "@material-ui/core/DialogContentText";
import DialogActions from "@material-ui/core/DialogActions";
import SVGPath from "../../SVGPath/SVGPath";
import _ from "underscore";
import './Operations.scss'
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import {withStyles} from "@material-ui/core/styles";
import Input from "@material-ui/core/Input";
import InputAdornment from "@material-ui/core/InputAdornment";
import IconButton from "@material-ui/core/IconButton";
import SendIcon from '@material-ui/icons/Send';
import ExecuteIcon from '@material-ui/icons/Autorenew';
import SelectFileIcon from '@material-ui/icons/Attachment';
import Tooltip from "@material-ui/core/Tooltip";
import HelpIcon from '@material-ui/icons/Help';
import RPMDivergence from '../RPMDivergence/RPMDivergence';
import ReportLimitCatchError from './ReportLimitCatchError/ReportLimitCatchError';

const path = require('path');
const DEFAULT_COORDINATE_LIMITS = {
    min: {
        inch: -100,
        mm: -100
    },
    max: {
        inch: 0,
        mm: 0
    }
};

const styles = theme => ({
    millImageStyle: {
        width: '265px',
        height: '135px',
        backgroundImage: `url('./static/img/mill_with_axis.png')`
    },
    millImageStyleGG2: {
        width: '265px',
        height: '135px',
        backgroundImage: `url('./static/img/mill_with_axis_gg2.png')`
    },
    formControl: {
        margin: theme.spacing(1),
        minWidth: 50,
        classKey: 'fullWidth',
        variant: 'outlined'
    }
});

class Operations extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            open: false,
            realTimeStatus: {},
            realTimeStatusDisplay: '',
            manualEntry: "",
            entryHistory: [ ],
            historyIndex: 0,
            isSeekingHistory: false,
            step: {stepNum: 0},
            WCS: 'G54',
            units: 'mm',
            speed: 'Feedrate',
            mode: 'Fixed',
            fixed_distance: {value: 1.0, unit: 'mm'},
            feedRate: this.props.feedRate,
            feedRate2: 100,
            jogRate: 0,
            homingAlertDialogOpen: false,
            pathIdEventKeyMap: {},
            gCodeFilePath: '',
            gCodeFilePathDisplay: '',
            forceShowJoggingTooltip: false,
            forceShowUnitTooltip: false,
            forceShowJoggingTooltipMaxDistance: false,
            joggingTooltipText: '',
            focusedInput: '',
            maxDistanceIsValid: true,
            milling: false,
            millingProgress: -1,
            movementAbsolute: true,
            limitWarningOpen: false,
            isGG2: !this.props.firmware.grbl.startsWith('1.1')
        };

        this.progress = this.progress.bind(this);
        this.getMillingInProgressDisplay = this.getMillingInProgressDisplay.bind(this);
        this.getMillingProgress = this.getMillingProgress.bind(this);
        this.updateRealtimeStatus = this.updateRealtimeStatus.bind(this);
        this.executeCommand = this.executeCommand.bind(this);
        this.uploadGCodeFile = this.uploadGCodeFile.bind(this);
        this.interval = null;
        this.convertToUnits = this.convertToUnits.bind(this);
        this.get_work_pos = this.get_work_pos.bind(this);
        this.get_position = this.get_position.bind(this);
        this.getCommandKey = this.getCommandKey.bind(this);
        this.keydownListener = this.keydownListener.bind(this);
        this.keyupListener = this.keyupListener.bind(this);
        this.onModeChange = this.onModeChange.bind(this);
        this.printLog = this.printLog.bind(this);
        this.onSpeedChange = this.onSpeedChange.bind(this);
        this.onFeedRateChange = this.onFeedRateChange.bind(this);
        this.onJogRateChange = this.onJogRateChange.bind(this);
        this.pathClickStarted = this.pathClickStarted.bind(this);
        this.pathClickEnded = this.pathClickEnded.bind(this);
        this.getPathColorClass = this.getPathColorClass.bind(this);
        this.sendCommand = this.sendCommand.bind(this);
        this.isOutOfBounds = this.isOutOfBounds.bind(this);
        this.tempIsMovementAbsolute = this.tempIsMovementAbsolute.bind(this);
        this.populateCoordinateCache = this.populateCoordinateCache.bind(this);
        this.selectGCodeFile = this.selectGCodeFile.bind(this);
        this.getFixedValue = this.getFixedValue.bind(this);
        this.handleInputHasFocus = this.handleInputHasFocus.bind(this);
        this.handleInputNoLongerHasFocus = this.handleInputNoLongerHasFocus.bind(this);
        this.isMaxDistanceValid = this.isMaxDistanceValid.bind(this);
        this.allowedToJog = this.allowedToJog.bind(this);
        this.focusOnNothing = this.focusOnNothing.bind(this);
        this.onFeedRateNumberChange = this.onFeedRateNumberChange.bind(this);
        this.updateMovementType = this.updateMovementType.bind(this);
        this.disableSoftLimitSetting = this.disableSoftLimitSetting.bind(this);
        this.updateUnits = this.updateUnits.bind(this);
        this.updateUnitsOutput = this.updateUnitsOutput.bind(this);
        this.updateUnitsInput = this.updateUnitsInput.bind(this);
        this.currentJog = null;
        this.manual_entry_focused = false;
        this.manual_entry_ref = React.createRef();
        this.max_distance_ref = React.createRef();
        this.unitRef = React.createRef();
        this.wcsRef = React.createRef();
        this.jogModeRef = React.createRef();
        /*this.homePresetRef = React.createRef();
        this.preset1Ref = React.createRef();
        this.preset2Ref = React.createRef();
        this.preset3Ref = React.createRef();
        this.preset4Ref = React.createRef();*/
        this.commandKeys = {};
        this.eventKeyFrontEndCommandMap = {};
        this.backEndKeyMap = {
            'gantry_left': 'LEFT',
            'gantry_right': 'RIGHT',
            'raise_table': 'UP',
            'lower_table': 'DOWN',
            'retract': 'RETRACT',
            'plunge': 'PLUNGE'
        };
        this.pathIdFrontEndCommandMap = {
            'y_neg_path': 'gantry_left',
            'y_pos_path': 'gantry_right',
            'z_neg_path': 'plunge',
            'z_pos_path': 'retract',
            'x_pos_path': 'lower_table',
            'x_neg_path': 'raise_table'
        };
        this.coordinateColorThresholdCache = {};
    }

    disableSoftLimitSetting() {
        ipcRenderer.send(
            "Settings::UpdateSettings",
            this.state.settings.pause,
            this.state.settings.enableSlider,
            this.state.settings.maxFeedRate,
            true
        );
        let settings = this.state.settings;
        settings.disableLimitCatch = true;
        this.setState({settings: settings});
    }

    handleInputHasFocus(focusName) {
        this.setState({focusedInput: focusName});
    }

    handleInputNoLongerHasFocus() {
        this.setState({focusedInput: ''});
    }

    updateMovementType(event, command) {
        let movementType;

        const regex = /G9[0-1]/i;
        if (command.length > 0) {
            movementType = command[0].VALUE.match(regex);
        }
        if (movementType && command[1].VALUE === "ok") {
            this.setState({
                movementAbsolute: movementType[0].toLowerCase() === "g90" ? true : false
            });
        }
    }

    refreshShuttleKeys() {
        ipcRenderer.once(
            "Ghost::GetShuttleKeysResponse",
            (event, commandKeys) => {
                this.commandKeys = commandKeys;

                // populate eventKeyFrontEndCommandMap
                _.each(
                    this.commandKeys,
                    (commandKey, commandValue) =>
                        (this.eventKeyFrontEndCommandMap[
                            commandKey.toLowerCase()
                        ] = commandValue)
                );

                // this is a test
                // populate pathIdEventKeyMap
                this.setState({
                    pathIdEventKeyMap: {
                        y_neg_path: this.getCommandKey("gantry_left"),
                        y_pos_path: this.getCommandKey("gantry_right"),
                        z_neg_path: this.getCommandKey("plunge"),
                        z_pos_path: this.getCommandKey("retract"),
                        x_pos_path: this.getCommandKey("lower_table"),
                        x_neg_path: this.getCommandKey("raise_table"),
                    },
                });
            }
        );
        ipcRenderer.send("Ghost::GetShuttleKeys");
    }

    fetchAsyncData() {
				this.refreshShuttleKeys();

        ipcRenderer.once('Settings::GetSettingsResponse', (event, settings) => {
            this.setState({settings: settings});
        });
        ipcRenderer.send('Settings::GetSettings');

        ipcRenderer.once('Ghost::GetMachineConfigResponse', (event, config) => {
            let limits = this.state.limits;

            if (config.soft_limits != null) {
                limits = JSON.parse(config.soft_limits);
            }

            this.setState({
                limits: limits
            });
        });
        ipcRenderer.send('Ghost::GetMachineConfig');
    }

    progress() {
        setTimeout(this.progress, 100);
    };

    getMillingProgress() {
        while (this.props.open) {
            ipcRenderer.send("Jobs::GetProgress", 0)
            ipcRenderer.once('Jobs::GetProgressResponse', (event, updatedProgress) => {
                if (updatedProgress.milling) {
                    this.setState({
                        millingProgress: updatedProgress.progress.percentage,
                    });
                    this.props.setMilling(true);
                } else {
                    this.props.setMilling(false);
                }
            });
            setTimeout(this.getMillingProgress, 100);
            return
        }
    }

    getMillingInProgressDisplay() {
        if (this.props.milling) {
            return (
                <React.Fragment>
                    <div>
                        <Typography display="inline" variant='h4' color="secondary">{this.state.millingProgress}%</Typography><RPMDivergence indicatorHeight='30px' />
                        <LinearProgress variant="determinate" color="secondary" style={{ height: '15px' }} value={this.state.millingProgress} />
                    </div>
                </React.Fragment>
            );
        }
        return;
    }

    printLog(event, arg) {
        console.log(JSON.stringify(arg));
    }

    componentDidMount() {
        this.fetchAsyncData.call(this);

        window.addEventListener('keydown', this.keydownListener, true);
        window.addEventListener('keyup', this.keyupListener, true);

        this.interval = setInterval(() => { 
            ipcRenderer.send('Ghost::GetStatus');
        }, 200);

        ipcRenderer.removeAllListeners("DD_UpdateRealtimeStatus");
        ipcRenderer.on("DD_UpdateRealtimeStatus", this.updateRealtimeStatus);
        ipcRenderer.sendSync("Ghost::SetManualEntryMode", true);

        this.getMillingProgress();
        ipcRenderer.removeListener("Jobs::ReadWrites", this.updateMovementType);
        ipcRenderer.on("Jobs::ReadWrites", this.updateMovementType);
        this.setState({feedRate2: this.state.feedRate});
    }

    componentWillUnmount() {
        clearInterval(this.interval);

        window.removeEventListener('keydown', this.keydownListener, true);
        window.removeEventListener('keyup', this.keyupListener, true);
        ipcRenderer.removeAllListeners("DD_UpdateRealtimeStatus");
        ipcRenderer.sendSync("Ghost::SetManualEntryMode", false);
    }

    componentDidUpdate(prevProps, prevState) {
        if (
            !_.isEqual(this.state.units, prevState.units) ||
            !_.isEqual(this.state.limits, prevState.limits) ||
            !_.isEqual(this.state.fixed_distance, prevState.fixed_distance) ||
            !_.isEqual(this.state.mode, prevState.mode)
        ) {
            this.coordinateColorThresholdCache = {};
        }
    }

    convertToUnits(value, input_unit, output_unit) {
        if (input_unit === output_unit) {
            return value;
        }

        let sanitizedValue = (this.isMaxDistanceValid(value) ? value : 0);
        const isMM = input_unit === 'mm';
        if (isMM) {
            sanitizedValue =  sanitizedValue / 25.4;
        } else {
            sanitizedValue = sanitizedValue * 25.4;
        }

        return sanitizedValue.toFixed(isMM ? 3 : 4);
    }

    updateRealtimeStatus(event, status) {
        if (!this.firstRealTimeStatusReceived && this.state.realTimeStatus && this.state.realTimeStatus.state) {
            this.firstRealTimeStatusReceived = true;

            if (this.state.realTimeStatus.state.toLowerCase() == 'alarm') {
                this.setState({homingAlertDialogOpen: true});
            }
        }

        try {
            const parsed = JSON.parse(status);
            if (parsed.error == null) {
                let status = parsed.status;
                let wcs = this.state.WCS;
                if (status.work_coordinates != null) {
                    wcs = status.work_coordinates.wcs;
                }

                this.setState({
                    realTimeStatus: status,
                    realTimeStatusDisplay: this.getStatusDisplay(status),
                    WCS: wcs,
                    units: status.parserUnits
                });
            }
        } catch (e) {
            console.log(e);
        }
    }

    focusOnNothing() {
        setTimeout(() => {
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
								this.setState({focusedInput: ''});
            }
        }, 0);
    }

    getAxisValue(axis, value) {
        const regex = new RegExp(axis + "-?[0-9]+\\.?[0-9]*", "i");
        const movementString = value.match(regex);
        if (movementString) {
            return Number(movementString[0].slice(1));
        } else {
            return 0;
        }
    }

    convertToAbsolute(axis, value) {
        return value + Number(this.get_position(axis));
    }

    tempIsMovementAbsolute(value) {
        let movementType;

        const regex = /G9[0-1]/i;
        movementType = value.match(regex);
        
        if (movementType) {
            return movementType[0].toLowerCase() === "g90" ? true : false
        }
    }

    containsTypeAndDir(value) {
        const regex1 = /G9[0-1]/i;
        const regex2 = /(x|y|z)-?[0-9]+/i

        let directionChange = value.match(regex1);
        let axisChange = value.match(regex2);

        if (directionChange && axisChange) {
            return true;
        } else {
            return false;
        }
    }

    isOutOfBounds(value) {
        let x, y, z;
        let xLimit, yLimit, zLimit;
        let useTempMovementType;
        let movementTypeAbsolute;
        
        if (this.props.firmware != null && this.props.firmware.grbl != null) {
            if (this.props.firmware.grbl.startsWith('1.1')) {
                //GG3
                xLimit = -86.5;
                yLimit = -241.5;
                zLimit = -78.5;
            } else {
                //GG2
                xLimit = -75;
                yLimit = -180;
                zLimit = -60.5;
            }
        }


        useTempMovementType = this.containsTypeAndDir(value);

        if (useTempMovementType) {
            movementTypeAbsolute = this.tempIsMovementAbsolute(value);
        } else {
            movementTypeAbsolute = this.state.movementAbsolute;
        }


        x = this.getAxisValue("x", value);
        y = this.getAxisValue("y", value);
        z = this.getAxisValue("z", value);
        
        if (!movementTypeAbsolute) {
            x = this.convertToAbsolute("x", x);
            y = this.convertToAbsolute("y", y);
            z = this.convertToAbsolute("z", z);
        }

        if ((x > 0 || x < xLimit) || (y > 0 || y < yLimit) || (z > 0 || z < zLimit)) {
            return true;
        } else {
            return false;
        }
    }

    sendCommand() {
        let isOutOfBounds = false;
        isOutOfBounds = this.isOutOfBounds(this.state.manualEntry);
        if (isOutOfBounds) {
            this.setState({limitWarningOpen: true});
        } else {
            this.executeCommand();
        }
    }

    executeCommand() {
        this.manual_entry_ref.current.focus();
        const command = this.state.manualEntry;

        this.updateUnits(command);
        let history = this.state.entryHistory.slice();
        let searchIndex = history.indexOf(command);
        if (searchIndex !== -1) { history.splice(searchIndex, 1); }
        history.push(command);
        const buffSize = 15;
        if (history.length === buffSize) { history.splice(1, 1); }  // Remove earliest except for empty string at front

        // Hack to clear raw output
        // const nextStepNum = this.state.step.stepNum + 1;
        this.setState({
            manualEntry: '',
            entryHistory: history,
            historyIndex: history.length,
            isSeekingHistory: false
        });

        if (command.trim().toLowerCase() === '$h') {
            this.sendHome();
        } else if (command.trim() === '|') {
            this.setState({ movementAbsolute: true });
            ipcRenderer.send("Ghost::ExecuteCommand", command);
        } else {
            ipcRenderer.send("Ghost::ExecuteCommand", command);
        }

        this.fetchAsyncData.call(this);
    }

    getCommandKey(value) {
        if (this.commandKeys == null) {
            return '';
        } else {
            return this.commandKeys[value];
        }
    }

    getFrontEndCommand(eventKey) {
        let sanitizedEventKey = (eventKey || '').toLowerCase();
        let frontEndCommand = this.eventKeyFrontEndCommandMap[sanitizedEventKey];

        //We hard key these but allow the jog commands to be bound to other keys as well
        //These are hardcoded because now that NumLock is used to quick-jump to max_distance
        //it causes my preferred keybindings (the number pad) to inadvertently switch between
        //the bound keys (4, 8, etc.) and the arrow keys. This allows me to keep my preferred keybindings
        if(eventKey == 'ArrowLeft') {
          frontEndCommand = 'gantry_left';
        }
        else if(eventKey == 'ArrowRight') {
          frontEndCommand = 'gantry_right';
        }
        else if(eventKey == 'ArrowUp') {
          frontEndCommand = 'raise_table';
        }
        else if(eventKey == 'ArrowDown') {
          frontEndCommand = 'lower_table';
        }

        if (!frontEndCommand) {
            throw new Error(`Cannot determine frontEndCommand from eventKey: ${sanitizedEventKey}`);
        }

        return frontEndCommand;
    }

    getBackendCommand(frontEndCommand) {
        let sanitizedFrontEndCommand = (frontEndCommand || '').toLowerCase();

        let backendCommand = this.backEndKeyMap[sanitizedFrontEndCommand];

        if (!backendCommand) {
            throw new Error(`Cannot determine backendCommand from frontEndCommand: ${sanitizedFrontEndCommand}`);
        }

        return backendCommand
    }

    jogStart(frontEndCommand) {
        if (this.currentJog != null || !this.allowedToJog()) {
            return;
        }

        let backendCommand = this.getBackendCommand(frontEndCommand);
        this.currentJog = frontEndCommand;

        let value = this.convertToUnits(this.state.fixed_distance.value, this.state.fixed_distance.unit, 'mm')

        ipcRenderer.send(
            'Ghost::Jog',
            backendCommand,
            this.state.mode === 'Continuous',
            value
        );
        this.setState({isHome: false});
    }

    jogEnd() {
        if (this.jogInterval != null) {
            clearInterval(this.jogInterval);
            this.jogInterval = null;
        }

        if (this.currentJog != null) {
            ipcRenderer.sendSync("Ghost::CancelJog");
            this.currentJog = null;
        }
    }

		keydownListener(event) {
        let eventKey = event.key;
        //console.log(eventKey);

        if (this.state.focusedInput) {
          if(
            eventKey == this.getCommandKey('escape_textbox') ||
            (
              this.state.focusedInput == 'max_distance' &&
              eventKey == 'Enter'
            )
          ) {
            this.focusOnNothing();
            return;
          }

          if (this.state.focusedInput == 'manual_entry') {
              if (eventKey == 'Enter') {
                  this.state.settings.disableLimitCatch ? this.executeCommand() : this.sendCommand();
              }
              else if (eventKey === 'ArrowDown' && this.state.isSeekingHistory) {
                  let index = this.state.historyIndex + 1;
                  let command = '';
                  if (index < this.state.entryHistory.length) {
                      command = this.state.entryHistory[index];
                  } else {
                      index = this.state.entryHistory.length;
                  }
                  this.setState({
                      manualEntry: command,
                      historyIndex: index,
                      isSeekingHistory: true
                  });
              }
              else if (eventKey === 'ArrowUp') {
                  let index = this.state.historyIndex - 1;
                  if (index < 0) { index = 0; }
                  this.setState({
                      manualEntry: this.state.entryHistory[index],
                      historyIndex: index,
                      isSeekingHistory: true
                  });
              }

              return;
          }

          return;
        }
        else if(!this.state.openShuttleSettings) {
          if(eventKey == this.getCommandKey('escape_textbox')) {
            //Putting this condition here so that the escape button doesn't fall through and throw an error message
            return;
          }
          else if(eventKey == this.getCommandKey('focus_manual_entry')) {
            this.manual_entry_ref.current.focus();
            this.handleInputHasFocus('manual_entry');
            return;
          }
          else if(eventKey == this.getCommandKey('focus_max_distance')) {
            this.max_distance_ref.current.focus();
            this.handleInputHasFocus('max_distance');
            return;
          }
          else if(eventKey == this.getCommandKey('switch_units')) {
            if(this.state.units == 'mm') {
              this.sendUnitsInputChange('inch');
            }
            else if(this.state.units == 'inch') {
              this.sendUnitsInputChange('mm');
            }
            return;
          }
          else if(eventKey == this.getCommandKey('switch_jog_mode')) {
            if(this.state.mode == 'Continuous') {
              this.setState({mode: 'Fixed'});
            }
            else if(this.state.mode == 'Fixed') {
              this.setState({mode: 'Continuous'});
            }
            return;
          }
          else if(eventKey == this.getCommandKey('increase_units')) {
            this.setState({fixed_distance: { 
              value: this.state.fixed_distance.value * 10, 
              unit: this.state.units 
            }});
            return;
          }
          else if(eventKey == this.getCommandKey('decrease_units')) {
            this.setState({fixed_distance: { 
              value: this.state.fixed_distance.value / 10, 
              unit: this.state.units 
            }});
            return;
          }
          /*else if(eventKey == this.getCommandKey('home_preset')) {
            this.homePresetRef.current.handleClick();
            return;
          }
          else if(eventKey == this.getCommandKey('preset_1')) {
            this.preset1Ref.current.handleClick();
            return;
          }
          else if(eventKey == this.getCommandKey('preset_2')) {
            this.preset2Ref.current.handleClick();
            return;
          }
          else if(eventKey == this.getCommandKey('preset_3')) {
            this.preset3Ref.current.handleClick();
            return;
          }
          else if(eventKey == this.getCommandKey('preset_4')) {
            this.preset4Ref.current.handleClick();
            return;
          }*/
        }

        try {
            if(!this.state.openShuttleSettings) {
              let frontEndCommand = this.getFrontEndCommand(eventKey);
              this.jogStart(frontEndCommand);
            }
        } catch (e) {
            // do nothing, not all keys have bindings
            console.log(e);
        }
    }

    keyupListener(event) {
        if (this.currentJog != null && (this.currentJog === this.getFrontEndCommand(event.key))) {
            this.jogEnd();
        }
    }

    getEventKeyFromPathId(pathId) {
        return this.state.pathIdEventKeyMap[pathId] || '';
    }

    get_work_pos(axis) {
        if (this.state.realTimeStatus && this.state.realTimeStatus.work_coordinates) {
            const value = this.state.realTimeStatus.work_coordinates.work_pos[axis];
            return value[this.state.units].toFixed(this.getFixedValue());
        }

        return '';
    }

    getFixedValue() {
        return (this.state.units === 'mm') ? 3 : 4;
    }

    get_position(axis) {
        if (this.state.realTimeStatus && this.state.realTimeStatus.machine_pos) {
            const value = this.state.realTimeStatus.machine_pos[axis];
            return value[this.state.units].toFixed(this.getFixedValue());
        }

        return '';
    }

    getStatusDisplay(status) {
        let realTimeStatusDisplay = '';

        if (status && status.state) {
            realTimeStatusDisplay = status.state;
        }

        return realTimeStatusDisplay;
    }

    onJogRateChange(event, jogRate) {
        this.setState({jogRate: jogRate});
    }

    onFeedRateChange(event, feedRate) {
        this.setState({feedRate: feedRate, feedRate2: feedRate});
        this.focusOnNothing();
    }

    onFeedRateNumberChange(event, newFeedRate) {
        if (newFeedRate < 30) {
            newFeedRate = 30;
        } else if (newFeedRate > this.state.settings.maxFeedRate) {
            newFeedRate = this.state.settings.maxFeedRate;
        }
        this.onFeedRateChange(event, newFeedRate);
        this.props.updateFeedRate(newFeedRate);
    }

    onModeChange(e) {
        this.setState({mode: e.target.value});
        this.jogModeRef.current.blur();
        this.focusOnNothing();
    }

    onSpeedChange(e) {
        this.setState({speed: e.target.value});
    }

    pathClickStarted(e) {
        let pathId = e.target.id;

        let frontEndCommand = this.pathIdFrontEndCommandMap[pathId];
        if (frontEndCommand) {
            this.jogStart(frontEndCommand);
        }
    }

    pathClickEnded() {
        this.jogEnd();
    }

    isValueInRange(value, pointA, pointB) {
        return (pointA <= value && pointB >= value) || (pointB <= value && pointA >= value);
    }

    getPathColorClass(coordinate, isMax) {
        const units = this.state.units;
        const value = this.get_position(coordinate, units);

        if (this.state.isHome) {
            return '';
        }


        this.populateCoordinateCache(coordinate, units);
        const coordinateKey = isMax ? 'max' : 'min';

        if (this.coordinateColorThresholdCache == null ||
            this.coordinateColorThresholdCache[coordinate] == null ||
            this.coordinateColorThresholdCache[coordinate][coordinateKey] == null
        ) {
            return '';
        }

        const A = this.coordinateColorThresholdCache[coordinate][coordinateKey]['A'];
        const BR = this.coordinateColorThresholdCache[coordinate][coordinateKey]['BR'];
        const BY = this.coordinateColorThresholdCache[coordinate][coordinateKey]['BY'];

        // the following ||'s are to handle the edge case when the machine coordinate surpasses the provided max or min respectively
        if (this.isValueInRange(value, A, BR, isMax) || (isMax && value > A) || (!isMax && value < A)) {
            return 'red';
        } else if (this.isValueInRange(value, A, BY, isMax)) {
            return 'yellow';
        }

        return '';
    }

    populateCoordinateCache(coordinate, units) {
        if (!this.coordinateColorThresholdCache[coordinate]) {
            let coordinateLimits;

            if (this.state.limits && this.state.limits[coordinate]) {
                coordinateLimits = this.state.limits[coordinate];
            } else {
                coordinateLimits = DEFAULT_COORDINATE_LIMITS;
            }

            let redThreshold;
            let yellowThreshold;
            if (this.state.mode === 'Continuous') {
                redThreshold = this.convertToUnits(2, 'mm', units);
                yellowThreshold = this.convertToUnits(10, 'mm', units);
            } else {
                const fixedDistance = this.getSafeFloat(this.state.fixed_distance.value);
                redThreshold = fixedDistance;
                yellowThreshold = this.safeMultiply(fixedDistance, 3);
            }

            if (this.coordinateColorThresholdCache == null) {
                this.coordinateColorThresholdCache = {};
            }

            this.coordinateColorThresholdCache[coordinate] = {
                'min': {},
                'max': {}
            };

            const minA = this.getSafeFloat(coordinateLimits.min[units]);
            this.coordinateColorThresholdCache[coordinate]['min']['A'] = minA;
            this.coordinateColorThresholdCache[coordinate]['min']['BR'] = this.safeAdd(minA, redThreshold);
            this.coordinateColorThresholdCache[coordinate]['min']['BY'] = this.safeAdd(minA, yellowThreshold);

            const maxA = this.getSafeFloat(coordinateLimits.max[units]);
            this.coordinateColorThresholdCache[coordinate]['max']['A'] = maxA;
            this.coordinateColorThresholdCache[coordinate]['max']['BR'] = this.safeSubtract(maxA, redThreshold);
            this.coordinateColorThresholdCache[coordinate]['max']['BY'] = this.safeSubtract(maxA, yellowThreshold);
        }
    }

    getSafeFloat(value) {
        let sanitizedValue = value;
        if (typeof sanitizedValue !== 'number') {
            sanitizedValue = parseFloat(sanitizedValue.trim());
        }

        return sanitizedValue;
    }

    safeAdd(a, b) {
        return this.getSafeFloat(a) + this.getSafeFloat(b);
    }

    safeSubtract(a, b) {
        return this.getSafeFloat(a) - this.getSafeFloat(b);
    }

    safeMultiply(a, b) {
        return this.getSafeFloat(a) * this.getSafeFloat(b);
    }

    sendHome() {
        this.setState({
                isHome: true
            }
        );
        ipcRenderer.sendSync("Ghost::ExecuteCommand", '$H');
    }

    selectGCodeFile() {
        ipcRenderer.once('GCodeFileSelected', (event, gCodeFilePath) => {
            let gCodeFilePathDisplay = gCodeFilePath;

            if (gCodeFilePathDisplay.length > 60) {
                gCodeFilePathDisplay = gCodeFilePathDisplay.substr(gCodeFilePathDisplay.length - 60);
                gCodeFilePathDisplay = `...${gCodeFilePathDisplay.substr(gCodeFilePathDisplay.indexOf(path.sep))}`;
            }

            this.setState({gCodeFilePath: gCodeFilePath, gCodeFilePathDisplay: gCodeFilePathDisplay});
        });
        ipcRenderer.send('File::OpenGCodeFileDialog');
    }

    uploadGCodeFile() {
        if (!this.state.gCodeFilePath) {
            return;
        }

        ipcRenderer.once('Ghost::UploadGCodeFileResponse', () => {
            this.setState({gCodeFilePath: '', gCodeFilePathDisplay: ''});
        });
        ipcRenderer.send('Ghost::UploadGCodeFile', this.state.gCodeFilePath);
    }

    isMaxDistanceValid(value) {
        if (isNaN(value)) {
            return false
        }

        const isEmpty = value === null || value === undefined || (typeof (value) === 'string' && value.trim() === '');

        if (isEmpty) {
            return false;
        }

        const units = this.state.units;
        const isMM = units === 'mm';
        const min = isMM ? 0.0025 : 0.0001;
        const max = isMM ? 1000 : 40;

        const floatValue = parseFloat(value);

        if (floatValue < min || floatValue > max) {
            return false;
        }

        return true;
    }

    allowedToJog() {
        return this.state.maxDistanceIsValid || this.state.mode === 'Continuous';
    }

    sendUnitsInputChange(units) {
        if (units == "mm") {
            ipcRenderer.send("Ghost::ExecuteCommand", "G21");
        } else if (units == "inch") {
            ipcRenderer.send("Ghost::ExecuteCommand", "G20");
        }
    }

    updateUnits(command) {
        this.updateUnitsOutput(command);
        this.updateUnitsInput(command);
    }

    updateUnitsOutput(command) {
        if (command === "$13=0") {
            this.setState({units: "mm"});
            this.sendUnitsInputChange("mm");
        } else if (command === "$13=1") {
            this.setState({units: "inch"});
            this.sendUnitsInputChange("inch");
        }
    }

    updateUnitsInput(command) {
        var match = command.match(/G(20|21)/i);
        if (match) {
            if (match[0] === "G20") {
                this.setState({units: "inch"});
            }
            else if (match[0] === "G21") {
                this.setState({units: "mm"});
            }
        }
    }

    render() {
        function getFeedRateGrid(component) {
            if (component.state.speed !== 'Feedrate') {
                return '';
            }

            //let feedRate = component.state.feedRate || 100;
            let settings = component.state.settings || {};
            let disabled = !settings.enable_slider;
            let maxFeedRate = settings.maxFeedRate;

            return (
                <React.Fragment>
                    <Grid className="slider-container" item xs={5}>
                        <Slider
                            className={component.props.classes.slider}
                            value={component.state.feedRate}
                            step={2}
                            min={30}
                            disabled={disabled}
                            max={maxFeedRate}
                            aria-labelledby="label"
                            onChange={component.onFeedRateChange}
                            onChangeCommitted={(event, value) => { component.props.updateFeedRate(value); }}
                        />
                    </Grid>
                    <Grid item xs={2}>
                        <FormControl className={component.props.classes.formControl} fullWidth>
                            <InputLabel id="feed-rate-input-label">%</InputLabel>
                            <Input
                                className="text-box feed-rate"
                                id="feed-rate-input-label"
                                value={component.state.feedRate2}
                                min={30}
                                max={maxFeedRate}
                                style={{color: app.modal.color}}
                                inputProps={{style: {color: app.modal.color}}}
                                onChange={ (event) => component.setState({feedRate2: event.target.value})}
                                onBlur={ (event) => {component.onFeedRateNumberChange({}, parseInt(event.target.value))}}
                                onKeyDown={ (event) => { event.key === 'Enter' ? component.onFeedRateNumberChange({}, parseInt(event.target.value)) : "" }}
                                fullWidth
                            />
                        </FormControl>
                    </Grid>
                </React.Fragment>
            );
        }

        function handleMaxDistanceChange(component, e) {
            const value = e.currentTarget.value;
            const isValid = component.isMaxDistanceValid(value);

            component.setState({
                maxDistanceIsValid: isValid,
                fixed_distance: { value: value, unit: component.state.units }
            });
        }

        function getJoggingMode(component) {
            let textField = '';

            const isFixedMode = component.state.mode === 'Fixed';

            if (isFixedMode) {
                const distance = component.convertToUnits(
                    component.state.fixed_distance.value,
                    component.state.fixed_distance.unit,
                    component.state.units
                );

                textField = (
                    <Tooltip 
                        open={component.state.forceShowJoggingTooltipMaxDistance} 
                        placement="top-end" 
                        title={component.state.joggingTooltipMaxDistanceText} 
                    >
                        <FormControl 
                            className={component.props.classes.formControl} 
                            fullWidth 
                            error={!component.state.maxDistanceIsValid}
                            onMouseEnter={(ignored) => {if (component.state.isGG2) { component.setState({forceShowJoggingTooltipMaxDistance: true, joggingTooltipMaxDistanceText: "Jogging disabled on GG2"})}}}
                            onMouseLeave={(ignored) => component.setState({forceShowJoggingTooltipMaxDistance: false})} 
                        >
                            <InputLabel id="units-input-label" disableAnimation={true} shrink={true}>Max Distance</InputLabel>
                            <Input
                                className="text-box coordinate-unit"
                                id="units-input-label"
                                value={distance}
                                onChange={e => {
                                    handleMaxDistanceChange(component, e);
                                }}
                                fullWidth
                                disabled={component.state.isGG2}
                                disableUnderline
																inputRef={component.max_distance_ref}
																onFocus={() => component.handleInputHasFocus('max_distance')}
                                onBlur={() => component.handleInputNoLongerHasFocus()}
                            />
                        </FormControl>
                    </Tooltip>
                );
            }

            return (
                <React.Fragment>
                    <Grid container spacing={1}>
                        <Grid item xs={8}>
                            <Tooltip
                                open={component.state.forceShowJoggingTooltip}
                                placement="top-end"
                                title={component.state.joggingTooltipText}   
                            >
                                <FormControl className={component.props.classes.formControl} 
                                    fullWidth
                                    onMouseEnter={(ignored) => {if (component.state.isGG2) { component.setState({forceShowJoggingTooltip: true, joggingTooltipText: 'Jogging disabled on GG2'})}}}
                                    onMouseLeave={(ignored) => component.setState({forceShowJoggingTooltip: false})} 
                                >
                                    <InputLabel id="jog-mode-select-label">Jog Mode</InputLabel>
                                    <Select
                                        id="jog-mode-select"
                                        className={component.props.classes.select}
                                        labelId="jog-mode-select-label"
                                        ref={component.jogModeRef}
                                        disableUnderline
                                        disabled={component.state.isGG2}
                                        value={component.state.mode}
                                        onChange={component.onModeChange}
                                        onBlurCapture={(ignored) => component.setState({forceShowJoggingTooltip: false})}
                                    >
                                        <MenuItem
                                            value="Continuous"
                                            onMouseEnter={(ignored) => component.setState({forceShowJoggingTooltip: true, joggingTooltipText: 'In this mode, GG will move until the arrow click/keystroke ends, or until the axis reaches its end-of-travel.'})}
                                            onMouseLeave={(ignored) => component.setState({forceShowJoggingTooltip: false})}
                                            onClick={(ignored) => {
                                                component.jogModeRef.current.blur();
                                                component.focusOnNothing();
                                            }}
                                        >Continuous Motion</MenuItem>
                                        <MenuItem
                                            value="Fixed"
                                            onMouseEnter={(ignored) => component.setState({forceShowJoggingTooltip: true, joggingTooltipText: 'In this mode, GG will move up to the maximum specified distance per activation (arrow click, keystroke). Motion stops immediately if the keystroke/click ends prior to hitting the maximum specified distance.'})}
                                            onMouseLeave={(ignored) => component.setState({forceShowJoggingTooltip: false})}
                                            onClick={(ignored) => {
                                                component.jogModeRef.current.blur();
                                                component.focusOnNothing();
                                            }}
                                        >Travel Distance Limited (per click)</MenuItem>
                                    </Select>
                                </FormControl>
                            </Tooltip>
                        </Grid>
                        <Grid item xs={4}>
                            {textField}
                        </Grid>
                    </Grid>
                </React.Fragment>
            )
        }

        function getHomingAlertDialog(component) {
            let handleClose = () => {
                component.setState({homingAlertDialogOpen: false});
            };

            let sendHome = () => {
                handleClose();
                component.sendHome();
            };

            return (
                <React.Fragment>
                    <Dialog
                        open={component.state.homingAlertDialogOpen}
                        onClose={handleClose}
                        aria-labelledby="homing-alert-dialog-title"
                        aria-describedby="homing-alert-dialog-description"
                    >
                        <DialogContent>
                            <DialogContentText>We recommend that you home your machine before
                                jogging.
                            </DialogContentText>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={handleClose} color="primary">Continue Without Homing</Button>
                            <Button onClick={(e) => {e.preventDefault(); sendHome()}} color="primary" autoFocus>Home Now</Button>
                        </DialogActions>
                    </Dialog>
                </React.Fragment>
            );
        }

        function getUnitsSelect(component) {
            return (
                <Tooltip
                    open={component.state.forceShowUnitTooltip}
                    placement="top-end"
                    title="Defines the units for 'Max Distance,' Machine Coordinates,' & 'Work Coordinates'. G-code manually typed into 'Manual Entry' ignores this drop-down; the parser state ('$G') is used instead."
                    onMouseEnter={(ignored) => component.setState({forceShowUnitTooltip: true})}
                    onMouseLeave={(ignored) => component.setState({forceShowUnitTooltip: false})}
                >
                    <FormControl
                        className={component.props.classes.formControl}
                        fullWidth
                        onMouseEnter={(ignored) => component.setState({forceShowUnitTooltip: true})}
                        onMouseLeave={(ignored) => component.setState({forceShowUnitTooltip: false})}>
                        <InputLabel
                            id="units-select-label"
                            onMouseEnter={(ignored) => component.setState({forceShowUnitTooltip: true})}
                            onMouseLeave={(ignored) => component.setState({forceShowUnitTooltip: false})}
                        >Units</InputLabel>
                        <Select
                            className={component.props.classes.select}
                            labelId="units-select-label"
                            ref={component.unitRef}
                            disableUnderline
                            value={component.state.units}
                            onChange={(e) => {
                                component.sendUnitsInputChange(e.target.value);
                                component.setState({units: e.target.value});
                                component.fetchAsyncData.call(component);
                                component.unitRef.current.blur();
                                component.focusOnNothing();
                            }}
                            onMouseEnter={(ignored) => component.setState({forceShowUnitTooltip: true})}
                            onMouseLeave={(ignored) => component.setState({forceShowUnitTooltip: false})}
                            onBlurCapture={(ignored) => component.setState({forceShowUnitTooltip: false})}
                            autoWidth
                        >
                            <MenuItem value="mm"
                                      onMouseEnter={(ignored) => component.setState({forceShowUnitTooltip: true})}
                                      onMouseLeave={(ignored) => component.setState({forceShowUnitTooltip: false})}
                                      onClick={(ignored) => {
                                          component.unitRef.current.blur();
                                          component.focusOnNothing();
                                      }}
                            >mm</MenuItem>
                            <MenuItem value="inch"
                                      onMouseEnter={(ignored) => component.setState({forceShowUnitTooltip: true})}
                                      onMouseLeave={(ignored) => component.setState({forceShowUnitTooltip: false})}
                                      onClick={(ignored) => {
                                          component.unitRef.current.blur();
                                          component.focusOnNothing();
                                      }}
                            >inch</MenuItem>
                        </Select>
                    </FormControl>
                </Tooltip>
            );
        }

        function getWCSSelect(component) {
            return (
                <FormControl className={component.props.classes.formControl} fullWidth>
                    <InputLabel id="wcs-select-label">WCS</InputLabel>
                    <Select
                        className={component.props.classes.select}
                        labelId="wcs-select-label"
                        ref={component.wcsRef}
                        disableUnderline
                        value={component.state.WCS}
                        onChange={(e) => {
                            component.setState({WCS: e.target.value});
                            ipcRenderer.send("Ghost::ExecuteCommand", e.target.value);
                            component.fetchAsyncData.call(component);
                            component.wcsRef.current.blur();
                            component.focusOnNothing();
                        }}
                        autoWidth
                    >
                        <MenuItem
                            value="G54"
                            onClick={(ignored) => {
                                          component.wcsRef.current.blur();
                                          component.focusOnNothing();
                                      }}
                        >G54</MenuItem>
                        <MenuItem
                            value="G55"
                            onClick={(ignored) => {
                                          component.wcsRef.current.blur();
                                          component.focusOnNothing();
                                      }}
                        >G55</MenuItem>
                        <MenuItem
                            value="G56"
                            onClick={(ignored) => {
                                          component.wcsRef.current.blur();
                                          component.focusOnNothing();
                                      }}
                        >G56</MenuItem>
                        <MenuItem
                            value="G57"
                            onClick={(ignored) => {
                                          component.wcsRef.current.blur();
                                          component.focusOnNothing();
                                      }}
                        >G57</MenuItem>
                        <MenuItem
                            value="G58"
                            onClick={(ignored) => {
                                          component.wcsRef.current.blur();
                                          component.focusOnNothing();
                                      }}
                        >G58</MenuItem>
                        <MenuItem
                            value="G59"
                            onClick={(ignored) => {
                                          component.wcsRef.current.blur();
                                          component.focusOnNothing();
                                      }}
                        >G59</MenuItem>
                    </Select>
                </FormControl>
            );
        }

        function getSvg(component) {
            let gg2ToolTip = "Jogging disabled on GG2";
            return (
                <svg xmlns="http://www.w3.org/2000/svg"
                     width="3.68056in" height="1.875in"
                     viewBox="0 0 265 135"
                     className={ component.state.isGG2 ? component.props.classes.millImageStyleGG2 : component.props.classes.millImageStyle}>

                    <path id="x_neg_head"
                          className={component.state.isGG2 ? '' : component.getPathColorClass('x', false)}
                          fill="transparent" stroke="#7b7b7b" strokeWidth="3"
                          d="M 9.59,0.81
           C 6.99,2.94 3.43,9.10 1.70,12.21
             0.93,13.60 -0.10,15.35 1.19,16.80
             2.80,18.62 13.10,17.97 15.84,17.95
             17.21,17.94 19.96,18.13 20.79,16.80
             21.65,15.44 20.38,13.40 19.72,12.21
             19.72,12.21 13.52,2.32 13.52,2.32
             12.07,0.56 11.69,0.42 9.59,0.81 Z" />
                    <path id="x_pos_head"
                          className={component.state.isGG2 ? '' : component.getPathColorClass('x', true)}
                          fill="transparent" stroke="#7b7b7b" strokeWidth="3"
                          d="M 1.18,91.21
           C 1.07,91.41 0.53,91.60 0.52,92.74
             0.51,94.75 6.19,103.52 7.63,105.48
             8.67,106.91 10.02,108.59 12.02,107.62
             13.75,106.78 18.74,98.31 19.90,96.22
             20.67,94.83 21.70,93.08 20.41,91.63
             19.38,90.46 17.27,90.51 15.84,90.48
             12.24,90.42 4.17,89.91 1.18,91.21 Z" />
                    <path id="y_pos_head"
                          className={component.state.isGG2 ? '' : component.getPathColorClass('y', true)}
                          fill="transparent" stroke="#7b7b7b" strokeWidth="3"
                          d="M 188.00,112.00
           C 186.62,116.85 186.91,121.99 187.00,127.00
             187.04,129.07 186.91,132.71 189.31,133.59
             191.98,134.57 205.57,126.69 204.55,122.99
             203.54,119.33 191.64,113.16 188.00,112.00 Z" />
                    <path id="y_neg_head"
                          className={component.state.isGG2 ? '' : component.getPathColorClass('y', false)}
                          fill="transparent" stroke="#7b7b7b" strokeWidth="3"
                          d="M 50.00,135.00
           C 51.38,130.15 51.09,125.01 51.00,120.00
             50.96,117.93 51.09,114.29 48.69,113.41
             46.02,112.43 32.43,120.31 33.45,124.01
             34.46,127.67 46.36,133.84 50.00,135.00 Z" />
                    <path id="z_pos_head"
                          className={component.state.isGG2 ? '' : component.getPathColorClass('z', true)}
                          fill="transparent" stroke="#7b7b7b" strokeWidth="3"
                          d="M 252.98,0.81
           C 250.39,2.94 246.82,9.10 245.10,12.21
             244.33,13.60 243.30,15.35 244.59,16.80
             246.19,18.62 256.50,17.97 259.24,17.95
             260.61,17.94 263.36,18.13 264.19,16.80
             265.04,15.44 263.78,13.40 263.11,12.21
             263.11,12.21 256.91,2.32 256.91,2.32
             255.47,0.56 255.09,0.42 252.98,0.81 Z" />
                    <path id="z_neg_head"
                          className={component.state.isGG2 ? '' : component.getPathColorClass('z', false)}
                          fill="transparent" stroke="#7b7b7b" strokeWidth="3"
                          d="M 244.58,87.62
           C 244.47,87.82 243.93,88.01 243.92,89.15
             243.91,91.16 249.58,99.93 251.02,101.89
             252.07,103.32 253.42,105.00 255.41,104.03
             257.15,103.18 262.14,94.72 263.30,92.63
             264.07,91.24 265.10,89.49 263.81,88.04
             262.78,86.87 260.66,86.92 259.24,86.89
             255.64,86.83 247.57,86.32 244.58,87.62 Z" />

                    <SVGPath id="y_neg_path"
                             fill={'transparent'} stroke={'transparent'} strokeWidth={'1'}
                             d="M 50.00,135.00
           C 50.00,135.00 51.00,125.00 51.00,125.00
             51.00,125.00 109.00,125.00 109.00,125.00
             109.00,125.00 109.00,122.00 109.00,122.00
             109.00,122.00 51.00,122.00 51.00,122.00
             50.99,119.63 51.47,114.43 48.69,113.41
             45.91,112.39 33.38,120.27 33.34,123.17
             33.27,127.19 46.45,133.87 50.00,135.00 Z"
                             clickStarted={component.state.isGG2 ? function () {} : component.pathClickStarted}
                             clickEnded={component.state.isGG2 ? function () {} : component.pathClickEnded}
                             tooltipValue={component.state.isGG2 ? gg2ToolTip : component.getEventKeyFromPathId('y_neg_path')}
                             tooltipPlacement={'bottom-end'}/>
                    <SVGPath id="y_pos_path"
                             fill={'transparent'} stroke={'transparent'} strokeWidth={'1'}
                             d="M 188.00,112.00
           C 188.00,112.00 187.00,122.00 187.00,122.00
             187.00,122.00 129.00,122.00 129.00,122.00
             129.00,122.00 129.00,125.00 129.00,125.00
             129.00,125.00 187.00,125.00 187.00,125.00
             187.01,127.37 186.53,132.57 189.31,133.59
             192.09,134.61 204.62,126.73 204.66,123.83
             204.73,119.81 191.55,113.13 188.00,112.00 Z"
                             clickStarted={component.state.isGG2 ? function () {} : component.pathClickStarted}
                             clickEnded={component.state.isGG2 ? function () {} : component.pathClickEnded}
                             tooltipValue={component.state.isGG2 ? gg2ToolTip : component.getEventKeyFromPathId('y_pos_path')}
                             tooltipPlacement={'bottom-start'}/>
                    <SVGPath id="z_pos_path"
                             fill={'transparent'} stroke={'transparent'} strokeWidth={'1'}
                             d="M 252.76,17.95
           C 252.76,17.95 252.76,39.49 252.76,39.49
             252.76,39.49 255.64,39.49 255.64,39.49
             255.64,39.49 255.64,17.95 255.64,17.95
             257.47,17.95 263.17,18.43 264.19,16.80
             265.04,15.44 263.78,13.40 263.11,12.21
             261.78,9.82 256.89,0.61 254.19,0.53
             251.55,0.46 246.41,9.84 245.10,12.21
             244.44,13.41 243.54,14.90 244.23,16.29
             245.33,18.51 250.60,17.95 252.76,17.95 Z"
                             clickStarted={component.state.isGG2 ? function () {} : component.pathClickStarted}
                             clickEnded={component.state.isGG2 ? function () {} : component.pathClickEnded}
                             tooltipValue={component.state.isGG2 ? gg2ToolTip : component.getEventKeyFromPathId('z_pos_path')}
                             tooltipPlacement={'top-end'}/>
                    <SVGPath id="z_neg_path"
                             fill={'transparent'} stroke={'transparent'} strokeWidth={'1'}
                             d="M 252.76,65.35
           C 252.76,65.35 252.76,86.89 252.76,86.89
             250.92,86.89 245.23,86.41 244.21,88.04
             243.35,89.40 244.62,91.44 245.28,92.63
             246.62,95.02 251.51,104.23 254.21,104.31
             256.85,104.38 261.99,95.00 263.30,92.63
             263.96,91.43 264.86,89.94 264.17,88.55
             263.07,86.33 257.79,86.89 255.64,86.89
             255.64,86.89 255.64,65.35 255.64,65.35
             255.64,65.35 252.76,65.35 252.76,65.35 Z"
                             clickStarted={component.state.isGG2 ? function () {} : component.pathClickStarted}
                             clickEnded={component.state.isGG2 ? function () {} : component.pathClickEnded}
                             tooltipValue={component.state.isGG2 ? gg2ToolTip : component.getEventKeyFromPathId('z_neg_path')}
                             tooltipPlacement={'bottom'}/>
                    <SVGPath id="x_pos_path"
                             fill={'transparent'} stroke={'transparent'} strokeWidth={'1'}
                             d="M 9.36,68.94
           C 9.36,68.94 9.36,90.48 9.36,90.48
             7.53,90.48 1.83,90.00 0.81,91.63
             -0.04,92.99 1.22,95.03 1.89,96.22
             3.22,98.62 8.11,107.82 10.81,107.90
             13.45,107.97 18.59,98.59 19.90,96.22
             20.56,95.02 21.46,93.53 20.77,92.14
             19.67,89.92 14.40,90.48 12.24,90.48
             12.24,90.48 12.24,68.94 12.24,68.94
             12.24,68.94 9.36,68.94 9.36,68.94 Z"
                             clickStarted={component.state.isGG2 ? function () {} : component.pathClickStarted}
                             clickEnded={component.state.isGG2 ? function () {} : component.pathClickEnded}
                             tooltipValue={component.state.isGG2 ? gg2ToolTip : component.getEventKeyFromPathId('x_pos_path')}
                             tooltipPlacement={'bottom-start'}/>
                    <SVGPath id="x_neg_path"
                             fill={'transparent'} stroke={'transparent'} strokeWidth={'1'}
                             d="M 9.36,17.95
           C 9.36,17.95 9.36,39.49 9.36,39.49
             9.36,39.49 12.24,39.49 12.24,39.49
             12.24,39.49 12.24,17.95 12.24,17.95
             14.08,17.95 19.77,18.43 20.79,16.80
             21.65,15.44 20.38,13.40 19.72,12.21
             18.38,9.82 13.49,0.61 10.79,0.53
             8.15,0.46 3.01,9.84 1.70,12.21
             1.04,13.41 0.14,14.90 0.83,16.29
             1.93,18.51 7.21,17.95 9.36,17.95 Z"
                             clickStarted={component.state.isGG2 ? function () {} : component.pathClickStarted}
                             clickEnded={component.state.isGG2 ? function () {} : component.pathClickEnded}
                             tooltipValue={component.state.isGG2 ? gg2ToolTip : component.getEventKeyFromPathId('x_neg_path')}
                             tooltipPlacement={'top-start'}/>
                </svg>
            );
        }

        function getGridHeader() {
            return <Grid container spacing={1}>
                <Grid item xs={2} />
                <Grid item xs={5}><Typography>Machine Coordinates</Typography></Grid>
                <Grid item xs={5}><Typography>Work Coordinates</Typography></Grid>
            </Grid>;
        }

        function getGridX(component) {
            return <Grid container spacing={1}>
                <Grid item xs={2}><Typography className={'coordinate-label'}>X</Typography></Grid>
                <Grid item xs={5}>
                    <TextField
                        disabled
                        className="coordinate-field"
                        margin="dense"
                        variant="outlined"
                        value={component.get_position("x")}
                    />
                </Grid>
                <Grid item xs={5}>
                    <TextField
                        disabled
                        className="coordinate-field"
                        margin="dense"
                        variant="outlined"
                        value={component.get_work_pos("x")}
                    />
                </Grid>
            </Grid>;
        }

        function getGridY(component) {
            return (
                <Grid container spacing={1}>
                    <Grid item xs={2}><Typography className={'coordinate-label'}>Y</Typography></Grid>
                    <Grid item xs={5}>
                        <TextField
                            disabled
                            className="coordinate-field"
                            margin="dense"
                            variant="outlined"
                            value={component.get_position("y")}
                        />
                    </Grid>
                    <Grid item xs={5}>
                        <TextField
                            disabled
                            className="coordinate-field"
                            margin="dense"
                            variant="outlined"
                            value={component.get_work_pos("y")}
                        />
                    </Grid>
                </Grid>
            );
        }

        function getGridZ(component) {
            return (
                <Grid container spacing={1}>
                    <Grid item xs={2}><Typography className={'coordinate-label'}>Z</Typography></Grid>
                    <Grid item xs={5}>
                        <TextField
                            disabled
                            className="coordinate-field"
                            margin="dense"
                            variant="outlined"
                            value={component.get_position("z")}
                        />
                    </Grid>
                    <Grid item xs={5}>
                        <TextField
                            disabled
                            className="coordinate-field"
                            margin="dense"
                            variant="outlined"
                            value={component.get_work_pos("z")}
                        />
                    </Grid>
                </Grid>
            );
        }

        function getStatusDisplay(component) {
            return (
                <FormControl className={component.props.classes.formControl} fullWidth>
                    <InputLabel id="status-input-label">Status</InputLabel>
                    <Input
                        className="text-box status"
                        id="status-input-label"
                        value={component.state.realTimeStatusDisplay}
                        inputProps={{style: {color: app.modal.color}}}
                        disableUnderline
                        disabled
                    />
                </FormControl>
            );
        }

        function getManualEntryRow(component) {
            return (
                <Grid className="short-row input-with-button" container spacing={1}>
                    <Grid item xs={12}>
                        <FormControl className={component.props.classes.formControl} fullWidth>
                            <InputLabel id="manual-entry-input" shrink>Manual Entry</InputLabel>
                            <Input
                                id="manual-entry-input"
                                inputRef={component.manual_entry_ref}
                                style={{color: app.modal.color}}
                                inputProps={{style: {color: app.modal.color}}}
                                value={component.state.manualEntry}
                                onChange={e => {
                                    component.setState({manualEntry: e.currentTarget.value});
                                }}
                                onFocus={() => {
																		component.handleInputHasFocus('manual_entry');
                                    component.manual_entry_focused = true;
                                }}
                                onBlur={() => {
																		component.handleInputNoLongerHasFocus();
                                    component.manual_entry_focused = false;
                                }}
                                endAdornment={
                                    <InputAdornment position="end">
                                        <IconButton 
                                            onClick={ () => { 
                                                component.state.settings.disableLimitCatch ? component.executeCommand() : component.sendCommand();
                                                }
                                            } 
                                            color="primary" 
                                        >
                                            <SendIcon />
                                        </IconButton>
                                    </InputAdornment>
                                }
                                disableUnderline
                            />
                        </FormControl>
                    </Grid>
                </Grid> 
            );
        }

        function getRunGCodeRow(component) {
            return (
                <Grid className="short-row input-with-button" container spacing={1}>
                    <Grid item xs={12}>
                        <FormControl className={component.props.classes.formControl} fullWidth>
                            <InputLabel id="g-code-file-input">Run G-code File</InputLabel>
                            <Input
                                id="g-code-file-input"
                                style={{color: app.modal.color}}
                                inputProps={{style: {color: app.modal.color}}}
                                value={component.state.gCodeFilePathDisplay}
                                startAdornment={
                                    <InputAdornment position="start">
                                        <IconButton onClick={component.selectGCodeFile} color="primary">
                                            <SelectFileIcon />
                                        </IconButton>
                                    </InputAdornment>
                                }
                                endAdornment={
                                    <InputAdornment position="end">
                                        <IconButton onClick={component.uploadGCodeFile} color="primary" disabled={!component.state.gCodeFilePath}>
                                            <ExecuteIcon />
                                        </IconButton>
                                    </InputAdornment>
                                }
                                disableUnderline
                                readOnly
                            />
                        </FormControl>
                    </Grid>
                </Grid>
            );
        }

        return (
            <React.Fragment>
                <div id="operations-tab">
                    <Grid id="mill-row" container spacing={1}>
                        <Grid className="mill-image" item xs={7}>
                            {getSvg(this)}
                        </Grid>
                        <Grid className="coordinate-grid" item xs={5}>
                            {getGridHeader()}
                            {getGridX(this)}
                            {getGridY(this)}
                            {getGridZ(this)}
                        </Grid>
                    </Grid>

                    <Grid className="short-row" container spacing={1}>
                        <Grid item xs={8}>
                            {getJoggingMode(this)}
                        </Grid>
                        <Grid item xs={2}>
                            {getUnitsSelect(this)}
                        </Grid>
                        <Grid item xs={2}>
                            {getWCSSelect(this)}
                        </Grid>
                    </Grid>

                    <Grid className="short-row" container spacing={1}>
                        <Grid item xs={2}>
                            {getStatusDisplay(this)}
                        </Grid>
                        <Grid item xs={2}>
                            <Typography className="feedrate-label" align={'right'}>Feedrate</Typography>
                        </Grid>
                        <Grid item xs={1}>
                            <Tooltip placement={'right-start'} title='Range Configurable in Settings Window'><HelpIcon className={'help-icon'} fontSize={'small'} /></Tooltip>
                        </Grid>
                        {getFeedRateGrid(this)}
                    </Grid>

                    <>{getRunGCodeRow(this)}</>
                    <>{getManualEntryRow(this)}</>
                    <>{this.getMillingInProgressDisplay()}</>
                    <Grid id="machine-output" container spacing={0}>
                        <Grid item xs={12}>
                            <Typography>Machine Output:</Typography>
                            <div id="raw">
                                <Raw selectedStep={this.state.step} millingInProgress={true} />
                            </div>
                        </Grid>
                    </Grid>
                    <Alert
                        open={this.state.limitWarningOpen}
                        message={"The command you sent will trigger a limit alarm. Would you like to still send it?"}
                        yesNo={true}
                        onOk={(event) => { this.executeCommand(); this.setState({ limitWarningOpen: false }) }}
                        onCancel={(event) => { this.setState({ limitWarningOpen: false }) }}
                        extraButtonText="This error is incorrect"
                        onExtraButton={(event) => { this.setState({ reportLimitErrorOpen: true, limitWarningOpen: false})}}
                    />
                    <ReportLimitCatchError open={this.state.reportLimitErrorOpen} onClose={(event) => {this.setState({ reportLimitErrorOpen: false })}} inputValue={this.state.manualEntry} onSend={this.disableSoftLimitSetting} />
                    {getHomingAlertDialog(this)}
                </div>
            </React.Fragment>
        );
    }
}

Operations.propTypes = {
    classes: PropTypes.object.isRequired,
    closeDialog: PropTypes.func.isRequired,
    open: PropTypes.bool.isRequired
};

export default withStyles(styles)(Operations);

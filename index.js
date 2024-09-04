var inherits = require('util').inherits;
var Service, Characteristic;
var request = require('request');
var FakeGatoHistoryService = require('fakegato-history');
const version = require('./package.json').version;

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	Accessory = homebridge.platformAccessory;
	UUIDGen = homebridge.hap.uuid;
	FakeGatoHistoryService = require('fakegato-history')(homebridge);
	homebridge.registerAccessory("homebridge-3em-energy-meter-adv", "3EMEnergyMeterAdv", EnergyMeter);
}

function EnergyMeter(log, config) {
	this.log = log;
	this.ip = config["ip"] || "127.0.0.1";
	this.url = "http://" + this.ip + "/status/emeters?";
	this.auth = config["auth"];
	this.name = config["name"];
	this.displayName = config["name"];
	this.timeout = config["timeout"] || 5000;
	this.http_method = "GET";
	this.update_interval = Number(config["update_interval"] || 10000);
	this.negative_handling_mode = config["negative_handling_mode"] || 0;
	this.use_pf = config["use_pf"] || false;
	this.debug_log = config["debug_log"] || false;
	this.serial = config.serial || "9000000";

	// internal variables
	this.waiting_response = false;
	this.powerConsumption = 0;
	this.totalPowerConsumption = 0;
	this.voltage1 = 0;
	this.ampere1 = 0;
	this.pf0 = 1;
	this.pf1 = 1;
	this.pf2 = 1;
	this.currentA = 0;
	this.currentB = 0;
	this.currentC = 0;

	var EvePowerConsumption = function () {
		Characteristic.call(this, 'Consumption', 'E863F10D-079E-48FF-8F27-9C2605A29F52');
		this.setProps({
			format: Characteristic.Formats.UINT16,
			unit: "Watts",
			maxValue: 100000,
			minValue: 0,
			minStep: 1,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	EvePowerConsumption.UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';
	inherits(EvePowerConsumption, Characteristic);

	var EveTotalConsumption = function () {
		Characteristic.call(this, 'Energy', 'E863F10C-079E-48FF-8F27-9C2605A29F52');
		this.setProps({
			format: Characteristic.Formats.FLOAT,
			unit: 'kWh',
			maxValue: 1000000000,
			minValue: 0,
			minStep: 0.001,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	EveTotalConsumption.UUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52';
	inherits(EveTotalConsumption, Characteristic);

	var EveVoltage1 = function () {
		Characteristic.call(this, 'Volt', 'E863F10A-079E-48FF-8F27-9C2605A29F52');
		this.setProps({
			format: Characteristic.Formats.FLOAT,
			unit: 'Volt',
			maxValue: 1000000000,
			minValue: 0,
			minStep: 0.001,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	EveVoltage1.UUID = 'E863F10A-079E-48FF-8F27-9C2605A29F52';
	inherits(EveVoltage1, Characteristic);

	var EveAmpere1 = function () {
		Characteristic.call(this, 'Ampere', 'E863F126-079E-48FF-8F27-9C2605A29F52');
		this.setProps({
			format: Characteristic.Formats.FLOAT,
			unit: 'Ampere',
			maxValue: 1000000000,
			minValue: 0,
			minStep: 0.001,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	EveAmpere1.UUID = 'E863F126-079E-48FF-8F27-9C2605A29F52';
	inherits(EveAmpere1, Characteristic);

	var EveCurrentA = function () {
		Characteristic.call(this, 'Current A', 'E863F127-079E-48FF-8F27-9C2605A29F52');
		this.setProps({
			format: Characteristic.Formats.FLOAT,
			unit: 'Current',
			maxValue: 1000000000,
			minValue: 0,
			minStep: 0.001,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	EveCurrentA.UUID = 'E863F127-079E-48FF-8F27-9C2605A29F52';
	inherits(EveCurrentA, Characteristic);

	var EveCurrentB = function () {
		Characteristic.call(this, 'Current B', 'E863F128-079E-48FF-8F27-9C2605A29F52');
		this.setProps({
			format: Characteristic.Formats.FLOAT,
			unit: 'Current',
			maxValue: 1000000000,
			minValue: 0,
			minStep: 0.001,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	EveCurrentB.UUID = 'E863F128-079E-48FF-8F27-9C2605A29F52';
	inherits(EveCurrentB, Characteristic);

	var EveCurrentC = function () {
		Characteristic.call(this, 'Current C', 'E863F129-079E-48FF-8F27-9C2605A29F52');
		this.setProps({
			format: Characteristic.Formats.FLOAT,
			unit: 'Current',
			maxValue: 1000000000,
			minValue: 0,
			minStep: 0.001,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	EveCurrentC.UUID = 'E863F129-079E-48FF-8F27-9C2605A29F52';
	inherits(EveCurrentC, Characteristic);


	var PowerMeterService = function (displayName, subtype) {
		Service.call(this, displayName, '00000001-0000-1777-8000-775D67EC4377', subtype);
		this.addCharacteristic(EvePowerConsumption);
		this.addOptionalCharacteristic(EveTotalConsumption);
		this.addOptionalCharacteristic(EveVoltage1);
		this.addOptionalCharacteristic(EveAmpere1);
		this.addOptionalCharacteristic(EveCurrentA);
		this.addOptionalCharacteristic(EveCurrentB);
		this.addOptionalCharacteristic(EveCurrentC);
	};
	PowerMeterService.UUID = '00000001-0000-1777-8000-775D67EC4377';
	inherits(PowerMeterService, Service);

	// local vars
	this._EvePowerConsumption = EvePowerConsumption;
	this._EveTotalConsumption = EveTotalConsumption;
	this._EveVoltage1 = EveVoltage1;
	this._EveAmpere1 = EveAmpere1;

	this._EveCurrentA = EveCurrentA;
	this._EveCurrentB = EveCurrentB;
	this._EveCurrentC = EveCurrentC;

	// info
	this.informationService = new Service.AccessoryInformation();
	this.informationService
		.setCharacteristic(Characteristic.Manufacturer, "Shelly - produdegr")
		.setCharacteristic(Characteristic.Model, "Shelly 3EM")
		.setCharacteristic(Characteristic.FirmwareRevision, version)
		.setCharacteristic(Characteristic.SerialNumber, this.serial);

	// construct service
	this.service = new PowerMeterService(this.name);
	this.service.getCharacteristic(this._EvePowerConsumption).on('get', this.getPowerConsumption.bind(this));
	this.service.addCharacteristic(this._EveTotalConsumption).on('get', this.getTotalConsumption.bind(this));
	this.service.addCharacteristic(this._EveVoltage1).on('get', this.getVoltage1.bind(this));
	this.service.addCharacteristic(this._EveAmpere1).on('get', this.getAmpere1.bind(this));
	this.service.addCharacteristic(this._EveCurrentA).on('get', this.getCurrentA.bind(this));
	this.service.addCharacteristic(this._EveCurrentB).on('get', this.getCurrentB.bind(this));
	this.service.addCharacteristic(this._EveCurrentC).on('get', this.getCurrentC.bind(this));

	// add fakegato
	this.historyService = new FakeGatoHistoryService("energy", this, { storage: 'fs' });
}

EnergyMeter.prototype.updateState = function () {
	if (this.waiting_response) {
		this.log('Please select a higher update_interval value. Http command may not finish!');
		return;
	}
	this.waiting_response = true;
	this.last_value = new Promise((resolve, reject) => {
		var ops = {
			uri: this.url,
			method: this.http_method,
			timeout: this.timeout
		};
		if (this.debug_log) { this.log('Requesting energy values from Shelly 3EM(EM) ...'); }
		if (this.auth) {
			ops.auth = {
				user: this.auth.user,
				pass: this.auth.pass
			};
		}
		request(ops, (error, res, body) => {
			var json = null;
			if (error) {
				this.log('Bad http response! (' + ops.uri + '): ' + error.message);
			}
			else {
				try {
					json = JSON.parse(body);

					this.pf0 = parseFloat(json.emeters[0].pf);
					this.pf1 = parseFloat(json.emeters[1].pf);
					this.pf2 = parseFloat(json.emeters[2].pf);

					this.currentA = Math.abs(parseFloat(json.emeters[0].current));
					this.currentB = Math.abs(parseFloat(json.emeters[1].current));
					this.currentC = Math.abs(parseFloat(json.emeters[2].current));

					if (this.negative_handling_mode == 0) {
						this.powerConsumption = (parseFloat(json.emeters[0].power) + parseFloat(json.emeters[1].power) + parseFloat(json.emeters[2].power));
						this.totalPowerConsumption = ((parseFloat(json.emeters[0].total) + parseFloat(json.emeters[1].total) + parseFloat(json.emeters[2].total)) / 1000);
						this.voltage1 = (((parseFloat(json.emeters[0].voltage) + parseFloat(json.emeters[1].voltage) + parseFloat(json.emeters[2].voltage)) / 3));
						this.ampere1 = (((parseFloat(json.emeters[0].current) * this.pf0)
							+ (parseFloat(json.emeters[1].current) * this.pf1)
							+ (parseFloat(json.emeters[2].current) * this.pf2)));
						if (this.powerConsumption < 0) { this.powerConsumption = 0 }
						if (this.totalPowerConsumption < 0) { this.totalPowerConsumption = 0 }
						if (this.voltage1 < 0) { this.voltage1 = 0 }
						if (this.ampere1 < 0) { this.ampere1 = 0 }
					} else if (this.negative_handling_mode == 1) {
						this.powerConsumption = Math.abs(parseFloat(json.emeters[0].power) + parseFloat(json.emeters[1].power) + parseFloat(json.emeters[2].power));
						this.totalPowerConsumption = Math.abs((parseFloat(json.emeters[0].total) + parseFloat(json.emeters[1].total) + parseFloat(json.emeters[2].total)) / 1000);
						this.voltage1 = Math.abs(((parseFloat(json.emeters[0].voltage) + parseFloat(json.emeters[1].voltage) + parseFloat(json.emeters[2].voltage)) / 3));
						this.ampere1 = Math.abs(((parseFloat(json.emeters[0].current) * this.pf0)
							+ (parseFloat(json.emeters[1].current) * this.pf1)
							+ (parseFloat(json.emeters[2].current) * this.pf2)));
					}

					if (this.debug_log) { this.log('Successful http response. [ voltage: ' + this.voltage1.toFixed(0) + 'V, current: ' + this.ampere1.toFixed(1) + 'A, consumption: ' + this.powerConsumption.toFixed(0) + 'W, total consumption: ' + this.totalPowerConsumption.toFixed(2) + 'kWh ]'); }
				}
				catch (parseErr) {
					this.log('Error processing data: ' + parseErr.message);
					error = parseErr;
				}
			}
			if (!error) {

				resolve(this.powerConsumption, this.totalPowerConsumption, this.voltage1, this.ampere1, this.currentA, this.currentB, this.currentC)
			}
			else {
				reject(error);
			}
			this.waiting_response = false;
		});
	})
		.then((value_current, value_total, value_voltage1, value_ampere1, value_currentA, value_currentB, value_currentC) => {
			if (value_current != null) {
				this.service.getCharacteristic(this._EvePowerConsumption).setValue(value_current, undefined, undefined);
				//FakeGato
				this.historyService.addEntry({ time: Math.round(new Date().valueOf() / 1000), power: value_current });
			}
			if (value_total != null) {
				this.service.getCharacteristic(this._EveTotalConsumption).setValue(value_total, undefined, undefined);
			}
			if (value_voltage1 != null) {
				this.service.getCharacteristic(this._EveVoltage1).setValue(value_voltage1, undefined, undefined);
			}
			if (value_ampere1 != null) {
				this.service.getCharacteristic(this._EveAmpere1).setValue(value_ampere1, undefined, undefined);
			}

			if (value_currentA != null) {
				this.service.getCharacteristic(this._EveCurrentA).setValue(value_currentA, undefined, undefined);
			}
			if (value_currentB != null) {
				this.service.getCharacteristic(this._EveCurrentB).setValue(value_currentB, undefined, undefined);
			}
			if (value_currentC != null) {
				this.service.getCharacteristic(this._EveCurrentC).setValue(value_currentC, undefined, undefined);
			}

			return true;
		}, (error) => {
			return error;
		});
};

EnergyMeter.prototype.getPowerConsumption = function (callback) {
	callback(null, this.powerConsumption);
};

EnergyMeter.prototype.getTotalConsumption = function (callback) {
	callback(null, this.totalPowerConsumption);
};

EnergyMeter.prototype.getVoltage1 = function (callback) {
	callback(null, this.voltage1);
};

EnergyMeter.prototype.getAmpere1 = function (callback) {
	callback(null, this.ampere1);
};

EnergyMeter.prototype.getCurrentA = function (callback) {
	callback(null, this.currentA);
};
EnergyMeter.prototype.getCurrentB = function (callback) {
	callback(null, this.currentB);
};
EnergyMeter.prototype.getCurrentC = function (callback) {
	callback(null, this.currentC);
};


EnergyMeter.prototype.getServices = function () {
	this.log("getServices: " + this.name);
	if (this.update_interval > 0) {
		this.timer = setInterval(this.updateState.bind(this), this.update_interval);
	}
	return [this.informationService, this.service, this.historyService];
};

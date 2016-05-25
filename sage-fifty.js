var Promise = require('bluebird-wrap');
var odbc = require('odbc');
Promise.promisifyAll(odbc.Database.prototype);
var _ = require('lodash');
var path = require('path');
var PayInFull = require('./payinfull/');
var debug = require('debug')('sage-fifty');

function Sage50(options) {
	if (!options) {
		throw Error("Missing configuration options");
	}

	if (!options.accdata) {
		throw Error("ACCDATA path required");
	}

	if (!path.win32.isAbsolute(options.accdata)) {
		throw Error("ACCDATA must be an absolute path");
	}

	if (!options.username) {
		throw Error("Username required");
	}

	if (!options.version) {
		throw Error("Sage accounts data version must be specified");
	}

	this._accdata = options.accdata;
	this._username = options.username;
	this._password = options.password || "";
	this._version = options.version;

	this._odbc = odbc();
	this._connStr = [
        "Driver={Sage Line 50 v",
        this._version,
        "};DIR=",
        this._accdata,
        ";UseDataPath=No;UID=",
        this._username,
        ";PWD=",
        this._password
    ].join("");

    // connect to the odbc data
	this.db = this._odbc
		.openAsync(this._connStr)
		.return(this._odbc)
		.wrap(odbc.Database.prototype);

	debug("Sage50 linked to", this._accdata);
}

/**
 * Mark splits as paid in full
 * @param  {object} options {}
 * @return {Promise}        result object
 */
Sage50.prototype.payInFull = function(options){
	if (!options) {
		throw Error("Missing configuration options");
	}

	if (!options.bankCode) {
		throw Error("A bank code is required");
	}

	if (!options.reference) {
		throw Error("A remittance reference is required");
	}

	if (!options.accountRef) {
		throw Error("A customer account reference is required");
	}

	if (!options.splits || !options.splits.length) {
		throw Error("An array of splits is required and must not be empty");
	}

    return PayInFull({
        SageDataPath : this._accdata,
        SageUsername : this._username,
        SagePassword : this._password,
        BankCode     : options.bankCode,
        Reference    : options.reference,
        Details      : "Sales Receipt",
        AccountRef   : options.accountRef,
        Splits       : options.splits
    }, options.onprogress);
};

module.exports = Sage50;

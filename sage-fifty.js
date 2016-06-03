var Promise = require('bluebird');
var odbc = require('odbc');
Promise.promisifyAll(odbc.Database.prototype);
var _ = require('lodash');
var path = require('path');
var Bridge = require('./bridge');
var debug = require('debug')('sage-fifty');
var promizee = require('promizee');
var stream = require('stream');

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

    debug("Sage50 linked to", this._accdata);
}

/**
 * Mark splits as paid in full
 * @param  {object} options {}
 * @return {Promise}        result object
 */
Sage50.prototype.payInFull = function(options) {
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

    return Bridge({
        action       : "PayInFull",
        accdata      : this._accdata,
        username     : this._username,
        password     : this._password,
        bankCode     : options.bankCode,
        reference    : options.reference,
        details      : "Sales Receipt",
        accountRef   : options.accountRef,
        splits       : options.splits
    }, options.onprogress);
}

var zipSplits = function(raw){
    var headings = ["recordNumber", "headerNumber", "deletedFlag", "details", "type", "tranNumber", "amountPaid", "amountNet", "amountTax"];
    var zipped = _.zip.apply(_, headings.map(function(head){ return raw[head]; }));
    return zipped.map(function(line){
        return _.zipObject(headings, line);
    });
};

Sage50.prototype.getSplitsByRange = function(options) {
    return Bridge({
        action       : "GetSplitsByRange",
        accdata      : this._accdata,
        username     : this._username,
        password     : this._password,
        start        : options.start || 1,
        count        : options.count || 1000
    }, options.onprogress).then(zipSplits);
};

Sage50.prototype.getSplits = function(options) {
    return Bridge({
        action       : "GetSplitsByRange",
        accdata      : this._accdata,
        username     : this._username,
        password     : this._password,
        splits       : options.splits
    }, options.onprogress).then(zipSplits);
};

Sage50.prototype.getAllSplitsStream = function(chunkSize) {
    var curPos = 1;
    chunkSize = chunkSize || 100;
    var eof = false;
    var sg = this;

    debug("streaming splits in chunks of %s", chunkSize);

    var splitCache = [];

    var getMoreSplits = Promise.method(() => {
        if (splitCache.length > 0) {
            return;
        }

        debug('fetching next chunk of splits');
        return sg.getSplitsByRange({start: curPos, count: chunkSize}).then((splits) => {
            splitCache.push.apply(splitCache, splits.reverse());
            curPos += chunkSize;
            if (splits.length != chunkSize) {
                eof = true;
            }
        });
    });

    var getNextSplit = promizee(() => {
        if (eof && !splitCache.length) {
            debug('end of split stream');
            return null;
        }
        return getMoreSplits().then(() => splitCache.pop());
    });

    var readable = new stream.Readable({
        objectMode: true,
        read: function() {
            getNextSplit().then((s) => this.push(s));
        }
    });

    return readable;
}

Sage50.prototype._dbConnect = function() {
    if (!!this._db) {
        return;
    }

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
    this._db = this._odbc
        .openAsync(this._connStr)
        .return(this._odbc);
}

Sage50.prototype.query = function(sql, params) {
    this._dbConnect();
    return this._db.call('queryAsync', sql, params);
}

module.exports = Sage50;

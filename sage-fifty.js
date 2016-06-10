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

var zipBridgeResponse = function(raw){
    var headings = Object.keys(raw).filter(k => (raw[k] instanceof Array));
    var zipped = _.zip.apply(_, headings.map(head => raw[head]));
    return {
        recordCount: raw.recordCount,
        rows: zipped.map(line => _.zipObject(headings, line))
    };
};

Sage50.prototype.getInvoicesByRange = function(options) {
    return Bridge({
        action       : "GetInvoicesByRange",
        accdata      : this._accdata,
        username     : this._username,
        password     : this._password,
        start        : options.start || 1,
        count        : options.count || 1000
    }).then(zipBridgeResponse);
};

Sage50.prototype.getInvoices = function(options) {
    return Bridge({
        action       : "GetInvoicesByRange",
        accdata      : this._accdata,
        username     : this._username,
        password     : this._password,
        invoiceNumbers : options.invoiceNumbers
    }).then(zipBridgeResponse);
};

Sage50.prototype.getAllResourceStream = function(chunkSize, onProgress, rangeFunc) {
    var curPos = 1;
    chunkSize = chunkSize || 100;
    var eof = false;

    debug("streaming resource chunks of %s", chunkSize);

    var cache = [];

    var getMore = Promise.method(() => {
        if (cache.length > 0) {
            return;
        }

        debug('fetching next chunk');
        return rangeFunc.call(this, {start: curPos, count: chunkSize}).then(data => {
            onProgress && onProgress({
                pct: Math.min(curPos + chunkSize, data.recordCount) / data.recordCount,
                current: Math.min(curPos + chunkSize, data.recordCount),
                total: data.recordCount
            });
            cache.push.apply(cache, data.rows.reverse());
            curPos += chunkSize;
            if (data.rows.length != chunkSize) {
                eof = true;
            }
        });
    });

    var getNext = promizee(() => {
        if (eof && !cache.length) {
            debug('end of stream');
            return null;
        }
        return getMore().then(() => cache.pop());
    });

    var readable = new stream.Readable({
        objectMode: true,
        read: function() {
            getNext().then((s) => this.push(s));
        }
    });

    return readable;
}

Sage50.prototype.getAllInvoicesStream = function(chunkSize, onProgress) {
    return this.getAllResourceStream(chunkSize, onProgress, this.getInvoicesByRange);
}


Sage50.prototype.getHeadersByRange = function(options) {
    return Bridge({
        action       : "GetHeadersByRange",
        accdata      : this._accdata,
        username     : this._username,
        password     : this._password,
        start        : options.start || 1,
        count        : options.count || 1000
    }, options.onprogress).then(zipBridgeResponse);
};

Sage50.prototype.getHeaders = function(options) {
    return Bridge({
        action       : "GetHeadersByRange",
        accdata      : this._accdata,
        username     : this._username,
        password     : this._password,
        headers      : options.headers
    }, options.onprogress).then(zipBridgeResponse);
};

Sage50.prototype.getAllHeadersStream = function(chunkSize, onProgress) {
    return this.getAllResourceStream(chunkSize, onProgress, this.getHeadersByRange);
}


Sage50.prototype.getSplitsByRange = function(options) {
    return Bridge({
        action       : "GetSplitsByRange",
        accdata      : this._accdata,
        username     : this._username,
        password     : this._password,
        start        : options.start || 1,
        count        : options.count || 1000
    }, options.onprogress).then(zipBridgeResponse);
};

Sage50.prototype.getSplits = function(options) {
    return Bridge({
        action       : "GetSplitsByRange",
        accdata      : this._accdata,
        username     : this._username,
        password     : this._password,
        splits       : options.splits
    }, options.onprogress).then(zipBridgeResponse);
};

Sage50.prototype.getAllSplitsStream = function(chunkSize, onProgress) {
    return this.getAllResourceStream(chunkSize, onProgress, this.getSplitsByRange);
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

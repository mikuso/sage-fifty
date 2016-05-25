Description
-----------
This is an early prototype of a Sage 50 Accounts interface for NodeJS.

![Dependencies](https://david-dm.org/mikuso/sage-fifty.svg)
![Issues](https://img.shields.io/github/issues/mikuso/sage-fifty.svg)

Prerequisites
-------------
* Windows
* .NET framework 4.5
* Sage Accounts 50 Professional v22 (2016)
* Sage Line 50 ODBC drivers (installed with Sage)
* Sage Data Objects (SDO) COM libraries (installed with Sage)


Example Usage
-------------

```js
var Sage50 = require('sage-fifty');

// create a new sage link
var sage = new Sage50({
	accdata: "C:\\ProgramData\\Sage\\Accounts\\2016\\Demodata\\ACCDATA",
	username: "manager",
	version: 22
});

// a simple database query
sage.db.queryAsync("SELECT TOP 5 ACCOUNT_REF, SPLIT_NUMBER FROM AUDIT_SPLIT").then(function(splits){
	console.log('5 SPLITS:', splits);
});

// create a sales receipt and allocate payments to invoice lines
// (invoice lines are identified by their split numbers)
sage.payInFull({
	bankCode: 1200,
	accountRef: "ABS001",
	reference: "Test",
	splits: [1023,1021,1020,1019,1010,1024],
	onprogress: function(currentItem, totalItems){
		console.log('PayInFull Progress %s/%s', currentItem, totalItems);
	}
}).then(function(result){
	console.log('DONE PayInFull test', result);
});
```

Notes
-----
More info about Sage 50 Accounts data tables can be found here:
http://import.makingithappen.co.uk/custom_integration_files.htm

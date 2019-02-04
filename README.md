Description
-----------
This is an early prototype of a Sage 50 Accounts interface for NodeJS. Not suitable for production use.

![Dependencies](https://david-dm.org/mikuso/sage-fifty.svg)
![Issues](https://img.shields.io/github/issues/mikuso/sage-fifty.svg)

Prerequisites
-------------
* Windows
* .NET framework 4.5
* Sage 50c Accounts Professional v25 (2019)
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
	password: "password",
	version: 25
});

// a simple database query
sage.query("SELECT TOP 5 ACCOUNT_REF, SPLIT_NUMBER FROM AUDIT_SPLIT").then(function(splits){
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

// get splits
sage.getSplitsByRange({start:10, count:5}).then(function(splits){
	console.log('RANGE SPLITS', splits);
});

// get a stream of all splits, fetched in chunks of 2000
sage.getAllSplitsStream(2000)
	.on('data', (s)=>{
		console.log('split', s);
	})
	.once('end', ()=>{
		console.log('split stream ended');
	});
```

Notes
-----
More info about Sage 50 Accounts data tables can be found here:
http://import.makingithappen.co.uk/custom_integration_files.htm

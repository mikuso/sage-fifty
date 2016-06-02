var Sage50 = require('./sage-fifty');

// create a new sage link
var sage = new Sage50({
	accdata: "C:\\ProgramData\\Sage\\Accounts\\2016\\Demodata\\ACCDATA",
	username: "dev",
	version: 22
});

// a database query
sage.query("SELECT TOP 5 account_ref, split_number FROM audit_split").then(function(splits){
	console.log('5 SPLITS:', splits);
});

// mark splits as paid
sage.payInFull({
	bankCode: 1200,
	accountRef: "ABS001",
	reference: "Test",
	splits: [1023,1021,1020,1019,1010,1024,1017],
	onprogress: function(action,cur,total){
		console.log('PayInFull %s Progress %s/%s', action,cur,total);
	}
}).then(function(res){
	console.log('DONE PayInFull test', res);
});

// get splits
sage.getSplitsByRange({start:1, count:3}).then(function(splits){
	console.log('RANGE SPLITS', splits);
});

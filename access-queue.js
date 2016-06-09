var Promise = require('bluebird'); 
var PromiseQueue = require('promise-queue');
PromiseQueue.configure(Promise);
var path = require('path');

var queues = {};

module.exports = function(company, username){
	var key = [company,username].join("\t-\t");

	if (!queues[key]) {
		queues[key] = new PromiseQueue(1, Infinity);
	}

	var q = queues[key];
	return q.add.bind(q);
};

var sageAccessQueue = require('./access-queue');
var Promise = require('bluebird');
var child_process = require('child_process');
var path = require('path');
var _ = require('lodash');
var debug = require('debug')('sage-fifty:bridge');

var bridgeExe = path.resolve(__dirname, "./bin/sage50-bridge.exe");


module.exports = Promise.method(function Bridge(options, onprogress){

	onprogress = onprogress || (function(){});

	// queue will ensure we won't conflict with other apps on the same accdata/username
	return sageAccessQueue(options.accdata, options.username)(function(){

		debug("Spawning", bridgeExe, "with params", options);
		var cp = child_process.spawn(bridgeExe, ["--pipe"], {stdio: 'pipe'});

		return new Promise(function(resolve, reject){

			// provide program input
			cp.stdin.write(JSON.stringify(options));
			cp.stdin.end();

			// store program output
			var dataBuffer = "";

			function parseJSONOut(js){
				if (!js || !js.type) {
					reject(Error("Invalid JSON response"));
					cp.kill();
				}

				switch (js.type) {
					case 'progress':
						debug("->progress", js.activity, js.current +"/"+ js.total);
						onprogress(js.activity, js.current, js.total);
						break;
					case 'error':
						debug("->error", js.message);
						reject(Error(js.message));
						cp.kill();
						break;
					case 'data':
						debug("->data");
						resolve(js.data);
						break;
				}
			}

			function readOutput(){
				var lines = dataBuffer.split("\x00");

				while (lines.length) {
					var line = lines.shift();
					try {
						parseJSONOut(JSON.parse(line));
					} catch (x) {
						if (lines.length > 0) {
							// this line didn't parse and we have more queued up that need parsing?
							reject(Error("Bridge data parse error"));
						} else {
							// if this was the last line, we can expect that it might be incomplete
							dataBuffer = line;
						}
					}
				}
			}

						
			cp.stdout.on('data', function(data){
				dataBuffer += data;
				readOutput();
			});

			var onerror = function(err){
				reject(err);
				removelisteners();
			};

			var onexit = function(code){
				reject(Error("Premature exit: "+code));
				removelisteners();
			};

			function removelisteners(){
				cp.stdout.removeAllListeners();
				cp.removeListener('error', onerror);
				cp.removeListener('exit', onexit);
			};

			cp.on('error', onerror);
			cp.on('exit', onexit);


		});

	});

});

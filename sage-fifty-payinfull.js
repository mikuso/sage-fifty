var sageAccessQueue = require('./access-queue');
var Promise = require('bluebird');
var child_process = require('child_process');
var path = require('path');
var _ = require('lodash');
var payInFullExe = path.resolve(__dirname, "./bin/Sage50PayInFull.exe");
var debug = require('debug')('sage-fifty:payinfull');

/**
 * Sage50 - Pay in Full
 * @description
 * 	  Given a customer account, bank code and a list of splits, creates and allocates a sales receipt.
 * @param  {object} options {
 *    SageDataPath : string - path to ACCDATA folder
 *    SageUsername : string - dedicated Sage username
 *    SagePassword : string - corresponding password
 *    AccountRef   : string - account ref for the splits within
 *    BankCode     : string - bank code, which is also the SR nominal
 *    Reference    : string - your ref. perhaps a remittance ID / date?
 *    Details      : string - usually the text "Sales Receipt"
 *    Splits       : Array  - split numbers to mark as paid
 * }
 * @param  {Function(curPos, total)} onprogress  : a callback function to give progress updates
 * @return {Promise} resolves to an object {
 *    flag_imported         : bool   - Was a sales receipt successfully created?
 *    splits_allocated      : Array  - split numbers which were allocated (may be fewer than requested if some already paid)
 *    receiptValueTotal     : number - total value of the receipt which was imported
 *    receiptValueAllocated : number - total value of the receipt allocated to SI records. if different from Total, this might indicate a problem.
 * }
 */
module.exports = Promise.method(function PayInFull(options, onprogress){

	onprogress = _.throttle(onprogress || (function(){}), 200);

	if (!options.Splits.length) {
		throw Error("Must specify at least one split");
	}

	options.Splits = options.Splits.map(function(s){
		return s*1;
	});



	var accessQueue = sageAccessQueue(options.SageDataPath, options.SageUsername);

	return accessQueue(function(){
		// do work here
		// queue will ensure we won't conflict with other apps on the same username

		debug("Spawning", payInFullExe, "with params", options);
		var cp = child_process.spawn(payInFullExe, ["--pipe"], {stdio: 'pipe'});

		// ok... this is gonna get messy.
		// My apologies to anyone who needs to understand how this works.

		return new Promise(function(resolve, reject){

			// provide program input
			cp.stdin.write(JSON.stringify(options));
			cp.stdin.end();

			var readingJSONout = false;
			var pctTotal = 0;
			var pctCur = 0;

			var connectionTimeout = null;
			function readline(line){
				if (readingJSONout) {
					try {
						// we're done. feed the result back
						resolve(JSON.parse(line));
					} catch (x) {
						reject(x);
					}
				} else {

					if (!line) {
						return;
					}

					// handle errors
					if (line.match(/^!/)) {
						line = line.replace(/^! (Error: )?/, '');
						reject(Error(line));
						return;
					}

					// start a timer for connection issues
					if (line === "# Connecting") {
						debug("Connecting to Sage");
						connectionTimeout = setTimeout(function(){
							cp.kill();
							reject(Error("Failed to connect promptly"));
						}, 5000);
						return;
					}

					// call off the hounds
					if (line === "# Connected") {
						debug("Connected!");
						clearTimeout(connectionTimeout);
						return;
					}

					var newPct = line.match(/^% \w+ (\d+)/);
					if (newPct) {
						pctTotal += newPct[1]*1;
						return;
					}

					if (line.match(/^\+/)) {
						pctCur++;
						onprogress(pctCur, pctTotal);
						return;
					}
					debug('STDOUT:', line);
				}
			}

			// latch on to output
			var datastr = "";
			cp.stdout.on('data', function(data){
				datastr += data;
				var lines = datastr.split("\r\n");
				if (lines[0].match(/^--JSON--/)) {
					readingJSONout = true;
					lines.shift();
					datastr = lines.join("\r\n");
				} else if (!readingJSONout) {
					datastr = lines.pop();
					lines.forEach(readline);
				}
			});
			cp.stdout.once('end', function(){
				readline(datastr);
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
				cp.removeListener('error', onerror);
				cp.removeListener('exit', onexit);
				cp.stdout.removeAllListeners();
			};

			cp.on('error', onerror);
			cp.on('exit', onexit);


		}).catch(function(x){
			// just in case this exception hangs the program
			setTimeout(function(){
				try { cp.kill(); } catch(e){}
			}, 5000);

			throw x;
		});

	});

});

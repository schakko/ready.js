var util = require('util'),
colors = require('colors');

module.exports = {
  debug : function(msg) {
    if (false) {
      	util.puts(msg);
	for (var i = 1, arg; arg = arguments[i]; i++) {
        util.puts(sys.inspect(arg));
      }
    }
  },
  warn : function(msg) {
    util.puts(("WARNING : " + msg).yellow);
  },
  log : function(msg) {
    util.puts(msg.green);
  },
  error : function(msg) {
    util.puts(("ERROR : " + msg).red);
  },
  error_and_exit : function(msg) {
	error(msg);
    process.exit(1);
  }
}

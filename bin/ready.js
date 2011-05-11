#!/usr/bin/env node
var r = require("../lib/ready"),
  fs = require("fs"),
  sys = require("sys"),
  util = require("../lib/utils"),
  colors = require("colors"),
  argv = require('optimist').argv,
  logger = require("../lib/logger"),
  config = require("../lib/config"),
  inspect = require("util").inspect,
  internal_util = require("util");

var aggregates = [];

function sortAggregates(a, b) {
  a = a.filename;
  b = b.filename;
  
  var posA = config.order.indexOf(a);
  if (posA < 0) { posA = Number.MAX_VALUE };
  
  var posB = config.order.indexOf(b);
  if (posB < 0) { posB = Number.MAX_VALUE };
  
  if (posA == posB) {
    return (a < b) ? -1 : ((a > b) ? 1 : 0);
  } else {
    return posA - posB;
  }         
}

function compile(file, callback) {
  if (config.runGCompiler && !util.isExcluded(file)) {
    logger.log("Compiling '" + file + "'");
    r.compile(file, function(success, code, data) {
      if (success) {
        callback(file, code);
      } else {
        if (data.compiledCode !== null) {
          console.log("Error compiling '" + file + "' : code does not seem valid.");
        } else {
          console.log("Error compiling '" + file + "' : " + sys.inspect(data));
        }
      }
    });
  } else {
    // Get the code directly from the file
    fs.readFile(file, function(err, text) {
      if (!err) {
        callback(file, text.toString());
      } else {
        r.log("Error reading file : " + file);
      }
    });
  }
}

function aggregate(file, code) {
  var filename = file.match(/[^\/]+$/g)[0];
  var minfilename = filename.replace(/\.js$/i, "."+config.compiledExtension+".js");
  
  logger.log("Aggregating '" + file + "'")
  
  aggregates.push({filename : filename, code : code});
  
  var end = function() {
    if (util.allJsFiles.length == aggregates.length) { aggregateAll(); }
  }  

  // Save the file to dest
  if (config.keepCompiled) {
    // Create dest
    fs.mkdir(config.dest, 0755, function(err) {
      fs.open(config.dest + "/" + minfilename, "w+", 0755, function(err, fd) {
        if (!err) {
          fs.write(fd, code, null, null, function(err, written) {
            if (err) {
              logger.error("Can't write compiled file : " + minfilename);
            }

            end();
            fs.close(fd);
          });
        } else {
          logger.error("Can't save compiled file : " + minfilename);
          end();
        }
      });
    });
  } else {
    end();
  }
}

// Aggregate all
function aggregateAll() {
  if (config.aggregateTo.length > 0) {
    var createCode = function(agg) {
      return [["/*", agg.filename, "*/"].join(" "), agg.code].join("\n");
    }

    // Sort by the order
    aggregates = aggregates.sort(sortAggregates);
    var code = 
      aggregates.reduce(function(a, b) {
        if (typeof(a) !== "string") { a = createCode(a); };
        b = createCode(b);
        return [a, b].join("\n");
      });
      
    if (typeof(code) !== "string") { code = createCode(code); }

    // Write aggregate file
    fs.mkdir(config.dest, 0755, function(err) {
      var filepath = config.dest + "/" + config.aggregateTo;
      fs.open(filepath, "w+", 0755, function(err, fd) {
        if (!err) {
          fs.write(fd, code, null, null, function(err) {
            fs.close(fd);
          });
        } else {
          logger.error("Can't write aggregate file");
        }
      });
    });
  }
}

function printJsLint(file, obj, doCompilation, exitOnError) {
  if (obj.jslint.success) {
    logger.log("JSLINT success : " + file);
    if (doCompilation) {
      compile(file, aggregate);
    }
  } else {
    logger.error("JSLINT error : " + file);
    util.showJslintErrors(obj.jslint.data);
  }	

  if (exitOnError) {
    process.exit(1);
  }
}

function printVows(object) {
  if (object.vows.stderr !== undefined && object.vows.stderr.length > 0) {
    logger.error("VOWS error: " + object.vows.stderr);
  } else {
	console.log(object.vows.data);
  }
}

function startProcessing() {
  // Start the process
  util.forEachJs(function(file) {
    if (config.runJslint && !util.isExcluded(file)) {
      // Run jslint
      r.jslint(file, function(obj) {
		printJsLint(file, obj, true, true);
      });
    } else {
      compile(file, aggregate);
    }
  });

  r.vows(config.vows, function(object) {
	printVows(object);
  });
}

function watchFiles() {
  r.vows(config.vows, function(val) { printVows(val); });

  util.forEachJs(function(file) {
    if (!util.isExcluded(file)) {
      r.watch(file, function(val) {
		internal_util.puts("\033[2J");
		internal_util.puts("-----------------------------------------".white.bold);
		internal_util.puts(("Change " + (new Date())).white.bold);
		internal_util.puts(("File " + file).white.bold);
		internal_util.puts("-----------------------------------------".white.bold);

        if (val.jslint) {
		  printJsLint(file, val, false, false);
        }

		if (val.vows) {
		  printVows(val);
	    }
      });
    }
  });
}

// If no arg, show usage
if (argv.installcompiler || argv.i) {
  // install compiler.jar
  util.installCompiler(argv.installcompiler || argv.i);
} else if (argv.w || argv.watch) {
  watchFiles();
} else if (argv.v || argv.version) {
  util.version();
} else if (argv._.length == 0 || argv.h || argv.help) {
  util.usage();
} else {
  startProcessing();
}


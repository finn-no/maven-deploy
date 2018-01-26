#!/usr/bin/env node

/**
 * Module dependencies.
 */

var program = require('commander');
var package = require('./package.json');
var maven = require('./');
var path = require('path');

var callback = function(err, stdout, stderr, verbose){
    if (err){
        console.error(verbose ? stderr : err.message);
        return false;
    }else{
        console.log(verbose ? stdout : 'done');
        return true;
    }

};

function parseConfigPath(config){
    console.log('PARSE', config);
    return path.isAbsolute(config) ? path.normalize(config) : path.normalize(path.join(process.cwd(),config));
}

program
    .version(package.version)
    .option('-c, --config <path>', 'Path of config file',parseConfigPath,path.normalize(path.join(process.cwd(),'.mvnconfig.json')))
    .option('-v, --verbose', 'Prints all logs', 0);

program.command('package').action(function (options) {
    try {
        var config = require(options.parent.config);
        maven.config(config);
        maven.package(callback);
    } catch (e) {
        console.error('ERROR:');
        console.error(e.message);
    }
});

program.command('install').action(function (options) {
    try {
        var config = require(options.parent.config);
        maven.config(config);
        maven.package(function (err, stdout, stderr) {
            if (callback(err,stdout,stderr, options.parent.verbose)){
                maven.install(callback);
            }
        });
    } catch (e) {
        console.error('ERROR:');
        console.error(e.message);
    }
});

program.command('deploy <repoid>')
    .option('-s, --snapshot', 'flags the artifact as SNAPSHOT', 0)
    .action(function (repoid, options) {
        var config = require(options.parent.config);
        maven.config(config);
        maven.package(function (err, stdout, stderr) {
            if (callback(err, stdout, stderr,options.parent.verbose)) {
                maven.deploy(repoid, !!options.snapshot, callback);
            }
        });
    });

program.parse(process.argv);

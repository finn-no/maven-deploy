var fs = require('fs');
var path = require('path');
var walk = require('fs-walk');
var JSZip = require('jszip');
var extend = require('util-extend');
var exec = require('child_process').exec;
var defineOpts = require('define-options');
var semver = require('semver');

var config = {
        buildDir: 'target',
        finalName: '{name}',
        type: 'war'
    },
    validateConfig = defineOpts({
        groupId       : 'string   - the Maven group id.',
        buildDir      : '?|string - build directory. default "' + config.buildDir + '".',
        finalName     : '?|string - the final name of the file created when the built project is packaged. default "' +
                        config.finalName + '"',
        type          : '?|string - "jar" or "war". default "' + config.type + '".'
    }),
    validateRepos = defineOpts({
        repositories  : 'object[] - array of repositories, each with id and url to a Maven repository'
    }),
    validateRepo = defineOpts({
        id            : 'string   - the Maven repository id',
        url           : 'string   - URL to the Maven repository'
    }),
    pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

function filterConfig () {
    Object.keys(config).forEach(function (key) {
        var value = config[key];
        if (typeof value != 'string') { return; }

        config[key] = value.replace(/{([^}]+)}/g, function (org, key) {
            if (pkg[key] === undefined) { return org; }
            return pkg[key];
        });
    });
}

function warPath () {
    return path.join(config.buildDir, config.finalName + '.' + config.type);
}

function mvnArgs (repoId, isSnapshot) {
    var args = {
        packaging    : config.type,
        file         : warPath(),
        groupId      : config.groupId,
        artifactId   : pkg.name,
        version      : pkg.version
    };
    if (repoId) {
        var repos = config.repositories, l = repos.length;
        for (var i=0; i<l; i++) {
            if (repos[i].id !== repoId) { continue; }
            args.repositoryId = repos[i].id;
            args.url          = repos[i].url;
            break;
        }
    }
    if (isSnapshot) {
        args.version = semver.inc(args.version, 'patch') + '-SNAPSHOT';
    }

    return Object.keys(args).reduce(function (arr, key) {
        return arr.concat('-D' + key + '=' + args[key]);
    }, []);
}

function check (err) {
    if (err) {
        if (err.code === 'ENOENT') {
            console.error(cmd + ' command not found. Do you have it in your PATH?');
        } else {
            console.error(err);
        }
        process.exit(1);
    }
}

function command (cmd, done) {
    console.log('Executing command: ' + cmd);
    exec(cmd, function (err, stdout, stderr) {
        check(err);
        if (done) { done(err, stdout, stderr); }
    });
}

function mvn (args, repoId, isSnapshot, done) {
    command('mvn ' + args.concat(mvnArgs(repoId, isSnapshot)).join(' '), done);
}

var maven = {
    config: function (c) {
        validateConfig(c);
        extend(config, c);
        filterConfig();
    },

    package: function (done) {
        var war = new JSZip();
        var fullDir = path.join(config.buildDir, pkg.name);

        walk.walkSync(fullDir, function (base, file, stat) {
            if (stat.isDirectory()) {
                return;
            }
            var filePath = path.join(base, file);
            var data = fs.readFileSync(filePath, {encoding: 'utf-8'});
            war.file(path.relative(fullDir, filePath), data);
        });

        var buffer = war.generate({type:"nodebuffer", compression:'DEFLATE'});
        fs.writeFileSync(warPath(), buffer);
        if (done) { done(); }
    },

    install: function (done) {
        this.package();
        mvn(['install:install-file'], null, true, done);
    },

    deploy: function (repoId, isSnapshot, done) {
        if (typeof isSnapshot == 'function') { done = isSnapshot; isSnapshot = false; }
        validateRepos(config);
        config.repositories.forEach(validateRepo);
        this.package();
        mvn(['deploy:deploy-file'], repoId, isSnapshot, done);
    }
};

module.exports = maven;

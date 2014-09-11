var fs = require('fs');
var path = require('path');
var walk = require('fs-walk');
var JSZip = require('jszip');
var extend = require('util-extend');
var exec = require('child_process').exec;
var defineOpts = require('define-options');
var semver = require('semver');
var isBinaryFileSync = require('isbinaryfile');

var config, pkg, validateConfig, validateRepos, validateRepo;
init();
validateConfig = defineOpts({
    groupId       : 'string   - the Maven group id.',
    artifactId    : '?|string - the Maven artifact id. default "' + config.artifactId + '".',
    buildDir      : '?|string - build directory. default "' + config.buildDir + '".',
    finalName     : '?|string - the final name of the file created when the built project is packaged. default "' +
                    config.finalName + '"',
    type          : '?|string - "jar" or "war". default "' + config.type + '".',
    fileEncoding  : '?|string - valid file encoding. default "' + config.fileEncoding + '"'
});

validateRepos = defineOpts({
    repositories  : 'object[] - array of repositories, each with id and url to a Maven repository'
});

validateRepo = defineOpts({
    id            : 'string   - the Maven repository id',
    url           : 'string   - URL to the Maven repository'
});

function init () {
    var defaultFileEncoding = 'utf-8';
    pkg = readPackageJSON(defaultFileEncoding);
    config = {
        buildDir: 'dist',
        artifactId   : pkg.name,
        finalName: pkg.name,
        type: 'war',
        fileEncoding: defaultFileEncoding
    };
}

function readPackageJSON (fileEncoding) {
    return JSON.parse(fs.readFileSync('./package.json', fileEncoding));
}

function archivePath () {
    return path.join(config.buildDir, config.finalName + '.' + config.type);
}

function mvnArgs (repoId, isSnapshot) {
    var args = {
        packaging    : config.type,
        file         : archivePath(),
        groupId      : config.groupId,
        artifactId   : config.artifactId,
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

function check (cmd, err, stdout, stderr) {
    if (err) {
        if (err.code === 'ENOENT') {
            console.error(cmd + ' command not found. Do you have it in your PATH?');
        } else {
            console.error(stdout);
            console.error(stderr);
        }
        exit();
    }
}

function command (cmd, done) {
    console.log('Executing command: ' + cmd);
    exec(cmd, function (err, stdout, stderr) {
        check(cmd, err, stdout, stderr);
        if (done) { done(err, stdout, stderr); }
    });
}

function mvn (args, repoId, isSnapshot, done) {
    command('mvn -B ' + args.concat(mvnArgs(repoId, isSnapshot)).join(' '), done);
}

function exit(){
    process.exit(1);
}

var maven = {
    config: function (c) {
        validateConfig(c);
        extend(config, c);
    },

    package: function (done) {
        var archive = new JSZip();

        walk.walkSync(config.buildDir, function (base, file, stat) {
            if (stat.isDirectory() || file.indexOf(config.finalName + '.' + config.type) === 0) {
                return;
            }
            var filePath = path.join(base, file);

            var data;
            if(isBinaryFileSync(filePath)) {
                data = fs.readFileSync(filePath);
            } else {
                data = fs.readFileSync(filePath, {'encoding': config.fileEncoding});
            }

            archive.file(path.relative(config.buildDir, filePath), data);
        });

        var buffer = archive.generate({type:'nodebuffer', compression:'DEFLATE'});
        var arPath = archivePath();
        fs.writeFileSync(arPath, buffer);

        if (done) { done(); }
    },

    install: function (done) {
        this.package();
        mvn(['install:install-file'], null, true, done);
    },

    deploy: function (repoId, isSnapshot, done) {
        if (typeof isSnapshot == 'function') { done = isSnapshot; isSnapshot = false; }
        validateRepos(config);
        if (config.repositories.length === 0) {
            throw new Error('Maven repositories have to include at least one repository with ‘id’ and ‘url’.');
        }
        config.repositories.forEach(validateRepo);
        this.package();
        mvn(['deploy:deploy-file'], repoId, isSnapshot, done);
    },

    // only for tests - do not use externally
    _init: init,
    _getPkg: function () { return pkg; },
    _setPkg: function (_pkg) { pkg = _pkg; },
    _mockExec: function (mock) { exec = mock; },
    _getConfig: function () { return config; },
    _setConfig: function (conf) { config = conf; }
};

module.exports = maven;

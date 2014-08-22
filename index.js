var fs = require('fs');
var path = require('path');
var walk = require('fs-walk');
var extend = require('util-extend');
var exec = require('child_process').exec;
var defineOpts = require('define-options');
var semver = require('semver');
var archiver = require('archiver');

var config = {
        buildDir: 'dist',
        finalName: '{name}',
        type: 'war',
        fileEncoding: 'utf-8'
    },
    validateConfig = defineOpts({
        groupId       : 'string   - the Maven group id.',
        buildDir      : '?|string - build directory. default "' + config.buildDir + '".',
        finalName     : '?|string - the final name of the file created when the built project is packaged. default "' +
                        config.finalName + '"',
        type          : '?|string - "jar" or "war". default "' + config.type + '".',
        fileEncoding  : '?|string - valid file encoding. default "' + config.fileEncoding + '"'
    }),
    validateRepos = defineOpts({
        repositories  : 'object[] - array of repositories, each with id and url to a Maven repository'
    }),
    validateRepo = defineOpts({
        id            : 'string   - the Maven repository id',
        url           : 'string   - URL to the Maven repository'
    }),
    pkg = JSON.parse(fs.readFileSync('./package.json', config.fileEncoding));

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

function archivePath () {
    return config.finalName + '.' + config.type;
}

function mvnArgs (repoId, isSnapshot) {
    var args = {
        packaging    : config.type,
        file         : archivePath(),
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

function check (err, stdout, stderr) {
    if (err) {
        if (err.code === 'ENOENT') {
            console.error(cmd + ' command not found. Do you have it in your PATH?');
        } else {
            console.error(stdout);
            console.error(stderr);
        }
        process.exit(1);
    }
}

function command (cmd, done) {
    console.log('Executing command: ' + cmd);
    exec(cmd, function (err, stdout, stderr) {
        check(err, stdout, stderr);
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

        var output = fs.createWriteStream(archivePath());

        var archive;
        switch(config.type) {
            case 'war':
            case 'jar':
                archive = archiver('zip');
                break;
            case 'tar.gz':
                archive = archiver('tar', { gzip: true });
                break;
            default:
                archive = archiver(config.type);
        };

        archive.pipe(output);

        archive.bulk([
            { expand: true, cwd: config.buildDir, src: ['**'] }
        ]);

        archive.finalize();

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

var fs = require('fs');
var path = require('path');
var walk = require('fs-walk');
var JSZip = require('jszip');
var extend = require('util-extend');
var exec = require('child_process').exec;
var defineOpts = require('define-options');
var semver = require('semver');
var isBinaryFile = require('isbinaryfile');

var validateConfig, validateRepos, validateRepo, userConfig;

const DEFAULT_CONFIG = {
    artifactId: '{name}',
    buildDir: 'dist',
    finalName: '{name}',
    type: 'war',
    fileEncoding: 'utf-8',
    version: '{version}',
    generatePom: true
};

validateConfig = defineOpts({
    groupId       : 'string   - the Maven group id.',
    artifactId    : '?|string - the Maven artifact id. default "' + DEFAULT_CONFIG.artifactId + '".',
    classifier    : '?|string - the Maven optional classifier.',
    buildDir      : '?|string - build directory. default "' + DEFAULT_CONFIG.buildDir + '".',
    finalName     : '?|string - the final name of the file created when the built project is packaged. default "' +
                    DEFAULT_CONFIG.finalName + '"',
    type          : '?|string - "jar" or "war". default "' + DEFAULT_CONFIG.type + '".',
    fileEncoding  : '?|string - valid file encoding. default "' + DEFAULT_CONFIG.fileEncoding + '"',
    generatePom   : '?|boolean - "true" or "false". default "' + DEFAULT_CONFIG.generatePom + '".'
});

validateRepos = defineOpts({
    repositories  : 'object[] - array of repositories, each with id and url to a Maven repository'
});

validateRepo = defineOpts({
    id            : 'string   - the Maven repository id',
    url           : 'string   - URL to the Maven repository'
});

function convertPathIntoUnixLike (path) {
    return path.replace(/\\/g, '/');
}

function readPackageJSON (encoding) {
    return JSON.parse(fs.readFileSync('package.json', encoding));
}

function filterConfig (configTmpl, pkg) {
    // create a config object from the config template
    // replace {key} with the key's value in package.json
    var obj = extend({}, configTmpl);
    Object.keys(obj).forEach(function (key) {
        var value = obj[key];
        if (typeof value != 'string') { return; }

        obj[key] = value.replace(/{([^}]+)}/g, function (org, key) {
            if (pkg[key] === undefined) { return org; }
            return pkg[key];
        });
    });

    return obj;
}

function archivePath (isSnapshot) {
    var conf = getConfig(isSnapshot);
    return path.join(conf.buildDir, conf.finalName + '.' + conf.type);
}

function mvnArgs (repoId, isSnapshot, file) {
    var conf = getConfig(isSnapshot);

    var args = {
        packaging    : conf.type,
        file         : file,
        groupId      : conf.groupId,
        artifactId   : conf.artifactId,
        classifier   : conf.classifier,
        version      : conf.version,
        generatePom  : conf.generatePom
    };

    if (repoId) {
        var repos = conf.repositories, l = repos.length;
        for (var i=0; i<l; i++) {
            if (repos[i].id !== repoId) { continue; }
            args.repositoryId = repos[i].id;
            args.url          = repos[i].url;
            break;
        }
    }

    return Object.keys(args).filter(function (key) {
        return typeof args[key] !== 'undefined';
    }).reduce(function (arr, key) {
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

function getConfig (isSnapshot) {
    var configTmpl = extend({}, DEFAULT_CONFIG);
    if (userConfig) { configTmpl = extend(configTmpl, userConfig); }

    var pkg = readPackageJSON(configTmpl.fileEncoding);

    if (isSnapshot) {
        pkg.version = semver.inc(pkg.version, 'patch') + '-SNAPSHOT';
    }

    return filterConfig(configTmpl, pkg);
}

function package (isSnapshot, done) {
    if (typeof isSnapshot == 'function') { done = isSnapshot; isSnapshot = false; }
    var archive = new JSZip();
    var conf = getConfig(isSnapshot);

    walk.walkSync(conf.buildDir, function (base, file, stat) {
        if (stat.isDirectory() || file.indexOf(conf.finalName + '.' + conf.type) === 0) {
            return;
        }
        var filePath = path.join(base, file);

        var data;
        if(isBinaryFile.sync(filePath)) {
            data = fs.readFileSync(filePath);
        } else {
            data = fs.readFileSync(filePath, {'encoding': conf.fileEncoding});
        }

        archive.file(convertPathIntoUnixLike(path.relative(conf.buildDir, filePath)), data, {createFolders: true});
    });

    var buffer = archive.generate({type:'nodebuffer', compression:'DEFLATE'});
    var arPath = archivePath(isSnapshot);
    console.log('archive path', arPath);
    fs.writeFileSync(arPath, buffer);

    if (done) { done(); }
    return arPath;
}

function mvn (args, repoId, isSnapshot, file, done) {
    if (!file) { file = package(isSnapshot); }

    // check if file exists
    fs.statSync(file);

    command('mvn -B ' + args.concat(mvnArgs(repoId, isSnapshot, file)).join(' '), done);
}

function exit(){
    process.exit(1);
}

function setUserConfig (_userConfig) {
    validateConfig(_userConfig);
    userConfig = _userConfig;
}

var maven = {
    config: setUserConfig,

    package: package,

    install: function (file, done) {
        if (typeof file == 'function') { done = file; file = undefined; }
        mvn(['install:install-file'], null, true, file, done);
    },

    deploy: function (repoId, file, isSnapshot, done) {
        var conf = getConfig();
        if (file && typeof file != 'string') { done = isSnapshot; isSnapshot = file; file = undefined; }
        if (isSnapshot && typeof isSnapshot != 'boolean') { done = isSnapshot; isSnapshot = false; }

        validateRepos(conf);
        if (conf.repositories.length === 0) {
            throw new Error('Maven repositories have to include at least one repository with ‘id’ and ‘url’.');
        }
        conf.repositories.forEach(validateRepo);
        mvn(['deploy:deploy-file'], repoId, isSnapshot, file, done);
    }
};

module.exports = maven;

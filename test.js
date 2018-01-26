/* globals describe, it, beforeEach, afterEach */
/*jshint expr: true*/
var assert = require('assert');
var path = require('path');
var sinon = require('sinon');
var extend = require('util-extend');
var proxyquire = require('proxyquire');
var fsMock = require('mock-fs');
var fsReal = require('fs');
var semver = require('semver');
var JSZip = require('jszip');
var bufferEqual = require('buffer-equal');
var maven, fs;

var BINARY_FILE = fsReal.readFileSync('px.png');

var lastCmd, cmdCallback;

const GROUP_ID = 'com.dummy',
    TEST_CLASSIFIER = 'test',
    DUMMY_REPO_SNAPSHOT = {
        'id': 'dummy-repo',
        'url': 'http://mavendummyrepo.com/dummy/'
    },
    DUMMY_REPO_RELEASE = {
        'id': 'dummy-repo-release',
        'url': 'http://mavendummyrepo.com/dummy-release/'
    },
    TEST_CONFIG = {
        groupId: GROUP_ID,
        repositories: [DUMMY_REPO_SNAPSHOT, DUMMY_REPO_RELEASE],
        classifier: TEST_CLASSIFIER,
        generatePom: false
    },
    TEST_CONFIG_WITH_MANIFEST = {
        groupId: GROUP_ID,
        repositories: [DUMMY_REPO_SNAPSHOT, DUMMY_REPO_RELEASE],
        classifier: TEST_CLASSIFIER,
        generatePom: false,
        generateManifest: true
    },
    TEST_PKG_JSON = {
        name: 'test-pkg',
        version: '1.0.0'
    },
    TEST_CONFIG_WITH_POM = {
        groupId: GROUP_ID,
        repositories: [DUMMY_REPO_SNAPSHOT, DUMMY_REPO_RELEASE],
        classifier: TEST_CLASSIFIER,
        generatePom: false,
        pomFile: 'existing-pom.xml'
    };

var childProcessMock;
var execSpy;

function createFakeFS () {
    var fakeFS = fsMock.fs({
        'package.json': JSON.stringify(TEST_PKG_JSON),
        'dist': {
            'js': {
                'index.js': 'console.log("test")',
            },
            'README.md': '## README\nlorum ipsum',
            'px.png': BINARY_FILE
        }
    });
    return fakeFS;
}

function npmVersion (next) {
    var fileName = 'package.json';
    var pkg = JSON.parse(fs.readFileSync(fileName), {encoding: 'utf-8'});
    pkg.version = next;
    fs.writeFileSync(fileName, JSON.stringify(pkg), {encoding: 'utf-8'});
}

function warFileInDist () {
    return fs.readdirSync('./dist/').filter(function (fileName) {
        return /\.war$/.test(fileName);
    })[0];
}

function warFileInDistAsZip () {
    var pathToWarFile = warFileInDist();
    var context = fs.readFileSync('./dist/' + pathToWarFile);
    return new JSZip(context);
}

function assertWarFileToEqual (expectedName) {
    var warFile = warFileInDist();
    assert.ok(warFile);
    assert.equal(warFile, expectedName);
}

function assertWarFileContainsManifest(){
    var warFile = warFileInDistAsZip();
    assert.ok(warFile.file('META-INF/MANIFEST.MF'));
}

function arrayContains (arr, value) {
    return arr.indexOf(value) !== -1;
}

function assertArgs (cmd, expectedArgs) {
    var actualArgs = cmd.split(/\s+/);
    expectedArgs.forEach(function (expectedArg) {
        assert.ok(arrayContains(actualArgs, expectedArg), expectedArg + ' should be part of the command: ' + cmd);
    });
}

function assertNotArgs (cmd, unexpectedArgs) {
    var actualArgs = cmd.split(/\s+/);
    unexpectedArgs.forEach(function (expectedArg) {
        assert.ok(!arrayContains(actualArgs, expectedArg), expectedArg + ' should not be part of the command: ' + cmd);
    });
}

describe('maven-deploy', function () {
    beforeEach(function () {
        lastCmd = undefined;
        cmdCallback = undefined;

        childProcessMock = {
            exec: sinon.spy(),
            spawn: sinon.spy(),
            fork: sinon.spy()
        };

        execSpy = childProcessMock.exec;

        fs = createFakeFS();

        maven = proxyquire('./index.js', {
            'child_process': childProcessMock,
            'fs': fs,
            'fs-walk': proxyquire('fs-walk', {'fs': fs}),
            'isbinaryfile': proxyquire('isbinaryfile', {'fs': fs})
        });
    });

    afterEach(function () {
        fs = null;
        childProcessMock = null;
    });

    describe('config', function () {
        it('should throw an error if groupId is missing', function () {
            assert.throws(function () {
                maven.config({
                    repositories: [DUMMY_REPO_SNAPSHOT]
                });
            });
        });
    });

    describe('package', function () {
        it('should create an archive based on defaults', function () {
            maven.config(TEST_CONFIG);
            maven.package();

            assertWarFileToEqual(TEST_PKG_JSON.name + '.war');
        });

        it('should have a fresh version number if the package version has changed after config(...)', function () {
            const EXPECTED_VERSION = '1.2.3';

            maven.config( extend({finalName: '{name}-{version}'}, TEST_CONFIG) );
            npmVersion(EXPECTED_VERSION);
            maven.package();

            assertWarFileToEqual(TEST_PKG_JSON.name + '-' + EXPECTED_VERSION + '.war');
        });

        it('should create a manifest file', function () {
            maven.config(TEST_CONFIG_WITH_MANIFEST);
            maven.package();
            assertWarFileToEqual(TEST_PKG_JSON.name + '.war');
            assertWarFileContainsManifest();

        });
    });

    describe('install', function () {

        it('should exec "mvn"', function () {
            maven.config(TEST_CONFIG);
            maven.install();
            assert.ok(execSpy.calledOnce);
            assert.ok(execSpy.calledWithMatch(/^mvn /));
        });

        it('should pass expected arguments to "mvn"', function () {
            const EXPECTED_ARGS = [
                '-B',
                'install:install-file',
                '-Dpackaging=war',
                '-Dfile=dist' + path.sep + TEST_PKG_JSON.name + '.war',
                '-DgroupId=' + GROUP_ID,
                '-DartifactId=' + TEST_PKG_JSON.name,
                '-Dclassifier=' + TEST_CLASSIFIER
            ];
            maven.config(TEST_CONFIG);
            maven.install();

            assertArgs(execSpy.args[0][0], EXPECTED_ARGS);
        });

        it('should pass pomFile to "mvn" when given', function () {
            const EXPECTED_ARGS = [
                '-B',
                'install:install-file',
                '-Dpackaging=war',
                '-Dfile=dist' + path.sep + TEST_PKG_JSON.name + '.war',
                '-DgroupId=' + GROUP_ID,
                '-DartifactId=' + TEST_PKG_JSON.name,
                '-Dclassifier=' + TEST_CLASSIFIER,
                '-DpomFile=' + TEST_CONFIG_WITH_POM.pomFile
            ];
            maven.config(TEST_CONFIG_WITH_POM);
            maven.install();

            assertArgs(execSpy.args[0][0], EXPECTED_ARGS);
        });

        it('should filter undefined arguments', function () {
            const UNEXPECTED_ARGS = [
                '-Dclassifier=undefined'
            ];
            maven.config({
                groupId: GROUP_ID,
                repositories: [DUMMY_REPO_SNAPSHOT]
            });
            maven.install();

            assertNotArgs(execSpy.args[0][0], UNEXPECTED_ARGS);
        });

        it('should increase patch-version and add -SNAPSHOT to the version to follow Maven conventions', function () {
            const EXPECTED_VERSION_ARG = '-Dversion=' + semver.inc(TEST_PKG_JSON.version, 'patch') + '-SNAPSHOT';
            maven.config(TEST_CONFIG);
            maven.install();
            var cmd = childProcessMock.exec.args[0][0].split(/\s+/);

            assert.ok(arrayContains(cmd, EXPECTED_VERSION_ARG), 'cmd should contain ' + EXPECTED_VERSION_ARG +
                ', but does not.\ncmd: ' + cmd);
        });

        it('should include -SNAPSHOT in the filename if finalName includes {version}', function () {
            var EXPECTED_FILENAME = TEST_PKG_JSON.name + '-' + semver.inc(TEST_PKG_JSON.version, 'patch') +
                '-SNAPSHOT.war';
            var config = extend({}, TEST_CONFIG);
            config.finalName = '{name}-{version}';

            maven.config(config);
            maven.install();

            assertWarFileToEqual(EXPECTED_FILENAME);
        });

        it('should install file from arguments if specified', function () {
            const CUSTOM_FILE = 'file-from-args.jar';
            const EXPECTED_ARGS = ['-Dfile='+CUSTOM_FILE];

            var zip = new JSZip();
            zip.file('test.txt', 'test');
            fs.writeFileSync(CUSTOM_FILE, zip.generate({type:'nodebuffer', compression:'DEFLATE'}));

            maven.config(TEST_CONFIG);
            maven.install(CUSTOM_FILE);

            assertArgs(execSpy.args[0][0], EXPECTED_ARGS);
        });

        it('should throw error if file from arguments does not exist', function () {
            const CUSTOM_FILE = 'non-existing-file-from-args.jar';
            maven.config(TEST_CONFIG);

            assert.throws(function () {
                maven.install(CUSTOM_FILE);
            }, /ENOENT, no such file or directory/);
        });

        it('should call callback function when done successfully', function () {
            var spy = sinon.spy();
            maven.config(TEST_CONFIG);
            maven.install(spy);

            // fake successful exec
            var execCallback = execSpy.args[0][1];
            execCallback(null, 'stdout', null);

            assert.ok(spy.calledOnce);
            assert.equal(spy.args[0][1], 'stdout');
        });
    });

    describe('deploy', function () {
        it('should throw an error if repositories is empty', function () {
            assert.throws(function () {
                maven.config({
                    groupId: GROUP_ID
                });
                maven.deploy('dummy-repo', true);
            });

            assert.throws(function () {
                maven.config({
                    groupId: GROUP_ID,
                    repositories: []
                });
                maven.deploy('dummy-repo', true);
            });
        });

        it('should add correct repositoryId and url', function () {
            const EXPECTED_ARGS = [
                '-DrepositoryId='+DUMMY_REPO_RELEASE.id,
                '-Durl='+DUMMY_REPO_RELEASE.url
            ];
            maven.config(TEST_CONFIG);
            maven.deploy(DUMMY_REPO_RELEASE.id, false);

            assertArgs(execSpy.args[0][0], EXPECTED_ARGS);
        });

        it('should add file argument', function () {
            const EXPECTED_ARGS = ['-Dfile=dist/test-pkg.war'];
            maven.config(TEST_CONFIG);
            maven.deploy(DUMMY_REPO_RELEASE.id, false);
            assertArgs(execSpy.args[0][0], EXPECTED_ARGS);
        });

        it('should add version argument', function () {
            const EXPECTED_ARGS = ['-Dversion=1.0.0'];
            maven.config(TEST_CONFIG);
            maven.deploy(DUMMY_REPO_RELEASE.id, false);
            assertArgs(execSpy.args[0][0], EXPECTED_ARGS);
        });

        it('should deploy file from arguments if specified', function () {
            const CUSTOM_FILE = 'file-from-args.jar';
            const EXPECTED_ARGS = [
                '-Dfile='+CUSTOM_FILE,
                '-Dversion='+TEST_PKG_JSON.version
            ];

            var zip = new JSZip();
            zip.file('test.txt', 'test');
            fs.writeFileSync(CUSTOM_FILE, zip.generate({type:'nodebuffer', compression:'DEFLATE'}));

            maven.config(TEST_CONFIG);
            maven.deploy(DUMMY_REPO_RELEASE, CUSTOM_FILE);
            maven.deploy(DUMMY_REPO_RELEASE, CUSTOM_FILE, false);
            maven.deploy(DUMMY_REPO_RELEASE, CUSTOM_FILE, false, sinon.spy());
            maven.deploy(DUMMY_REPO_RELEASE, CUSTOM_FILE, sinon.spy());

            assert.equal(execSpy.callCount, 4);

            for (var i=0; i<4; i++) {
                assertArgs(execSpy.args[i][0], EXPECTED_ARGS);
            }
        });

        it('should call callback function when done successfully', function () {
            var spy = sinon.spy();

            maven.config(TEST_CONFIG);
            maven.deploy(DUMMY_REPO_RELEASE.id, spy);
            maven.deploy(DUMMY_REPO_RELEASE.id, false, spy);
            maven.deploy(DUMMY_REPO_RELEASE.id, true, spy);
            maven.deploy(DUMMY_REPO_RELEASE.id, 'package.json', spy);
            maven.deploy(DUMMY_REPO_RELEASE.id, 'package.json', false, spy);

            assert.equal(execSpy.callCount, 5);

            for (var i=0; i<5; i++) {
                // fake successful exec
                execSpy.args[i][1](null, 'stdout', null);
            }

            assert.equal(spy.callCount, 5);
            assert.equal(spy.args[0][1], 'stdout');
        });

        it('should not generate pom', function () {
            const EXPECTED_ARGS = ['-DgeneratePom=false'];
            maven.config(TEST_CONFIG);
            maven.deploy(DUMMY_REPO_RELEASE.id, false);
            assertArgs(execSpy.args[0][0], EXPECTED_ARGS);
        });
    });

    describe('archive', function () {
        it('should zip file with unix-style path', function () {
            maven.config(TEST_CONFIG);
            maven.package();

            var zip = warFileInDistAsZip();
            assert.ok(zip.file('js/index.js'));
        });

        it('should zip file with non-virtual folders', function () {
            maven.config(TEST_CONFIG);
            maven.package();

            var zip = warFileInDistAsZip();
            assert.equal(zip.folder(/^js/).length, 1);
        });

        it('should save binary files correctly', function () {
            maven.config(TEST_CONFIG);
            maven.package();

            var zip = warFileInDistAsZip();
            var image = zip.file('px.png');
            assert.ok(image, 'archive should contain px.png image');
            var imageEqualOriginal = bufferEqual(new Buffer( new Uint8Array(image.asArrayBuffer()) ), BINARY_FILE);
            assert.ok(imageEqualOriginal, 'image data equals the original');
        });
    });

});

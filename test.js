var assert = require('assert');
var maven = require('./index.js');
var shell = require('shelljs');
var extend = require('util-extend');

var lastCmd, cmdCallback;
var mockExec = function (cmd, callback) {
    lastCmd = cmd;
    cmdCallback = callback;
};

const GROUP_ID = 'com.dummy',
    DUMMY_REPO = {
        "id": "dummy-repo",
        "url": "http://mavendummyrepo.com/dummy/"
    },
    TEST_CONFIG = {
        groupId: GROUP_ID,
        repositories: [DUMMY_REPO]
    };

function createDist (buildDir) {
    buildDir = buildDir || 'dist';
    shell.mkdir('-p', buildDir + '/js');
    shell.cp('index.js', buildDir + '/js');
    shell.cp('README.md', buildDir);
}

function removeDist (buildDir) {
    buildDir = buildDir || 'dist';
    shell.rm('-rf', 'dist');
}

describe('maven-deploy', function () {
    beforeEach(function () {
        lastCmd = undefined;
        cmdCallback = undefined;
        maven._init();
        createDist();
    });

    afterEach(function () {
        removeDist();
    });

    describe('config', function () {
        it('should throw an error if groupId is missing', function () {
            assert.throws(function () {
                maven.config({
                    repositories: [DUMMY_REPO]
                });
            });
        });
    });

    describe('package', function () {
        it('should create an archive based on defaults', function () {
            var expectedPath = './dist/maven-deploy.war';
            maven.config(TEST_CONFIG);
            maven.package();
            assert.ok(shell.test('-f', expectedPath), 'Expected archive to be at: ' + expectedPath);
        });

        /*it('should have a fresh version number if the package version has changed after config', function () {
            var cfg = extend({finalName: '{name}-{version}'}, TEST_CONFIG);
            maven.config(cfg);
            // TODO Change version in package.json. Preferably not for real.
            maven.package();
            assert.ok(shell.test('-f', expectedPath), 'Expected archive to be at: ' + expectedPath);
        });*/
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
    });
});

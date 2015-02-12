/* globals describe, it, beforeEach, afterEach */
var assert = require('assert');
var expect = require('chai').expect;
var sinon = require('sinon');
var extend = require('util-extend');
var proxyquire = require('proxyquire');
var fsMock = require('mock-fs');
var maven, fs;

var lastCmd, cmdCallback;

const GROUP_ID = 'com.dummy',
    DUMMY_REPO = {
        'id': 'dummy-repo',
        'url': 'http://mavendummyrepo.com/dummy/'
    },
    TEST_CONFIG = {
        groupId: GROUP_ID,
        repositories: [DUMMY_REPO]
    },
    TEST_PKG_JSON = {
        name: 'test-pkg',
        version: '1.0.0'
    };

var childProcessMock;

function createFakeFS () {
    var fakeFS = fsMock.fs({
        'package.json': JSON.stringify(TEST_PKG_JSON),
        'dist': {
            'js': {
                'index.js': 'console.log("test")',
            },
            'README.md': '## README\nlorum ipsum'
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

function expectWarFileToEqual (expectedName) {
    var warFile = warFileInDist();
    expect(warFile).to.exist();
    expect(warFile).to.equal(expectedName);
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
                    repositories: [DUMMY_REPO]
                });
            });
        });
    });

    describe('package', function () {
        it('should create an archive based on defaults', function () {
            maven.config(TEST_CONFIG);
            maven.package();

            expectWarFileToEqual(TEST_PKG_JSON.name + '.war');
        });

        it('should have a fresh version number if the package version has changed after config(...)', function () {
            const EXPECTED_VERSION = '1.2.3';

            maven.config( extend({finalName: '{name}-{version}'}, TEST_CONFIG) );
            npmVersion(EXPECTED_VERSION);
            maven.package();

            expectWarFileToEqual(TEST_PKG_JSON.name + '-' + EXPECTED_VERSION + '.war');
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
    });
});

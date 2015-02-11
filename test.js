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
            var warFile = fs.readdirSync('./dist/').filter(function (fileName) {
                return /\.war$/.test(fileName);
            })[0];
            expect(warFile).to.exist();
            expect(warFile).to.equal(TEST_PKG_JSON.name + '.war');
        });

        it('should have a fresh version number if the package version has changed after config(...)', function () {
            var cfg = extend({finalName: '{name}-{version}'}, TEST_CONFIG);
            var newPkgJSON = extend(TEST_PKG_JSON, {version: '1.0.1'});

            maven.config(cfg);

            fs.writeFileSync('package.json', JSON.stringify(newPkgJSON), {encoding: 'utf-8'});

            maven.package();

            var warFile = fs.readdirSync('./dist/').filter(function (fileName) {
                return /\.war$/.test(fileName);
            })[0];
            expect(warFile).to.exist();
            expect(warFile).to.equal(TEST_PKG_JSON.name + '-' + newPkgJSON.version + '.war');
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

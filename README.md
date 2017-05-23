# maven-deploy

[![Build Status](https://travis-ci.org/finn-no/maven-deploy.svg?branch=master)](https://travis-ci.org/finn-no/maven-deploy)
[![Coverage Status](https://coveralls.io/repos/finn-no/maven-deploy/badge.svg?branch=master)](https://coveralls.io/r/finn-no/maven-deploy?branch=master)
[![Dependencies status](https://david-dm.org/finn-no/maven-deploy.svg)](https://david-dm.org/finn-no/maven-deploy)

A simple Node.js module to create a war-/jar-package and install/deploy to a local/remote Maven repository. It uses
`mvn` to do the actual deployment, so you need maven installed locally.

Project name and version is extracted from package.json and used as artifactId and maven version. Supply an object
litteral with other Maven related config. Values from package.json can be used by adding curly-braces around the key.
Example `{finalName: "{name}-{version}"}`.

The package is created from the `{buildDir}/` folder. So you need to make sure that the files you want in the
package is put there before packaging. The default is `dist/`. The package file will be output in the same folder.

    var config = {
        "groupId"      : "com.example",    // required - the Maven group id.
        "artifactId"   : "{name}",         // the Maven artifact id.
        "buildDir"     : "dist",           // project build directory.
        "finalName"    : "{name}",         // the final name of the file created when the built project is packaged.
        "type"         : "war",            // type of package. "war" or "jar" supported.
        "fileEncoding" : "utf-8",          // file encoding when traversing the file system, default is UTF-8
        "generatePom"  : true,             // generate a POM based on the configuration
        "pomFile"      : "pom.xml",        // use this existing pom.xml instead of generating one (generatePom must be false)
        "version"      : "{version}",      // sets the final version of the release
        "semver"       : "minor",          // increases package.json's version. Values here can be any semver.inc release
                                           // type strings, or an array of the release type and prerelease components.
        "repositories" : [                 // array of repositories, each with id and url to a Maven repository.
          {
            "id": "example-internal-snapshot",
            "url": "http://mavenproxy.example.com/example-internal-snapshot/"
          },
          {
            "id": "example-internal-release",
            "url": "http://mavenproxy.example.com/example-internal-release/"
          }
        ]
    };

It might be useful to store the config as a separate json-file, so you can re-use it in multiple files.

    var config = require('./maven-config.json');

## Package war/jar
It expects output from the project to be in dist/ directory. It zips the content and outputs it to
dist/{finalName}.{type}
Usage: `maven.package( [callback] )`

Example:

    var maven = require('maven-deploy');
    maven.config(config);
    maven.package();

## Install to local repository
Runs package first, then installs the package to your local Maven repository.
Usage: `maven.install( [callback] )`

Example:

    var maven = require('maven-deploy');
    maven.config(config);
    maven.install();

## Deploy
Runs package first, then deploys the package to the specified Maven repository.
Usage: `maven.deploy( repositoryId, [snapshot = false], [callback])`

### Example: deploy to snapshot repo
    var maven = require('maven-deploy');
    maven.config(config);
    maven.deploy('example-internal-snapshot', true);

### Example: deploy to release repo

    var maven = require('maven-deploy');
    maven.config(config);
    maven.deploy('example-internal-release');

### Example: deploy existing archive file

    var maven = require('maven-deploy');
    maven.config(config);
    maven.deploy('example-internal-release', 'file.jar');

## Versioning
By default, an artifact's version is based on the version in package.json (ie. config.version==='{version}'). To control the version in package.json, you can specify the semver release type param and any prerelease params.
All prerelease components in the resulting version will be turned into maven qualifiers and separated by '-' instead of '.'. For example 1.2.3-alpha.3 will be 1.2.3-alpha-3

Note: semver is not configured by default for release artifacts.

### Snapshots

All snapshot builds will have the '-SNAPSHOT' qualifier appended to them.
As well, if a version has prerelease components then the last build number will be dropped in place of the SNAPSHOT qualifier.

Note: semver is set to 'patch' by default for snapshot artifacts.

### Example: bumping the patch version

    console.log(packageJson.version); //1.2.3
    config.semver = 'patch';
    maven.config(config);
    maven.deploy('example-internal-release');
    //artifact version will be 1.2.4

### Example: bumping the release candidate version

    console.log(packageJson.version); //1.2.3-alpha.3
    config.semver = ['prerelease', 'alpha'];
    maven.config(config);
    maven.deploy('example-internal-release');
    //artifact version will be 1.2.3-alpha-4

### Example: replacing build numbers with SNAPSHOT

    console.log(packageJson.version); //1.2.3-alpha.3
    config.semver = ['prerelease', 'alpha'];
    maven.config(config);
    maven.deploy('example-internal-release', true);
    //artifact version will be 1.2.3-alpha-SNAPSHOT

## Contributing

We would love your contribution, please consult the [contributing](CONTRIBUTE.md) page for how to make your contributions land into the project as easily as possible.

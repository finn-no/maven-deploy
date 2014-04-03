# maven-deploy

A simple NodeJS module to create a war/jar package and install to a local Maven repository or deploy to a remote one.
It uses `mvn` to do the actual deployment, so you need maven installed locally.

Project name and version is extracted from package.json and used as artifactId and maven version. Supply an object
litteral with other Maven related config. Values from package.json can be used by adding curly-braces around the key.
Example `{finalName: "{name}-{version}"}`.

The package is created from the `{buildDir}/{finalName}` folder. So you need to make sure that the files you want in the
package is put there before packaging. The default is `target/your-project-name`.

    var config = {
        "groupId"      : "com.example",    // required - the Maven group id.
        "buildDir"     : "target",         // project build directory.
        "finalName"    : "{name}",         // the final name of the file created when the built project is packaged.
        "type"         : "war",            // type of package. "war" or "jar" supported.
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

## Contributing
If you have ideas how to improve this (or other things), please contribute :D

Haven't really settled on if it's a good idea to follow the Maven-way with target/project-name. Using a config with a
list of globs to find resources to add to the package could be more node-ish, but then you'd need some sort of mapping
if you want a different layout.

## Package war/jar
It expects output from the project to be in target/{finalName} directory. It zips the content and outputs it to
target/{finalName}.{type}
Usage: `maven.package( [callback] )`

Example:

    var maven = require('maven');
    maven.config(config);
    maven.package();

## Install to local repository
Runs package first, then installs the package to your local Maven repository.
Usage: `maven.install( [callback] )`

Example:

    var maven = require('maven');
    maven.config(config);
    maven.install();

## Deploy
Runs package first, then deploys the package to the specified Maven repository.
Usage: `maven.deploy( repositoryId, [snapshot = false], [callback])`

### Example: deploy to snapshot repo
    var maven = require('maven');
    maven.config(config);
    maven.deploy('example-internal-snapshot', true);

### Example: deploy to release repo

    var maven = require('maven');
    maven.config(config);
    maven.deploy('example-internal-release');

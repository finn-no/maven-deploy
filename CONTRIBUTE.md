# We would love your contribution!

The best thing is to always file an issue before submitting a pull-request. This is not a requirement, but a general best practice. This makes it easier to discuss the issue before any code is written. Sometimes the issues might already be fixed or will be out of scope for the module.

## Pull requests

* Please use [Test-Driven-Development](http://en.wikipedia.org/wiki/Test-driven_development) when changing something
  * Create small and readable unit-tests in test.js to verify a bug or feature
  * When the test fails, do the changes in index.js to verify the change
* Make sure you run all tests (`npm test`) to verify nothing broke
* Do not alter the version number, this is done in the release process

## Code Style Guide

Follow the jshint-rules. Verify by running `npm run lint`.

If possible use the _.editorconfig_ file in the project as it automates the rule [see [EditorConfig.org](http://editorconfig.org/)]. Below is a summary:

* code should be indented with 4 spaces
* single quotes should be used where feasible

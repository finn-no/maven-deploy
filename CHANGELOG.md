# Changelog

## Next major release
* BREAKING CHANGE: Do not exit if `mvn` command fails. Pass error, stdout and stderr to callback instead.
* Switch to async API

## 1.5.0
* No change since 1.5.0-beta

## 1.5.0-beta
* Add [generatePom](https://maven.apache.org/plugins/maven-deploy-plugin/deploy-file-mojo.html#generatePom) config-option
* Update some dev-dependencies and remove coveralls as runtime dependency
* Fix some lint errors

## 1.4.1
* Fix bug for deploy (Issue #31)

## 1.4.0
* Add optional file argument to pass an archive instead of generating one
* Update dependencies

## 1.3.2
* Fix undocumented breaking change in isbinaryfile (Issue #28)

## 1.3.1
* Add folders/directories to archive
* Update dependencies

## 1.3.0
* Revert breaking change accidentally shipped in 1.2.1
* {version} in finalName for a snapshot should use the new snapshot-version

## 1.2.1
* Strip undefined mvn arguments

## 1.2.0
* Fix wrong path-separator for the archive on Windows (Anton Savchenko)
* Add Classifier maven parameter (jmorille and Gregers Rygg)
* Updated dependencies and removed Chai (Gregers Rygg)

## 1.1.0
* Fix package.json might change between calls to maven.config and maven.deploy (Gregers Rygg)
* Add coverage for tests (Gregers Rygg)
* Refactored tests (Gregers Rygg)
* Create tests for maven.install (Gregers Rygg)
* Other small improvements (Gregers Rygg)

## 1.0.0
* Fix zipping shouldn't corrupt binary files (Kalle Wuoti)
* Define artifact id in maven config and run maven in batch mode (-B) (Kalle Wuoti)
* Ignore only package file, when creating ZIP archive (tmair)
* Add fileEncoding as an option (Espen Dalløkken)
* JSHint and other small improvements (Gregers Rygg)

## 0.0.2
* Improved readme and package.json

## 0.0.1
* Initial work (Gregers Rygg)

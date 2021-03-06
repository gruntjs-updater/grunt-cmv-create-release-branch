/*
 * grunt-cmv-create-release-branch
 * https://github.com/liaodrake/grunt-cmv-create-release-branch
 *
 * Copyright (c) 2014 Christopher Vachon
 * Licensed under the MIT license.
 */

'use strict';

var shell  = require('shelljs');
var _silenceGit = true;

module.exports = function(grunt) {
	function convertInt(_value) {
		if (isNaN(_value)) {
			_value =  _value.replace(/[^0-9]{1,}/g,"");
		}
		return _value;
	}

	function git_isDirty() {
		var _command = "git status --porcelain";
		grunt.log.debug(_command);
		var sresult  = shell.exec(_command, { silent: _silenceGit });
		grunt.log.debug(JSON.stringify(sresult, null, "\t"));
		return ((sresult.output.length === 0)?false:true);
	}

	function git_getCurrentBranch(_branch) {
		var _command = "git branch";
		grunt.log.debug(_command);
		var sresult  = shell.exec(_command, { silent: _silenceGit });
		grunt.log.debug(JSON.stringify(sresult, null, "\t"));
		var _currentBranch = sresult.output.replace(/(?:[^\*]+)?\*\s{1,}([a-zA-Z0-9-_\.]+)(?:[^\*]+)?/gm,"$1");
		grunt.log.debug(_currentBranch);
		return _currentBranch
	}

	function git_checkout(_branch, flags) {
		var _command = "git checkout ";
		if (flags) { _command += flags + " "; }
		_command += _branch;
		grunt.log.debug(_command);
		var sresult  = shell.exec(_command, { silent: _silenceGit });
		grunt.log.debug(JSON.stringify(sresult, null, "\t"));
		if (sresult.code === 128) { return false; }

		return true;
	}

	function git_add(_file) {
		var _command ="git add " + _file;
		grunt.log.debug(_command);
		var sresult  = shell.exec(_command, { silent: _silenceGit });
		grunt.log.debug(JSON.stringify(sresult, null, "\t"));
		return true;
	}

	function git_commit(_message) {
		var _command = "git commit -m \"" + _message + "\"";
		grunt.log.debug(_command);
		var sresult  = shell.exec(_command, { silent: _silenceGit });
		grunt.log.debug(JSON.stringify(sresult, null, "\t"));
		return true;
	}

	function git_pull(branch) {
		var _command = "git pull";
		if (branch) {
			_command += " " + branch;
		}
		grunt.log.debug(_command);
		var sresult  = shell.exec(_command, { silent: _silenceGit });
		grunt.log.debug(JSON.stringify(sresult, null, "\t"));
		return true;
	}

	function git_push(toBranch) {
		var _command = "git push";
		if (toBranch) {
			_command += " " + toBranch;
		}
		grunt.log.debug(_command);
		var sresult  = shell.exec(_command, { silent: _silenceGit });
		grunt.log.debug(JSON.stringify(sresult, null, "\t"));
		return true;
	}

	grunt.registerMultiTask('create_release_branch', 'Grunt Task to Create Release Branches and automatically update semantic versioning', function() {
		var _defaults = {
			iterum: "patch",
			versionPrefix: "v",
			versionPostfix: "",
			updatePackage: true,
			updateVersion: true,
			updateReadme: true,
			files: {
				package: "package.json",
				readme: "README.md",
				version: "VERSION"
			},
			readmeFileText: "\n## [version]\n- New [iterum] branch created on [now]\n\n",
			readmeRegExReplacePattern: "(={3,}(?:\n|\r))",
			disableGit: false,
			git: {
				sourceBranch: "master",
				newBranchPrefix: "Release-",
				autoCommitUpdatedVersionFiles: true,
				autoCommitMessage: "Updated Version Numbers",
				autoPushToRemote: true,
				pushRemoteName: "origin"
			}
		};
		var _options = this.options(_defaults);

		// Set Defaults of Sub Options
		var _extendedOptionKeys = ["files","git"];
		for (var _extendedOptionKeyIndex in _extendedOptionKeys) {
			var extendedOptionKey = _extendedOptionKeys[_extendedOptionKeyIndex];
			for (var key in _defaults[extendedOptionKey]) {
				if (!_options[extendedOptionKey][key]) { _options[extendedOptionKey][key] = _defaults[extendedOptionKey][key]; }
			}
		}

		var _validIterums = ["major","minor","patch","static"];
		if (!this.target || (_validIterums.indexOf(this.target) === -1)) {
			if (!_options.iterum || (_validIterums.indexOf(_options.iterum) === -1)) {
				grunt.fail.fatal("Can not Increment Version without an Iterum");
			}
		} else {
			_options.iterum = this.target;
		}

		grunt.log.subhead("Create a "+ _options.iterum + " branch");

		// Git Checkout the Source Branch
		if (!_options.disableGit) {
			if (git_isDirty()) { grunt.fail.fatal("Git found some uncommited files. Commit or Stash git files to proceed"); }

			var _currentBranch = git_getCurrentBranch();
			grunt.log.oklns('Git Current Branch: ' + _currentBranch);
			if (_currentBranch != _options.git.sourceBranch) {
				grunt.log.oklns('Git Checkout: ' + _options.git.sourceBranch);
				git_checkout(_options.git.sourceBranch);
			}

			grunt.log.oklns('Git Pull');
			git_pull();
		}

		if (!_options.files.package || !grunt.file.exists(_options.files.package)) {
			grunt.fail.fatal("File Not Found [package]: " + _options.files.package + " (Default: " + _defaults.files.package + ")" );
		}
		var _pkg = grunt.file.readJSON(_options.files.package);
		grunt.log.oklns("Current Version: " + _pkg.version);

		// Increment the Version Number
		var _newVersionSplit = _pkg.version.split('.');
		if (_options.iterum === _validIterums[0]) { // major
			_newVersionSplit[0] = parseInt(convertInt(_newVersionSplit[0]))+1;
			_newVersionSplit[1] = 0; // reset minor to 0
			_newVersionSplit[2] = 0; // reset patch to 0
		}
		else if (_options.iterum === _validIterums[1]) { // minor
			_newVersionSplit[1] = parseInt(convertInt(_newVersionSplit[1]))+1;
			_newVersionSplit[2] = 0; // reset patch to 0
		}
		else if (_options.iterum === _validIterums[2]) { // patch
			_newVersionSplit[2] = parseInt(convertInt(_newVersionSplit[2]))+1;
		}
		// Set any Version Post / Pre fixes
		_newVersionSplit[0] = _options.versionPrefix + convertInt(_newVersionSplit[0]).toString();
		_newVersionSplit[2] = convertInt(_newVersionSplit[2]).toString() + _options.versionPostfix;

		// Set new Version
		_pkg.version = _newVersionSplit.join(".");
		grunt.log.oklns("Set to: " + _pkg.version);

		// Git Checkout the Create New Release Branch
		if (!_options.disableGit) {
			if (git_isDirty()) { grunt.fail.fatal("Git found some uncommited files. Commit or Stash git files to proceed"); }
			var _newBranchName = _options.git.newBranchPrefix + _pkg.version;
			grunt.log.oklns('Git Checkout New Branch: ' +_newBranchName);
			if (!git_checkout(_newBranchName,"-b")) {
				grunt.fail.fatal("Git Branch [" + _newBranchName + "] Already Exists");
			}
		}

		// write package file
		if (_options.updatePackage) {
			grunt.file.write(_options.files.package, JSON.stringify(_pkg, null, "\t"));
			grunt.log.oklns('Updated: ' + _options.files.package);
		}

		// If version file specified, update it
		if (_options.files.version && _options.updateVersion) {
			if (grunt.file.exists(_options.files.version)) {
				grunt.file.delete(_options.files.version);
			}
			grunt.file.write(_options.files.version,  _pkg.version);
			grunt.log.oklns('Updated: ' + _options.files.version);
		}

		// if Readme file specified, update it
		if (_options.files.readme && _options.updateReadme) {
			var readmeText = "";
			var _now = new Date();
			if (grunt.file.exists(_options.files.readme)) {
				readmeText = grunt.file.read(_options.files.readme);
			} else {
				var _headerUnderline = new Array( (_pkg.name.length) ).join("=");
				readmeText = _pkg.name + "\n" + _headerUnderline + "\n\n";
			}

			var _patt = new RegExp(_options.readmeRegExReplacePattern,"gi");
			readmeText = readmeText.replace(_patt, "$1" + _options.readmeFileText.replace("[version]",_pkg.version).replace("[iterum]",_options.iterum).replace("[now]",_now.toDateString()));
			grunt.file.write(_options.files.readme, readmeText);
			grunt.log.oklns('Updated: ' + _options.files.readme);
		}

		// Git Auto Add and Commit Updated Files
		if (!_options.disableGit &&  _options.git.autoCommitUpdatedVersionFiles) {
			var _logGitAdd = "Git Add: ";
			if (_options.files.package && _options.updatePackage) {
				git_add(_options.files.package);
				grunt.log.oklns(_logGitAdd + _options.files.package);
			}
			if (_options.files.version && _options.updateVersion) {
				git_add(_options.files.version);
				grunt.log.oklns(_logGitAdd + _options.files.version);
			}
			if (_options.files.readme && _options.updateReadme) {
				git_add(_options.files.readme);
				grunt.log.oklns(_logGitAdd + _options.files.readme);
			}
			git_commit(_options.git.autoCommitMessage);
			grunt.log.oklns('Git Commit Files: ' + _options.git.autoCommitMessage);
			git_commit(_options.git.autoCommitMessage);
		}

		// Git Auto Push and Commit Updated Files
		if (!_options.disableGit &&  _options.git.autoPushToRemote) {
			var _remoteBranchCommand = "--set-upstream "+ _options.git.pushRemoteName + " " + git_getCurrentBranch();
			grunt.log.oklns('Git Push to Remote: ' + _remoteBranchCommand);
			git_push(_remoteBranchCommand);
		}
	});
};

#!/usr/bin/env node

// /scripts/make
// ShellJS 'makefile' to run various tasks

import Process from 'node:process'

import 'shelljs/make.js'
import Shell from 'shelljs'
import Chalk from 'chalk'

/**
 * A simple logger.
 */
const Logger = {
	info: (...message) => Shell.echo(Chalk.blue.dim('[i]', ...message)),
	success: (...message) => Shell.echo(Chalk.green('[=]', ...message)),
	warn: (...message) => Shell.echo(Chalk.yellow('[!]', ...message)),
	error: (...message) => Shell.echo(Chalk.red('[*]', ...message)),
}

/**
 * Executes a command and prints the output only if an error occurs.
 *
 * @param command {any} - The command to execute.
 *
 * @return {boolean} - Whether the command succeeded.
 */
const exec = (...command) => {
	try {
		// Execute the command
		Shell.exec(...command, { silent: !command.toString().includes('xo') })
		// Return true if it succeeds
		return true
	} catch (error) {
		// Print the error and return false if it fails
		Logger.error('The following error occurred while running the command:')
		Shell.echo(
			error.message
				.replace('exec: ', '')
				.split('\n')
				.map((s) => `   ${s}`)
				.join('\n')
				.trim(),
		)

		// Set the exit code to 1, to indicate a failure while running the command
		Process.exitCode = 1

		// Return false, the command failed
		return false
	}
}

// The tasks to run
const tasks = {}

/**
 * Deletes all generated files.
 */
tasks.clean = () => {
	Logger.info('Deleting all generated files')
	rm('-rf', ['dist/', 'coverage/', '*.log', '*.tmp', '*.bak', '*.tgz'])
	Logger.success('Deleted all generated files')
}

/**
 * Builds the CJS and ESM version of the package.
 */
tasks.build = () => {
	Logger.info('Building CommonJS module')
	if (
		exec(
			'esbuild source/index.ts --bundle --format=cjs --outfile=dist/index.cjs',
		)
	) {
		// Hacky way of getting the default export to work in CJS modules too
		'module.exports = rateLimit'.toEnd('dist/index.cjs')
		Logger.success('Built CommonJS module')
	}

	Logger.info('Building ES module')
	if (
		exec(
			'esbuild source/index.ts --bundle --format=esm --outfile=dist/index.mjs',
		)
	)
		Logger.success('Built ES module')

	Logger.info('Generating type declarations')
	if (exec('dts-bundle-generator --out-file=dist/index.d.ts source/index.ts')) {
		// Hacky way of getting the default export to work in the declaration file too
		// TODO: Remove this when transitioning to pure ESM
		'export default rateLimit'.toEnd('dist/index.d.ts')
		Logger.success('Generated type definitions')
	}
}

/**
 * Runs the `clean` and `build` tasks.
 */
tasks.compile = () => {
	tasks.clean()
	tasks.build()
}

/**
 * Runs XO on code files and Prettier on the rest.
 */
tasks.lint = () => {
	Logger.info('Running `xo` on source code and tests')
	if (exec('xo --ignore scripts/')) Logger.success('Linter reported no errors')

	Logger.info('Running `prettier` on other files')
	if (exec('prettier --ignore-path .gitignore --ignore-unknown --check .'))
		Logger.success('Formatter reported no errors')
}

/**
 * Auto-fixes code and formatting issues.
 */
tasks.autofix = () => {
	Logger.info('Running `xo --fix` on source code and tests')
	if (exec('xo --ignore scripts/ --fix'))
		Logger.success('Linter reported no errors')

	Logger.info('Running `prettier --write` on other files')
	if (exec('prettier --ignore-path .gitignore --ignore-unknown --write .'))
		Logger.success('Files formatted successfully')
}

/**
 * Runs tests using Jest.
 */
tasks.test = () => {
	Logger.info('Running tests with jest')
	if (
		exec(
			'cross-env TS_NODE_PROJECT=config/typescript/test.json NODE_OPTIONS=--experimental-vm-modules jest',
		)
	)
		Logger.success('All tests passed')
}

// Export it
target = tasks

#!/usr/bin/env node

// /scripts/make
// ShellJS 'makefile' to run various tasks

import 'shelljs/make.js'
import shell from 'shelljs'

/**
 * Deletes all generated files.
 */
target.clean = () => {
	shell.echo('=> Deleting all generated files')
	shell.rm('-rf', ['dist/', 'coverage/', '*.log', '*.tmp', '*.bak', '*.tgz'])
}

/**
 * Builds the CJS and ESM version of the package.
 */
target.build = () => {
	shell.echo('=> Building CommonJS module')
	shell.exec(
		'esbuild source/index.ts --bundle --format=cjs --outfile=dist/index.cjs',
	)
	// Hacky way of getting the default export to work in CJS modules too
	'module.exports = rateLimit'.toEnd('dist/index.cjs')

	shell.echo('=> Building ES module')
	shell.exec(
		'esbuild source/index.ts --bundle --format=esm --outfile=dist/index.mjs',
	)

	shell.echo('=> Generating type declarations')
	shell.exec('tsc --emitDeclarationOnly')
}

/**
 * Runs the `clean` and `build` tasks.
 */
target.compile = () => {
	target.clean()
	target.build()
}

/**
 * Runs XO on code files and Prettier on the rest.
 */
target.lint = () => {
	shell.echo('=> Running `xo` on source code and tests')
	shell.exec('xo --ignore scripts/')

	shell.echo('=> Running `prettier` on other files')
	shell.exec('prettier --ignore-path .gitignore --ignore-unknown --check .')
}

/**
 * Auto-fixes code and formatting issues.
 */
target.autofix = () => {
	shell.echo('=> Running `xo --fix` on source code and tests')
	shell.exec('xo --ignore scripts/ --fix')

	shell.echo('=> Running `prettier --write` on other files')
	shell.exec('prettier --ignore-path .gitignore --ignore-unknown --write .')
}

/**
 * Runs tests using Jest.
 */
target.test = () => {
	shell.echo('=> Running tests with jest')
	shell.exec(
		'cross-env TS_NODE_PROJECT=config/typescript/test.json NODE_OPTIONS=--experimental-vm-modules jest',
	)
}

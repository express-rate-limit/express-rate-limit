// /tsdown.config.ts
// The configuration for tsdown which builds the library.

import { copyFile } from 'node:fs/promises'
import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: 'source/index.ts',
	outDir: 'dist/',
	format: ['esm', 'cjs'],
	platform: 'node',
	target: 'es2022',
	fixedExtension: true,
	dts: true,
	outputOptions(options, format) {
		if (format === 'cjs') {
			options.exports = 'named'
			options.footer =
				'module.exports = Object.assign(module.exports.default, module.exports);'
		}

		return options
	},
	onSuccess() {
		return copyFile('dist/index.d.mts', 'dist/index.d.ts')
	},
})

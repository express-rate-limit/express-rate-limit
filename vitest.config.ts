// /vitest.config.ts
// Configuration for the vitest test runner

import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['test/library/**/*-test.ts'],
		testTimeout: 30_000,
		coverage: {
			enabled: true,
			provider: 'v8',
			include: ['source/**/*.ts'],
			exclude: ['source/index.ts', 'source/types.ts'],
		},
	},
})

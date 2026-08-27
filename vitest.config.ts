// /vitest.config.ts
// Configuration for the vitest test runner. The suite is run twice, once
// against express 4 and once against express 5 - see `test/helpers/express.ts`
// for how the version under test is selected.

import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		testTimeout: 30_000,
		coverage: {
			enabled: true,
			provider: 'v8',
			include: ['source/**/*.ts'],
			exclude: ['source/index.ts', 'source/types.ts'],
		},
		projects: [
			{
				extends: true,
				test: {
					name: 'express-5',
					include: [
						'test/library/**/*-test.ts',
						'test/integrations/**/*-test.ts',
					],
					env: { EXPRESS_VERSION: '5' },
				},
			},
			{
				extends: true,
				test: {
					name: 'express-4',
					include: [
						'test/library/**/*-test.ts',
						'test/integrations/**/*-test.ts',
					],
					env: { EXPRESS_VERSION: '4' },
				},
			},
		],
	},
})

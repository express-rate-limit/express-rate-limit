// /vitest.config.ts
// Configuration for the vitest test runner.

import { defineConfig } from 'vitest/config'

const project = (group: string, config: object) =>
	['5', '4'].map((version) => ({
		extends: true,
		test: {
			name: `${group}:express-${version}`,
			include: [`test/${group}/**/*-test.ts`],
			env: { EXPRESS_VERSION: version },
			...config,
		},
	}))

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
			...project('library', {}),
			...project('stores', {
				hookTimeout: 180_000,
				server: {
					deps: {
						// This package's entrypoint is typescript, so it must be
						// transformed by vitest instead of being loaded by node.
						inline: ['precise-memory-rate-limit'],
					},
				},
			}),
		],
	},
})

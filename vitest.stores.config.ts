// /vitest.stores.config.ts
// Configuration for the external store tests, which spin up the backing
// databases (redis, mongo, memcached) as throwaway containers via
// `testcontainers`, and hence need docker and generous timeouts.

import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['test/stores/**/*-test.ts'],
		testTimeout: 30_000,
		// Pulling the database images on a cold machine can take a while.
		hookTimeout: 180_000,
		server: {
			deps: {
				// This package's entrypoint is typescript, so it must be
				// transformed by vitest instead of being loaded by node directly.
				inline: ['precise-memory-rate-limit'],
			},
		},
	},
})

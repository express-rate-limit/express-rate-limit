// /test/library/imports-test.ts
// Tests that the compiled library can be imported in every supported way:
// via `require` and `import`, using the default as well as the named export.

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { agent as request } from 'supertest'
import { describe, expect, it } from 'vitest'
import type defaultExport from '../../source/index.js'
import { createServer } from './helpers/create-server.js'

type RateLimit = typeof defaultExport
type DistModule = {
	default: RateLimit
	rateLimit: RateLimit
	MemoryStore: unknown
	ipKeyGenerator: unknown
}

const require = createRequire(import.meta.url)
const distPath = path.join(import.meta.dirname, '../../dist')

// Automatically skip these tests if running locally and the library has not
// been compiled; always run them in ci.
const maybeDescribe =
	existsSync(distPath) || process.env.CI ? describe : describe.skip

// Make sure a limiter created using the given `rateLimit` function plays well
// with the version of express under test.
const expectWorkingMiddleware = async (rateLimit: RateLimit) => {
	const app = createServer(rateLimit({ limit: 3 }))

	for (let i = 0; i < 3; i++) await request(app).get('/').expect(200)
	await request(app).get('/').expect(429)
}

maybeDescribe('import tests', () => {
	it('should work when `require`d via the package entrypoint', async () => {
		// Node resolves the package's own name using the `exports` map, so this
		// exercises the real `require('express-rate-limit')` path of a consumer.
		const library = require('express-rate-limit') as RateLimit & DistModule

		// The module itself is the `rateLimit` function, with the named exports
		// attached to it as properties for interop.
		expect(typeof library).toBe('function')
		expect(library.rateLimit).toBe(library.default)
		expect(typeof library.MemoryStore).toBe('function')
		expect(typeof library.ipKeyGenerator).toBe('function')

		await expectWorkingMiddleware(library) // default import usage.
		await expectWorkingMiddleware(library.rateLimit) // named import usage.
	})

	it('should work when `import`ed as esm', async () => {
		const library = (await import(
			pathToFileURL(path.join(distPath, 'index.mjs')).href
		)) as DistModule

		expect(typeof library.default).toBe('function')
		expect(library.rateLimit).toBe(library.default)
		expect(typeof library.MemoryStore).toBe('function')
		expect(typeof library.ipKeyGenerator).toBe('function')

		await expectWorkingMiddleware(library.default) // default import usage.
		await expectWorkingMiddleware(library.rateLimit) // named import usage.
	})
})

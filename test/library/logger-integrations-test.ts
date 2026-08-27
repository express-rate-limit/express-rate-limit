// /test/library/logger-integrations-test.ts
// Tests that the `logger` option is compatible with popular loggers: pino
// (used directly), and nestjs' logger (used via a small adapter, since it
// takes its arguments in the opposite order).

import { Logger as NestLogger } from '@nestjs/common'
import pino from 'pino-http'
import { agent as request } from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import rateLimit, { MemoryStore } from '../../source/index.js'
import { createServer } from '../helpers/server.js'

// The error logged when the store fails and `passOnStoreError` is set.
const storeErrorMessage =
	'express-rate-limit: error from store, allowing request without rate-limiting.'

// Create a store whose `increment` function fails on the first call.
const createFailingStore = () => {
	const store = new MemoryStore()
	vi.spyOn(store, 'increment').mockRejectedValueOnce(new Error('oops'))
	return store
}

describe('logger integration tests', () => {
	it('should log store errors using pino', async () => {
		const logger = pino()
		const errorSpy = vi
			.spyOn(logger.logger, 'error')
			.mockImplementation(() => {})

		const app = createServer([
			logger,
			rateLimit({
				limit: 3,
				store: createFailingStore(),
				logger: logger.logger,
				passOnStoreError: true,
			}),
		])
		await request(app).get('/').expect(200)

		expect(errorSpy).toHaveBeenCalledWith(expect.any(Error), storeErrorMessage)
	})

	it('should log store errors using a nestjs logger', async () => {
		const logger = new NestLogger('express-rate-limit')
		const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

		const app = createServer(
			rateLimit({
				limit: 3,
				store: createFailingStore(),
				// Nest's logger takes the message first, so wrap it in an adapter.
				logger: {
					error: (error, message) =>
						message ? logger.error(message, error) : logger.error(error),
					warn: (error, message) =>
						message ? logger.warn(message, error) : logger.warn(error),
				},
				passOnStoreError: true,
			}),
		)
		await request(app).get('/').expect(200)

		expect(errorSpy).toHaveBeenCalledWith(storeErrorMessage, expect.any(Error))
	})
})

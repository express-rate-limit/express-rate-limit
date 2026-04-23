import { jest } from '@jest/globals'
import { agent as request } from 'supertest'
import { app, logger, store } from '../source/pino'

describe('Using Pino as logger', () => {
	let errorSpy: unknown

	beforeEach(() => {
		jest.spyOn(store, 'increment').mockRejectedValueOnce(new Error('oops'))
		errorSpy = jest.spyOn(logger.logger, 'error')
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	it('should log the store error using pino', async () => {
		await request(app).get('/').expect(200)

		expect(errorSpy).toHaveBeenCalledWith(
			expect.any(Error),
			'express-rate-limit: error from store, allowing request without rate-limiting.',
		)
	})
})

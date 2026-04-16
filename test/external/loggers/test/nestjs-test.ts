import { jest } from '@jest/globals'
import { INestApplication } from '@nestjs/common'
import { agent as request } from 'supertest'
import { boostrap } from '../source/nestjs'

describe('Using Pino as logger', () => {
	let app: INestApplication
	let appUrl: string
	let errorSpy: unknown

	beforeEach(async () => {
		const nest = await boostrap()

		app = nest.app
		appUrl = await app.getUrl()

		jest.spyOn(nest.store, 'increment').mockRejectedValueOnce(new Error('oops'))
		errorSpy = jest.spyOn(nest.logger, 'error')
	})

	afterEach(async () => {
		jest.clearAllMocks()

		await app.close()
	})

	it('should log the store error using pino', async () => {
		await request(appUrl).get('/').expect(200)

		expect(errorSpy).toHaveBeenCalledWith(
			'express-rate-limit: error from store, allowing request without rate-limiting.',
			expect.any(Error),
		)
	})
})

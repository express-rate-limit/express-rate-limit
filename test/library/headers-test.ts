// /test/headers-test.ts
// Tests whether the headers sent back by the middleware

import { jest } from '@jest/globals'
import { agent as request } from 'supertest'
import type { Response } from 'express'
import rateLimit from '../../source/index.js'
import {
	setLegacyHeaders,
	setStandardHeadersDraft6,
	setStandardHeadersDraft7,
	setRetryAfter,
} from '../../source/headers.js'
import type { RateLimitInfo } from '../../source/types.js'
import { Validations } from '../../source/validations.js'
import { createServer } from './helpers/create-server.js'

describe('headers test', () => {
	it('should send correct `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset` headers', async () => {
		const app = createServer(
			rateLimit({
				windowMs: 60 * 1000,
				max: 5,
				legacyHeaders: true,
			}),
		)
		const expectedResetTimestamp = Math.ceil(
			(Date.now() + 60 * 1000) / 1000,
		).toString()
		const resetRegexp = new RegExp(
			`^${expectedResetTimestamp.slice(
				0,
				Math.max(0, expectedResetTimestamp.length - 2),
			)}\\d\\d$`,
		)

		await request(app)
			.get('/')
			.expect('x-ratelimit-limit', '5')
			.expect('x-ratelimit-remaining', '4')
			.expect('x-ratelimit-reset', resetRegexp)
			.expect(200, 'Hi there!')
	})

	it('should send correct `ratelimit-*` headers for the standard headers draft 6', async () => {
		const app = createServer(
			rateLimit({
				windowMs: 60 * 1000,
				max: 5,
				standardHeaders: true,
			}),
		)

		await request(app)
			.get('/')
			.expect('ratelimit-policy', '5;w=60')
			.expect('ratelimit-limit', '5')
			.expect('ratelimit-remaining', '4')
			.expect('ratelimit-reset', '60')
			.expect(200, 'Hi there!')
	})

	it('should send policy and combined ratelimit headers for the standard draft 7', async () => {
		const app = createServer(
			rateLimit({
				windowMs: 60 * 1000,
				max: 5,
				standardHeaders: 'draft-7',
			}),
		)

		await request(app)
			.get('/')
			.expect('ratelimit-policy', '5;w=60')
			.expect('ratelimit', 'limit=5, remaining=4, reset=60')
			.expect(200, 'Hi there!')
	})

	it('should return the `retry-after` header once IP has reached the max', async () => {
		const app = createServer(
			rateLimit({
				windowMs: 60 * 1000,
				max: 1,
			}),
		)

		await request(app).get('/').expect(200)
		await request(app).get('/').expect(429).expect('retry-after', '60')
	})

	it('should not attempt to set headers if request.headersSent is true', () => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const response: Response = {
			headersSent: true,
			setHeader: jest.fn(),
		} as any
		const info: RateLimitInfo = {
			limit: 5,
			current: 1,
			remaining: 4,
			resetTime: new Date(),
		}
		const windowMs = 60 * 1000
		const validatons: Validations = new Validations(false)

		setLegacyHeaders(response, info)
		setStandardHeadersDraft6(response, info, windowMs)
		setStandardHeadersDraft7(response, info, windowMs, validatons)
		setRetryAfter(response, info, windowMs)

		expect(response.setHeader).not.toBeCalled()
	})
})

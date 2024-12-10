// /test/headers-test.ts
// Tests whether the headers sent back by the middleware

import type { Response } from 'express'
import { jest } from '@jest/globals'
import { agent as request } from 'supertest'
import { parseRateLimit } from 'ratelimit-header-parser'
import rateLimit from '../../source/index.js'
import type { RateLimitInfo } from '../../source/types.js'
import {
	setLegacyHeaders,
	setDraft6Headers,
	setDraft7Headers,
	setRetryAfterHeader,
} from '../../source/headers.js'
import { createServer } from './helpers/create-server.js'

describe('headers test', () => {
	it('should send correct `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset` headers', async () => {
		const app = createServer(
			rateLimit({
				windowMs: 60 * 1000,
				limit: 5,
				legacyHeaders: true,
			}),
		)

		const oneMinLater = Date.now() + 60 * 1000
		const expectedResetTimestamp = Math.ceil(oneMinLater / 1000).toString()
		const resetRegexp = new RegExp(
			`^${expectedResetTimestamp.slice(
				0,
				Math.max(0, expectedResetTimestamp.length - 2),
			)}\\d\\d$`, // Expect the same seconds, not same milliseconds.
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
				limit: 5,
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
				limit: 5,
				standardHeaders: 'draft-7',
			}),
		)

		await request(app)
			.get('/')
			.expect('ratelimit-policy', '5;w=60')
			.expect('ratelimit', 'limit=5, remaining=4, reset=60')
			.expect(200, 'Hi there!')
	})

	it('should send correct headers for the standard draft 8', async () => {
		const app = createServer(
			rateLimit({
				windowMs: 2 * 60 * 60 * 1000,
				limit: 5,
				standardHeaders: 'draft-8',
			}),
		)

		await request(app)
			.get('/')
			.expect(
				'ratelimit-policy',
				'"rl-5-in-2hrs"; q=5; w=7200; pk=:M2U0OGVmOWQyMmUw:',
			)
			.expect('ratelimit', '"rl-5-in-2hrs"; r=4; t=7200')
			.expect(200, 'Hi there!')
	})

	it('should send multiple headers correctly for the standard draft 8', async () => {
		const app = createServer([
			rateLimit({
				windowMs: 60 * 1000,
				limit: 5,
				standardHeaders: 'draft-8',
			}),
			rateLimit({
				windowMs: 2 * 24 * 60 * 60 * 1000,
				limit: 8,
				standardHeaders: 'draft-8',
			}),
		])

		const policies = [
			'"rl-5-in-1min"; q=5; w=60; pk=:M2U0OGVmOWQyMmUw:',
			'"rl-8-in-2day"; q=8; w=172800; pk=:M2U0OGVmOWQyMmUw:',
		]
		const limits = [
			'"rl-5-in-1min"; r=4; t=60',
			'"rl-8-in-2day"; r=7; t=172800',
		]

		await request(app)
			.get('/')
			.expect('ratelimit-policy', policies.join(', '))
			.expect('ratelimit', limits.join(', '))
			.expect(200, 'Hi there!')
	})

	it('should override the quota name if specified for the standard draft 8', async () => {
		const app = createServer(
			rateLimit({
				identifier: 'keep-kalm',
				windowMs: 2 * 60 * 60 * 1000,
				limit: 5,
				standardHeaders: 'draft-8',
			}),
		)

		await request(app)
			.get('/')
			.expect(
				'ratelimit-policy',
				'"keep-kalm"; q=5; w=7200; pk=:M2U0OGVmOWQyMmUw:',
			)
			.expect('ratelimit', '"keep-kalm"; r=4; t=7200')
			.expect(200, 'Hi there!')
	})

	it('should return the `retry-after` header once IP has reached the max', async () => {
		const app = createServer(
			rateLimit({
				windowMs: 60 * 1000,
				limit: 1,
			}),
		)

		await request(app).get('/').expect(200)
		await request(app).get('/').expect(429).expect('retry-after', '60')
	})

	it('should not attempt to set headers if request.headersSent is true', () => {
		const response: Response = {
			headersSent: true,
			setHeader: jest.fn(),
		} as any
		const info: RateLimitInfo = {
			limit: 5,
			used: 1,
			remaining: 4,
			resetTime: new Date(),
		}
		const windowMs = 60 * 1000

		setLegacyHeaders(response, info)
		setDraft6Headers(response, info, windowMs)
		setDraft7Headers(response, info, windowMs)
		setRetryAfterHeader(response, info, windowMs)

		expect(response.setHeader).not.toBeCalled()
	})

	describe('ratelimit-header-parser compatibility', () => {
		it('should emit legacy headers that ratelimit-header-parser can read', async () => {
			const app = createServer(
				rateLimit({
					windowMs: 60 * 1000,
					limit: 5,
					legacyHeaders: true,
					standardHeaders: false,
				}),
			)

			const response = await request(app).get('/').expect(200)
			const rateLimitDetails = parseRateLimit(response as any)

			expect(rateLimitDetails).toMatchObject({
				used: 1,
				remaining: 4,
				limit: 5,
				reset: expect.any(Date),
			})
		})
		it('should emit standard draft-6 headers that ratelimit-header-parser can read', async () => {
			const app = createServer(
				rateLimit({
					windowMs: 60 * 1000,
					limit: 5,
					legacyHeaders: false,
					standardHeaders: 'draft-6',
				}),
			)

			const response = await request(app).get('/').expect(200)
			const rateLimitDetails = parseRateLimit(response as any)

			expect(rateLimitDetails).toMatchObject({
				used: 1,
				remaining: 4,
				limit: 5,
				reset: expect.any(Date),
			})
		})

		it('should emit a standard draft 7 combined header that ratelimit-header-parser can parse', async () => {
			const app = createServer(
				rateLimit({
					windowMs: 60 * 1000,
					limit: 5,
					legacyHeaders: false,
					standardHeaders: 'draft-7',
				}),
			)

			const response = await request(app).get('/').expect(200)
			const rateLimitDetails = parseRateLimit(response as any)

			expect(rateLimitDetails).toMatchObject({
				used: 1,
				remaining: 4,
				limit: 5,
				reset: expect.any(Date),
			})
		})
	})
})

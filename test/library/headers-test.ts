// /test/headers-test.ts
// Tests whether the headers sent back by the middleware

import { describe, expect, it, jest } from '@jest/globals'
import type { Response } from 'express'
import { parseRateLimit } from 'ratelimit-header-parser'
import { agent as request } from 'supertest'
import {
	setDraft6Headers,
	setDraft7Headers,
	setDraft8Headers,
	setLegacyHeaders,
	setRetryAfterHeader,
} from '../../source/headers.js'
import rateLimit from '../../source/index.js'
import type {
	ClientRateLimitInfo,
	RateLimitInfo,
	Store,
} from '../../source/types.js'
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
				keyGenerator: (request, response) => 'foo', // the partition key is generated using this
			}),
		)

		const policy = '"5-in-2hrs"; q=5; w=7200; pk=:MmMyNmI0NmI2OGZm:'
		const limit = '"5-in-2hrs"; r=4; t=7200'

		await request(app)
			.get('/')
			.expect('ratelimit-policy', policy)
			.expect('ratelimit', limit)
			.expect(200, 'Hi there!')
	})

	it('should send multiple headers correctly for the standard draft 8', async () => {
		const fiveSeconds = 5 * 1000
		const oneMinute = 60 * 1000
		const oneHour = 60 * 60 * 1000
		const oneDay = 1 * 24 * 60 * 60 * 1000
		const twoDays = 2 * 24 * 60 * 60 * 1000

		const app = createServer([
			rateLimit({
				windowMs: fiveSeconds,
				limit: 1,
				standardHeaders: 'draft-8',
			}),
			rateLimit({ windowMs: oneMinute, limit: 5, standardHeaders: 'draft-8' }),
			rateLimit({ windowMs: oneHour, limit: 6, standardHeaders: 'draft-8' }),
			rateLimit({ windowMs: oneDay, limit: 7, standardHeaders: 'draft-8' }),
			rateLimit({ windowMs: twoDays, limit: 8, standardHeaders: 'draft-8' }),
		])

		const policies = [
			'"1-in-5sec"; q=1; w=5; pk=:M2U0OGVmOWQyMmUw:',
			'"5-in-1min"; q=5; w=60; pk=:M2U0OGVmOWQyMmUw:',
			'"6-in-1hr"; q=6; w=3600; pk=:M2U0OGVmOWQyMmUw:',
			'"7-in-1day"; q=7; w=86400; pk=:M2U0OGVmOWQyMmUw:',
			'"8-in-2days"; q=8; w=172800; pk=:M2U0OGVmOWQyMmUw:',
		]
		const limits = [
			'"1-in-5sec"; r=0; t=5',
			'"5-in-1min"; r=4; t=60',
			'"6-in-1hr"; r=5; t=3600',
			'"7-in-1day"; r=6; t=86400',
			'"8-in-2days"; r=7; t=172800',
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
				keyGenerator: (request, response) => 'foo', // Pk param is generated from this
			}),
		)

		await request(app)
			.get('/')
			.expect(
				'ratelimit-policy',
				'"keep-kalm"; q=5; w=7200; pk=:MmMyNmI0NmI2OGZm:',
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

	it('should not set the `retry-after` header if all headers have been disabled', async () => {
		const app = createServer(
			rateLimit({
				windowMs: 60 * 1000,
				limit: 1,
				legacyHeaders: false,
				standardHeaders: false,
			}),
		)

		await request(app).get('/').expect(200)

		const response = await request(app).get('/').expect(429)
		expect(response.get('retry-after')).toBeUndefined()
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
			key: 'foo',
		}
		const windowMs = 60 * 1000
		const name = 'test-quota'
		const key = 'foo'

		setLegacyHeaders(response, info)
		setDraft6Headers(response, info, windowMs)
		setDraft7Headers(response, info, windowMs)
		setDraft8Headers(response, info, windowMs, name, key)
		setRetryAfterHeader(response, info, windowMs)

		expect(response.setHeader).not.toHaveBeenCalled()
	})

	it('should not send headers for an incorrect draft number', async () => {
		const app = createServer(
			rateLimit({
				windowMs: 2 * 60 * 60 * 1000,
				limit: 5,
				// @ts-expect-error Check if the library ignores invalid draft numbers.
				standardHeaders: 'invalid-draft',
				validate: { headersDraftVersion: false },
			}),
		)

		const response = await request(app).get('/').expect(200, 'Hi there!')
		expect(response.get('ratelimit')).toBeUndefined()
		expect(response.get('ratelimit-policy')).toBeUndefined()
	})

	describe('support for stores that do not provide reset time', () => {
		class MockStore implements Store {
			hits: Map<string, number> = new Map()

			async get(key: string): Promise<ClientRateLimitInfo> {
				return {
					totalHits: this.hits.get(key) ?? 0,
					resetTime: undefined,
				}
			}

			async increment(key: string): Promise<ClientRateLimitInfo> {
				const count = (this.hits.get(key) ?? 0) + 1
				this.hits.set(key, count)

				return { totalHits: count, resetTime: undefined }
			}

			async decrement(_key: string): Promise<void> {}

			async resetKey(_key: string): Promise<void> {}
		}

		it('should set the `retry-after` header to the value of `windowMs` in seconds instead', async () => {
			const app = createServer(
				rateLimit({
					windowMs: 60 * 1000,
					limit: 1,
					store: new MockStore(),
					legacyHeaders: true,
					standardHeaders: true,
				}),
			)

			await request(app).get('/').expect(200)
			await request(app).get('/').expect(429).expect('retry-after', '60')
		})
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

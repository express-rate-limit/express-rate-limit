// /test/middleware-test.ts
// Tests the rate limiting middleware

// import { platform } from 'node:process'

import { jest } from '@jest/globals'
import { Request, Response, NextFunction } from 'express'
import { agent as request } from 'supertest'

import rateLimit, {
	LegacyStore,
	Store,
	Options,
	IncrementCallback,
	IncrementResponse,
} from '../../source/index.js'

import { createServer } from './helpers/create-server.js'

describe('middleware test', () => {
	beforeEach(() => {
		jest.useFakeTimers('modern')
	})
	afterEach(() => {
		jest.useRealTimers()
		jest.restoreAllMocks()
	})

	class MockStore implements Store {
		initWasCalled = false
		incrementWasCalled = false
		decrementWasCalled = false
		resetKeyWasCalled = false
		resetAllWasCalled = false

		counter = 0

		init(_options: Options): void {
			this.initWasCalled = true
		}

		async increment(_key: string): Promise<IncrementResponse> {
			this.counter += 1
			this.incrementWasCalled = true

			return { totalHits: this.counter, resetTime: undefined }
		}

		async decrement(_key: string): Promise<void> {
			this.counter -= 1
			this.decrementWasCalled = true
		}

		async resetKey(_key: string): Promise<void> {
			this.resetKeyWasCalled = true
		}

		async resetAll(): Promise<void> {
			this.resetAllWasCalled = true
		}
	}

	class MockLegacyStore implements LegacyStore {
		initWasCalled = false
		incrementWasCalled = false
		decrementWasCalled = false
		resetKeyWasCalled = false
		resetAllWasCalled = false

		counter = 0

		incr(_key: string, callback: IncrementCallback) {
			this.counter += 1
			this.incrementWasCalled = true

			callback(undefined, this.counter, undefined)
		}

		decrement(_key: string): void {
			this.counter -= 1
			this.decrementWasCalled = true
		}

		resetKey(_key: string): void {
			this.resetKeyWasCalled = true
		}

		resetAll(): void {
			this.resetAllWasCalled = true
		}
	}

	class MockBackwardCompatibleStore implements Store, LegacyStore {
		initWasCalled = false
		incrementWasCalled = false
		decrementWasCalled = false
		resetKeyWasCalled = false
		resetAllWasCalled = false

		counter = 0

		incr(_key: string, callback: IncrementCallback) {
			this.counter += 1
			this.incrementWasCalled = true

			callback(undefined, this.counter, undefined)
		}

		async increment(_key: string): Promise<IncrementResponse> {
			this.counter += 1
			this.incrementWasCalled = true

			return { totalHits: this.counter, resetTime: undefined }
		}

		decrement(_key: string): void {
			this.counter -= 1
			this.decrementWasCalled = true
		}

		resetKey(_key: string): void {
			this.resetKeyWasCalled = true
		}

		resetAll(): void {
			this.resetAllWasCalled = true
		}
	}

	it('should not modify the options object passed', () => {
		const options = {}
		rateLimit(options)
		expect(options).toStrictEqual({})
	})

	it('should call `init` even if no requests have come in', async () => {
		const store = new MockStore()
		rateLimit({
			store,
		})

		expect(store.initWasCalled).toEqual(true)
	})

	it('should print an error if `request.ip` is undefined', async () => {
		jest.spyOn(global.console, 'error').mockImplementation(() => {})

		await Promise.resolve(
			rateLimit()(
				{ ip: undefined } as any as Request,
				{} as any as Response,
				(() => {}) as NextFunction,
			),
		)

		expect(console.error).toBeCalled()
	})

	it('should let the first request through', async () => {
		const app = createServer(rateLimit({ max: 1 }))

		await request(app).get('/').expect(200).expect('Hi there!')
	})

	it('should refuse additional connections once IP has reached the max', async () => {
		const app = createServer(
			rateLimit({
				max: 2,
			}),
		)

		await request(app).get('/').expect(200)
		await request(app).get('/').expect(200)
		await request(app).get('/').expect(429)
	})

	it('should (eventually) accept new connections from a blocked IP', async () => {
		const app = createServer(
			rateLimit({
				max: 2,
				windowMs: 50,
			}),
		)

		await request(app).get('/').expect(200)
		await request(app).get('/').expect(200)
		await request(app).get('/').expect(429)
		jest.advanceTimersByTime(60)
		await request(app).get('/').expect(200)
	})

	it('should work repeatedly', async () => {
		const app = createServer(
			rateLimit({
				max: 2,
				windowMs: 50,
			}),
		)

		await request(app).get('/').expect(200)
		await request(app).get('/').expect(200)
		await request(app).get('/').expect(429)
		jest.advanceTimersByTime(60)
		await request(app).get('/').expect(200)
		await request(app).get('/').expect(200)
		await request(app).get('/').expect(429)
		jest.advanceTimersByTime(60)
		await request(app).get('/').expect(200)
	})

	it('should show the provided message instead of the default message when max connections are reached', async () => {
		const message = 'Enhance your calm'
		const app = createServer(
			rateLimit({
				windowMs: 1000,
				max: 2,
				message,
			}),
		)

		await request(app).get('/').expect(200)
		await request(app).get('/').expect(200)
		await request(app).get('/').expect(429).expect(message)
	})

	it('should allow the error status code to be customized', async () => {
		const statusCode = 420
		const app = createServer(
			rateLimit({
				max: 1,
				statusCode,
			}),
		)
		await request(app).get('/').expect(200)
		await request(app).get('/').expect(statusCode)
	})

	it('should allow responding with a JSON message', async () => {
		const message = {
			error: {
				code: 'too-many-requests',
				message: 'Too many requests were attempted in a short span of time.',
			},
		}
		const app = createServer(
			rateLimit({
				message,
				max: 1,
			}),
		)

		await request(app).get('/').expect(200, 'Hi there!')
		await request(app).get('/').expect(429, message)
	})

	it('should use a custom handler when specified', async () => {
		const app = createServer(
			rateLimit({
				max: 1,
				handler: (_request, response) => {
					response.status(420).end('Enhance your calm')
				},
			}),
		)

		await request(app).get('/').expect(200)
		await request(app).get('/').expect(420, 'Enhance your calm')
	})

	it('should allow custom key generators', async () => {
		const app = createServer(
			rateLimit({
				max: 2,
				keyGenerator: (request, _response) => request.query.key as string,
			}),
		)

		await request(app).get('/').query({ key: 1 }).expect(200)
		await request(app).get('/').query({ key: 1 }).expect(200)

		await request(app).get('/').query({ key: 2 }).expect(200)

		await request(app).get('/').query({ key: 1 }).expect(429)

		await request(app).get('/').query({ key: 2 }).expect(200)
		await request(app).get('/').query({ key: 2 }).expect(429)
	})

	it('should allow custom skip function', async () => {
		const app = createServer(
			rateLimit({
				max: 2,
				skip: () => true,
			}),
		)

		await request(app).get('/').query({ key: 1 }).expect(200)
		await request(app).get('/').query({ key: 1 }).expect(200)

		await request(app).get('/').query({ key: 1 }).expect(200)
	})

	it('should allow custom skip function that returns a promise', async () => {
		const limiter = rateLimit({
			max: 2,
			skip: async () => {
				return Promise.resolve(true)
			},
		})

		const app = createServer(limiter)
		await request(app).get('/').query({ key: 1 }).expect(200)
		await request(app).get('/').query({ key: 1 }).expect(200)

		await request(app).get('/').query({ key: 1 }).expect(200)
	})

	it('should allow max to be a function', async () => {
		const app = createServer(
			rateLimit({
				max: () => 2,
			}),
		)

		await request(app).get('/').expect(200)
		await request(app).get('/').expect(200)
		await request(app).get('/').expect(429)
	})

	it('should allow max to be a function that returns a promise', async () => {
		const app = createServer(
			rateLimit({
				max: async () => Promise.resolve(2),
			}),
		)

		await request(app).get('/').expect(200)
		await request(app).get('/').expect(200)
		await request(app).get('/').expect(429)
	})

	it('should calculate the remaining hits', async () => {
		const app = createServer(
			rateLimit({
				max: async () => Promise.resolve(2),
			}),
		)

		await request(app)
			.get('/')
			.expect(200)
			.expect('x-ratelimit-limit', '2')
			.expect('x-ratelimit-remaining', '1')
			.expect((response) => {
				if ('retry-after' in response.headers) {
					throw new Error(
						`Expected no retry-after header, got ${
							response.headers['retry-after'] as string
						}`,
					)
				}
			})
			.expect(200, 'Hi there!')
	})

	it.each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])('should call `increment` on the store (%s store)', async (name, store) => {
		const app = createServer(
			rateLimit({
				store,
			}),
		)
		await request(app).get('/')

		expect(store.incrementWasCalled).toEqual(true)
	})

	it.each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])('should call `resetKey` on the store (%s store)', async (name, store) => {
		const limiter = rateLimit({
			store,
		})

		limiter.resetKey('key')

		expect(store.resetKeyWasCalled).toEqual(true)
	})

	it.each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])(
		'should decrement hits when requests succeed and `skipSuccessfulRequests` is set to true (%s store)',
		async (name, store) => {
			const app = createServer(
				rateLimit({
					skipSuccessfulRequests: true,
					store,
				}),
			)

			await request(app).get('/').expect(200)

			expect(store.decrementWasCalled).toEqual(true)
		},
	)

	it.each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])(
		'should not decrement hits when requests fail and `skipSuccessfulRequests` is set to true (%s store)',
		async (name, store) => {
			const app = createServer(
				rateLimit({
					skipSuccessfulRequests: true,
					store,
				}),
			)

			await request(app).get('/error').expect(400)

			expect(store.decrementWasCalled).toEqual(false)
		},
	)

	it.each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])(
		'should decrement hits when requests succeed, `skipSuccessfulRequests` is set to true and a custom `requestWasSuccessful` method used (%s store)',
		async (name, store) => {
			const app = createServer(
				rateLimit({
					skipSuccessfulRequests: true,
					requestWasSuccessful: (_request, response) =>
						response.statusCode === 200,
					store,
				}),
			)

			await request(app).get('/').expect(200)
			expect(store.decrementWasCalled).toEqual(true)
		},
	)

	it.each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])(
		'should not decrement hits when requests fail, `skipSuccessfulRequests` is set to true and a custom `requestWasSuccessful` method used (%s store)',
		async (name, store) => {
			const app = createServer(
				rateLimit({
					skipSuccessfulRequests: true,
					requestWasSuccessful: (request, response) => {
						return response.statusCode === 200
					},
					store,
				}),
			)

			await request(app).get('/error').expect(400)

			expect(store.decrementWasCalled).toEqual(false)
		},
	)

	it.each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])(
		'should decrement hits when requests succeed, `skipSuccessfulRequests` is set to true and a custom `requestWasSuccessful` method used (%s store)',
		async (name, store) => {
			const app = createServer(
				rateLimit({
					skipSuccessfulRequests: true,
					requestWasSuccessful: (request, _response) =>
						request.query.success === '1',
					store,
				}),
			)

			await request(app).get('/?success=1')

			expect(store.decrementWasCalled).toEqual(true)
		},
	)

	it.each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])(
		'should not decrement hits when requests fail, `skipSuccessfulRequests` is set to true and a custom `requestWasSuccessful` method used (%s store)',
		async (name, store) => {
			const app = createServer(
				rateLimit({
					skipSuccessfulRequests: true,
					requestWasSuccessful: (request, _response) =>
						request.query.success === '1',
					store,
				}),
			)

			await request(app).get('/?success=0')

			expect(store.decrementWasCalled).toEqual(false)
		},
	)

	it.each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])(
		'should decrement hits when requests fail and `skipFailedRequests` is set to true (%s store)',
		async (name, store) => {
			const app = createServer(
				rateLimit({
					skipFailedRequests: true,
					store,
				}),
			)

			await request(app).get('/error').expect(400)

			expect(store.decrementWasCalled).toEqual(true)
		},
	)

	it.each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])(
		'should not decrement hits when requests succeed and `skipFailedRequests` is set to true (%s store)',
		async (name, store) => {
			const app = createServer(
				rateLimit({
					skipFailedRequests: true,
					store,
				}),
			)

			await request(app).get('/').expect(200)

			expect(store.decrementWasCalled).toEqual(false)
		},
	)

	// FIXME: This test times out  _sometimes_ on MacOS and Windows, so it is disabled for now
	/*
	;(platform === 'darwin' ? it.skip : it).each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])(
		'should decrement hits when response closes and `skipFailedRequests` is set to true (%s store)',
		async (name, store) => {
			jest.useRealTimers()
			jest.setTimeout(60_000)

			const app = createServer(
				rateLimit({
					skipFailedRequests: true,
					store,
				}),
			)

			let _resolve: () => void
			const connectionClosed = new Promise<void>((resolve) => {
				_resolve = resolve
			})

			app.get('/hang-server', (_request, response) => {
				response.on('close', _resolve)
			})

			const hangRequest = request(app).get('/hang-server').timeout(10)

			await expect(hangRequest).rejects.toThrow()
			await connectionClosed

			expect(store.decrementWasCalled).toEqual(true)
		},
	)
	*/

	it.each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])(
		'should decrement hits when response emits an error and `skipFailedRequests` is set to true (%s store)',
		async (name, store) => {
			const app = createServer(
				rateLimit({
					skipFailedRequests: true,
					store,
				}),
			)

			await request(app).get('/crash')

			expect(store.decrementWasCalled).toEqual(true)
		},
	)

	it.each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])(
		'should decrement hits when rate limit is reached and `skipFailedRequests` is set to true (%s store)',
		async (name, store) => {
			const app = createServer(
				rateLimit({
					max: 2,
					store,
					skipFailedRequests: true,
				}),
			)

			await request(app).get('/').expect(200)
			await request(app).get('/').expect(200)
			await request(app).get('/').expect(429)

			expect(store.decrementWasCalled).toEqual(true)
		},
	)

	it.each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])(
		'should forward errors in the handler using `next()` (%s store)',
		async (name, store) => {
			let errorCaught = false

			const app = createServer(
				rateLimit({
					max: 1,
					store,
					handler: () => {
						const exception = new Error('420: Enhance your calm')
						throw exception
					},
				}),
			)

			app.use(
				(
					error: Error,
					_request: Request,
					response: Response,
					_next: NextFunction,
				) => {
					errorCaught = true
					response.status(500).send(error.message)
				},
			)

			await request(app).get('/').expect(200)
			await request(app).get('/').expect(500)

			expect(errorCaught).toEqual(true)
		},
	)

	it.each([
		['modern', new MockStore()],
		['legacy', new MockLegacyStore()],
		['compat', new MockBackwardCompatibleStore()],
	])(
		'should forward errors in `skip()` using `next()` (%s store)',
		async (name, store) => {
			let errorCaught = false

			const app = createServer(
				rateLimit({
					max: 1,
					store,
					skip: () => {
						const exception = new Error('420: Enhance your calm')
						throw exception
					},
				}),
			)

			app.use(
				(
					error: Error,
					_request: Request,
					response: Response,
					_next: NextFunction,
				) => {
					errorCaught = true
					response.status(500).send(error.message)
				},
			)

			await request(app).get('/').expect(500)

			expect(errorCaught).toEqual(true)
		},
	)

	it('should pass the number of hits and the limit to the next request handler in the `request.rateLimit` property', async () => {
		let savedRequestObject: any
		const saveRequestObject = (
			request: Request,
			_response: Response,
			next: NextFunction,
		) => {
			savedRequestObject = request

			next()
		}

		const app = createServer([
			saveRequestObject,
			rateLimit({
				legacyHeaders: false,
			}),
		])

		await request(app).get('/').expect(200)
		expect(savedRequestObject).toBeTruthy()
		expect(savedRequestObject.rateLimit).toBeTruthy()
		expect(savedRequestObject.rateLimit.limit).toEqual(5)
		expect(savedRequestObject.rateLimit.remaining).toEqual(4)

		savedRequestObject = undefined
		await request(app).get('/').expect(200)
		expect(savedRequestObject.rateLimit.limit).toEqual(5)
		expect(savedRequestObject.rateLimit.remaining).toEqual(3)
	})

	it('should pass the number of hits and the limit to the next request handler with a custom property', async () => {
		let savedRequestObject: any
		const saveRequestObject = (
			request: Request,
			_response: Response,
			next: NextFunction,
		) => {
			savedRequestObject = request

			next()
		}

		const app = createServer([
			saveRequestObject,
			rateLimit({
				legacyHeaders: false,
				requestPropertyName: 'rateLimitInfo',
			}),
		])

		await request(app).get('/').expect(200)
		expect(savedRequestObject).toBeTruthy()
		expect(savedRequestObject.rateLimitInfo).toBeTruthy()
		expect(savedRequestObject.rateLimitInfo.limit).toEqual(5)
		expect(savedRequestObject.rateLimitInfo.remaining).toEqual(4)

		savedRequestObject = undefined
		await request(app).get('/').expect(200)
		expect(savedRequestObject.rateLimitInfo.limit).toEqual(5)
		expect(savedRequestObject.rateLimitInfo.remaining).toEqual(3)
	})

	it('should handle two rate-limiters with different `requestPropertyNames` operating independently', async () => {
		const keyLimiter = rateLimit({
			max: 2,
			requestPropertyName: 'rateLimitKey',
			keyGenerator: (request) => request.query.key as string,
			handler: (_request, response) => {
				response.status(420).end('Enhance your calm')
			},
		})
		const globalLimiter = rateLimit({
			max: 5,
			requestPropertyName: 'rateLimitGlobal',
			keyGenerator: () => 'global',
			handler: (_request, response) => {
				response.status(429).end('Too many requests')
			},
		})

		let savedRequestObject: any
		const saveRequestObject = (
			request: Request,
			_response: Response,
			next: NextFunction,
		) => {
			savedRequestObject = request
			next()
		}

		const app = createServer([saveRequestObject, keyLimiter, globalLimiter])

		await request(app).get('/').query({ key: 1 }).expect(200)
		expect(savedRequestObject).toBeTruthy()
		expect(savedRequestObject.rateLimit).toBeUndefined()

		expect(savedRequestObject.rateLimitKey).toBeTruthy()
		expect(savedRequestObject.rateLimitKey.limit).toEqual(2)
		expect(savedRequestObject.rateLimitKey.remaining).toEqual(1)

		expect(savedRequestObject.rateLimitGlobal).toBeTruthy()
		expect(savedRequestObject.rateLimitGlobal.limit).toEqual(5)
		expect(savedRequestObject.rateLimitGlobal.remaining).toEqual(4)

		savedRequestObject = undefined
		await request(app).get('/').query({ key: 2 }).expect(200)
		expect(savedRequestObject.rateLimitKey.remaining).toEqual(1)
		expect(savedRequestObject.rateLimitGlobal.remaining).toEqual(3)

		savedRequestObject = undefined
		await request(app).get('/').query({ key: 1 }).expect(200)
		expect(savedRequestObject.rateLimitKey.remaining).toEqual(0)
		expect(savedRequestObject.rateLimitGlobal.remaining).toEqual(2)

		savedRequestObject = undefined
		await request(app).get('/').query({ key: 2 }).expect(200)
		expect(savedRequestObject.rateLimitKey.remaining).toEqual(0)
		expect(savedRequestObject.rateLimitGlobal.remaining).toEqual(1)

		savedRequestObject = undefined
		await request(app)
			.get('/')
			.query({ key: 1 })
			.expect(420, 'Enhance your calm')
		expect(savedRequestObject.rateLimitKey.remaining).toEqual(0)

		savedRequestObject = undefined
		await request(app).get('/').query({ key: 3 }).expect(200)
		await request(app)
			.get('/')
			.query({ key: 3 })
			.expect(429, 'Too many requests')
		expect(savedRequestObject.rateLimitKey.remaining).toEqual(0)
		expect(savedRequestObject.rateLimitGlobal.remaining).toEqual(0)
	})
})

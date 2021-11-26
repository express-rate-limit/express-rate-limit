'use strict'
const express = require('express')
const assert = require('assert')
const request = require('supertest')
const rateLimit = require('../dist/index.js')

// todo: look into using http://sinonjs.org/docs/#clock instead of actually letting the tests wait on setTimeouts

describe('express-rate-limit node module', () => {
	let app, longResponseClosed

	function createAppWith(limit, checkVar, errorHandler, successHandler) {
		app = express()
		app.all('/', limit, (request, response) => {
			if (
				checkVar &&
				request.rateLimit.limit === 5 &&
				request.rateLimit.remaining === 4
			) {
				app.end((err, response) => {
					if (err) {
						return errorHandler(err)
					}
					return successHandler(undefined, response)
				})
			}

			response.format({
				html: function () {
					response.send('response!')
				},
				json: function () {
					response.json({
						message: 'response!',
					})
				},
			})
		})

		app.all('/bad_response_status', limit, (request, response) => {
			response.status(403).send()
		})

		app.all('/long_response', limit, (request, response) => {
			const timerId = setTimeout(() => response.send('response!'), 100)
			response.on('close', () => {
				longResponseClosed = true
				clearTimeout(timerId)
			})
		})

		app.all('/response_emit_error', limit, (request, response) => {
			response.on('error', () => {
				response.end()
			})

			response.emit('error', new Error())
		})

		return app
	}

	function MockStore() {
		this.incr_was_called = false
		this.resetKey_was_called = false
		this.decrement_was_called = false
		this.counter = 0

		this.incr = (key, cb) => {
			this.counter++
			this.incr_was_called = true

			cb(undefined, this.counter)
		}

		this.decrement = () => {
			this.counter--
			this.decrement_was_called = true
		}

		this.resetKey = () => {
			this.resetKey_was_called = true
			this.counter = 0
		}
	}

	function goodRequest(
		errorHandler,
		successHandler,
		key,
		headerCheck,
		limit,
		remaining,
	) {
		let request = request(app).get('/')
		// add optional key parameter
		if (key) {
			request = request.query({ key: key })
		}

		if (headerCheck) {
			request
				.expect('x-ratelimit-limit', limit && limit.toString())
				.expect('x-ratelimit-remaining', remaining && remaining.toString())
				.expect((response) => {
					if ('retry-after' in response.headers) {
						throw new Error(
							'Expected no retry-after header, got ' +
								response.headers['retry-after'],
						)
					}
				})
				.expect(200, /response!/)
				.end((err, response) => {
					if (err) {
						return errorHandler(err)
					}
					if (successHandler) {
						successHandler(undefined, response)
					}
				})
		} else {
			request
				.expect(200)
				.expect(/response!/)
				.end((err, response) => {
					if (err) {
						return errorHandler(err)
					}
					if (successHandler) {
						successHandler(undefined, response)
					}
				})
		}
	}

	function goodJsonRequest(errorHandler, successHandler) {
		request(app)
			.get('/')
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(200, {
				message: 'response!',
			})
			.end((err, response) => {
				if (err) {
					return errorHandler(err)
				}
				if (successHandler) {
					successHandler(undefined, response)
				}
			})
	}

	function badRequest(
		errorHandler,
		successHandler,
		key,
		headerCheck,
		limit,
		remaining,
		retryAfter,
	) {
		let request = request(app).get('/')

		// add optional key parameter
		if (key) {
			request = request.query({ key: key })
		}

		request = request.expect(429).expect(/Too many requests/)

		if (headerCheck) {
			request = request
				.expect('retry-after', retryAfter)
				.expect('x-ratelimit-limit', limit)
				.expect('x-ratelimit-remaining', remaining)
		}

		request.end((err, response) => {
			if (err) {
				return errorHandler(err)
			}
			if (successHandler) {
				successHandler(undefined, response)
			}
		})
	}

	function badJsonRequest(errorHandler, successHandler) {
		request(app)
			.get('/')
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(429, { message: 'Too many requests, please try again later.' })
			.end((err, response) => {
				if (err) {
					return errorHandler(err)
				}
				if (successHandler) {
					successHandler(undefined, response)
				}
			})
	}

	it('should not allow the use of a store that is not valid', (done) => {
		function InvalidStore() {}

		try {
			rateLimit({
				store: new InvalidStore(),
			})
		} catch (e) {
			return done()
		}

		done(new Error('It allowed an invalid store'))
	})

	it('should let the first request through', (done) => {
		const app = createAppWith(rateLimit({ max: 1 }))
		request(app)
			.get('/')
			.expect(200)
			.expect(/response!/)
			.end(done)
	})

	it('should call incr on the store', (done) => {
		const store = new MockStore()

		const app = createAppWith(
			rateLimit({
				store: store,
			}),
		)

		request(app)
			.get('/')
			.end((err /*, response*/) => {
				if (err) {
					return done(err)
				}
				if (!store.incr_was_called) {
					done(new Error('incr was not called on the store'))
				} else {
					done()
				}
			})
	})

	it('should call resetKey on the store', (done) => {
		const store = new MockStore()
		const limiter = rateLimit({
			store: store,
		})

		limiter.resetKey('key')

		if (!store.resetKey_was_called) {
			done(new Error('resetKey was not called on the store'))
		} else {
			done()
		}
	})

	it('should refuse additional connections once IP has reached the max', async () => {
		const app = createAppWith(
			rateLimit({
				delayMs: 0,
				max: 2,
			}),
		)
		await request(app).get('/').expect(200)
		await request(app).get('/').expect(200)
		await request(app).get('/').expect(429)
	})

	it('should show the provided message instead of the default message when max connections are reached', async () => {
		const message = 'Test ratelimit message'
		const app = createAppWith(
			rateLimit({
				delayMs: 0,
				max: 2,
				message,
			}),
		)
		await request(app).get('/').expect(200)
		await request(app).get('/').expect(200)
		await request(app).get('/').expect(429).expect(message)
	})

	it('should (eventually) accept new connections from a blocked IP', (done) => {
		createAppWith(
			rateLimit({
				max: 2,
				windowMs: 50,
			}),
		)
		goodRequest(done)
		goodRequest(done)
		badRequest(done)
		setTimeout(() => {
			goodRequest(done, (/* err, response */) => {
				done()
			})
		}, 60)
	})

	it('should work repeatedly (issues #2 & #3)', (done) => {
		createAppWith(
			rateLimit({
				max: 2,
				windowMs: 50,
			}),
		)

		goodRequest(done)
		goodRequest(done)
		badRequest(done)
		setTimeout(() => {
			goodRequest(done, (/* err, response */) => {
				goodRequest(done)
				badRequest(done)
				setTimeout(() => {
					goodRequest(done, (/* err, response */) => {
						done()
					})
				}, 60)
			})
		}, 60)
	})

	it('should allow the error statusCode to be customized', (done) => {
		// note: node.js places some restrictions on what status codes are allowed
		const errStatusCode = 456
		createAppWith(
			rateLimit({
				delayMs: 0,
				max: 1,
				statusCode: errStatusCode,
			}),
		)
		goodRequest(done)
		request(app).get('/').expect(errStatusCode).end(done)
	})

	it(`should allow individual IP's to be reset`, (done) => {
		const limiter = rateLimit({
			max: 1,
			windowMs: 50,
		})
		createAppWith(limiter)

		// set in headers so that I don't have to deal with the body being a stream
		app.get('/ip', (request, response) => {
			response.setHeader('x-your-ip', request.ip)
			response.status(204).send('')
		})

		request(app)
			.get('/ip')
			.expect(204)
			.end((err, response) => {
				const myIp = response.headers['x-your-ip']
				if (!myIp) {
					return done(new Error('unable to determine local IP'))
				}
				goodRequest(done)
				badRequest(done, (err) => {
					if (err) {
						return done(err)
					}
					limiter.resetIp(myIp)
					goodRequest(done, done)
				})
			})
	})

	it('should respond with JSON', (done) => {
		const limiter = rateLimit({
			delayMs: 0,
			message: { message: 'Too many requests, please try again later.' },
			max: 1,
		})
		createAppWith(limiter)
		goodJsonRequest(done)
		badJsonRequest(done, done)
	})

	it('should use the custom handler when specified', (done) => {
		const limiter = rateLimit({
			delayMs: 0,
			max: 1,
			handler: function (request, response) {
				response.status(429).end('Custom handler executed!')
			},
		})
		createAppWith(limiter)
		goodRequest(done)
		request(app)
			.get('/')
			.expect(429, 'Custom handler executed!')
			.end((err) => {
				if (err) {
					return done(err)
				} else {
					return done()
				}
			})
	})

	it('should allow custom key generators', (done) => {
		const limiter = rateLimit({
			delayMs: 0,
			max: 2,
			keyGenerator: function (request, response) {
				assert.ok(request)
				assert.ok(response)

				const key = request.query.key
				assert.ok(key)

				return key
			},
		})

		createAppWith(limiter)
		goodRequest(done, undefined, 1)
		goodRequest(done, undefined, 1)
		goodRequest(done, undefined, 2)
		badRequest(
			done,
			(err) => {
				if (err) {
					return done(err)
				}
				goodRequest(done, undefined, 2)
				badRequest(done, done, 2)
			},
			1,
		)
	})

	it('should allow custom skip function', (done) => {
		const limiter = rateLimit({
			delayMs: 0,
			max: 2,
			skip: function (request, response) {
				assert.ok(request)
				assert.ok(response)

				return true
			},
		})

		createAppWith(limiter)
		goodRequest(done, undefined, 1)
		goodRequest(done, undefined, 1)
		goodRequest(done, done, 1) // 3rd request would normally fail but we're skipping it
	})

	it('should allow custom skip function that returns a promise', (done) => {
		const limiter = rateLimit({
			delayMs: 0,
			max: 2,
			skip: function (request, response) {
				assert.ok(request)
				assert.ok(response)

				return Promise.resolve(true)
			},
		})

		createAppWith(limiter)
		goodRequest(done, undefined, 1)
		goodRequest(done, undefined, 1)
		goodRequest(done, done, 1) // 3rd request would normally fail but we're skipping it
	})

	it('should pass current hits and limit hits to the next function', (done) => {
		const limiter = rateLimit({
			headers: false,
		})
		createAppWith(limiter, true, done, done)
		done()
	})

	it('should allow max to be a function', (done) => {
		createAppWith(
			rateLimit({
				delayMs: 0,
				max: () => 2,
			}),
		)
		goodRequest(done)
		goodRequest(done)
		badRequest(done, done)
	})

	it('should allow max to be a function that returns a promise', (done) => {
		createAppWith(
			rateLimit({
				delayMs: 0,
				max: () => Promise.resolve(2),
			}),
		)
		goodRequest(done)
		goodRequest(done)
		badRequest(done, done)
	})

	// https://github.com/nfriedly/express-rate-limit/pull/102
	it('should calculate the remaining hits', (done) => {
		const expectedLimit = 2
		createAppWith(
			rateLimit({
				delayMs: 0,
				max: () => Promise.resolve(expectedLimit),
			}),
		)
		const expectedRemaining = 1
		goodRequest(done, done, undefined, true, expectedLimit, expectedRemaining)
	})

	it('should decrement hits with success response and skipSuccessfulRequests', (done) => {
		const store = new MockStore()
		createAppWith(
			rateLimit({
				skipSuccessfulRequests: true,
				store: store,
			}),
		)

		goodRequest(done, () => {
			if (!store.decrement_was_called) {
				done(new Error('decrement was not called on the store'))
			} else {
				done()
			}
		})
	})

	it('should not decrement hits with failed response and skipSuccessfulRequests', (done) => {
		const store = new MockStore()
		createAppWith(
			rateLimit({
				skipSuccessfulRequests: true,
				store: store,
			}),
		)

		request(app)
			.get('/bad_response_status')
			.expect(403)
			.end(() => {
				if (store.decrement_was_called) {
					done(new Error('decrement was called on the store'))
				} else {
					done()
				}
			})
	})

	it('should decrement hits with failed response and skipFailedRequests', (done) => {
		const store = new MockStore()
		createAppWith(
			rateLimit({
				skipFailedRequests: true,
				store: store,
			}),
		)

		request(app)
			.get('/bad_response_status')
			.expect(403)
			.end(() => {
				if (!store.decrement_was_called) {
					done(new Error('decrement was not called on the store'))
				} else {
					done()
				}
			})
	})

	it('should decrement hits with closed response and skipFailedRequests', (done) => {
		const store = new MockStore()
		createAppWith(
			rateLimit({
				skipFailedRequests: true,
				store: store,
			}),
		)

		const checkStoreDecremented = () => {
			if (longResponseClosed) {
				if (!store.decrement_was_called) {
					done(new Error('decrement was not called on the store'))
				} else {
					done()
				}
			} else {
				setImmediate(checkStoreDecremented)
			}
		}

		request(app)
			.get('/long_response')
			.timeout({
				response: 10,
			})
			.end(checkStoreDecremented)
	})

	it('should decrement hits with response emitting error and skipFailedRequests', (done) => {
		const store = new MockStore()
		createAppWith(
			rateLimit({
				skipFailedRequests: true,
				store: store,
			}),
		)

		request(app)
			.get('/response_emit_error')
			.end(() => {
				if (!store.decrement_was_called) {
					done(new Error('decrement was not called on the store'))
				} else {
					done()
				}
			})
	})

	it('should not decrement hits with success response and skipFailedRequests', (done) => {
		const store = new MockStore()
		createAppWith(
			rateLimit({
				skipFailedRequests: true,
				store: store,
			}),
		)

		goodRequest(done, () => {
			if (store.decrement_was_called) {
				done(new Error('decrement was called on the store'))
			} else {
				done()
			}
		})
	})

	it('should decrement hits with IP hits reached max and skipFailedRequests', (done) => {
		const store = new MockStore()
		createAppWith(
			rateLimit({
				delayMs: 0,
				max: 2,
				store: store,
				skipFailedRequests: true,
			}),
		)
		goodRequest(done)
		goodRequest(done)
		badRequest(done, () => {
			if (!store.decrement_was_called) {
				done(new Error('decrement was not called on the store'))
			} else {
				done()
			}
		})
	})

	it('should not modify the passed in options object', () => {
		const opts = {}
		rateLimit(opts)
		assert.deepEqual(opts, {})
	})

	it('should handle exceptions', (done) => {
		let errorCaught = false
		const store = new MockStore()
		const app = createAppWith(
			rateLimit({
				max: 1,
				store: store,
				handler: () => {
					const exception = new Error()
					exception.code = 429
					exception.message = 'Too many requests'
					throw exception
				},
			}),
		)
		// eslint-disable-next-line no-unused-vars
		app.use((err, request, response, next) => {
			errorCaught = true
			response.status(err.code).send(err.message)
		})
		goodRequest(done)
		badRequest(done, () => {
			assert(errorCaught)
			done()
		})
	})

	it('should handle exceptions thrown in skip function', (done) => {
		let errorCaught = false
		const store = new MockStore()
		const app = createAppWith(
			rateLimit({
				max: 1,
				store: store,
				skip: () => {
					const exception = new Error()
					exception.code = 429
					exception.message = 'Too many requests'
					return Promise.reject(exception)
				},
			}),
		)
		// eslint-disable-next-line no-unused-vars
		app.use((err, request, response, next) => {
			errorCaught = true
			response.status(err.code).send(err.message)
		})
		badRequest(done, () => {
			assert(errorCaught)
			done()
		})
	})
})

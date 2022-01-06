// /source/lib.ts
// The option parser and rate limiting middleware

import { Request, Response, NextFunction, RequestHandler } from 'express'

import MemoryStore from './memory-store.js'
import {
	Options,
	AugmentedRequest,
	RateLimitRequestHandler,
	LegacyStore,
	Store,
	IncrementResponse,
} from './types.js'

/**
 * Type guard to check if a store is legacy store.
 *
 * @param store {LegacyStore | Store} - The store to check
 *
 * @return {boolean} - Whether the store is a legacy store
 */
const isLegacyStore = (store: LegacyStore | Store): store is LegacyStore =>
	// Check that `incr` exists but `increment` does not - store authors might want
	// to keep both around for backwards compatibility.
	typeof (store as any).incr === 'function' &&
	typeof (store as any).increment !== 'function'

/**
 * Converts a legacy store to the promisified version.
 *
 * @param store {LegacyStore | Store} - The legacy store or even a modern store
 *
 * @returns {Store} - The promisified version of the store
 */
const promisifyStore = (passedStore: LegacyStore | Store): Store => {
	if (!isLegacyStore(passedStore)) {
		// It's not an old store, return as is
		return passedStore
	}

	// Why can't Typescript understand this?
	const legacyStore = passedStore

	// A promisified version of the store
	class PromisifiedStore implements Store {
		async increment(key: string): Promise<IncrementResponse> {
			return new Promise((resolve, reject) => {
				legacyStore.incr(
					key,
					(
						error: Error | undefined,
						totalHits: number,
						resetTime: Date | undefined,
					) => {
						if (error) reject(error)
						resolve({ totalHits, resetTime })
					},
				)
			})
		}

		async decrement(key: string): Promise<void> {
			return Promise.resolve(legacyStore.decrement(key))
		}

		async resetKey(key: string): Promise<void> {
			return Promise.resolve(legacyStore.resetKey(key))
		}

		async resetAll(): Promise<void> {
			if (typeof legacyStore.resetAll === 'function')
				return Promise.resolve(legacyStore.resetAll())
		}
	}

	return new PromisifiedStore()
}

/**
 * Adds the defaults for options the user has not specified.
 *
 * @param options {Options} - The options the user specifies
 *
 * @returns {Options} - A complete configuration object
 */
const parseOptions = (
	passedOptions: Omit<Partial<Options>, 'store'> & {
		store?: Store | LegacyStore
	},
): Options => {
	// Now add the defaults for the other options

	const options = {
		windowMs: 60 * 1000,
		store: new MemoryStore(),
		max: 5,
		message: 'Too many requests, please try again later.',
		statusCode: 429,
		legacyHeaders: passedOptions.headers ?? true,
		standardHeaders: passedOptions.draft_polli_ratelimit_headers ?? false,
		requestPropertyName: 'rateLimit',
		skipFailedRequests: false,
		skipSuccessfulRequests: false,
		requestWasSuccessful: (_request: Request, response: Response): boolean =>
			response.statusCode < 400,
		skip: (_request: Request, _response: Response): boolean => false,
		keyGenerator: (request: Request, _response: Response): string => {
			if (!request.ip) {
				console.error(
					'WARN | `express-rate-limit` | `request.ip` is undefined. You can avoid this by providing a custom `keyGenerator` function, but it may be indicative of a larger issue.',
				)
			}

			return request.ip
		},
		handler: (
			_request: Request,
			response: Response,
			_next: NextFunction,
			_optionsUsed: Options,
		): void => {
			response.status(options.statusCode).send(options.message)
		},
		onLimitReached: (
			_request: Request,
			_response: Response,
			_optionsUsed: Options,
		): void => {},
		...passedOptions,
	}

	// Ensure that the store passed implements the either the `Store` or `LegacyStore`
	// interface
	if (
		(typeof (options.store as LegacyStore).incr !== 'function' &&
			typeof (options.store as Store).increment !== 'function') ||
		typeof options.store.decrement !== 'function' ||
		typeof options.store.resetKey !== 'function' ||
		(typeof options.store.resetAll !== 'undefined' &&
			typeof options.store.resetAll !== 'function') ||
		(typeof (options.store as Store).init !== 'undefined' &&
			typeof (options.store as Store).init !== 'function')
	) {
		throw new TypeError(
			'An invalid store was passed. Please ensure that the store is a class that implements the `Store` interface.',
		)
	}

	// Promisify the store, if it is not already
	options.store = promisifyStore(options.store)

	// Return the 'clean' options
	return options as Options
}

/**
 * Just pass on any errors for the developer to handle, usually as a HTTP 500
 * Internal Server Error.
 *
 * @param fn {RequestHandler} - The request handler for which to handle errors
 *
 * @returns {RequestHandler} - The request handler wrapped with a `.catch` clause
 *
 * @private
 */
const handleAsyncErrors =
	(fn: RequestHandler): RequestHandler =>
	async (request: Request, response: Response, next: NextFunction) => {
		try {
			await Promise.resolve(fn(request, response, next)).catch(next)
		} catch (error: unknown) {
			next(error)
		}
	}

/**
 *
 * Create an instance of IP rate-limiting middleware for Express.
 *
 * @param passedOptions {Options} - Options to configure the rate limiter
 *
 * @returns {RateLimitRequestHandler} - The middleware that rate-limits clients based on your configuration
 *
 * @public
 */
const rateLimit = (
	passedOptions?: Omit<Partial<Options>, 'store'> & {
		store?: Store | LegacyStore
	},
): RateLimitRequestHandler => {
	// Parse the options and add the default values for unspecified options
	const options = parseOptions(passedOptions ?? {})
	// Call the `init` method on the store, if it exists
	if (typeof options.store.init === 'function') options.store.init(options)

	// Then return the actual middleware
	const middleware = handleAsyncErrors(
		async (request: Request, response: Response, next: NextFunction) => {
			// First check if we should skip the request
			const skip = await options.skip(request, response)
			if (skip) {
				next()
				return
			}

			// Create an augmented request
			const augmentedRequest = request as AugmentedRequest

			// Get a unique key for the client
			const key = await options.keyGenerator(request, response)
			// Increment the client's hit counter by one
			const { totalHits, resetTime } = await options.store.increment(key)

			// Get the quota (max number of hits) for each client
			const retrieveQuota =
				typeof options.max === 'function'
					? options.max(request, response)
					: options.max

			const maxHits = await retrieveQuota
			// Set the rate limit information on the augmented request object
			augmentedRequest[options.requestPropertyName] = {
				limit: maxHits,
				current: totalHits,
				remaining: Math.max(maxHits - totalHits, 0),
				resetTime,
			}

			// Set the X-RateLimit headers on the response object if enabled
			if (options.legacyHeaders && !response.headersSent) {
				response.setHeader('X-RateLimit-Limit', maxHits)
				response.setHeader(
					'X-RateLimit-Remaining',
					augmentedRequest[options.requestPropertyName].remaining,
				)

				// If we have a resetTime, also provide the current date to help avoid issues with incorrect clocks
				if (resetTime instanceof Date) {
					response.setHeader('Date', new Date().toUTCString())
					response.setHeader(
						'X-RateLimit-Reset',
						Math.ceil(resetTime.getTime() / 1000),
					)
				}
			}

			// Set the standardized RateLimit headers on the response object
			// if enabled
			if (options.standardHeaders && !response.headersSent) {
				response.setHeader('RateLimit-Limit', maxHits)
				response.setHeader(
					'RateLimit-Remaining',
					augmentedRequest[options.requestPropertyName].remaining,
				)

				if (resetTime) {
					const deltaSeconds = Math.ceil(
						(resetTime.getTime() - Date.now()) / 1000,
					)
					response.setHeader('RateLimit-Reset', Math.max(0, deltaSeconds))
				}
			}

			// If we are to skip failed/successfull requests, decrement the
			// counter accordingly once we know the status code of the request
			if (options.skipFailedRequests || options.skipSuccessfulRequests) {
				let decremented = false
				const decrementKey = async () => {
					if (!decremented) {
						await options.store.decrement(key)
						decremented = true
					}
				}

				if (options.skipFailedRequests) {
					response.on('finish', async () => {
						if (!options.requestWasSuccessful(request, response))
							await decrementKey()
					})
					response.on('close', async () => {
						if (!response.writableEnded) await decrementKey()
					})
					response.on('error', async () => {
						await decrementKey()
					})
				}

				if (options.skipSuccessfulRequests) {
					response.on('finish', async () => {
						if (options.requestWasSuccessful(request, response))
							await decrementKey()
					})
				}
			}

			// Call the {@link Options.onLimitReached} callback on
			// the first request where client exceeds their rate limit.
			if (maxHits && totalHits === maxHits + 1) {
				options.onLimitReached(request, response, options)
			}

			// If the client has exceeded their rate limit, set the Retry-After
			// header and call the {@link Options.handler} function
			if (maxHits && totalHits > maxHits) {
				if (
					(options.legacyHeaders || options.standardHeaders) &&
					!response.headersSent
				) {
					response.setHeader('Retry-After', Math.ceil(options.windowMs / 1000))
				}

				options.handler(request, response, next, options)
				return
			}

			next()
		},
	)

	// Export the store's function to reset the hit counter for a particular
	// client based on their identifier
	;(middleware as RateLimitRequestHandler).resetKey =
		options.store.resetKey.bind(options.store)

	return middleware as RateLimitRequestHandler
}

// Export it to the world!
export default rateLimit

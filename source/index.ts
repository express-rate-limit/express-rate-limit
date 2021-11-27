// /source/index.ts
// Library code

import Express from 'express'

import MemoryStore from './memory-store.js'

/**
 * Callback that fires when a client's hit counter is incremented.
 *
 * @param error {Error | undefined} - The error that occurred, if any
 * @param hit {number} - The number of hits for that client so far
 * @param resetTime {Date | undefined} - The time when the counter resets
 *
 * @public
 */
export type IncrementCallback = (
	error: Error | undefined,
	hit: number,
	resetTime: Date | undefined,
) => void

/**
 * Method (in the form of middleware) to generate custom identifiers for
 * clients.
 *
 * @param request {Express.Request} - The Express request object
 * @param response {Express.Response} - The Express response object
 *
 * @returns {string} - The string used to identify the client
 *
 * @public
 */
export type KeyGeneratingMiddleware = (
	request: Express.Request,
	response: Express.Response,
) => string | Promise<string>

/**
 * Method (in the form of middleware) to determine whether or not this request
 * counts towards a client's quota.
 *
 * @param request {Express.Request} - The Express request object
 * @param response {Express.Response} - The Express response object
 *
 * @returns {boolean} - Whether or not this request counts towards the quota
 *
 * @public
 */
export type ShouldSkipMiddleware = (
	request: Express.Request,
	response: Express.Response,
) => boolean | Promise<boolean>

/**
 * A modified Express request handler with the rate limit functions.
 */
export type RateLimitRequestHandler = Express.RequestHandler

/**
 * An interface that all hit counter stores must implement.
 */
export interface Store {
	/**
	 * Method to increment a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 * @param callback {IncrementCallback} - The callback to call once the counter is incremented
	 */
	increment: (key: string, callback: IncrementCallback) => void

	/**
	 * Method to decrement a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 */
	decrement: (key: string) => void

	/**
	 * Method to reset a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 */
	resetKey: (key: string) => void

	/**
	 * Method to reset everyone's hit counter.
	 */
	resetAll?: () => void
}

/**
 * The configuration options for the rate limiter.
 */
export interface Options {
	/**
	 * How long we should remember the requests
	 */
	readonly windowMs: number

	/**
	 * The maximum number of connection to allow during the `window` before
	 * rate limiting the client.
	 *
	 * Can be the limit itself as a number or express middleware that parses
	 * the request and then figures out the limit.
	 */
	readonly max:
		| number
		| ((
				request: Express.Request,
				response: Express.Response,
		  ) => number | Promise<number>)

	/**
	 * The response body to send back when a client is rate limited.
	 */
	readonly message: any

	/**
	 * The HTTP status code to send back when a client is rate limited.
	 *
	 * Defaults to `HTTP 429 Too Many Requests` (RFC 6585).
	 */
	readonly statusCode: number

	/**
	 * Whether to send custom headers with the rate limit and the number of
	 * requests.
	 */
	readonly headers: boolean

	/**
	 * Whether to enable support for the rate limit standardization headers.
	 */
	readonly useStandardizedHeaders: boolean

	/**
	 * The name of the property on the request object to store the rate limit info.
	 *
	 * Defaults to `rateLimit`.
	 */
	readonly requestPropertyName: string

	/**
	 * If `true`, the library will (by default) skip all requests that have a 4XX
	 * or 5XX status.
	 */
	readonly skipFailedRequests: boolean

	/**
	 * If `true`, the library will (by default) skip all requests that have a
	 * status code less than 400.
	 */
	readonly skipSuccessfulRequests: boolean

	/**
	 * Method to determine whether or not the request counts as 'succesful'. Used
	 * when either `skipSuccessfulRequests` or `skipFailedRequests` is set to true.
	 */
	readonly requestWasSuccessful: ShouldSkipMiddleware

	/**
	 * Method to generate custom identifiers for clients.
	 *
	 * By default, the client's IP address is used.
	 */
	readonly keyGenerator: KeyGeneratingMiddleware

	/**
	 * Method (in the form of middleware) to determine whether or not this request
	 * counts towards a client's quota.
	 */
	readonly skip: ShouldSkipMiddleware

	/**
	 * Express request handler that sends back a response when a client is
	 * rate-limited.
	 */
	readonly handler: (
		request: Express.Request,
		response: Express.Response,
		optionsUsed: Options,
	) => void

	/**
	 * Express request handler that sends back a response when a client has
	 * reached their rate limit.
	 */
	readonly onLimitReached: (
		request: Express.Request,
		response: Express.Response,
		optionsUsed: Options,
	) => void

	/**
	 * The {@link Store} to use to store the hit count for each client.
	 */
	readonly store: Store
}

/**
 * The extended request object that includes information about the client's
 * rate limit.
 */
export type AugmentedRequest = Express.Request & {
	[key: string]: RateLimitInfo
}

/**
 * The rate limit related information for each client included in the
 * Express request object.
 */
export interface RateLimitInfo {
	readonly limit: number
	readonly current: number
	readonly remaining: number
	readonly resetTime: Date | undefined
}

/**
 * Adds the defaults for options the user has not specified.
 *
 * @param options {Options} - The options the user specifies
 *
 * @returns {Options} - A complete configuration object
 */
const parseOptions = (passedOptions: Partial<Options>): Options => {
	const {
		// Default window of time is 1 minute
		windowMs = 60 * 1000,
		// The default storage provider used is a {@link MemoryStore}
		store = new MemoryStore(windowMs),
	} = passedOptions

	// Now add the defaults for the other options
	const options: Options = {
		windowMs,
		store,
		max: 5,
		message: 'Too many requests, please try again later.',
		statusCode: 429,
		headers: true,
		useStandardizedHeaders: false,
		requestPropertyName: 'rateLimit',
		skipFailedRequests: false,
		skipSuccessfulRequests: false,
		requestWasSuccessful: (_request, response) => response.statusCode < 400,
		keyGenerator: (request) => {
			if (!request.ip) {
				console.error(
					'WARN | `express-rate-limit` | The `request.ip` is undefined. You can avoid this by providing a custom `keyGenerator` function, but it may be indicative of a larger issue.',
				)
			}

			return request.ip
		},
		skip: () => false,
		handler: (_request, response, _optionsUsed: Options) =>
			response.status(options.statusCode).send(options.message),
		onLimitReached: () => {},
		...passedOptions,
	}

	// Ensure that the store passed implements the {@link Store} interface
	if (
		typeof options.store.increment !== 'function' ||
		typeof options.store.resetKey !== 'function' ||
		(options.skipFailedRequests &&
			typeof options.store.decrement !== 'function')
	) {
		throw new Error(
			'An invalid store was passed. Please ensure that the store is a class that implements the `Store` interface.',
		)
	}

	// Throw an error if any deprecated options are passed
	for (const option of ['global', 'delayMs', 'delayAfter']) {
		// This doesn't trigger if any value is set to a falsy value (e.g., 0),
		// because that essentially disables them
		if ((passedOptions as any)[option]) {
			throw new Error(
				`The \`${option}\` option was removed from \`express-rate-limit\` v3.`,
			)
		}
	}

	// Return the 'clean' options
	return options
}

/**
 * Just pass on any errors for the developer to handle, usually as a HTTP 500
 * Internal Server Error.
 *
 * @param fn {Express.RequestHandler} - The request handler for which to handle errors
 *
 * @returns {Express.RequestHandler} - The request handler wrapped with a `.catch` clause
 *
 * @private
 */
const handleAsyncErrors =
	(fn: Express.RequestHandler): Express.RequestHandler =>
	async (
		request: Express.Request,
		response: Express.Response,
		next: Express.NextFunction,
	) => {
		try {
			// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
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
	passedOptions?: Partial<Options>,
): RateLimitRequestHandler => {
	// Parse the options and add the default values for unspecified options
	const options = parseOptions(passedOptions ?? {})

	// Then return the actual middleware
	return handleAsyncErrors(
		async (
			request: Express.Request,
			response: Express.Response,
			next: Express.NextFunction,
		) => {
			// First check if we should skip the request
			const skip = await Promise.resolve(options.skip(request, response))
			if (skip) {
				next()
				return
			}

			// Create an augmented request
			const augmentedRequest = request as AugmentedRequest

			// Get a unique key for the client
			const key = await Promise.resolve(options.keyGenerator(request, response))
			// Increment the client's hit counter by one
			const { totalHits, resetTime } = await new Promise<{
				totalHits: number
				resetTime: Date | undefined
			}>((resolve, reject) => {
				options.store.increment(
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

			// Get the quota (max number of hits) for each client
			const retrieveQuota =
				typeof options.max === 'function'
					? options.max(request, response)
					: options.max

			const maxHits = await Promise.resolve(retrieveQuota)
			// Set the rate limit information on the augmented request object
			augmentedRequest[options.requestPropertyName] = {
				limit: maxHits,
				current: totalHits,
				remaining: Math.max(maxHits - totalHits, 0),
				resetTime,
			}

			// Set the X-RateLimit headers on the response object if enabled
			if (options.headers && !response.headersSent) {
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
			if (options.useStandardizedHeaders && !response.headersSent) {
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
				const decrementKey = () => {
					if (!decremented) {
						options.store.decrement(key)
						decremented = true
					}
				}

				if (options.skipFailedRequests) {
					response.on('finish', () => {
						if (!options.requestWasSuccessful(request, response)) decrementKey()
					})
					response.on('close', () => {
						if (!response.writableEnded) decrementKey()
					})
					response.on('error', () => {
						decrementKey()
					})
				}

				if (options.skipSuccessfulRequests) {
					response.on('finish', () => {
						if (options.requestWasSuccessful(request, response)) decrementKey()
					})
				}
			}

			// Call the {@link Options.onLimitReached} callback if
			// the client has reached their rate limit.
			if (maxHits && totalHits === maxHits + 1) {
				options.onLimitReached(request, response, options)
			}

			// If the client has exceeded their rate limit, set the Retry-After
			// header and call the {@link Options.handler} function
			if (maxHits && totalHits > maxHits) {
				if (options.headers && !response.headersSent) {
					response.setHeader('Retry-After', Math.ceil(options.windowMs / 1000))
				}

				options.handler(request, response, options)
				return
			}

			next()
		},
	)
}

// Export it to the world!
export default rateLimit

// /source/express-rate-limit
// Library code

import MemoryStore = require('./memory-store')
import Express = require('express')

/**
 * The types for this library.
 */
namespace RateLimit {
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
	) => string

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
	) => boolean

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
		increment(key: string, callback: IncrementCallback): void

		/**
		 * Method to decrement a client's hit counter.
		 *
		 * @param key {string} - The identifier for a client
		 */
		decrement(key: string): void

		/**
		 * Method to reset a client's hit counter.
		 *
		 * @param key {string} - The identifier for a client
		 */
		resetKey(key: string): void

		/**
		 * Method to reset everyone's hit counter.
		 */
		resetAll(): void
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
			| ((request: Express.Request, response: Express.Response) => number)

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
		readonly draft_polli_ratelimit_headers: boolean

		/**
		 * If `true`, the library will skip all requests that have a 4XX or 5XX
		 * status.
		 */
		readonly skipFailedRequests: boolean

		/**
		 * If `true`, the library will skip all requests that have a status code
		 * less than 400.
		 */
		readonly skipSuccessfulRequests: boolean

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
	export interface AugmentedRequest extends Express.Request {
		rateLimit: RateLimitInfo
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
}

/**
 * Adds the defaults for options the user has not specified.
 *
 * @param options {RateLimit.Options} - The options the user specifies
 *
 * @returns {RateLimit.Options} - A complete configuration object
 */
function parseOptions(
	passedOptions: Partial<RateLimit.Options>,
): RateLimit.Options {
	const {
		// Default window of time is 1 minute
		windowMs = 60 * 1000,
		// The default storage provider used is a {@link MemoryStore}
		store = new MemoryStore(windowMs),
	} = passedOptions

	// Now add the defaults for the other options
	const options: RateLimit.Options = {
		windowMs,
		store,
		max: 5,
		message: 'Too many requests, please try again later.',
		statusCode: 429,
		headers: true,
		draft_polli_ratelimit_headers: false,
		skipFailedRequests: false,
		skipSuccessfulRequests: false,
		keyGenerator: (request) => request.ip,
		skip: () => false,
		handler: (_request, response, optionsUsed: RateLimit.Options) =>
			response.status(options.statusCode).send(options.message),
		onLimitReached: () => {},
		...passedOptions,
	}

	// Ensure that the store passed implements the {@link RateLimit.Store} interface
	if (
		typeof options.store.increment !== 'function' ||
		typeof options.store.resetKey !== 'function' ||
		(options.skipFailedRequests &&
			typeof options.store.decrement !== 'function')
	) {
		throw new Error(
			'An invalid store was passed. Please ensure that the store is a class that implements the `RateLimit.Store` interface.',
		)
	}

	// Throw an error if any deprecated options are passed
	;['global', 'delayMs', 'delayAfter'].forEach((key) => {
		// This doesn't trigger if any value is set to a falsy value (e.g., 0),
		// because that essentially disables them
		if ((passedOptions as any)[key]) {
			throw new Error(
				`The \`${key}\` option was removed from \`express-rate-limit\` v3.`,
			)
		}
	})

	// Return the 'clean' options
	return options
}

/**
 * A modified Express request handler with the rate limit functions.
 */
type RateLimitRequestHandler = Express.RequestHandler & {
	/**
	 * Attaches the {@link resetKey} function of the store to the modified handler.
	 */
	readonly resetKey: RateLimit.Store['resetKey']
	readonly resetIp: RateLimit.Store['resetKey']

	/**
	 * Provides a way to extract the rate limit information (if it exists) from
	 * a generic Express request object.
	 *
	 * @param request {Express.Request} - The generic Express request object
	 *
	 * @returns {RateLimit.RateLimitInfo | undefined} - The rate limit info, if available for the request
	 */
	readonly getRateLimit: (
		request: Express.Request,
	) => RateLimit.RateLimitInfo | undefined
}

/**
 * Type guard to check if the generic request object has rate limit info in it.
 *
 * @param request {Express.Request} - The generic Express request object
 *
 * @returns {TypeGuard} - Whether the request is in fact an {@link RateLimit.AugmentedRequest}
 */
const isAugmentedRequest = (
	request: Express.Request,
): request is RateLimit.AugmentedRequest => {
	const asAny = request as any

	// Check if `request.rateLimit` is a {@link RateLimit.RateLimitInfo} object
	return (
		'rateLimit' in asAny &&
		typeof asAny.rateLimit.limit === 'number' &&
		typeof asAny.rateLimit.current === 'number' &&
		typeof asAny.rateLimit.remaining === 'number' &&
		(asAny.rateLimit.resetTime === undefined ||
			asAny.rateLimit.resetTime instanceof Date)
	)
}

/**
 *
 * IP rate-limiting middleware for Express.
 *
 * @param passedOptions {RateLimit.Options} - Options to configure the rate limiter
 *
 * @returns {RateLimitRequestHandler} - The middleware that rate-limits clients based on your configuration
 *
 * @public
 */
const RateLimit = (
	passedOptions: Partial<RateLimit.Options>,
): RateLimitRequestHandler => {
	// Parse the options and add the default values for unspecified options
	const options = parseOptions(passedOptions)

	// The actual rate limiting middleware
	const rateLimit = (
		request: Express.Request,
		response: Express.Response,
		next: Express.NextFunction,
	) => {
		// First check if we should skip the request
		Promise.resolve(options.skip(request, response))
			.then((skip) => {
				if (skip) return next()

				// Create an augmented request
				const augmentedRequest = request as RateLimit.AugmentedRequest

				// Get a unique key for the client
				const key = options.keyGenerator(request, response)
				// Increment the client's hit counter by one
				options.store.increment(key, (error, current, resetTime) => {
					if (error) return next(error)

					// Get the quota (max number of hits) for each client
					const retrieveQuota =
						typeof options.max === 'function'
							? options.max(request, response)
							: options.max

					Promise.resolve(retrieveQuota)
						.then((max) => {
							// Set the rate limit information on the augmented request object
							augmentedRequest.rateLimit = {
								limit: max,
								current: current,
								remaining: Math.max(max - current, 0),
								resetTime: resetTime,
							}

							// Set the X-RateLimit headers on the response object if enabled
							if (options.headers && !response.headersSent) {
								response.setHeader('X-RateLimit-Limit', max)
								response.setHeader(
									'X-RateLimit-Remaining',
									augmentedRequest.rateLimit.remaining,
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
							if (
								options.draft_polli_ratelimit_headers &&
								!response.headersSent
							) {
								response.setHeader('RateLimit-Limit', max)
								response.setHeader(
									'RateLimit-Remaining',
									augmentedRequest.rateLimit.remaining,
								)

								if (resetTime) {
									const deltaSeconds = Math.ceil(
										(resetTime.getTime() - Date.now()) / 1000,
									)
									response.setHeader(
										'RateLimit-Reset',
										Math.max(0, deltaSeconds),
									)
								}
							}

							// If we are to skip failed/successfull requests, decrement the
							// counter accordingly once we know the status code of the request
							if (
								options.skipFailedRequests ||
								options.skipSuccessfulRequests
							) {
								let decremented = false
								const decrementKey = () => {
									if (!decremented) {
										options.store.decrement(key)
										decremented = true
									}
								}

								if (options.skipFailedRequests) {
									response.on('finish', () => {
										if (response.statusCode >= 400) decrementKey()
									})
									response.on('close', () => {
										if (!response.finished) decrementKey()
									})
									response.on('error', () => decrementKey())
								}

								if (options.skipSuccessfulRequests) {
									response.on('finish', () => {
										if (response.statusCode < 400) options.store.decrement(key)
									})
								}
							}

							// Call the {@link RateLimit.Options.onLimitReached} callback if
							// the client has reached their rate limit.
							if (max && current === max + 1) {
								options.onLimitReached(request, response, options)
							}

							// If the client has exceeded their rate limit, set the Retry-After
							// header and call the {@link RateLimit.Options.handler} function
							if (max && current > max) {
								if (options.headers && !response.headersSent) {
									response.setHeader(
										'Retry-After',
										Math.ceil(options.windowMs / 1000),
									)
								}

								return options.handler(request, response, options)
							}

							return next()
						})
						// Just pass on any errors for the developer to handle, usually as
						// a HTTP 500 Internal Server Error
						.catch(next)
				})
			})
			.catch(next)
	}

	// Export the store's function to reset the hit counter for a particular
	// client based on their identifier
	rateLimit.resetKey = options.store.resetKey.bind(options.store)
	// Export the same function as `resetIp` for backward compatibility
	rateLimit.resetIp = rateLimit.resetKey

	// Provide a way to extract the rate limit information (if it exists) from
	// a generic Express request object.
	rateLimit.getRateLimit = (
		request: Express.Request,
	): RateLimit.RateLimitInfo | undefined =>
		isAugmentedRequest(request) ? request.rateLimit : undefined

	return rateLimit
}

export = RateLimit

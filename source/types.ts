// /source/types.ts
// All the types used by this package

import Express from 'express'

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
export type RateLimitRequestHandler = Express.RequestHandler & {
	/**
	 * Method to reset a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 */
	resetKey: (key: string) => void
}

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

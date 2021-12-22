// /source/types.ts
// All the types used by this package

import Express from 'express'

/**
 * Callback that fires when a client's hit counter is incremented.
 *
 * @param error {Error | undefined} - The error that occurred, if any
 * @param totalHits {number} - The number of hits for that client so far
 * @param resetTime {Date | undefined} - The time when the counter resets
 */
export type IncrementCallback = (
	error: Error | undefined,
	totalHits: number,
	resetTime: Date | undefined,
) => void

/**
 * Method (in the form of middleware) to generate/retrieve a value based on the
 * incoming request
 *
 * @param request {Express.Request} - The Express request object
 * @param response {Express.Response} - The Express response object
 *
 * @returns {T} - The value needed
 */
export type ValueDeterminingMiddleware<T> = (
	request: Express.Request,
	response: Express.Response,
) => T | Promise<T>

/**
 * Express request handler that sends back a response when a client is
 * rate-limited.
 *
 * @param request {Express.Request} - The Express request object
 * @param response {Express.Response} - The Express response object
 * @param next {Express.NextFunction} - The Express `next` function, can be called to skip responding
 * @param optionsUsed {Options} - The options used to set up the middleware
 */
export type RateLimitExceededEventHandler = (
	request: Express.Request,
	response: Express.Response,
	next: Express.NextFunction,
	optionsUsed: Options,
) => void

/**
 * Express request handler that sends back a response when a client has reached
 * their rate limit, and will be rate limited on their next request.
 *
 * @param request {Express.Request} - The Express request object
 * @param response {Express.Response} - The Express response object
 * @param optionsUsed {Options} - The options used to set up the middleware
 */
export type RateLimitReachedEventHandler = (
	request: Express.Request,
	response: Express.Response,
	optionsUsed: Options,
) => void

/**
 * Data returned from the `Store` when a client's hit counter is incremented.
 *
 * @property totalHits {number} - The number of hits for that client so far
 * @property resetTime {Date | undefined} - The time when the counter resets
 */
export type IncrementResponse = {
	totalHits: number
	resetTime: Date | undefined
}

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
 *
 * @deprecated 6.x - Implement the `Store` interface instead.
 */
export interface LegacyStore {
	/**
	 * Method to increment a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 * @param callback {IncrementCallback} - The callback to call once the counter is incremented
	 */
	incr: (key: string, callback: IncrementCallback) => void

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
 * An interface that all hit counter stores must implement.
 */
export interface Store {
	/**
	 * Method that initializes the store, and has access to the options passed to
	 * the middleware too.
	 *
	 * @param options {Options} - The options used to setup the middleware
	 */
	init?: (options: Options) => void

	/**
	 * Method to increment a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 *
	 * @returns {IncrementResponse} - The number of hits and reset time for that client
	 */
	increment: (key: string) => Promise<IncrementResponse> | IncrementResponse

	/**
	 * Method to decrement a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 */
	decrement: (key: string) => Promise<void> | void

	/**
	 * Method to reset a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 */
	resetKey: (key: string) => Promise<void> | void

	/**
	 * Method to reset everyone's hit counter.
	 */
	resetAll?: () => Promise<void> | void
}

/**
 * The configuration options for the rate limiter.
 */
export interface Options {
	/**
	 * How long we should remember the requests.
	 */
	readonly windowMs: number

	/**
	 * The maximum number of connection to allow during the `window` before
	 * rate limiting the client.
	 *
	 * Can be the limit itself as a number or express middleware that parses
	 * the request and then figures out the limit.
	 */
	readonly max: number | ValueDeterminingMiddleware<number>

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
	 * Whether to send `X-RateLimit-*` headers with the rate limit and the number
	 * of requests.
	 */
	readonly legacyHeaders: boolean

	/**
	 * Whether to enable support for the rate limit standardization headers (`RateLimit-*`).
	 */
	readonly standardHeaders: boolean

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
	readonly requestWasSuccessful: ValueDeterminingMiddleware<boolean>

	/**
	 * Method to generate custom identifiers for clients.
	 *
	 * By default, the client's IP address is used.
	 */
	readonly keyGenerator: ValueDeterminingMiddleware<string>

	/**
	 * Method (in the form of middleware) to determine whether or not this request
	 * counts towards a client's quota.
	 */
	readonly skip: ValueDeterminingMiddleware<boolean>

	/**
	 * Express request handler that sends back a response when a client is
	 * rate-limited.
	 */
	readonly handler: RateLimitExceededEventHandler

	/**
	 * Express request handler that sends back a response when a client has
	 * reached their rate limit, and will be rate limited on their next request.
	 */
	readonly onLimitReached: RateLimitReachedEventHandler

	/**
	 * The {@link Store} to use to store the hit count for each client.
	 */
	store: Store

	/**
	 * Whether to send `X-RateLimit-*` headers with the rate limit and the number
	 * of requests.
	 *
	 * @deprecated 6.x - This option was renamed to `legacyHeaders`.
	 */
	headers?: boolean

	/**
	 * Whether to send `RateLimit-*` headers with the rate limit and the number
	 * of requests.
	 *
	 * @deprecated 6.x - This option was renamed to `standardHeaders`.
	 */
	draft_polli_ratelimit_headers?: boolean
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

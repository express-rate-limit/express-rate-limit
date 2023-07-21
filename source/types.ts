// /source/types.ts
// All the types used by this package

import type { Request, Response, NextFunction, RequestHandler } from 'express'

/**
 * Callback that fires when a client's hit counter is incremented.
 *
 * @param error {Error | undefined} - The error that occurred, if any.
 * @param totalHits {number} - The number of hits for that client so far.
 * @param resetTime {Date | undefined} - The time when the counter resets.
 */
export type IncrementCallback = (
	error: Error | undefined,
	totalHits: number,
	resetTime: Date | undefined,
) => void

/**
 * Method (in the form of middleware) to generate/retrieve a value based on the
 * incoming request.
 *
 * @param request {Request} - The Express request object.
 * @param response {Response} - The Express response object.
 *
 * @returns {T} - The value needed.
 */
export type ValueDeterminingMiddleware<T> = (
	request: Request,
	response: Response,
) => T | Promise<T>

/**
 * Express request handler that sends back a response when a client is
 * rate-limited.
 *
 * @param request {Request} - The Express request object.
 * @param response {Response} - The Express response object.
 * @param next {NextFunction} - The Express `next` function, can be called to skip responding.
 * @param optionsUsed {Options} - The options used to set up the middleware.
 */
export type RateLimitExceededEventHandler = (
	request: Request,
	response: Response,
	next: NextFunction,
	optionsUsed: Options,
) => void

/**
 * Event callback that is triggered on a client's first request that exceeds the limit
 * but not for subsequent requests. May be used for logging, etc. Should *not*
 * send a response.
 *
 * @param request {Request} - The Express request object.
 * @param response {Response} - The Express response object.
 * @param optionsUsed {Options} - The options used to set up the middleware.
 */
export type RateLimitReachedEventHandler = (
	request: Request,
	response: Response,
	optionsUsed: Options,
) => void

/**
 * Data returned from the `Store` when a client's hit counter is incremented.
 *
 * @property totalHits {number} - The number of hits for that client so far.
 * @property resetTime {Date | undefined} - The time when the counter resets.
 */
export type IncrementResponse = {
	totalHits: number
	resetTime: Date | undefined
}

/**
 * A modified Express request handler with the rate limit functions.
 */
export type RateLimitRequestHandler = RequestHandler & {
	/**
	 * Method to reset a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client.
	 */
	resetKey: (key: string) => void
}

/**
 * An interface that all hit counter stores must implement.
 *
 * @deprecated 6.x - Implement the `Store` interface instead.
 */
export type LegacyStore = {
	/**
	 * Method to increment a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client.
	 * @param callback {IncrementCallback} - The callback to call once the counter is incremented.
	 */
	incr: (key: string, callback: IncrementCallback) => void

	/**
	 * Method to decrement a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client.
	 */
	decrement: (key: string) => void

	/**
	 * Method to reset a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client.
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
export type Store = {
	/**
	 * Method that initializes the store, and has access to the options passed to
	 * the middleware too.
	 *
	 * @param options {Options} - The options used to setup the middleware.
	 */
	init?: (options: Options) => void

	/**
	 * Method to increment a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client.
	 *
	 * @returns {IncrementResponse} - The number of hits and reset time for that client.
	 */
	increment: (key: string) => Promise<IncrementResponse> | IncrementResponse

	/**
	 * Method to decrement a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client.
	 */
	decrement: (key: string) => Promise<void> | void

	/**
	 * Method to reset a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client.
	 */
	resetKey: (key: string) => Promise<void> | void

	/**
	 * Method to reset everyone's hit counter.
	 */
	resetAll?: () => Promise<void> | void

	/**
	 * Method to shutdown the store, stop timers, and release all resources.
	 */
	shutdown?: () => Promise<void> | void
}

/**
 * The configuration options for the rate limiter.
 */
export type Options = {
	/**
	 * How long we should remember the requests.
	 *
	 * Defaults to `60000` ms (= 1 minute).
	 */
	windowMs: number

	/**
	 * The maximum number of connections to allow during the `window` before
	 * rate limiting the client.
	 *
	 * Can be the limit itself as a number or express middleware that parses
	 * the request and then figures out the limit.
	 *
	 * Defaults to `5`.
	 */
	max: number | ValueDeterminingMiddleware<number>

	/**
	 * The response body to send back when a client is rate limited.
	 *
	 * Defaults to `'Too many requests, please try again later.'`
	 */
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	message: any | ValueDeterminingMiddleware<any>

	/**
	 * The HTTP status code to send back when a client is rate limited.
	 *
	 * Defaults to `HTTP 429 Too Many Requests` (RFC 6585).
	 */
	statusCode: number

	/**
	 * Whether to send `X-RateLimit-*` headers with the rate limit and the number
	 * of requests.
	 *
	 * Defaults to `true` (for backward compatibility).
	 */
	legacyHeaders: boolean

	/**
	 * Whether to enable support for the standardized rate limit headers (`RateLimit-*`).
	 *
	 * Defaults to `false` (for backward compatibility, but its use is recommended).
	 */
	standardHeaders: boolean

	/**
	 * The name of the property on the request object to store the rate limit info.
	 *
	 * Defaults to `rateLimit`.
	 */
	requestPropertyName: string

	/**
	 * If `true`, the library will (by default) skip all requests that have a 4XX
	 * or 5XX status.
	 *
	 * Defaults to `false`.
	 */
	skipFailedRequests: boolean

	/**
	 * If `true`, the library will (by default) skip all requests that have a
	 * status code less than 400.
	 *
	 * Defaults to `false`.
	 */
	skipSuccessfulRequests: boolean

	/**
	 * Method to generate custom identifiers for clients.
	 *
	 * By default, the client's IP address is used.
	 */
	keyGenerator: ValueDeterminingMiddleware<string>

	/**
	 * Express request handler that sends back a response when a client is
	 * rate-limited.
	 *
	 * By default, sends back the `statusCode` and `message` set via the options.
	 */
	handler: RateLimitExceededEventHandler

	/**
	 * Express request handler that sends back a response when a client has
	 * reached their rate limit, and will be rate limited on their next request.
	 *
	 * @deprecated 6.x - Please use a custom `handler` that checks the number of
	 * hits instead.
	 */
	onLimitReached: RateLimitReachedEventHandler

	/**
	 * Method (in the form of middleware) to determine whether or not this request
	 * counts towards a client's quota.
	 *
	 * By default, skips no requests.
	 */
	skip: ValueDeterminingMiddleware<boolean>

	/**
	 * Method to determine whether or not the request counts as 'succesful'. Used
	 * when either `skipSuccessfulRequests` or `skipFailedRequests` is set to true.
	 *
	 * By default, requests with a response status code less than 400 are considered
	 * successful.
	 */
	requestWasSuccessful: ValueDeterminingMiddleware<boolean>

	/**
	 * The `Store` to use to store the hit count for each client.
	 *
	 * By default, the built-in `MemoryStore` will be used.
	 */
	store: Store | LegacyStore

	/**
	 * Whether or not the validation checks should run.
	 */
	validate: boolean

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
export type AugmentedRequest = Request & {
	[key: string]: RateLimitInfo
}

/**
 * The rate limit related information for each client included in the
 * Express request object.
 */
export type RateLimitInfo = {
	limit: number
	current: number
	remaining: number
	resetTime: Date | undefined
}

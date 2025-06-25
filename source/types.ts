// /source/types.ts
// All the types used by this package

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { Validations } from './validations.js'
import type { SUPPORTED_DRAFT_VERSIONS } from './headers.js'

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
export type ClientRateLimitInfo = {
	totalHits: number
	resetTime: Date | undefined
}

export type IncrementResponse = ClientRateLimitInfo

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

	/**
	 * Method to fetch a client's hit count and reset time.
	 *
	 * @param key {string} - The identifier for a client.
	 *
	 * @returns {ClientRateLimitInfo} - The number of hits and reset time for that client.
	 */
	getKey: (
		key: string,
	) =>
		| Promise<ClientRateLimitInfo | undefined>
		| ClientRateLimitInfo
		| undefined
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
	 * Method to fetch a client's hit count and reset time.
	 *
	 * @param key {string} - The identifier for a client.
	 *
	 * @returns {ClientRateLimitInfo} - The number of hits and reset time for that client.
	 */
	get?: (
		key: string,
	) =>
		| Promise<ClientRateLimitInfo | undefined>
		| ClientRateLimitInfo
		| undefined

	/**
	 * Method to increment a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client.
	 *
	 * @returns {IncrementResponse | undefined} - The number of hits and reset time for that client.
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

	/**
	 * Flag to indicate that keys incremented in one instance of this store can
	 * not affect other instances. Typically false if a database is used, true for
	 * MemoryStore.
	 *
	 * Used to help detect double-counting misconfigurations.
	 */
	localKeys?: boolean

	/**
	 * Optional value that the store prepends to keys
	 *
	 * Used by the double-count check to avoid false-positives when a key is counted twice, but with different prefixes
	 */
	prefix?: string
}

export type DraftHeadersVersion = (typeof SUPPORTED_DRAFT_VERSIONS)[number]

/**
 * Validate configuration object for enabling or disabling specific validations.
 *
 * The keys must also be keys in the validations object, except `enable`, `disable`,
 * and `default`.
 */
export type EnabledValidations = {
	[key in keyof Omit<Validations, 'enabled' | 'disable'> | 'default']?: boolean
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
	limit: number | ValueDeterminingMiddleware<number>

	/**
	 * The response body to send back when a client is rate limited.
	 *
	 * Defaults to `'Too many requests, please try again later.'`
	 */
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
	standardHeaders: boolean | DraftHeadersVersion

	/**
	 * The name used to identify the quota policy in the `RateLimit` headers as per
	 * the 8th draft of the IETF specification.
	 *
	 * Defaults to `{limit}-in-{window}`.
	 */
	identifier: string | ValueDeterminingMiddleware<string>

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
	 * IPv6 subnet mask applied to IPv6 addresses in the default keyGenerator.
	 *
	 * Generally, ISPs that support IPv6 give each of their customers a range of IPv6 addresses, whereas they usually provide only a single IPv4 address per customer.
	 * A malicious user could iterate through their range of IPv6 addresses and bypass simple IP-based rate limiting.
	 * This setting counteracts that by allowing the rate-limiter to block an entire range of IPv6 addresses at once.
	 *
	 * The default value is 56, corresponding to a /56 subnet.
	 *
	 * The valid range is 1-128, but typically ISPs assign subnets in the range of 32-64, with 64 being the most common. The validation check will warn for values outside the 32-64 range, (but can be disabled).
	 *
	 * In a 128 bit IPv6 address, the number of bits in this setting will be kept, and the rest will be ignored when determining the user's IP address.
	 * A smaller number means the ISP is reserving fewer bits for their control and allowing a larger portion of the address to be in the customer's control, thereby allowing the customer to have a greater number of unique IPs.
	 *
	 * 56 is a moderately aggressive default. It may be increased to if users are being incorrectly blocked (try 60 or 64), or decreased if you are seeing evidence of abuse.
	 * 64, 60 ([Comcast][1]), 56, and 48 are all common values used by various ISPs.
	 *
	 * The option may also be set to a function that returns the value if you want to apply different subnets to different different users.
	 *
	 * Set to false to disable and always use the IP without masking.
	 *
	 * [1]: https://news.ycombinator.com/item?id=44228908
	 */
	ipv6Subnet:
		| 64 // A few common values, followed by number as a catch-all
		| 60 // Apparently comcast allows customers to request up to a /60, which is effectively 16 /64s
		| 56
		| 52
		| 50
		| 48
		| 32
		| number // Todo: figure out how to do a "range type" to replace `number` with "1-128". (The validator limits to 32-64, but typescript should probably allow the whole range.)
		| ValueDeterminingMiddleware<number>
		| false

	/**
	 * Express request handler that sends back a response when a client is
	 * rate-limited.
	 *
	 * By default, sends back the `statusCode` and `message` set via the options.
	 */
	handler: RateLimitExceededEventHandler

	/**
	 * Method (in the form of middleware) to determine whether or not this request
	 * counts towards a client's quota.
	 *
	 * By default, skips no requests.
	 */
	skip: ValueDeterminingMiddleware<boolean>

	/**
	 * Method to determine whether or not the request counts as 'successful'. Used
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
	 * The list of validation checks that should run.
	 */
	validate: boolean | EnabledValidations

	/**
	 * Whether to send `X-RateLimit-*` headers with the rate limit and the number
	 * of requests.
	 *
	 * @deprecated 6.x - This option was renamed to `legacyHeaders`.
	 */
	headers?: boolean

	/**
	 * The maximum number of connections to allow during the `window` before
	 * rate limiting the client.
	 *
	 * Can be the limit itself as a number or express middleware that parses
	 * the request and then figures out the limit.
	 *
	 * @deprecated 7.x - This option was renamed to `limit`. However, it will not
	 * be removed from the library in the foreseeable future.
	 */
	max?: number | ValueDeterminingMiddleware<number>

	/**
	 * If the Store generates an error, allow the request to pass.
	 */
	passOnStoreError: boolean
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
	used: number
	remaining: number
	resetTime: Date | undefined
	key: string // IP address, etc.

	/**
	 * NOTE: The `current` field is deprecated and renamed to `used`. The library
	 * will still set the `current` property, and you can still access it, but it
	 * will be hidden from iteration and JSON.stringify calls. See:
	 * https://github.com/express-rate-limit/express-rate-limit/discussions/372#discussioncomment-6915685
	 */
	// current: number
}

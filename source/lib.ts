// /source/lib.ts
// The option parser and rate limiting middleware

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type {
	Options,
	AugmentedRequest,
	RateLimitRequestHandler,
	LegacyStore,
	Store,
	IncrementResponse,
	ValueDeterminingMiddleware,
	RateLimitExceededEventHandler,
	RateLimitReachedEventHandler,
} from './types.js'
import { Validations } from './validations.js'
import MemoryStore from './memory-store.js'

/**
 * Type guard to check if a store is legacy store.
 *
 * @param store {LegacyStore | Store} - The store to check.
 *
 * @return {boolean} - Whether the store is a legacy store.
 */
const isLegacyStore = (store: LegacyStore | Store): store is LegacyStore =>
	// Check that `incr` exists but `increment` does not - store authors might want
	// to keep both around for backwards compatibility.
	typeof (store as any).incr === 'function' &&
	typeof (store as any).increment !== 'function'

/**
 * Converts a legacy store to the promisified version.
 *
 * @param store {LegacyStore | Store} - The store passed to the middleware.
 *
 * @returns {Store} - The promisified version of the store.
 */
const promisifyStore = (passedStore: LegacyStore | Store): Store => {
	if (!isLegacyStore(passedStore)) {
		// It's not an old store, return as is
		return passedStore
	}

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
			return legacyStore.decrement(key)
		}

		async resetKey(key: string): Promise<void> {
			return legacyStore.resetKey(key)
		}

		async resetAll(): Promise<void> {
			if (typeof legacyStore.resetAll === 'function')
				return legacyStore.resetAll()
		}
	}

	return new PromisifiedStore()
}

/**
 * The internal configuration interface.
 *
 * This is copied from Options, with fields made non-readonly and deprecated
 * fields removed.
 *
 * For documentation on what each field does, {@see Options}.
 *
 * This is not stored in types because it's internal to the API, and should not
 * be interacted with by the user.
 */
type Configuration = {
	windowMs: number
	max: number | ValueDeterminingMiddleware<number>
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	message: any | ValueDeterminingMiddleware<any>
	statusCode: number
	legacyHeaders: boolean
	standardHeaders: boolean
	requestPropertyName: string
	skipFailedRequests: boolean
	skipSuccessfulRequests: boolean
	keyGenerator: ValueDeterminingMiddleware<string>
	handler: RateLimitExceededEventHandler
	onLimitReached: RateLimitReachedEventHandler
	skip: ValueDeterminingMiddleware<boolean>
	requestWasSuccessful: ValueDeterminingMiddleware<boolean>
	store: Store
	validate: boolean
}

/**
 *
 * Remove any options where their value is set to undefined. This avoids overwriting defaults
 * in the case a user passes undefined instead of simply omitting the key.
 *
 * @param passedOptions {Options} - The options to omit.
 *
 * @returns {Options} - The same options, but with all undefined fields omitted.
 *
 * @private
 */
const omitUndefinedOptions = (
	passedOptions: Partial<Options>,
): Partial<Configuration> => {
	const omittedOptions: Partial<Configuration> = {}

	for (const k of Object.keys(passedOptions)) {
		const key = k as keyof Configuration

		if (passedOptions[key] !== undefined) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			omittedOptions[key] = passedOptions[key]
		}
	}

	return omittedOptions
}

/**
 * Type-checks and adds the defaults for options the user has not specified.
 *
 * @param options {Options} - The options the user specifies.
 *
 * @returns {Configuration} - A complete configuration object.
 */
const parseOptions = (
	passedOptions: Partial<Options>,
	validations: Validations,
): Configuration => {
	// Passing undefined should be equivalent to not passing an option at all, so we'll
	// omit all fields where their value is undefined.
	const notUndefinedOptions: Partial<Options> =
		omitUndefinedOptions(passedOptions)

	// See ./types.ts#Options for a detailed description of the options and their
	// defaults.
	const config: Configuration = {
		windowMs: 60 * 1000,
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
		keyGenerator(request: Request, _response: Response): string {
			// Run the validation checks on the IP and headers to make sure everything
			// is working as intended.
			validations.ip(request.ip)
			validations.trustProxy(request)
			validations.xForwardedForHeader(request)

			// By default, use the IP address to rate limit users.
			return request.ip
		},
		async handler(
			request: Request,
			response: Response,
			_next: NextFunction,
			_optionsUsed: Options,
		): Promise<void> {
			// Set the response status code.
			response.status(config.statusCode)
			// Call the `message` if it is a function.
			const message: unknown =
				typeof config.message === 'function'
					? await (config.message as ValueDeterminingMiddleware<any>)(
							request,
							response,
					  )
					: config.message

			// Send the response if writable.
			if (!response.writableEnded) {
				response.send(message ?? 'Too many requests, please try again later.')
			}
		},
		onLimitReached(
			_request: Request,
			_response: Response,
			_optionsUsed: Options,
		): void {},
		// Print an error to the console if a few known misconfigurations are detected.
		validate: true,
		// Allow the options object to be overriden by the options passed to the middleware.
		...notUndefinedOptions,
		// Note that this field is declared after the user's options are spread in,
		// so that this field doesn't get overriden with an un-promisified store!
		store: promisifyStore(notUndefinedOptions.store ?? new MemoryStore()),
	}

	// Ensure that the store passed implements the `Store` interface
	if (
		typeof config.store.increment !== 'function' ||
		typeof config.store.decrement !== 'function' ||
		typeof config.store.resetKey !== 'function' ||
		(config.store.resetAll !== undefined &&
			typeof config.store.resetAll !== 'function') ||
		(config.store.init !== undefined && typeof config.store.init !== 'function')
	) {
		throw new TypeError(
			'An invalid store was passed. Please ensure that the store is a class that implements the `Store` interface.',
		)
	}

	return config
}

/**
 * Just pass on any errors for the developer to handle, usually as a HTTP 500
 * Internal Server Error.
 *
 * @param fn {RequestHandler} - The request handler for which to handle errors.
 *
 * @returns {RequestHandler} - The request handler wrapped with a `.catch` clause.
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
 * @param passedOptions {Options} - Options to configure the rate limiter.
 *
 * @returns {RateLimitRequestHandler} - The middleware that rate-limits clients based on your configuration.
 *
 * @public
 */
const rateLimit = (
	passedOptions?: Partial<Options>,
): RateLimitRequestHandler => {
	// Create the validator before even parsing the rest of the options
	const validations = new Validations(passedOptions?.validate ?? true)
	// Parse the options and add the default values for unspecified options
	const options = parseOptions(passedOptions ?? {}, validations)

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

				// If we have a resetTime, also provide the current date to help avoid
				// issues with incorrect clocks.
				if (resetTime instanceof Date) {
					response.setHeader('Date', new Date().toUTCString())
					response.setHeader(
						'X-RateLimit-Reset',
						Math.ceil(resetTime.getTime() / 1000),
					)
				}
			}

			// Set the standardized RateLimit headers on the response object
			// if enabled.
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

			// Call the `onLimitReached` callback on the first request where client
			// exceeds their rate limit
			// NOTE: `onLimitReached` is deprecated, this should be removed in v7.x
			if (maxHits && totalHits === maxHits + 1) {
				options.onLimitReached(request, response, options)
			}

			// Disable the validations, since they should have run at least once by now.
			validations.disable()

			// If the client has exceeded their rate limit, set the Retry-After header
			// and call the `handler` function
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

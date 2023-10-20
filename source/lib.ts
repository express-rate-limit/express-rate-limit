// /source/lib.ts
// The option parser and rate limiting middleware

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type {
	Options,
	AugmentedRequest,
	RateLimitRequestHandler,
	LegacyStore,
	Store,
	ClientRateLimitInfo,
	ValueDeterminingMiddleware,
	RateLimitExceededEventHandler,
	DraftHeadersVersion,
	RateLimitInfo,
	EnabledValidations,
} from './types.js'
import {
	setLegacyHeaders,
	setDraft6Headers,
	setDraft7Headers,
	setRetryAfterHeader,
} from './headers.js'
import { getValidations, type Validations } from './validations.js'
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
		async increment(key: string): Promise<ClientRateLimitInfo> {
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

		/* istanbul ignore next */
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
	limit: number | ValueDeterminingMiddleware<number>
	message: any | ValueDeterminingMiddleware<any>
	statusCode: number
	legacyHeaders: boolean
	standardHeaders: false | DraftHeadersVersion
	requestPropertyName: string
	skipFailedRequests: boolean
	skipSuccessfulRequests: boolean
	keyGenerator: ValueDeterminingMiddleware<string>
	handler: RateLimitExceededEventHandler
	skip: ValueDeterminingMiddleware<boolean>
	requestWasSuccessful: ValueDeterminingMiddleware<boolean>
	store: Store
	validations: Validations
}

/**
 * Converts a `Configuration` object to a valid `Options` object, in case the
 * configuration needs to be passed back to the user.
 *
 * @param config {Configuration} - The configuration object to convert.
 *
 * @returns {Partial<Options>} - The options derived from the configuration.
 */
const getOptionsFromConfig = (config: Configuration): Options => {
	const { validations, ...directlyPassableEntries } = config

	return {
		...directlyPassableEntries,
		validate: validations.enabled as EnabledValidations,
	}
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
): Partial<Options> => {
	const omittedOptions: Partial<Options> = {}

	for (const k of Object.keys(passedOptions)) {
		const key = k as keyof Options

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
const parseOptions = (passedOptions: Partial<Options>): Configuration => {
	// Passing undefined should be equivalent to not passing an option at all, so we'll
	// omit all fields where their value is undefined.
	const notUndefinedOptions: Partial<Options> =
		omitUndefinedOptions(passedOptions)

	// Create the validator before even parsing the rest of the options.
	const validations = getValidations(notUndefinedOptions?.validate ?? true)
	validations.validationsConfig()

	// Warn for the deprecated options. Note that these options have been removed
	// from the type definitions in v7.
	validations.draftPolliHeaders(
		// @ts-expect-error see the note above.
		notUndefinedOptions.draft_polli_ratelimit_headers,
	)
	// @ts-expect-error see the note above.
	validations.onLimitReached(notUndefinedOptions.onLimitReached)

	// The default value for the `standardHeaders` option is `false`. If set to
	// `true`, it resolve to `draft-6`. `draft-7` (recommended) is used only if
	// explicitly set.
	let standardHeaders = notUndefinedOptions.standardHeaders ?? false
	if (standardHeaders === true) standardHeaders = 'draft-6'

	// See ./types.ts#Options for a detailed description of the options and their
	// defaults.
	const config: Configuration = {
		windowMs: 60 * 1000,
		limit: passedOptions.max ?? 5, // `max` is deprecated, but support it anyways.
		message: 'Too many requests, please try again later.',
		statusCode: 429,
		legacyHeaders: passedOptions.headers ?? true,
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
			return request.ip!
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
				response.send(message)
			}
		},
		// Allow the default options to be overriden by the options passed to the middleware.
		...notUndefinedOptions,
		// `standardHeaders` is resolved into a draft version above, use that.
		standardHeaders,
		// Note that this field is declared after the user's options are spread in,
		// so that this field doesn't get overriden with an un-promisified store!
		store: promisifyStore(notUndefinedOptions.store ?? new MemoryStore()),
		// Print an error to the console if a few known misconfigurations are detected.
		validations,
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
			/* istanbul ignore next */
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
	// Parse the options and add the default values for unspecified options
	const config = parseOptions(passedOptions ?? {})
	const options = getOptionsFromConfig(config)

	// Call the `init` method on the store, if it exists
	if (typeof config.store.init === 'function') config.store.init(options)

	// Then return the actual middleware
	const middleware = handleAsyncErrors(
		async (request: Request, response: Response, next: NextFunction) => {
			// First check if we should skip the request
			const skip = await config.skip(request, response)
			if (skip) {
				next()
				return
			}

			// Create an augmented request
			const augmentedRequest = request as AugmentedRequest

			// Get a unique key for the client
			const key = await config.keyGenerator(request, response)
			// Increment the client's hit counter by one.
			const { totalHits, resetTime } = await config.store.increment(key)
			// Make sure that -
			// - the hit count is incremented only by one.
			// - the returned hit count is a positive integer.
			config.validations.positiveHits(totalHits)
			config.validations.singleCount(request, config.store, key)

			// Get the limit (max number of hits) for each client.
			const retrieveLimit =
				typeof config.limit === 'function'
					? config.limit(request, response)
					: config.limit
			const limit = await retrieveLimit
			config.validations.limit(limit)

			// Define the rate limit info for the client.
			const info: RateLimitInfo = {
				limit,
				used: totalHits,
				remaining: Math.max(limit - totalHits, 0),
				resetTime,
			}

			// Set the `current` property on the object, but hide it from iteration
			// and `JSON.stringify`. See the `./types#RateLimitInfo` for details.
			Object.defineProperty(info, 'current', {
				configurable: false,
				enumerable: false,
				value: totalHits,
			})

			// Set the rate limit information on the augmented request object
			augmentedRequest[config.requestPropertyName] = info

			// Set the `X-RateLimit` headers on the response object if enabled.
			if (config.legacyHeaders && !response.headersSent) {
				setLegacyHeaders(response, info)
			}

			// Set the standardized `RateLimit-*` headers on the response object if
			// enabled.
			if (config.standardHeaders && !response.headersSent) {
				if (config.standardHeaders === 'draft-6') {
					setDraft6Headers(response, info, config.windowMs)
				} else if (config.standardHeaders === 'draft-7') {
					config.validations.headersResetTime(info.resetTime)
					setDraft7Headers(response, info, config.windowMs)
				}
			}

			// If we are to skip failed/successfull requests, decrement the
			// counter accordingly once we know the status code of the request
			if (config.skipFailedRequests || config.skipSuccessfulRequests) {
				let decremented = false
				const decrementKey = async () => {
					if (!decremented) {
						await config.store.decrement(key)
						decremented = true
					}
				}

				if (config.skipFailedRequests) {
					response.on('finish', async () => {
						if (!config.requestWasSuccessful(request, response))
							await decrementKey()
					})
					response.on('close', async () => {
						if (!response.writableEnded) await decrementKey()
					})
					response.on('error', async () => {
						await decrementKey()
					})
				}

				if (config.skipSuccessfulRequests) {
					response.on('finish', async () => {
						if (config.requestWasSuccessful(request, response))
							await decrementKey()
					})
				}
			}

			// Disable the validations, since they should have run at least once by now.
			config.validations.disable()

			// If the client has exceeded their rate limit, set the Retry-After header
			// and call the `handler` function.
			if (totalHits > limit) {
				if (config.legacyHeaders || config.standardHeaders) {
					setRetryAfterHeader(response, info, config.windowMs)
				}

				config.handler(request, response, next, options)
				return
			}

			next()
		},
	)

	const getThrowFn = () => {
		throw new Error('The current store does not support the get/getKey method')
	}

	// Export the store's function to reset and fetch the rate limit info for a
	// client based on their identifier.
	;(middleware as RateLimitRequestHandler).resetKey =
		config.store.resetKey.bind(config.store)
	;(middleware as RateLimitRequestHandler).getKey =
		typeof config.store.get === 'function'
			? config.store.get.bind(config.store)
			: getThrowFn

	return middleware as RateLimitRequestHandler
}

// Export it to the world!
export default rateLimit

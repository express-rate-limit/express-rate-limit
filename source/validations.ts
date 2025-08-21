// /source/validations.ts
// The validation functions

import { isIP } from 'node:net'
import type { Request } from 'express'
import { SUPPORTED_DRAFT_VERSIONS } from './headers.js'
import type {
	EnabledValidations,
	Options,
	Store,
	ValueDeterminingMiddleware,
} from './types.js'

/**
 * An error thrown/returned when a validation error occurs.
 */
class ValidationError extends Error {
	name: string
	code: string
	help: string

	/**
	 * The code must be a string, in snake case and all capital, that starts with
	 * the substring `ERR_ERL_`.
	 *
	 * The message must be a string, starting with an uppercase character,
	 * describing the issue in detail.
	 */
	constructor(code: string, message: string) {
		const url = `https://express-rate-limit.github.io/${code}/`
		super(`${message} See ${url} for more information.`)

		// `this.constructor.name` is the class name
		this.name = this.constructor.name
		this.code = code
		this.help = url
	}
}

/**
 * A warning logged when the configuration used will/has been changed by a
 * newly released version of the library.
 */
class ChangeWarning extends ValidationError {}

/**
 * List of store instances that have been used with any express-rate-limit instance
 */
const usedStores = new Set<Store>()

/**
 * Maps the key used in a store for a certain request, and ensures that the
 * same key isn't used more than once per request.
 *
 * The store can be any one of the following:
 *  - An instance, for stores like the MemoryStore where two instances do not
 *    share state.
 *  - A string (class name), for stores where multiple instances
 *    typically share state, such as the Redis store.
 */
const singleCountKeys = new WeakMap<Request, Map<Store | string, string[]>>()

/**
 * The validations that can be run, as well as the methods to run them.
 */
const validations = {
	enabled: {
		default: true,
	} as { [key: string]: boolean }, // Should be EnabledValidations type, but that's a circular reference

	disable() {
		for (const k of Object.keys(this.enabled)) this.enabled[k] = false
	},

	/**
	 * Checks whether the IP address is valid, and that it does not have a port
	 * number in it.
	 *
	 * See https://github.com/express-rate-limit/express-rate-limit/wiki/Error-Codes#err_erl_invalid_ip_address.
	 *
	 * @param ip {string | undefined} - The IP address provided by Express as request.ip.
	 *
	 * @returns {void}
	 */
	ip(ip: string | undefined) {
		if (ip === undefined) {
			throw new ValidationError(
				'ERR_ERL_UNDEFINED_IP_ADDRESS',
				`An undefined 'request.ip' was detected. This might indicate a misconfiguration or the connection being destroyed prematurely.`,
			)
		}

		if (!isIP(ip)) {
			throw new ValidationError(
				'ERR_ERL_INVALID_IP_ADDRESS',
				`An invalid 'request.ip' (${ip}) was detected. Consider passing a custom 'keyGenerator' function to the rate limiter.`,
			)
		}
	},

	/**
	 * Makes sure the trust proxy setting is not set to `true`.
	 *
	 * See https://github.com/express-rate-limit/express-rate-limit/wiki/Error-Codes#err_erl_permissive_trust_proxy.
	 *
	 * @param request {Request} - The Express request object.
	 *
	 * @returns {void}
	 */
	trustProxy(request: Request) {
		if (request.app.get('trust proxy') === true) {
			throw new ValidationError(
				'ERR_ERL_PERMISSIVE_TRUST_PROXY',
				`The Express 'trust proxy' setting is true, which allows anyone to trivially bypass IP-based rate limiting.`,
			)
		}
	},

	/**
	 * Makes sure the trust proxy setting is set in case the `X-Forwarded-For`
	 * header is present.
	 *
	 * See https://github.com/express-rate-limit/express-rate-limit/wiki/Error-Codes#err_erl_unset_trust_proxy.
	 *
	 * @param request {Request} - The Express request object.
	 *
	 * @returns {void}
	 */
	xForwardedForHeader(request: Request) {
		if (
			request.headers['x-forwarded-for'] &&
			request.app.get('trust proxy') === false
		) {
			throw new ValidationError(
				'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR',
				`The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false (default). This could indicate a misconfiguration which would prevent express-rate-limit from accurately identifying users.`,
			)
		}
	},

	/**
	 * Ensures totalHits value from store is a positive integer.
	 *
	 * @param hits {any} - The `totalHits` returned by the store.
	 */
	positiveHits(hits: any) {
		if (typeof hits !== 'number' || hits < 1 || hits !== Math.round(hits)) {
			throw new ValidationError(
				'ERR_ERL_INVALID_HITS',
				`The totalHits value returned from the store must be a positive integer, got ${hits}`,
			)
		}
	},

	/**
	 * Ensures a single store instance is not used with multiple express-rate-limit instances
	 */
	unsharedStore(store: Store) {
		if (usedStores.has(store)) {
			const maybeUniquePrefix = store?.localKeys
				? ''
				: ' (with a unique prefix)'
			throw new ValidationError(
				'ERR_ERL_STORE_REUSE',
				`A Store instance must not be shared across multiple rate limiters. Create a new instance of ${store.constructor.name}${maybeUniquePrefix} for each limiter instead.`,
			)
		}

		usedStores.add(store)
	},

	/**
	 * Ensures a given key is incremented only once per request.
	 *
	 * @param request {Request} - The Express request object.
	 * @param store {Store} - The store class.
	 * @param key {string} - The key used to store the client's hit count.
	 *
	 * @returns {void}
	 */
	singleCount(request: Request, store: Store, key: string) {
		let storeKeys = singleCountKeys.get(request)
		if (!storeKeys) {
			storeKeys = new Map()
			singleCountKeys.set(request, storeKeys)
		}

		const storeKey = store.localKeys ? store : store.constructor.name
		let keys = storeKeys.get(storeKey)
		if (!keys) {
			keys = []
			storeKeys.set(storeKey, keys)
		}

		const prefixedKey = `${store.prefix ?? ''}${key}`

		if (keys.includes(prefixedKey)) {
			throw new ValidationError(
				'ERR_ERL_DOUBLE_COUNT',
				`The hit count for ${key} was incremented more than once for a single request.`,
			)
		}

		keys.push(prefixedKey)
	},

	/**
	 * Warns the user that the behaviour for `max: 0` / `limit: 0` is
	 * changing in the next major release.
	 *
	 * @param limit {number} - The maximum number of hits per client.
	 *
	 * @returns {void}
	 */
	limit(limit: number) {
		if (limit === 0) {
			throw new ChangeWarning(
				'WRN_ERL_MAX_ZERO',
				'Setting limit or max to 0 disables rate limiting in express-rate-limit v6 and older, but will cause all requests to be blocked in v7',
			)
		}
	},

	/**
	 * Warns the user that the `draft_polli_ratelimit_headers` option is deprecated
	 * and will be removed in the next major release.
	 *
	 * @param draft_polli_ratelimit_headers {any | undefined} - The now-deprecated setting that was used to enable standard headers.
	 *
	 * @returns {void}
	 */
	draftPolliHeaders(draft_polli_ratelimit_headers?: any) {
		if (draft_polli_ratelimit_headers) {
			throw new ChangeWarning(
				'WRN_ERL_DEPRECATED_DRAFT_POLLI_HEADERS',
				`The draft_polli_ratelimit_headers configuration option is deprecated and has been removed in express-rate-limit v7, please set standardHeaders: 'draft-6' instead.`,
			)
		}
	},

	/**
	 * Warns the user that the `onLimitReached` option is deprecated and
	 * will be removed in the next major release.
	 *
	 * @param onLimitReached {any | undefined} - The maximum number of hits per client.
	 *
	 * @returns {void}
	 */
	onLimitReached(onLimitReached?: any) {
		if (onLimitReached) {
			throw new ChangeWarning(
				'WRN_ERL_DEPRECATED_ON_LIMIT_REACHED',
				'The onLimitReached configuration option is deprecated and has been removed in express-rate-limit v7.',
			)
		}
	},

	/**
	 * Warns the user when an invalid/unsupported version of the draft spec is passed.
	 *
	 * @param version {any | undefined} - The version passed by the user.
	 *
	 * @returns {void}
	 */
	headersDraftVersion(version?: any) {
		if (
			typeof version !== 'string' ||
			// @ts-expect-error This is fine. If version is not in the array, it will just return false.
			!SUPPORTED_DRAFT_VERSIONS.includes(version)
		) {
			const versionString = SUPPORTED_DRAFT_VERSIONS.join(', ')
			throw new ValidationError(
				'ERR_ERL_HEADERS_UNSUPPORTED_DRAFT_VERSION',
				`standardHeaders: only the following versions of the IETF draft specification are supported: ${versionString}.`,
			)
		}
	},

	/**
	 * Warns the user when the selected headers option requires a reset time but
	 * the store does not provide one.
	 *
	 * @param resetTime {Date | undefined} - The timestamp when the client's hit count will be reset.
	 *
	 * @returns {void}
	 */
	headersResetTime(resetTime?: Date) {
		if (!resetTime) {
			throw new ValidationError(
				'ERR_ERL_HEADERS_NO_RESET',
				`standardHeaders:  'draft-7' requires a 'resetTime', but the store did not provide one. The 'windowMs' value will be used instead, which may cause clients to wait longer than necessary.`,
			)
		}
	},

	/**
	 * Checks the options.validate setting to ensure that only recognized
	 * validations are enabled or disabled.
	 *
	 * If any unrecognized values are found, an error is logged that
	 * includes the list of supported vaidations.
	 */
	validationsConfig() {
		const supportedValidations = Object.keys(this).filter(
			(k) => !['enabled', 'disable'].includes(k),
		)
		supportedValidations.push('default')
		for (const key of Object.keys(this.enabled)) {
			if (!supportedValidations.includes(key)) {
				throw new ValidationError(
					'ERR_ERL_UNKNOWN_VALIDATION',
					`options.validate.${key} is not recognized. Supported validate options are: ${supportedValidations.join(
						', ',
					)}.`,
				)
			}
		}
	},

	/**
	 * Checks to see if the instance was created inside of a request handler,
	 * which would prevent it from working correctly, with the default memory
	 * store (or any other store with localKeys.)
	 */
	creationStack(store: Store) {
		const { stack } = new Error(
			'express-rate-limit validation check (set options.validate.creationStack=false to disable)',
		)

		if (
			stack?.includes('Layer.handle [as handle_request]') || // express v4
			stack?.includes('Layer.handleRequest') // express v5
		) {
			if (!store.localKeys) {
				// This means the user is using an external store, which may be safe.
				// Print out an error anyways, to alert them of the possibility that
				// the rate limiter may not work as intended.

				// See the discussion here: https://github.com/express-rate-limit/express-rate-limit/pull/461#discussion_r1626940562.
				throw new ValidationError(
					'ERR_ERL_CREATED_IN_REQUEST_HANDLER',
					'express-rate-limit instance should *usually* be created at app initialization, not when responding to a request.',
				)
			}

			// Otherwise, make sure they know not to do this.
			throw new ValidationError(
				'ERR_ERL_CREATED_IN_REQUEST_HANDLER',
				'express-rate-limit instance should be created at app initialization, not when responding to a request.',
			)
		}
	},

	ipv6Subnet(ipv6Subnet?: any) {
		if (ipv6Subnet === false) {
			return // Explicitly disabled
		}

		if (!Number.isInteger(ipv6Subnet) || ipv6Subnet < 32 || ipv6Subnet > 64) {
			throw new ValidationError(
				'ERR_ERL_IPV6_SUBNET',
				`Unexpected ipv6Subnet value: ${ipv6Subnet}. Expected an integer between 32 and 64 (usually 48-64).`,
			)
		}
	},

	ipv6SubnetOrKeyGenerator(options: Partial<Options>) {
		// Note: false is a valid option for ipv6Subnet
		if (options.ipv6Subnet !== undefined && options.keyGenerator) {
			throw new ValidationError(
				'ERR_ERL_IPV6SUBNET_OR_KEYGENERATOR',
				`Incompatible options: the 'ipv6Subnet' option is ignored when a custom 'keyGenerator' function is also set.`,
			)
		}
	},

	keyGeneratorIpFallback(keyGenerator?: ValueDeterminingMiddleware<string>) {
		if (!keyGenerator) {
			return
		}

		const src = keyGenerator.toString()
		if (
			(src.includes('req.ip') || src.includes('request.ip')) &&
			!src.includes('ipKeyGenerator')
		) {
			throw new ValidationError(
				'ERR_ERL_KEY_GEN_IPV6',
				'Custom keyGenerator appears to use request IP without calling the ipKeyGenerator helper function for IPv6 addresses. This could allow IPv6 users to bypass limits.',
			)
		}
	},

	windowMs(windowMs: number) {
		const SET_TIMEOUT_MAX = 2 ** 31 - 1
		if (
			typeof windowMs !== 'number' ||
			Number.isNaN(windowMs) ||
			windowMs < 1 ||
			windowMs > SET_TIMEOUT_MAX
		) {
			throw new ValidationError(
				'ERR_ERL_WINDOW_MS',
				`Invalid windowMs value: ${windowMs}${typeof windowMs !== 'number' ? ` (${typeof windowMs})` : ''}, must be a number between 1 and ${SET_TIMEOUT_MAX} when using the default MemoryStore`,
			)
		}
	},
}

export type Validations = typeof validations

/**
 * Creates a copy of the validations object where each method is
 * wrapped to catch and log any thrown errors. Sets `enabled` to the
 * provided value, allowing different instances of express-rate-limit
 * to have different validations settings.
 *
 * @param enabled {boolean} - The list of enabled validations.
 *
 * @returns {Validations} - The validation functions.
 */
export const getValidations = (
	_enabled: boolean | EnabledValidations,
): Validations => {
	let enabled: { [key: string]: boolean }
	if (typeof _enabled === 'boolean') {
		enabled = {
			default: _enabled,
		}
	} else {
		enabled = {
			default: true,
			..._enabled,
		}
	}

	const wrappedValidations = { enabled } as Validations
	// Wrap all validations to handle disabling and thrown errors
	for (const [name, validation] of Object.entries(validations)) {
		if (typeof validation === 'function')
			(wrappedValidations as { [index: string]: any })[name] = (
				...args: any[]
			) => {
				if (!(enabled[name] ?? enabled.default)) {
					return
				}

				try {
					;(validation as (...args: any[]) => void).apply(
						wrappedValidations,
						args,
					)
				} catch (error: any) {
					if (error instanceof ChangeWarning) console.warn(error)
					else console.error(error)
				}
			}
	}

	return wrappedValidations
}

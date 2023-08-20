// /source/validations.ts
// The validation functions

import { isIP } from 'node:net'
import type { Request } from 'express'
import type { RateLimitReachedEventHandler, Store } from './types'

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
 * The validations that can be run, as well as the methods to run them.
 */
export class Validations {
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
	private static readonly singleCountKeys = new WeakMap<
		Request,
		Map<Store | string, string[]>
	>()

	// eslint-disable-next-line @typescript-eslint/parameter-properties
	enabled: boolean

	constructor(enabled: boolean) {
		this.enabled = enabled
	}

	enable() {
		this.enabled = true
	}

	disable() {
		this.enabled = false
	}

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
		this.wrap(() => {
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
		})
	}

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
		this.wrap(() => {
			if (request.app.get('trust proxy') === true) {
				throw new ValidationError(
					'ERR_ERL_PERMISSIVE_TRUST_PROXY',
					`The Express 'trust proxy' setting is true, which allows anyone to trivially bypass IP-based rate limiting.`,
				)
			}
		})
	}

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
		this.wrap(() => {
			if (
				request.headers['x-forwarded-for'] &&
				request.app.get('trust proxy') === false
			) {
				throw new ValidationError(
					'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR',
					`The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false (default). This could indicate a misconfiguration which would prevent express-rate-limit from accurately identifying users.`,
				)
			}
		})
	}

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
		this.wrap(() => {
			let storeKeys = Validations.singleCountKeys.get(request)
			if (!storeKeys) {
				storeKeys = new Map()
				Validations.singleCountKeys.set(request, storeKeys)
			}

			const storeKey = store.localKeys ? store : store.constructor.name
			let keys = storeKeys.get(storeKey)
			if (!keys) {
				keys = []
				storeKeys.set(storeKey, keys)
			}

			if (keys.includes(key)) {
				throw new ValidationError(
					'ERR_ERL_DOUBLE_COUNT',
					`The hit count for ${key} was incremented more than once for a single request.`,
				)
			}

			keys.push(key)
		})
	}

	/**
	 * Warns the user that the behaviour for `max: 0` is changing in the next
	 * major release.
	 *
	 * @param max {number} - The maximum number of hits per client.
	 *
	 * @returns {void}
	 */
	max(max: number) {
		this.wrap(() => {
			if (max === 0) {
				throw new ChangeWarning(
					'WRN_ERL_MAX_ZERO',
					`Setting max to 0 disables rate limiting in express-rate-limit v6 and older, but will cause all requests to be blocked in v7`,
				)
			}
		})
	}

	/**
	 * Warns the user that the `onLimitReached` option is deprecated and will be removed in the next
	 * major release.
	 *
	 * @param onLimitReached {function|undefined} - The maximum number of hits per client.
	 *
	 * @returns {void}
	 */
	onLimitReached(onLimitReached?: RateLimitReachedEventHandler) {
		this.wrap(() => {
			if (onLimitReached) {
				throw new ChangeWarning(
					'WRN_ERL_DEPRECATED_ON_LIMIT_REACHED',
					`The onLimitReached configuration option is deprecated and will be removed in express-rate-limit v7.`,
				)
			}
		})
	}

	/**
	 * Warns the user when the selected headers option requires a reset time but
	 * the store does not provide one.
	 *
	 * @param resetTime {Date | undefined} - The timestamp when the client's hit count will be reset.
	 *
	 * @returns {void}
	 */
	headersResetTime(resetTime?: Date) {
		this.wrap(() => {
			if (!resetTime) {
				throw new ValidationError(
					'ERR_ERL_HEADERS_NO_RESET',
					`standardHeaders:  'draft-7' requires a 'resetTime', but the store did not provide one. The 'windowMs' value will be used instead, which may cause clients to wait longer than necessary.`,
				)
			}
		})
	}

	private wrap(validation: () => void) {
		if (!this.enabled) {
			return
		}

		try {
			validation.call(this)
		} catch (error: any) {
			if (error instanceof ChangeWarning) console.warn(error)
			else console.error(error)
		}
	}
}

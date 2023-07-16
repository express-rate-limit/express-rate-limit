// /source/validations.ts
// The validation functions

import { isIP } from 'node:net'
import type { Request } from 'express'

/**
 * An error thrown/returned when a validation error occurs.
 */
class ValidationError extends Error {
	name: string
	code: string

	/**
	 * The code must be a string, in snake case and all capital, that starts with
	 * the substring `ERR_ERL_`.
	 *
	 * The message must be a string, starting with a lowercase character,
	 * describing the issue in detail.
	 */
	constructor(code: string, message: string) {
		super(
			`express-rate-limit: ${code} - ${message} See https://github.com/express-rate-limit/express-rate-limit/wiki/Error-Codes#${code.toLowerCase()} for more information on this error.`,
		)

		// `this.constructor.name` is the class name
		this.name = this.constructor.name
		this.code = code
		this.message = message
	}
}

export class Validations {
	constructor(private enabled: boolean) {}

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

	private wrap(validation: () => void) {
		if (!this.enabled) {
			return
		}

		try {
			validation.call(this)
		} catch (error: any) {
			console.error(error)
		}
	}
}

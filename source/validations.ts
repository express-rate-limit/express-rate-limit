// /source/validations.ts
// The validation functions

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
		super(`express-rate-limit: ${code} - ${message}`)

		// `this.constructor.name` is the class name
		this.name = this.constructor.name
		this.code = code
		this.message = message
	}
}

export class Validations {
	constructor(private enabled: boolean) {}

	// The following regex matches IPv4 and IPv6, but not if they include a port number at the end.
	// https://www.regextester.com/104038
	private static get ipAddressRegex() {
		return /((^\s*(((\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])\.){3}(\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5]))\s*$)|(^\s*((([\dA-Fa-f]{1,4}:){7}([\dA-Fa-f]{1,4}|:))|(([\dA-Fa-f]{1,4}:){6}(:[\dA-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([\dA-Fa-f]{1,4}:){5}(((:[\dA-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([\dA-Fa-f]{1,4}:){4}(((:[\dA-Fa-f]{1,4}){1,3})|((:[\dA-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([\dA-Fa-f]{1,4}:){3}(((:[\dA-Fa-f]{1,4}){1,4})|((:[\dA-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([\dA-Fa-f]{1,4}:){2}(((:[\dA-Fa-f]{1,4}){1,5})|((:[\dA-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([\dA-Fa-f]{1,4}:)(((:[\dA-Fa-f]{1,4}){1,6})|((:[\dA-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[\dA-Fa-f]{1,4}){1,7})|((:[\dA-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$))/
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
					`An undefined 'request.ip' was detected. This might indicate a misconfiguration or the connection being destroyed prematurely. See https://github.com/express-rate-limit/express-rate-limit/wiki/Error-Codes#err_erl_undefined_ip_address for more information on this error.`,
				)
			}

			if (!Validations.ipAddressRegex.test(ip)) {
				throw new ValidationError(
					'ERR_ERL_INVALID_IP_ADDRESS',
					`An invalid 'request.ip' (${ip}) was detected. Consider passing a custom 'keyGenerator' function to the rate limiter. See https://github.com/express-rate-limit/express-rate-limit/wiki/Error-Codes#err_erl_invalid_ip_address for more information on this error.`,
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
					`The Express 'trust proxy' setting is true, which allows anyone to trivially bypass IP-based rate limiting. See https://github.com/express-rate-limit/express-rate-limit/wiki/Error-Codes#err_erl_permissive_trust_proxy for more information on this error.`,
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
				request.app.get('trust proxy') === undefined
			) {
				throw new ValidationError(
					'ERR_ERL_UNSET_TRUST_PROXY',
					`The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is undefined. This could indicate misconfiguration or a malicious actor. See https://github.com/express-rate-limit/express-rate-limit/wiki/Error-Codes#err_erl_unset_trust_proxy for more information on this error.`,
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

// /source/validations.ts
// The validation functions

import type { Request } from 'express'
import { ValidationLevel } from './types.js'

/**
 * Runs the given validation check, and conveys the error message to the user
 * as per the given validation level.
 *
 * @param level {ValidationLevel} - The validation level set by the user.
 * @param check {Function} - The validation check to run.
 * @param error {string} - The error message to return in case the validation check fails.
 *
 * @returns {void}
 */
const runCheck = (
	level: ValidationLevel,
	check: () => boolean,
	error: string,
) => {
	// If the validation is turned off, don't even bother performing the check.
	if (level === ValidationLevel.Off) return

	// Run the check. If it fails, then return the error message to the user.
	if (!check()) {
		const message = `express-rate-limit: ${error}`
		if (level === ValidationLevel.Warn) {
			// If set to 'warn', console.warn the messsage.
			console.warn(message)
		} else if (level === ValidationLevel.Throw) {
			// If set to 'throw', throw the error.
			throw new Error(message)
		}
	}
}

// The following regex matches IPv4 and IPv6, but not if they include a port number at the end.
// https://www.regextester.com/104038
const ipAddressRegex =
	/^((\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])\.){3}(\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z\d-]*[a-zA-Z\d])\.)*([A-Za-z]|[A-Za-z][A-Za-z\d-]*[A-Za-z\d])$|^\s*((([\dA-Fa-f]{1,4}:){7}([\dA-Fa-f]{1,4}|:))|(([\dA-Fa-f]{1,4}:){6}(:[\dA-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([\dA-Fa-f]{1,4}:){5}(((:[\dA-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([\dA-Fa-f]{1,4}:){4}(((:[\dA-Fa-f]{1,4}){1,3})|((:[\dA-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([\dA-Fa-f]{1,4}:){3}(((:[\dA-Fa-f]{1,4}){1,4})|((:[\dA-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([\dA-Fa-f]{1,4}:){2}(((:[\dA-Fa-f]{1,4}){1,5})|((:[\dA-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([\dA-Fa-f]{1,4}:)(((:[\dA-Fa-f]{1,4}){1,6})|((:[\dA-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[\dA-Fa-f]{1,4}){1,7})|((:[\dA-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/

/**
 * Checks whether the IP address is valid, and that it does not have a port
 * number in it.
 *
 * The port from which a request comes can be changed simply by opening or
 * closing a browser, or when using an Azure proxy, thus opening up avenues
 * for bypassing the rate limit.
 *
 * See https://github.com/express-rate-limit/express-rate-limit/wiki/Troubleshooting-Proxy-Issues.
 *
 * @param level {ValidationLevel} - The validation level passed by the user.
 * @param ip {string} - The IP address provided by Express as request.ip.
 *
 * @returns {void}
 */
export const validateIp = (level: ValidationLevel, ip: string) => {
	runCheck(
		level,
		() => ipAddressRegex.test(ip),
		`an invalid 'request.ip' (${ip}) was detected. Consider passing a custom 'keyGenerator' function to the rate limiter.`,
	)
}

/**
 * Makes sure the trust proxy setting is not set to `true`.
 *
 * If this is set to true, it will cause express to return the leftmost entry
 * in the `X-Forwarded-For` header as the client's IP. This header could be
 * set by the client or the proxy, opening up avenues for bypassing the rate
 * limiter.
 *
 * See https://github.com/express-rate-limit/express-rate-limit/wiki/Troubleshooting-Proxy-Issues.
 *
 * @param level {ValidationLevel} - The validation level passed by the user.
 * @param request {Request} - The Express request object.
 *
 * @returns {void}
 */
export const validateTrustProxy = (
	level: ValidationLevel,
	request: Request,
) => {
	runCheck(
		level,
		() => request.app.get('trust proxy') === true,
		`the express 'trust proxy' setting is true, which allows anyone to trivially bypass IP-based rate limiting. For more information, see http://expressjs.com/en/guide/behind-proxies.html.`,
	)
}

/**
 * Makes sure the trust proxy setting is set in case the `X-Forwarded-For`
 * header is present.
 *
 * @param level {ValidationLevel} - The validation level passed by the user.
 * @param request {Request} - The Express request object.
 *
 * @returns {void}
 */
export function validateXForwardedForHeader( // eslint-disable-line @typescript-eslint/naming-convention
	level: ValidationLevel,
	request: Request,
) {
	runCheck(
		level,
		() =>
			Boolean(request.headers['x-forwarded-for']) &&
			request.app.get('trust proxy') === undefined,
		`the 'X-Forwarded-For' header is set but the 'trust proxy' setting is undefined. This could indicate misconfiguration or a malicious actor.`,
	)
}

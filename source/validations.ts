import type { Request } from 'express'
import { ValidationLevel } from './types.js'

function runCheck(
	level: ValidationLevel,
	check: () => boolean,
	errorMessage: string,
) {
	if (level === ValidationLevel.Off) {
		return
	}

	if (!check()) {
		const message = `express-rate-limit: ${errorMessage}`
		if (level === ValidationLevel.Warn) {
			console.warn(message)
		} else if (level === ValidationLevel.Throw) {
			throw new Error(message)
		}
	}
}

// https://www.regextester.com/104038
// matches IPv4 and IPv6, but not if they include a port number at the end
// eslint-disable-next-line @typescript-eslint/naming-convention
const reIP =
	/^((\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])\.){3}(\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z\d-]*[a-zA-Z\d])\.)*([A-Za-z]|[A-Za-z][A-Za-z\d-]*[A-Za-z\d])$|^\s*((([\dA-Fa-f]{1,4}:){7}([\dA-Fa-f]{1,4}|:))|(([\dA-Fa-f]{1,4}:){6}(:[\dA-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([\dA-Fa-f]{1,4}:){5}(((:[\dA-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([\dA-Fa-f]{1,4}:){4}(((:[\dA-Fa-f]{1,4}){1,3})|((:[\dA-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([\dA-Fa-f]{1,4}:){3}(((:[\dA-Fa-f]{1,4}){1,4})|((:[\dA-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([\dA-Fa-f]{1,4}:){2}(((:[\dA-Fa-f]{1,4}){1,5})|((:[\dA-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([\dA-Fa-f]{1,4}:)(((:[\dA-Fa-f]{1,4}){1,6})|((:[\dA-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[\dA-Fa-f]{1,4}){1,7})|((:[\dA-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/
// eslint-disable-next-line @typescript-eslint/naming-convention
export function validateIP(level: ValidationLevel, ip: string) {
	runCheck(
		level,
		() => reIP.test(ip),
		`Invalid req.ip: ${ip}. Consider providing a custom keyGenerator function in the configuration.`,
	)
}

export function validateTrustProxy(level: ValidationLevel, request: Request) {
	runCheck(
		level,
		() => request.app.get('trust proxy') === true,
		`express's 'trust proxy' setting is true, this allows anyone to trivially bypass IP-based rate limiting. See http://expressjs.com/en/guide/behind-proxies.html`,
	)
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function validateXForwardedForHeader(
	level: ValidationLevel,
	request: Request,
) {
	runCheck(
		level,
		() =>
			Boolean(request.headers['x-forwarded-for']) &&
			request.app.get('trust proxy') === undefined,
		`X-Forwarded-For header is set but 'trust proxy' setting is undefined. This could indicate misconfiguration or a malicious actor.`,
	)
}

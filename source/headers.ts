import type { Response } from 'express'
import type { RateLimitInfo } from './types.js'

/**
 * Sets X-RateLimit-* headers on a response
 */
export function setLegacyHeaders(response: Response, info: RateLimitInfo) {
	response.setHeader('X-RateLimit-Limit', info.limit)
	response.setHeader('X-RateLimit-Remaining', info.remaining)

	// If we have a resetTime, also provide the current date to help avoid
	// issues with incorrect clocks.
	if (info.resetTime instanceof Date) {
		response.setHeader('Date', new Date().toUTCString())
		response.setHeader(
			'X-RateLimit-Reset',
			Math.ceil(info.resetTime.getTime() / 1000),
		)
	}
}

/**
 * Sets RateLimit-* headers based on https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers-06
 */
export function setStandardHeadersDraft6(
	response: Response,
	info: RateLimitInfo,
) {
	response.setHeader('RateLimit-Limit', info.limit)
	response.setHeader('RateLimit-Remaining', info.remaining)

	const { resetTime } = info
	if (resetTime) {
		const deltaSeconds = Math.ceil((resetTime.getTime() - Date.now()) / 1000)
		response.setHeader('RateLimit-Reset', Math.max(0, deltaSeconds))
	}
}

/**
 * Sets RateLimit & RateLimit-Policy headers based on https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers-07
 */
export function setStandardHeadersDraft7(
	response: Response,
	info: RateLimitInfo,
	windowMs: number,
) {
	const windowSeconds = Math.ceil(windowMs / 1000)
	let resetSeconds: number
	const { resetTime } = info
	if (resetTime) {
		const deltaSeconds = Math.ceil((resetTime.getTime() - Date.now()) / 1000)
		resetSeconds = Math.max(0, deltaSeconds)
	} else {
		// This isn't really correct, but the field is required by the spec, so this is the best we can do.
		// Validator should have already logged an error by this point.
		resetSeconds = windowSeconds
	}

	response.setHeader('RateLimit-Policy', `${info.limit};w=${windowSeconds}`)
	response.setHeader(
		'RateLimit',
		`limit=${info.limit}, remaining=${info.remaining}, reset=${resetSeconds}`,
	)
}

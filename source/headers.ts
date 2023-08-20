// /source/headers.ts
// The header parsing and setting functions

import type { Response } from 'express'
import type { RateLimitInfo } from './types.js'

/**
 * Returns the number of seconds left for the window to reset. Uses `windowMs`
 * in case the store doesn't return a `resetTime`.
 *
 * @param resetTime {Date | undefined} - The timestamp at which the store window resets.
 * @param windowMs {number | undefined} - The window length.
 */
const getResetSeconds = (
	resetTime?: Date,
	windowMs?: number,
): number | undefined => {
	let resetSeconds: number | undefined = undefined // eslint-disable-line no-undef-init
	if (resetTime) {
		const deltaSeconds = Math.ceil((resetTime.getTime() - Date.now()) / 1000)
		resetSeconds = Math.max(0, deltaSeconds)
	} else if (windowMs) {
		// This isn't really correct, but the field is required by the spec in `draft-7`,
		// so this is the best we can do. The validator should have already logged a
		// warning by this point.
		resetSeconds = Math.ceil(windowMs / 1000)
	}

	return resetSeconds
}

/**
 * Sets `X-RateLimit-*` headers on a response.
 *
 * @param response {Response} - The express response object to set headers on.
 * @param info {RateLimitInfo} - The rate limit info, used to set the headers.
 */
export const setLegacyHeaders = (
	response: Response,
	info: RateLimitInfo,
): void => {
	if (response.headersSent) return

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
 * Sets `RateLimit-*`` headers based on the sixth draft of the IETF specification.
 * See https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers-06.
 *
 * @param response {Response} - The express response object to set headers on.
 * @param info {RateLimitInfo} - The rate limit info, used to set the headers.
 * @param windowMs {number} - The window length.
 */
export const setDraft6Headers = (
	response: Response,
	info: RateLimitInfo,
	windowMs: number,
): void => {
	if (response.headersSent) return

	const windowSeconds = Math.ceil(windowMs / 1000)
	const resetSeconds = getResetSeconds(info.resetTime)

	response.setHeader('RateLimit-Policy', `${info.limit};w=${windowSeconds}`)
	response.setHeader('RateLimit-Limit', info.limit)
	response.setHeader('RateLimit-Remaining', info.remaining)

	// Set this header only if the store returns a `resetTime`.
	if (resetSeconds) response.setHeader('RateLimit-Reset', resetSeconds)
}

/**
 * Sets `RateLimit` & `RateLimit-Policy` headers based on the seventh draft of the spec.
 * See https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers-07.
 *
 * @param response {Response} - The express response object to set headers on.
 * @param info {RateLimitInfo} - The rate limit info, used to set the headers.
 * @param windowMs {number} - The window length.
 */
export const setDraft7Headers = (
	response: Response,
	info: RateLimitInfo,
	windowMs: number,
): void => {
	if (response.headersSent) return

	const windowSeconds = Math.ceil(windowMs / 1000)
	const resetSeconds = getResetSeconds(info.resetTime, windowMs)

	response.setHeader('RateLimit-Policy', `${info.limit};w=${windowSeconds}`)
	response.setHeader(
		'RateLimit',
		`limit=${info.limit}, remaining=${info.remaining}, reset=${resetSeconds!}`,
	)
}

/**
 * Sets the `Retry-After` header.
 *
 * @param response {Response} - The express response object to set headers on.
 * @param info {RateLimitInfo} - The rate limit info, used to set the headers.
 * @param windowMs {number} - The window length.
 */
export const setRetryAfterHeader = (
	response: Response,
	info: RateLimitInfo,
	windowMs: number,
): void => {
	if (response.headersSent) return

	const resetSeconds = getResetSeconds(info.resetTime, windowMs)
	response.setHeader('Retry-After', resetSeconds!)
}

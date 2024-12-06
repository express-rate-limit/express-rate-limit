// /source/headers.ts
// The header setting functions

import { createHash } from 'node:crypto'
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
 * Returns a humanised version of the duration of the window, to be used to name
 * the rate limiter in the policy header.
 *
 * @param windowMs {number} - The window length.
 */
const getDurationInWords = (windowMs: number): string | undefined => {
	const seconds = windowMs / 1000
	const minutes = windowMs / (1000 * 60)
	const hours = windowMs / (1000 * 60 * 60)
	const days = windowMs / (1000 * 60 * 60 * 24)

	if (seconds < 60) return `${seconds}sec`
	if (minutes < 60) return `${minutes}min`
	if (hours < 24) return `${hours}hrs`

	return `${days}day`
}

/**
 * Returns the hash of the identifier, truncated to 16 letters, so it can be
 * used as a partition key. The 16-letter limit is arbitrary, and folllows from
 * the examples given in the 8th draft.
 *
 * @param key {string} - The identifier to hash.
 */
const getPartitionKey = (key: string): string => {
	const hash = createHash('sha256')

	hash.update(key)
	return hash.digest('hex').slice(0, 16)
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

	response.setHeader('X-RateLimit-Limit', info.limit.toString())
	response.setHeader('X-RateLimit-Remaining', info.remaining.toString())

	// If we have a resetTime, also provide the current date to help avoid
	// issues with incorrect clocks.
	if (info.resetTime instanceof Date) {
		response.setHeader('Date', new Date().toUTCString())
		response.setHeader(
			'X-RateLimit-Reset',
			Math.ceil(info.resetTime.getTime() / 1000).toString(),
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
	response.setHeader('RateLimit-Limit', info.limit.toString())
	response.setHeader('RateLimit-Remaining', info.remaining.toString())

	// Set this header only if the store returns a `resetTime`.
	if (resetSeconds)
		response.setHeader('RateLimit-Reset', resetSeconds.toString())
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
 * Sets `RateLimit` & `RateLimit-Policy` headers based on the eighth draft of the spec.
 * See https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers-08.
 *
 * @param response {Response} - The express response object to set headers on.
 * @param info {RateLimitInfo} - The rate limit info, used to set the headers.
 * @param windowMs {number} - The window length.
 * @param key {string} - The unique string identifying the client.
 */
export const setDraft8Headers = (
	response: Response,
	info: RateLimitInfo,
	windowMs: number,
	key: string,
): void => {
	if (response.headersSent) return

	const windowSeconds = Math.ceil(windowMs / 1000)
	const resetSeconds = getResetSeconds(info.resetTime, windowMs)
	const duration = getDurationInWords(windowMs)
	const partitionKey = getPartitionKey(key)

	const name = `rl-${info.limit}-in-${duration}`
	const policy = `q=${info.limit}; w=${windowSeconds}; pk=${partitionKey}`
	const header = `r=${info.remaining}; t=${resetSeconds!}`

	response.setHeader('RateLimit-Policy', `"${name}"; ${policy}`)
	response.setHeader('RateLimit', `"${name}"; ${header}`)
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
	response.setHeader('Retry-After', resetSeconds!.toString())
}

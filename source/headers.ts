// /source/headers.ts
// The header setting functions

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import type { Response } from 'express'
import type { RateLimitInfo } from './types.js'

export const SUPPORTED_DRAFT_VERSIONS = [
	'draft-6',
	'draft-7',
	'draft-8',
] as const

/**
 * Returns the number of seconds left for the window to reset. Uses `windowMs`
 * in case the store doesn't return a `resetTime`.
 *
 * @param windowMs {number | undefined} - The window length.
 * @param resetTime {Date | undefined} - The timestamp at which the store window resets.
 */
const getResetSeconds = (windowMs: number, resetTime?: Date): number => {
	let resetSeconds: number
	if (resetTime) {
		const deltaSeconds = Math.ceil((resetTime.getTime() - Date.now()) / 1000)
		resetSeconds = Math.max(0, deltaSeconds)
	} else {
		// This isn't really correct, but the field is required by the spec in `draft-7`,
		// so this is the best we can do. The validator should have already logged a
		// warning by this point.
		resetSeconds = Math.ceil(windowMs / 1000)
	}

	return resetSeconds
}

/**
 * Returns the hash of the identifier, truncated to 12 bytes, and then converted
 * to base64 so that it can be used as a 16 byte partition key. The 16-byte limit
 * is arbitrary, and follows from the examples given in the 8th draft.
 *
 * @param key {string} - The identifier to hash.
 */
const getPartitionKey = (key: string): string => {
	const hash = createHash('sha256')
	hash.update(key)

	const partitionKey = hash.digest('hex').slice(0, 12)
	return Buffer.from(partitionKey).toString('base64')
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
	const resetSeconds = getResetSeconds(windowMs, info.resetTime)

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
	const resetSeconds = getResetSeconds(windowMs, info.resetTime)

	response.setHeader('RateLimit-Policy', `${info.limit};w=${windowSeconds}`)
	response.setHeader(
		'RateLimit',
		`limit=${info.limit}, remaining=${info.remaining}, reset=${resetSeconds}`,
	)
}

/**
 * Sets `RateLimit` & `RateLimit-Policy` headers based on the eighth draft of the spec.
 * See https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers-08.
 *
 * @param response {Response} - The express response object to set headers on.
 * @param info {RateLimitInfo} - The rate limit info, used to set the headers.
 * @param windowMs {number} - The window length.
 * @param name {string} - The name of the quota policy.
 * @param key {string} - The unique string identifying the client.
 */
export const setDraft8Headers = (
	response: Response,
	info: RateLimitInfo,
	windowMs: number,
	name: string,
	key: string,
): void => {
	if (response.headersSent) return

	const windowSeconds = Math.ceil(windowMs / 1000)
	const resetSeconds = getResetSeconds(windowMs, info.resetTime)
	const partitionKey = getPartitionKey(key)

	const header = `r=${info.remaining}; t=${resetSeconds}`
	const policy = `q=${info.limit}; w=${windowSeconds}; pk=:${partitionKey}:`

	response.append('RateLimit', `"${name}"; ${header}`)
	response.append('RateLimit-Policy', `"${name}"; ${policy}`)
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

	const resetSeconds = getResetSeconds(windowMs, info.resetTime)

	response.setHeader('Retry-After', resetSeconds.toString())
}

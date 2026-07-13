/**
 * Time constants in milliseconds
 *
 * Use these with rate limit window calculations:
 * @example
 * // 5 minute window
 * windowMs:5 * MINUTE
 *
 * // 2 hour window
 * windowMs:2 * HOUR
 *
 * // 1 day window
 * windowMs:1 * DAY
 */
export const SECOND: number = 1000
export const MINUTE: number = 60 * SECOND
export const HOUR: number = 60 * MINUTE
export const DAY: number = 24 * HOUR

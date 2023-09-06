// /source/memory-store.ts
// A memory store for hit counts

import type { Store, Options, ClientRateLimitInfo } from './types.js'

/**
 * Calculates the time when all hit counters will be reset.
 *
 * @param windowMs {number} - The duration of a window (in milliseconds).
 *
 * @returns {Date}
 *
 * @private
 */
const calculateNextResetTime = (windowMs: number): Date => {
	const resetTime = new Date()
	resetTime.setMilliseconds(resetTime.getMilliseconds() + windowMs)
	return resetTime
}

/**
 * A `Store` that stores the hit count for each client in memory.
 *
 * @public
 */
export default class MemoryStore implements Store {
	/**
	 * The duration of time before which all hit counts are reset (in milliseconds).
	 */
	windowMs!: number

	/**
	 * The map that stores the number of hits for each client in memory.
	 */
	hits!: {
		[key: string]: number | undefined
	}

	/**
	 * The time at which all hit counts will be reset.
	 */
	resetTime!: Date

	/**
	 * Reference to the active timer.
	 */
	interval?: NodeJS.Timer

	/**
	 * Confirmation that the keys incremented in once instance of MemoryStore
	 * cannot affect other instances.
	 */
	localKeys = true

	/**
	 * Method that initializes the store.
	 *
	 * @param options {Options} - The options used to setup the middleware.
	 */
	init(options: Options): void {
		// Get the duration of a window from the options.
		this.windowMs = options.windowMs
		// Then calculate the reset time using that.
		this.resetTime = calculateNextResetTime(this.windowMs)

		// Initialise the hit counter map.
		this.hits = {}

		// Reset hit counts for ALL clients every `windowMs` - this will also
		// re-calculate the `resetTime`
		this.interval = setInterval(async () => {
			await this.resetAll()
		}, this.windowMs)
		// Cleaning up the interval will be taken care of by the `shutdown` method.
		if (this.interval.unref) this.interval.unref()
	}

	/**
	 * Method to fetch a client's hit count and reset time.
	 *
	 * @param key {string} - The identifier for a client.
	 *
	 * @returns {ClientRateLimitInfo | undefined} - The number of hits and reset time for that client.
	 *
	 * @public
	 */
	async get(key: string): Promise<ClientRateLimitInfo | undefined> {
		if (this.hits[key] !== undefined)
			return {
				totalHits: this.hits[key]!,
				resetTime: this.resetTime,
			}
		return undefined
	}

	/**
	 * Method to increment a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client.
	 *
	 * @returns {ClientRateLimitInfo} - The number of hits and reset time for that client.
	 *
	 * @public
	 */
	async increment(key: string): Promise<ClientRateLimitInfo> {
		const totalHits = (this.hits[key] ?? 0) + 1
		this.hits[key] = totalHits

		return {
			totalHits,
			resetTime: this.resetTime,
		}
	}

	/**
	 * Method to decrement a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client.
	 *
	 * @public
	 */
	async decrement(key: string): Promise<void> {
		const current = this.hits[key]

		if (current) this.hits[key] = current - 1
	}

	/**
	 * Method to reset a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client.
	 *
	 * @public
	 */
	async resetKey(key: string): Promise<void> {
		delete this.hits[key]
	}

	/**
	 * Method to reset everyone's hit counter.
	 *
	 * @public
	 */
	async resetAll(): Promise<void> {
		this.hits = {}
		this.resetTime = calculateNextResetTime(this.windowMs)
	}

	/**
	 * Method to stop the timer (if currently running) and prevent any memory
	 * leaks.
	 *
	 * @public
	 */
	shutdown(): void {
		clearInterval(this.interval)
	}
}

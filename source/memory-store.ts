// /source/memory-store.ts
// A memory store for hit counts

import { Store, Options, IncrementResponse } from './types.js'

/**
 * Calculates the time when all hit counters will be reset.
 *
 * @param windowMs {number} - The duration of a window (in milliseconds)
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
 * A {@link Store} that stores the hit count for each client in
 * memory.
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
	hits!: { [key: string]: number | undefined }

	/**
	 * The time at which all hit counts will be reset.
	 */
	resetTime!: Date

	/**
	 * Method that initializes the store.
	 *
	 * @param options {Options} - The options used to setup the middleware
	 */
	init(options: Options): void {
		this.windowMs = options.windowMs
		this.hits = {}
		this.resetTime = calculateNextResetTime(this.windowMs)

		// Reset hit counts for ALL clients every `windowMs`
		const interval = setInterval(() => {
			this.resetAll()
		}, this.windowMs)
		if (interval.unref) {
			interval.unref()
		}
	}

	/**
	 * Method to increment a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 *
	 * @returns {IncrementResponse} - The number of hits and reset time for that client
	 *
	 * @public
	 */
	increment(key: string): IncrementResponse {
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
	 * @param key {string} - The identifier for a client
	 *
	 * @public
	 */
	decrement(key: string): void {
		const current = this.hits[key]
		if (current) {
			this.hits[key] = current - 1
		}
	}

	/**
	 * Method to reset a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 *
	 * @public
	 */
	resetKey(key: string): void {
		delete this.hits[key]
	}

	/**
	 * Method to reset everyone's hit counter.
	 *
	 * @public
	 */
	resetAll(): void {
		this.hits = {}
		this.resetTime = calculateNextResetTime(this.windowMs)
	}
}

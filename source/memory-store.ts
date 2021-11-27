// /source/memory-store.ts
// A memory store for hit counts

import { Store, IncrementCallback } from '.'

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
	windowMs: number

	/**
	 * The map that stores the number of hits for each client in memory.
	 */
	hits: { [key: string]: number | undefined }

	/**
	 * The time at which all hit counts will be reset.
	 */
	resetTime: Date

	/**
	 * @constructor for {@link MemoryStore}
	 *
	 * @param windowMs {number} - The duration of a window (in milliseconds)
	 */
	constructor(windowMs: number) {
		this.windowMs = windowMs
		this.hits = {}
		this.resetTime = calculateNextResetTime(windowMs)

		// Reset hit counts for ALL clients every windowMs
		const interval = setInterval(() => {
			this.resetAll()
		}, windowMs)
		if (interval.unref) {
			interval.unref()
		}
	}

	/**
	 * Method to increment a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 * @param callback {IncrementCallback} - The callback to call once the counter is incremented
	 *
	 * @public
	 */
	increment(key: string, callback: IncrementCallback) {
		const current = (this.hits[key] ?? 0) + 1
		this.hits[key] = current

		callback(undefined, current, this.resetTime)
	}

	/**
	 * Method to decrement a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 *
	 * @public
	 */
	decrement(key: string) {
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
	resetKey(key: string) {
		delete this.hits[key]
	}

	/**
	 * Method to reset everyone's hit counter.
	 *
	 * @public
	 */
	resetAll() {
		this.hits = {}
		this.resetTime = calculateNextResetTime(this.windowMs)
	}
}

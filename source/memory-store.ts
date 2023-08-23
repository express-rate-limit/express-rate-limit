// /source/memory-store.ts
// A memory store for hit counts

import type { Store, Options, IncrementResponse } from './types.js'

// Client is similar to IncrementResponse, except that resetTime is always defined
type Client = {
	totalHits: number
	resetTime: Date
}

const average = (array: number[]) =>
	array.reduce((a, b) => a + b) / array.length

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
	 * These two maps store usage (requests) and reset time by key (IP)
	 *
	 * They are split into two to avoid having to iterate through the entire set to determine which ones need reset.
	 * Instead, Clients are moved from previous to current as new requests come in.
	 * Once windowMS has elapsed, all clients left in previous are known to be expired.
	 * At that point, the cache pool is filled from previous, and any remaining clients are cleared.
	 *
	 */
	previous = new Map<string, Client>()
	current = new Map<string, Client>()

	/**
	 * Cache of unused clients, kept to reduce the number of objects created and destroyed.
	 *
	 * Improves performance, at the expense of a small amount of RAM.
	 *
	 * Each individual entry takes up 152 bytes.
	 * In one benchmark, the total time taken to handle 100M requests was reduced from 70.184s to 47.862s (~32% improvement) with ~5.022 MB extra RAM used.
	 * .
	 */
	pool: Client[] = []

	/**
	 * Used to calculate how many entries to keep in the pool
	 */
	newClients = 0
	recentNew: number[] = []

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

		// Indicates that init was called more than once.
		// Could happen if a store was shared between multiple instances.
		if (this.interval) {
			clearTimeout(this.interval)
		}

		// Reset all clients left in previous every `windowMs`.
		this.interval = setInterval(() => {
			this.clearExpired()
		}, this.windowMs)

		// Cleaning up the interval will be taken care of by the `shutdown` method.
		if (this.interval.unref) this.interval.unref()
	}

	/**
	 * Method to increment a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client.
	 *
	 * @returns {IncrementResponse} - The number of hits and reset time for that client.
	 *
	 * @public
	 */
	async increment(key: string): Promise<IncrementResponse> {
		const client = this.getClient(key)

		const now = Date.now()
		if (client.resetTime.getTime() <= now) {
			this.resetClient(client, now)
		}

		client.totalHits++

		return client
	}

	/**
	 * Method to decrement a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client.
	 *
	 * @public
	 */
	async decrement(key: string): Promise<void> {
		const client = this.getClient(key)

		if (client.totalHits > 1) client.totalHits--
	}

	/**
	 * Method to reset a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client.
	 *
	 * @public
	 */
	async resetKey(key: string): Promise<void> {
		this.current.delete(key)
		this.previous.delete(key)
	}

	/**
	 * Method to reset everyone's hit counter.
	 *
	 * @public
	 */
	async resetAll(): Promise<void> {
		this.current.clear()
		this.previous.clear()
	}

	/**
	 * Method to stop the timer (if currently running) and prevent any memory
	 * leaks.
	 *
	 * @public
	 */
	shutdown(): void {
		clearInterval(this.interval)
		void this.resetAll()
	}

	private resetClient(client: Client, now = Date.now()) {
		client.totalHits = 0
		client.resetTime.setTime(now + this.windowMs)
	}

	/**
	 * Refill the pool, set previous to current, reset current
	 */
	private clearExpired() {
		// At this point, all clients in previous are expired

		// calculate the target pool size
		this.recentNew.push(this.newClients)
		if (this.recentNew.length > 10) this.recentNew.shift()
		this.newClients = 0
		const targetPoolSize = Math.round(average(this.recentNew))

		// Calculate how many entries to potentially copy to the pool
		let poolSpace = targetPoolSize - this.pool.length

		// Fill up the pool with expired clients
		for (const client of this.previous.values()) {
			if (poolSpace > 0) {
				this.pool.push(client)
				poolSpace--
			} else {
				break
			}
		}

		// Clear all expired clients from previous
		this.previous.clear()

		// Swap previous and temporary
		const temporary = this.previous
		this.previous = this.current
		this.current = temporary
	}

	/**
	 * Retrieves or creates a client. Ensures it is in this.current
	 * @param key IP or other key
	 * @returns Client
	 */
	private getClient(key: string): Client {
		if (this.current.has(key)) {
			return this.current.get(key)!
		}

		let client
		if (this.previous.has(key)) {
			client = this.previous.get(key)!
		} else if (this.pool.length > 0) {
			client = this.pool.pop()!
			this.resetClient(client)
			this.newClients++
		} else {
			client = { totalHits: 0, resetTime: new Date() }
			this.resetClient(client)
			this.newClients++
		}

		this.current.set(key, client)
		return client
	}
}

// /source/memory-store.ts
// A memory store for hit counts

import type { Store, Options, IncrementResponse } from './types.js'

/**
 * The record that stores information about a client - namely, how many times
 * they have hit the endpoint, and when their hit count resets.
 *
 * Similar to `IncrementResponse`, except `resetTime` is a compulsory field.
 */
type Client = {
	totalHits: number
	resetTime: Date
}

/**
 * Find the average of a list of numbers.
 *
 * @param array {number[]} - The list to find the average of.
 *
 * @returns {number} - The average.
 */
const average = (array: number[]): number =>
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
	 * These two maps store usage (requests) and reset time by key (for example, IP
	 * addresses or API keys).
	 *
	 * They are split into two to avoid having to iterate through the entire set to
	 * determine which ones need reset. Instead, `Client`s are moved from `previous`
	 * to `current` as they hit the endpoint. Once `windowMs` has elapsed, all clients
	 * left in `previous`, i.e., those that have not made any recent requests, are
	 * known to be expired. At that point, the cache pool is filled from `previous`,
	 * and any remaining `Client`s are cleared from memory.
	 */
	previous = new Map<string, Client>()
	current = new Map<string, Client>()

	/**
	 * The cache of unused clients, kept to reduce the number of objects created
	 * and destroyed. Improves performance, at the expense of a small amount of RAM.
	 *
	 * Each entry takes up 152 bytes. In one benchmark, the total time taken to handle
	 * 100M requests was reduced from 70.184s to 47.862s (~32% improvement) with
	 * ~5.022 MB extra RAM used.
	 */
	pool: Client[] = []

	/**
	 * Used to calculate how many entries to keep in the pool.
	 */
	numberOfCreatedClients = 0
	recentClientsCount: number[] = []

	/**
	 * A reference to the active timer.
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

	/**
	 * Recycles a client by setting its hit count to zero, and reset time to
	 * `windowMs` milliseconds from now.
	 *
	 * NOT to be confused with `#resetKey()`, which removes a client from both the
	 * `current` and `previous` maps.
	 *
	 * @param client {Client} - The client to recycle.
	 * @param now {number} - The current time, to which the `windowMs` is added to get the `resetTime` for the client.
	 *
	 * @return {Client} - The modified client that was passed in, to allow for chaining.
	 */
	private resetClient(client: Client, now = Date.now()): Client {
		client.totalHits = 0
		client.resetTime.setTime(now + this.windowMs)

		return client
	}

	/**
	 * Retrieves or creates a client, given a key. Also ensures that the client being
	 * returned is in the `current` map.
	 *
	 * @param key {string} - The key under which the client is (or is to be) stored.
	 *
	 * @returns {Client} - The requested client.
	 */
	private getClient(key: string): Client {
		// If we already have a client for that key in the `current` map, return it.
		if (this.current.has(key)) return this.current.get(key)!

		let client
		if (this.previous.has(key)) {
			// If it's in the `previous` map, take it out
			client = this.previous.get(key)!
			this.previous.delete(key)
		} else if (this.pool.length > 0) {
			// If it's in neither the `current` nor the `previous` maps, animate a corpse
			// from the pool. Spoooooooooooky!
			client = this.pool.pop()!
			this.resetClient(client)

			// Note that we created a new client.
			this.numberOfCreatedClients++
		} else {
			// If the pool does not have spare corpses, pull one from thin air. Boo!
			client = { totalHits: 0, resetTime: new Date() }
			this.resetClient(client)

			// Once more, note that we created a new client.
			this.numberOfCreatedClients++
		}

		// Make sure the client is bumped into the `current` map, and return it.
		this.current.set(key, client)
		return client
	}

	/**
	 * Refills the pool, demotes `current` clients to `previous`, and resets the
	 * `current` map.
	 *
	 * This function is called every `windowMs`.
	 */
	private clearExpired(): void {
		// At this point, all clients in previous are expired.

		// Calculate the new `pool`'s size. The new size is basically the average of
		// the number of clients created per `windowMs` in the last ten windows.
		this.recentClientsCount.push(this.numberOfCreatedClients)
		if (this.recentClientsCount.length > 10) this.recentClientsCount.shift()
		this.numberOfCreatedClients = 0
		const targetPoolSize = Math.round(average(this.recentClientsCount))

		// Calculate how many entries to potentially copy to the pool.
		let poolSpace = targetPoolSize - this.pool.length

		// Fill up the pool with expired clients.
		for (const client of this.previous.values()) {
			if (poolSpace > 0) {
				this.pool.push(client)
				poolSpace--
			} else break
		}

		// Clear all expired clients from `previous`.
		this.previous.clear()

		// Swap previous and temporary
		const temporary = this.previous
		this.previous = this.current
		this.current = temporary
	}
}

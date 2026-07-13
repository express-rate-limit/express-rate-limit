// /source/memory-store.ts
// A memory store for hit counts

import type { ClientRateLimitInfo, Options, Store } from './types.js'
import type { Validations } from './validations.js'

/**
 * The record that stores information about a client - namely, how many times
 * they have hit the endpoint, and when their hit count resets.
 *
 * Similar to `ClientRateLimitInfo`, except `resetTime` is a compulsory field.
 */
type Client = {
	totalHits: number
	resetTime: Date
}

/**
 * A `Store` that stores the hit count for each client in memory.
 *
 * @public
 */
export class MemoryStore implements Store {
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
	 * known to be expired and can be deleted in bulk.
	 */
	previous = new Map<string, Client>()
	current = new Map<string, Client>()

	/**
	 * A reference to the active timer.
	 */
	interval?: NodeJS.Timeout

	/**
	 * Confirmation that the keys incremented in once instance of MemoryStore
	 * cannot affect other instances.
	 */
	localKeys = true

	constructor(private validations?: Validations) {}

	/**
	 * Method that initializes the store.
	 *
	 * @param options {Options} - The options used to setup the middleware.
	 */
	init(options: Options): void {
		// Get the duration of a window from the options.
		this.windowMs = options.windowMs

		// check for a valid value
		this.validations?.windowMs(this.windowMs)

		// Indicates that init was called more than once.
		// Could happen if a store was shared between multiple instances.
		if (this.interval) clearInterval(this.interval)

		// Reset all clients left in previous every `windowMs`.
		this.interval = setInterval(() => {
			this.clearExpired()
		}, this.windowMs)

		// Cleaning up the interval will be taken care of by the `shutdown` method.
		this.interval.unref?.()
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
		return this.current.get(key) ?? this.previous.get(key)
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

		if (client.totalHits > 0) client.totalHits--
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
		// biome-ignore lint/style/noNonNullAssertion: we're checking that it exists
		if (this.current.has(key)) return this.current.get(key)!

		let client
		if (this.previous.has(key)) {
			// If it's in the `previous` map, take it out
			// biome-ignore lint/style/noNonNullAssertion: we're checking that it exists
			client = this.previous.get(key)!
			this.previous.delete(key)
		} else {
			// Finally, if we don't have an existing entry for this client, create a new one
			client = { totalHits: 0, resetTime: new Date() }
			this.resetClient(client)
		}

		// Make sure the client is bumped into the `current` map, and return it.
		this.current.set(key, client)
		return client
	}

	/**
	 * Move current clients to previous, create a new map for current.
	 *
	 * This function is called every `windowMs`.
	 */
	private clearExpired(): void {
		// At this point, all clients in previous are expired
		this.previous = this.current
		this.current = new Map()
	}
}

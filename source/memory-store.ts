// /source/memory-store.ts
// A memory store for hit counts

import type { Store, Options, IncrementResponse } from './types.js'

// Client is similar to IncrementResponse, except that resetTime is always defined
type Client = {
	totalHits: number
	resetTime: Date
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
	 * These two maps store usage (requests) and reset time by key (IP)
	 *
	 * They are split into two to avoid having to iterate through the entire set to determine which ones need reset.
	 * Instead, Clients are moved from previous to current as new requests come in from them.
	 * Once windowMS has elapsed, all clients left in previous are reset at once.
	 *
	 */
	previous!: Map<string, Client>
	current!: Map<string, Client>

	/**
	 * Pool of unused clients, kept to reduce the number of objects created and destroyed
	 */
	pool!: Client[]

	/**
	 * Maximum number of unused clients to keep in the pool
	 */
	poolSize = 100

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
	 * Create a new MemoryStore with an optional custom poolSize
	 *
	 * Note that the windowMS option is passed to init() by express-rate-limit
	 *
	 * @param [options]
	 * @param [options.poolSize] - Maximum number of unused objects to keep around. Increase to reduce garbage collection.
	 */
	constructor({ poolSize }: { poolSize?: number } = {}) {
		if (typeof poolSize === 'number') {
			this.poolSize = poolSize
		}
	}

	/**
	 * Method that initializes the store.
	 *
	 * @param options {Options} - The options used to setup the middleware.
	 */
	init(options: Options): void {
		// Get the duration of a window from the options.
		this.windowMs = options.windowMs

		// Initialise the hit counter map
		this.previous = new Map()
		this.current = new Map()

		// Initialize the spare client pool
		this.pool = []

		// Indicates that init was called more than once.
		// Could happen if a store was shared between multiple instances.
		if (this.interval) {
			clearTimeout(this.interval)
		}

		// Reset all clients left in previous every `windowMs`.
		this.interval = setInterval(() => {
			this.resetPrevious()
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
		if (client.resetTime.getTime() < now) {
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
	private resetPrevious() {
		const temporary = this.previous
		this.previous = this.current
		let poolSpace = this.pool.length - this.poolSize
		for (const client of temporary.values()) {
			if (poolSpace > 0) {
				this.pool.push(client)
				poolSpace--
			} else {
				break
			}
		}

		temporary.clear()
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
		} else {
			client = { totalHits: 0, resetTime: new Date() }
			this.resetClient(client)
		}

		this.current.set(key, client)
		return client
	}
}

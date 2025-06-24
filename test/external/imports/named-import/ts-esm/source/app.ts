// /source/app.ts
// Create a basic server that uses express-rate-limit to rate limit requests

import createServer from 'express'
import {
	ClientRateLimitInfo,
	MemoryStore,
	rateLimit,
	Store,
} from 'express-rate-limit'

export class TestStore implements Store {
	hits: Record<string, number> = {}

	async get(key: string): Promise<ClientRateLimitInfo> {
		return {
			totalHits: this.hits[key],
			resetTime: undefined,
		}
	}

	async increment(key: string): Promise<ClientRateLimitInfo> {
		if (!this.hits[key]) this.hits[key] = 0
		this.hits[key] += 1

		return {
			totalHits: this.hits[key],
			resetTime: undefined,
		}
	}

	async decrement(key: string): Promise<void> {
		if (this.hits[key]) this.hits[key]--
	}

	async resetKey(key: string): Promise<void> {
		delete this.hits[key]
	}

	async shutdown(): Promise<void> {
		console.log('Shutdown successful')
	}
}

export const app = createServer()

export const store = Math.floor(Math.random() * 2)
	? new TestStore()
	: new MemoryStore()

app.use(
	rateLimit({
		limit: 2,
		legacyHeaders: false,
		standardHeaders: true,
		store,
	}),
)

app.get('/', (request, response) => {
	response.send('Hello!')
})

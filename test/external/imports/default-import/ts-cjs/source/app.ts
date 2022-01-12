// /source/app.ts
// Create a basic server that uses express-rate-limit to rate limit requests

import createServer from 'express'
import rateLimit, { Store, IncrementResponse } from 'express-rate-limit'

class TestStore implements Store {
	hits: Record<string, number> = {}

	async increment(key: string): Promise<IncrementResponse> {
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
}

const app = createServer()

app.use(rateLimit({ max: 2, store: new TestStore() }))

app.get('/', (request, response) => response.send('Hello!'))

export default app

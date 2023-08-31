// /source/app.js
// Create a basic server that uses express-rate-limit to rate limit requests

import createServer from 'express'
import rateLimit, { MemoryStore } from 'express-rate-limit'

const app = createServer()

app.use(
	rateLimit({
		limit: 2,
		legacyHeaders: false,
		standardHeaders: true,
		store: new MemoryStore(),
	}),
)

app.get('/', (request, response) => response.send('Hello!'))

export default app

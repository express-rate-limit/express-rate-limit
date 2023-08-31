// /source/app.js
// Create a basic server that uses express-rate-limit to rate limit requests

const createServer = require('express')
const { rateLimit, MemoryStore } = require('express-rate-limit')

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

module.exports = app

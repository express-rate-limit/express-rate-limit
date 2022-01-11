// /source/app.js
// Create a basic server that uses express-rate-limit to rate limit requests

import createServer from 'express'
import rateLimit from 'express-rate-limit'

const app = createServer()

app.use(rateLimit({ max: 2 }))

app.get('/', (request, response) => response.send('Hello!'))

export default app

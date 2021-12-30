// /source/app.js
// Create a basic server that uses express-rate-limit to rate limit requests

const createServer = require('express')
const rateLimit = require('express-rate-limit')

const app = createServer()

app.use(rateLimit({ max: 2 }))

app.get('/', (request, response) => response.send('Hello!'))

module.exports = app

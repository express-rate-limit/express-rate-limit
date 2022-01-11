// /test/server-test.js
// Tests the server's rate limiting middleware

const request = require('supertest')

const app = require('../source/app.js')

test('rate limiting middleware', async () => {
	await request(app).get('/').expect(200)
	await request(app).get('/').expect(200)
	await request(app).get('/').expect(429)
})

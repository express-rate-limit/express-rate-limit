// /test/server-test.js
// Tests the server's rate limiting middleware

import request from 'supertest'

import app from '../source/app.js'

test('rate limiting middleware', async () => {
	await request(app).get('/').expect(200)
	await request(app).get('/').expect(200)
	await request(app).get('/').expect(429)
})

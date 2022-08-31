// /test/server-test.ts
// Tests the server's rate limiting middleware

import { jest } from '@jest/globals'
import { agent as request } from 'supertest'

import { app, store, TestStore } from '../source/app.js'

test('rate limiting middleware', async () => {
	jest.spyOn(global.console, 'log').mockImplementation(() => undefined)
	await request(app).get('/').expect(200)
	await request(app).get('/').expect(200)
	await request(app).get('/').expect(429)
	await store.shutdown()
	if (store instanceof TestStore) {
		expect(console.log).toHaveBeenCalledWith('Shutdown successful')
	}
})

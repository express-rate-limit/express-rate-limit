// /test/stores-test.ts
// Tests the rate limiter with various different stores

import { agent as request } from 'supertest'
import memcachedStore from '../source/memcached-store.js'
import mongoStore from '../source/mongo-store.js'
import redisStore from '../source/redis-store.js'

// TODO: This package doesn't work with jest, since its entrypoint is
// typescript, and jest only seems to support loading javascript modules.
// import preciseStore from '../source/precise-store.js'

test.each([
	['redis', redisStore],
	['mongo', mongoStore],
	['memcached', memcachedStore],
	// ['precise', preciseStore],
])('should work for %s store', async (_name, app) => {
	await request(app).get('/').expect(200)
	await request(app).get('/').expect(200)
	await request(app).get('/').expect(200)
	await request(app).get('/').expect(429)
})

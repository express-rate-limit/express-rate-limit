// /test/stores/stores-test.ts
// Tests the rate limiter with various external stores, running the backing
// databases as throwaway docker containers via `testcontainers`.

import PreciseMemoryStore from 'precise-memory-rate-limit'
import { MemcachedStore } from 'rate-limit-memcached'
// @ts-expect-error - no type definitions for this package
import MongoStore from 'rate-limit-mongo'
import RedisStore from 'rate-limit-redis'
import { createClient } from 'redis'
import { agent as request } from 'supertest'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, describe, it } from 'vitest'
import rateLimit, { type Options } from '../../source/index.js'
import { createServer } from '../library/helpers/create-server.js'

// The number of requests to allow before the store should start returning
// rate limited responses.
const limit = 3

// Create a server that rate limits requests using the given store, and make
// requests until the limit is exceeded.
const expectStoreToCountHits = async (store: Options['store']) => {
	const app = createServer(rateLimit({ limit, store }))
	for (let i = 0; i < limit; i++) await request(app).get('/').expect(200)
	await request(app).get('/').expect(429)
}

describe('external store tests', () => {
	let redisContainer: StartedTestContainer
	let mongoContainer: StartedTestContainer
	let memcachedContainer: StartedTestContainer

	// Cleanup functions to close the stores' database connections, so that the
	// process can exit cleanly once the tests are done.
	const disconnectFns: Array<() => Promise<unknown>> = []

	beforeAll(async () => {
		;[redisContainer, mongoContainer, memcachedContainer] = await Promise.all([
			new GenericContainer('redis').withExposedPorts(6379).start(),
			new GenericContainer('mongo').withExposedPorts(27017).start(),
			new GenericContainer('memcached').withExposedPorts(11211).start(),
		])
	})

	afterAll(async () => {
		await Promise.all(disconnectFns.map(async (disconnect) => disconnect()))
		await Promise.all(
			[redisContainer, mongoContainer, memcachedContainer].map(
				async (container) => container?.stop(),
			),
		)
	})

	it('should work with rate-limit-redis', async () => {
		const client = createClient({
			url: `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`,
		})
		await client.connect()
		disconnectFns.push(async () => client.close())

		await expectStoreToCountHits(
			new RedisStore({
				sendCommand: async (...args) => client.sendCommand(args),
			}),
		)
	})

	it('should work with rate-limit-mongo', async () => {
		const store = new MongoStore({
			uri: `mongodb://${mongoContainer.getHost()}:${mongoContainer.getMappedPort(27017)}/test_db`,
			errorHandler: console.error.bind(null, 'rate-limit-mongo'),
		})
		disconnectFns.push(async () => {
			const client = await store.getClient()
			await client.close()
		})

		await expectStoreToCountHits(store)
	})

	it('should work with rate-limit-memcached', async () => {
		const store = new MemcachedStore({
			locations: [
				`${memcachedContainer.getHost()}:${memcachedContainer.getMappedPort(11211)}`,
			],
		})
		disconnectFns.push(async () =>
			(store.client as { close?: () => void }).close?.(),
		)

		await expectStoreToCountHits(store)
	})

	it('should work with precise-memory-rate-limit', async () => {
		await expectStoreToCountHits(new PreciseMemoryStore(limit))
	})
})

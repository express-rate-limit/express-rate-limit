// /test/memory-store-test.ts
// Tests the built in memory store

import { jest } from '@jest/globals'
import MemoryStore from '../../source/memory-store.js'
import type { Options } from '../../source/index.js'

const minute = 60 * 1000

describe.only('memory store test', () => {
	beforeEach(() => {
		jest.useFakeTimers()
		jest.spyOn(global, 'clearInterval')
	})
	afterEach(() => {
		jest.useRealTimers()
		jest.restoreAllMocks()
	})

	it('returns the current hit count and reset time for a key', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: minute } as Options)
		const key = 'test-store'

		await store.increment(key)

		const response = await store.get(key)
		expect(response).toMatchObject({
			totalHits: 1,
			resetTime: expect.any(Date),
		})
	})

	it('sets the value to 1 on first call to `increment`', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: minute } as Options)
		const key = 'test-store'

		const { totalHits } = await store.increment(key)
		expect(totalHits).toEqual(1)
	})

	it('increments the key for the store when `increment` is called', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: minute } as Options)
		const key = 'test-store'

		await store.increment(key)

		const { totalHits } = await store.increment(key)
		expect(totalHits).toEqual(2)
	})

	it('decrements the key for the store when `decrement` is called', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: minute } as Options)
		const key = 'test-store'

		await store.increment(key)
		await store.increment(key)
		await store.decrement(key)

		const { totalHits } = await store.increment(key)
		expect(totalHits).toEqual(2)
	})

	it('resets the count for a key in the store when `resetKey` is called', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: minute } as Options)
		const key = 'test-store'

		await store.increment(key)
		await store.resetKey(key)

		const { totalHits } = await store.increment(key)
		expect(totalHits).toEqual(1)
	})

	it('resets the count for all keys in the store when `resetAll` is called', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: minute } as Options)
		const keyOne = 'test-store-one'
		const keyTwo = 'test-store-two'

		await store.increment(keyOne)
		await store.increment(keyTwo)
		await store.resetAll()

		const { totalHits: totalHitsOne } = await store.increment(keyOne)
		const { totalHits: totalHitsTwo } = await store.increment(keyTwo)
		expect(totalHitsOne).toEqual(1)
		expect(totalHitsTwo).toEqual(1)
	})

	it('clears the timer when `shutdown` is called', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: minute } as Options)
		expect(store.interval).toBeDefined()
		store.shutdown()
		expect(clearInterval).toHaveBeenCalledWith(store.interval)
	})

	it('resets the count for all the keys in the store when the timeout is reached', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: 50 } as Options)
		const keyOne = 'test-store-one'
		const keyTwo = 'test-store-two'

		await store.increment(keyOne)
		await store.increment(keyTwo)

		jest.advanceTimersByTime(60)
		const { totalHits: totalHitsOne } = await store.increment(keyOne)
		const { totalHits: totalHitsTwo } = await store.increment(keyTwo)
		expect(totalHitsOne).toEqual(1)
		expect(totalHitsTwo).toEqual(1)
	})

	it('can run in electron where setInterval does not return a Timeout object with an unset function', async () => {
		const originalSetInterval = setInterval
		let timeoutId = 1
		let realTimeoutId: NodeJS.Timer
		// @ts-expect-error We want to not return a `Timer` instance for testing
		jest.spyOn(global, 'setTimeout').mockImplementation((callback, timeout) => {
			realTimeoutId = originalSetInterval(callback, timeout)
			return timeoutId++
		})

		const store = new MemoryStore()
		store.init({ windowMs: -1 } as Options)
		const key = 'test-store'

		try {
			const { totalHits } = await store.increment(key)
			expect(totalHits).toEqual(1)
		} finally {
			// @ts-expect-error `realTimeoutId` is already set in the `spyOn` call
			clearTimeout(realTimeoutId)
		}
	})

	it('should move clients from previous to current', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: 100 } as Options)

		await store.increment('key1')
		// Key1 is now in current
		expect(store.current.has('key1')).toBe(true)
		expect(store.previous.has('key1')).toBe(false)

		jest.advanceTimersByTime(100)
		// Key1 is now in previous, current is empty
		expect(store.current.has('key1')).toBe(false)
		expect(store.previous.has('key1')).toBe(true)

		await store.increment('key1')
		// Should move key from previous to current
		expect(store.current.has('key1')).toBe(true)
		expect(store.previous.has('key1')).toBe(false)
	})

	// Covers the same bug as above, but in a more robust way that doesn't touch any internal structures
	it('does not allow a Client object to be assigned to two keys', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: 100 } as Options)
		await store.increment('key1') // Key1 is now in current

		jest.advanceTimersByTime(100) // Key1 is now in previous. Target pool size is 1, but it's empty.
		await store.increment('key1') // Key1 is now in current again. If it's also in previous, that's a bug!
		await store.increment('key2') // Need 1 new client to keep the pool size target at 1

		jest.advanceTimersByTime(100) // Key1 and key2 are now in previous. Target pool size is 1, but it should be empty.
		await store.increment('key1') // Move it from previous to current
		await store.increment('key1')
		let returnValue1 = await store.increment('key1')
		expect(returnValue1.totalHits).toBe(3)

		const returnValue3 = await store.increment('key3') // Should create a new Client instance because the pool should be empty. In the bad case, it instead resets the same object to 1
		expect(returnValue1).not.toBe(returnValue3) // Should be separate objects
		expect(returnValue3.totalHits).toBe(1)

		returnValue1 = await store.increment('key1')
		expect(returnValue1.totalHits).toBe(4) // Should be 4, will be 2 if there's a reuse bug
	})
})

test('resetKey should remove the key from storage', async () => {
	const store = new MemoryStore()

	// Increment the test key
	await store.increment('test-key')

	// Ensure the key exists before reset
	let client = await store.get('test-key')
	expect(client).toBeDefined()

	// Reset the key
	await store.resetKey('test-key')

	// Ensure the key is removed after reset
	client = await store.get('test-key')
	expect(client).toBeUndefined()
})

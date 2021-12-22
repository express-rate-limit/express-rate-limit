// /test/memory-store-test.ts
// Tests the built in memory store

import { jest } from '@jest/globals'

import { Options } from '../dist/esm/index.js'
import MemoryStore from '../dist/esm/memory-store.js'

describe('memory store test', () => {
	it('sets the value to 1 on first call to `increment`', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: -1 } as Options)
		const key = 'test-store'

		const { totalHits } = store.increment(key)
		expect(totalHits).toEqual(1)
	})

	it('increments the key for the store when `increment` is called', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: -1 } as Options)
		const key = 'test-store'

		store.increment(key)

		const { totalHits } = store.increment(key)
		expect(totalHits).toEqual(2)
	})

	it('resets the count for a key in the store when `resetKey` is called', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: -1 } as Options)
		const key = 'test-store'

		store.increment(key)
		store.resetKey(key)

		const { totalHits } = store.increment(key)
		expect(totalHits).toEqual(1)
	})

	it('resets the count for all keys in the store when `resetAll` is called', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: -1 } as Options)
		const keyOne = 'test-store-one'
		const keyTwo = 'test-store-two'

		store.increment(keyOne)
		store.increment(keyTwo)
		store.resetAll()

		const { totalHits: totalHitsOne } = store.increment(keyOne)
		const { totalHits: totalHitsTwo } = store.increment(keyTwo)
		expect(totalHitsOne).toEqual(1)
		expect(totalHitsTwo).toEqual(1)
	})

	it('resets the count for all the keys in the store when the timeout is reached', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: 50 } as Options)
		const keyOne = 'test-store-one'
		const keyTwo = 'test-store-two'

		store.increment(keyOne)
		store.increment(keyTwo)

		setTimeout(() => {
			const { totalHits: totalHitsOne } = store.increment(keyOne)
			const { totalHits: totalHitsTwo } = store.increment(keyTwo)

			expect(totalHitsOne).toEqual(1)
			expect(totalHitsTwo).toEqual(1)
		}, 60)
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
			const { totalHits } = store.increment(key)
			expect(totalHits).toEqual(1)
		} finally {
			// @ts-expect-error `realTimeoutId` is already set in the `spyOn` call
			clearTimeout(realTimeoutId)
		}
	})

	it('decrements the key for the store when `decrement` is called', async () => {
		const store = new MemoryStore()
		store.init({ windowMs: -1 } as Options)
		const key = 'test-store'

		store.increment(key)
		store.increment(key)
		store.decrement(key)

		const { totalHits } = store.increment(key)
		expect(totalHits).toEqual(2)
	})
})

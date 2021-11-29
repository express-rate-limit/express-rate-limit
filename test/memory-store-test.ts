// /test/memory-store-test.ts
// Tests the built in memory store

import { jest } from '@jest/globals'

import MemoryStore from '../dist/memory-store.js'

// TODO: Promisify all calls to increment

describe('memory store test', () => {
	it('sets the value to 1 on first call to `increment`', (done) => {
		const store = new MemoryStore(-1)
		const key = 'test-store'

		store.increment(key, (error, value) => {
			if (error) {
				done(error)
			} else if (value === 1) {
				done()
			} else {
				done(
					new Error(
						'Calling `increment` did not set the count for the key in the store to 1',
					),
				)
			}
		})
	})

	it('increments the key for the store when `increment` is called', (done) => {
		const store = new MemoryStore(-1)
		const key = 'test-store'

		store.increment(key, () => {
			store.increment(key, (error, value) => {
				if (error) {
					done(error)
				} else if (value === 2) {
					done()
				} else {
					done(
						new Error(
							'Calling `increment` did not increment count for the key in the store',
						),
					)
				}
			})
		})
	})

	it('resets the count for a key in the store when `resetKey` is called', (done) => {
		const store = new MemoryStore(-1)
		const key = 'test-store'

		store.increment(key, () => {
			store.resetKey(key)
			store.increment(key, (error, value) => {
				if (error) {
					done(error)
				} else if (value === 1) {
					done()
				} else {
					done(
						new Error(
							'Calling `resetKey` did not reset the count for the key in the store',
						),
					)
				}
			})
		})
	})

	it('resets the count for all keys in the store when `resetAll` is called', (done) => {
		const store = new MemoryStore(-1)
		const keyOne = 'test-store-one'
		const keyTwo = 'test-store-two'

		store.increment(keyOne, () => {
			store.increment(keyTwo, () => {
				store.resetAll()
				store.increment(keyOne, (error, valueOne) => {
					if (error) {
						done(error)
					} else if (valueOne === 1) {
						store.increment(keyTwo, (error, valueTwo) => {
							if (error) {
								done(error)
							} else if (valueTwo === 1) {
								done()
							} else {
								done(
									new Error(
										'`resetAll` did not reset the count for all the keys in the store',
									),
								)
							}
						})
					} else {
						done(
							new Error(
								'`resetAll` did not reset the count for all the keys in the store',
							),
						)
					}
				})
			})
		})
	})

	it('resets the count for all the keys in the store when the timeout is reached', (done) => {
		const store = new MemoryStore(50)
		const keyOne = 'test-store-one'
		const keyTwo = 'test-store-two'

		store.increment(keyOne, () => {
			store.increment(keyTwo, () => {
				setTimeout(() => {
					store.increment(keyOne, (error, valueOne) => {
						if (error) {
							done(error)
						} else if (valueOne === 1) {
							store.increment(keyTwo, (error, valueTwo) => {
								if (error) {
									done(error)
								} else if (valueTwo === 1) {
									done()
								} else {
									done(
										new Error(
											'Reaching the timeout did not reset all the keys in the store',
										),
									)
								}
							})
						} else {
							done(
								new Error(
									'Reaching the timeout did not reset all the keys in the store',
								),
							)
						}
					})
				}, 60)
			})
		})
	})

	it('can run in electron where setInterval does not return a Timeout object with an unset function', (done) => {
		const originalSetInterval = setInterval
		let timeoutId = 1
		let realTimeoutId: NodeJS.Timer
		// @ts-expect-error We want to not return a `Timer` instance for testing
		jest.spyOn(global, 'setTimeout').mockImplementation((callback, timeout) => {
			realTimeoutId = originalSetInterval(callback, timeout)
			return timeoutId++
		})

		const store = new MemoryStore(-1)
		const key = 'test-store'

		store.increment(key, (error, value) => {
			if (error) {
				clearTimeout(realTimeoutId)
				done(error)
			} else if (value === 1) {
				clearTimeout(realTimeoutId)
				done()
			} else {
				clearTimeout(realTimeoutId)
				done(
					new Error(
						'Calling `increment` did not set the counter for the key in the store to 1',
					),
				)
			}
		})
	})

	it('decrements the key for the store when `decrement` is called', (done) => {
		const store = new MemoryStore(-1)
		const key = 'test-store'

		store.increment(key, () => {
			store.decrement(key)
			store.increment(key, (error, value) => {
				if (error) {
					done(error)
				} else if (value === 1) {
					done()
				} else {
					done(new Error('decrease does not work'))
				}
			})
		})
	})
})

import MemoryStore = require('../dist/memory-store.js')

describe('MemoryStore store', function () {
	it('sets the value to 1 on first incr', function (done) {
		const store = new MemoryStore(-1)
		const key = 'test-store'

		store.incr(key, function (err?: Error, value?: Number) {
			if (err) {
				done(err)
			} else {
				if (value === 1) {
					done()
				} else {
					done(new Error('incr did not set the key on the store to 1'))
				}
			}
		})
	})

	it('increments the key for the store each incr', function (done) {
		const store = new MemoryStore(-1)
		const key = 'test-store'

		store.incr(key, function () {
			store.incr(key, function (err, value) {
				if (err) {
					done(err)
				} else {
					if (value === 2) {
						done()
					} else {
						done(new Error('incr did not increment the store'))
					}
				}
			})
		})
	})

	it('resets the key for the store when used with resetKey', function (done) {
		const store = new MemoryStore(-1)
		const key = 'test-store'

		store.incr(key, function () {
			// value should be 1 now
			store.resetKey(key)
			// value should be 0 now
			store.incr(key, function (err, value) {
				// value should be 1 now
				if (value === 1) {
					done()
				} else {
					done(
						new Error('resetKey did not reset the store for the key provided'),
					)
				}
			})
		})
	})

	it('resets all keys for the store when used with resetAll', function (done) {
		const store = new MemoryStore(-1)
		const keyOne = 'test-store-one'
		const keyTwo = 'test-store-two'

		store.incr(keyOne, function () {
			// valueOne should be 1 now
			store.incr(keyTwo, function () {
				// valueTwo should be 1 now
				store.resetAll()
				// valueOne should be 0 now
				// valueTwo should be 0 now
				store.incr(keyOne, function (err, valueOne) {
					// valueOne should be 1 now
					if (valueOne === 1) {
						store.incr(keyTwo, function (err, valueTwo) {
							// valueTwo should be 1 now
							if (valueTwo === 1) {
								done()
							} else {
								done(
									new Error('resetAll did not reset all the keys in the store'),
								)
							}
						})
					} else {
						done(new Error('resetAll did not reset all the keys in the store'))
					}
				})
			})
		})
	})

	it('resets all keys for the store when the timeout is reached', function (done) {
		const store = new MemoryStore(50)
		const keyOne = 'test-store-one'
		const keyTwo = 'test-store-two'

		store.incr(keyOne, function () {
			// valueOne should be 1 now
			store.incr(keyTwo, function () {
				// valueTwo should be 1 now
				setTimeout(function () {
					// valueOne and valueTwo should be 0 now
					store.incr(keyOne, function (err, valueOne) {
						// valueOne should be 1 now
						if (valueOne === 1) {
							store.incr(keyTwo, function (err, valueTwo) {
								// valueTwo should be 1 now
								if (valueTwo === 1) {
									done()
								} else {
									done(
										new Error(
											'reaching the timeout did not reset all the keys in the store',
										),
									)
								}
							})
						} else {
							done(
								new Error(
									'reaching the timeout did not reset all the keys in the store',
								),
							)
						}
					})
				}, 60)
			})
		})
	})

	it('decrements the key for the store each decrement', function (done) {
		const store = new MemoryStore(-1)
		const key = 'test-store'

		store.incr(key, function () {
			store.decrement(key)
			store.incr(key, function (error, value) {
				if (value === 1) {
					done()
				} else {
					done(new Error('decrease does not work'))
				}
			})
		})
	})
})

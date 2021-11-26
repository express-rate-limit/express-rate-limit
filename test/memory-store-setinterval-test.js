const MemoryStore = require('../dist/memory-store.js')

// this test is JS instead of TS, because I can't figure out how to mock setInterval in TS.
describe('MemoryStore interval', () => {
	const originalSetInterval = setInterval
	let timeoutId = 1
	let realTimeoutId

	beforeEach(() => {
		timeoutId = 1
		// eslint-disable-next-line  no-global-assign
		setInterval = (callback, timeout) => {
			realTimeoutId = originalSetInterval(callback, timeout)
			return timeoutId++
		}
	})

	// see #48 & https://nodejs.org/api/timers.html#timers_timeout_unref &
	it('can run in electron where setInterval does not return a Timeout object with an unref function', (done) => {
		const store = new MemoryStore(-1)
		const key = 'test-store'

		store.incr(key, (err, value) => {
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

	afterEach(() => {
		// eslint-disable-next-line  no-global-assign
		setInterval = originalSetInterval
		clearTimeout(realTimeoutId)
	})
})

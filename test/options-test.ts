// /test/options-test.ts
// Tests parsing/handling of options passed in by the user

import rateLimit from '../dist/index.js'

describe('options test', () => {
	it('should not allow the use of an invalid store', async () => {
		class InvalidStore {
			invalid = true
		}

		expect(() => {
			rateLimit({
				// @ts-expect-error Check if the library can detect invalid stores without TSC's help
				store: new InvalidStore(),
			})
		}).toThrowError(/store/)
	})

	it('should not allow the use of deprecated options', async () => {
		expect(() => {
			rateLimit({
				global: true,
			})
		}).toThrowError(/deprecated/)

		expect(() => {
			rateLimit({
				delayAfter: 2,
			})
		}).toThrowError(/deprecated/)

		expect(() => {
			rateLimit({
				delayMs: 2 * 1000,
			})
		}).toThrowError(/deprecated/)
	})

	it('should not throw if deprecated options are used but disabled by setting them to falsy values', async () => {
		expect(() => {
			rateLimit({
				global: false,
			})
		}).toBeTruthy()

		expect(() => {
			rateLimit({
				delayAfter: 0,
			})
		}).toBeTruthy()

		expect(() => {
			rateLimit({
				delayMs: 0,
			})
		}).toBeTruthy()
	})
})

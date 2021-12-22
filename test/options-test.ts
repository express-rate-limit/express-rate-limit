// /test/options-test.ts
// Tests parsing/handling of options passed in by the user

import rateLimit from '../dist/esm/index.js'

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

		expect(() => {
			rateLimit({
				headers: true,
			})
		}).toThrowError(/deprecated/)

		expect(() => {
			rateLimit({
				draft_polli_ratelimit_headers: true, // eslint-disable-line @typescript-eslint/naming-convention
			})
		}).toThrowError(/deprecated/)
	})

	it('should throw if deprecated options are used but disabled by setting them to falsy values', async () => {
		expect(() => {
			rateLimit({
				global: false,
			})
		}).toThrowError(/deprecated/)

		expect(() => {
			rateLimit({
				delayAfter: 0,
			})
		}).toThrowError(/deprecated/)

		expect(() => {
			rateLimit({
				delayMs: 0,
			})
		}).toThrowError(/deprecated/)

		expect(() => {
			rateLimit({
				headers: false,
			})
		}).toThrowError(/deprecated/)

		expect(() => {
			rateLimit({
				draft_polli_ratelimit_headers: false, // eslint-disable-line @typescript-eslint/naming-convention
			})
		}).toThrowError(/deprecated/)
	})
})

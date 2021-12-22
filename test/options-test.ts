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
				headers: true,
			})
		}).toThrowError(/renamed/)

		expect(() => {
			rateLimit({
				draft_polli_ratelimit_headers: true, // eslint-disable-line @typescript-eslint/naming-convention
			})
		}).toThrowError(/renamed/)
	})

	it('should throw if deprecated options are used but disabled by setting them to falsy values', async () => {
		expect(() => {
			rateLimit({
				headers: false,
			})
		}).toThrowError(/renamed/)

		expect(() => {
			rateLimit({
				draft_polli_ratelimit_headers: false, // eslint-disable-line @typescript-eslint/naming-convention
			})
		}).toThrowError(/renamed/)
	})
})

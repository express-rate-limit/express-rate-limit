// /test/options-test.ts
// Tests parsing/handling of options passed in by the user

import { describe, expect, it } from '@jest/globals'
import rateLimit, {
	type ClientRateLimitInfo,
	type Options,
	type Store,
} from '../../source/index.js'

describe('options test', () => {
	class MockStore implements Store {
		options!: Options

		init(options: Options): void {
			this.options = options
		}

		async get(_key: string): Promise<ClientRateLimitInfo> {
			return { totalHits: 1, resetTime: undefined }
		}

		async increment(_key: string): Promise<ClientRateLimitInfo> {
			return { totalHits: 1, resetTime: undefined }
		}

		async decrement(_key: string): Promise<void> {}

		async resetKey(_key: string): Promise<void> {}
	}

	it('should allow an empty options object', async () => {
		expect(rateLimit).not.toThrow()
	})

	it('should ignore options that are set to `undefined`', async () => {
		const store = new MockStore()
		rateLimit({
			store,
			limit: undefined,
		})

		expect(store.options.limit).toEqual(5)
	})

	// TODO: Update in v7.
	it('should allow the use of pre-6.x headers options', async () => {
		const store = new MockStore()
		rateLimit({
			store,
			headers: false,
		})

		expect(store.options.headers).toEqual(false)
	})

	it('should allow the use of the `max` option', async () => {
		const store = new MockStore()
		rateLimit({
			store,
			max: 7,
		})

		expect(store.options.limit).toEqual(7)
	})

	it('should allow the use of the `limit` option', async () => {
		const store = new MockStore()
		rateLimit({
			store,
			limit: 7,
		})

		expect(store.options.limit).toEqual(7)
	})

	it('should not allow the use of an invalid store', async () => {
		class InvalidStore {
			invalid = true
		}

		expect(() => {
			rateLimit({
				// @ts-expect-error Check if the library can detect invalid stores without TSC's help
				store: new InvalidStore(),
			})
		}).toThrow(/store/)
	})

	it('should not call `init` if it is not a function', async () => {
		class InvalidStore implements Store {
			options!: Options

			// @ts-expect-error Check if the library can detect invalid stores without TSC's help
			init = 'not-a-function'

			async increment(_key: string): Promise<ClientRateLimitInfo> {
				return { totalHits: 1, resetTime: undefined }
			}

			async decrement(_key: string): Promise<void> {}

			async resetKey(_key: string): Promise<void> {}
		}

		expect(() => {
			rateLimit({
				// @ts-expect-error Check if the library can detect invalid stores without TSC's help
				store: new InvalidStore(),
			})
		}).toThrow(/store/)
	})

	it('should not allow an invalid standardHeaders option', async () => {
		rateLimit({
			// @ts-expect-error Check if TSC can detect an invalid value for this option. If not, it
			// will report that this is an unnecessary annotation.
			standardHeaders: 'not-a-valid-draft',
		})
	})
})

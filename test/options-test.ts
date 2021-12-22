// /test/options-test.ts
// Tests parsing/handling of options passed in by the user

import rateLimit, {
	Store,
	Options,
	IncrementResponse,
} from '../dist/esm/index.js'

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

	it('should allow the use of pre-6.x headers options', async () => {
		class MockStore implements Store {
			options!: Options

			init(options: Options): void {
				this.options = options
			}

			increment(_key: string): IncrementResponse {
				return { totalHits: 1, resetTime: undefined }
			}

			decrement(_key: string): void {}

			resetKey(_key: string): void {}
		}

		const store = new MockStore()
		rateLimit({
			store,
			headers: false,
			draft_polli_ratelimit_headers: true, // eslint-disable-line @typescript-eslint/naming-convention
		})

		expect(store.options.headers).toEqual(false)
		expect(store.options.draft_polli_ratelimit_headers).toEqual(true)
	})
})

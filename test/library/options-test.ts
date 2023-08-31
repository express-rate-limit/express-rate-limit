// /test/options-test.ts
// Tests parsing/handling of options passed in by the user

import rateLimit, {
	type Store,
	type Options,
	type IncrementResponse,
} from '../../source/index.js'

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

	it('should not call `init` if it is not a function', async () => {
		class InvalidStore implements Store {
			options!: Options

			// @ts-expect-error Check if the library can detect invalid stores without TSC's help
			init = 'not-a-function'

			async increment(_key: string): Promise<IncrementResponse> {
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
		}).toThrowError(/store/)
	})
})

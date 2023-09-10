// /test/library/validation-test.ts
// Tests the validation functions

import {
	expect,
	jest,
	describe,
	it,
	beforeEach,
	afterEach,
} from '@jest/globals'
import { getValidations } from '../../source/validations.js'
import type { Store } from '../../source/types'

describe('validations tests', () => {
	let validations = getValidations(true)

	beforeEach(() => {
		jest.spyOn(console, 'error').mockImplementation(() => {})
		jest.spyOn(console, 'warn').mockImplementation(() => {})
	})
	afterEach(() => {
		jest.restoreAllMocks()
		validations = getValidations(true)
	})

	describe('ip', () => {
		it('should allow a valid IPv4', () => {
			validations.ip('1.2.3.4')
			expect(console.error).not.toBeCalled()
		})

		it('should allow a valid IPv6', () => {
			validations.ip('1200:0000:AB00:1234:0000:2552:7777:1313')
			expect(console.error).not.toBeCalled()
		})

		it('should log an error for an invalid IP', () => {
			validations.ip('badip')
			expect(console.error).toBeCalled()
		})

		it('shoud log an error for an undefined IP', () => {
			validations.ip(undefined)
			expect(console.error).toBeCalled()
		})

		it('should log an error for an IPv4 with a port', () => {
			validations.ip('1.2.3.4:1234')
			expect(console.error).toBeCalled()
		})

		it('should log an error for an IPv6 with a port', () => {
			validations.ip('[1200:0000:AB00:1234:0000:2552:7777:1313]:1234')
			expect(console.error).toBeCalled()
		})
	})

	describe('trustProxy', () => {
		it('should log an error on "trust proxy" = true', () => {
			validations.trustProxy({ app: { get: () => true } } as any)
			expect(console.error).toBeCalled()
		})

		it('should not log an error on "trust proxy" != true', () => {
			validations.trustProxy({ app: { get: () => false } } as any)
			validations.trustProxy({ app: { get: () => '1.2.3.4' } } as any)
			validations.trustProxy({ app: { get: () => /1.2.3.4/ } } as any)
			validations.trustProxy({ app: { get: () => ['1.2.3.4'] } } as any)
			expect(console.error).not.toBeCalled()
		})
	})

	describe('xForwardedFor', () => {
		it('should log an error only with X-Forwarded-For header and "trust proxy" = false', () => {
			validations.xForwardedForHeader({
				app: { get: () => true },
				headers: { 'x-forwarded-for': '1.2.3.4' },
			} as any)
			validations.xForwardedForHeader({
				app: { get: () => true },
				headers: {},
			} as any)
			validations.xForwardedForHeader({
				app: { get: () => false },
				headers: {},
			} as any)
			expect(console.error).not.toBeCalled()

			validations.xForwardedForHeader({
				app: { get: () => false },
				headers: { 'x-forwarded-for': '1.2.3.4' },
			} as any)
			expect(console.error).toBeCalled()
		})
	})

	describe('positiveHits', () => {
		it('should log an error if hits is non-numeric', () => {
			validations.positiveHits(true)
			expect(console.error).toBeCalled()
		})

		it('should log an error if hits is less than 1', () => {
			validations.positiveHits(0)
			expect(console.error).toBeCalled()
		})

		it('should log an error if hits is not an integer', () => {
			validations.positiveHits(1.5)
			expect(console.error).toBeCalled()
		})

		it('should not log an error if hits is a positive integer', () => {
			validations.positiveHits(1)
			expect(console.error).not.toBeCalled()
		})
	})

	describe('singleCount', () => {
		class TestExternalStore {} // eslint-disable-line @typescript-eslint/no-extraneous-class

		it('should log an error if a request is double-counted with a MemoryStore', () => {
			const request = {}
			const store = { localKeys: true }
			const key = '1.2.3.4'

			validations.singleCount(request as any, store as Store, key)
			expect(console.error).not.toBeCalled()
			validations.singleCount(request as any, store as Store, key)
			expect(console.error).toBeCalled()
		})

		it('should log an error if a request is double-counted with an external store', () => {
			const request = {}
			const store = new TestExternalStore()
			const key = '1.2.3.4'

			validations.singleCount(request as any, store as Store, key)
			expect(console.error).not.toBeCalled()
			validations.singleCount(request as any, store as Store, key)
			expect(console.error).toBeCalled()
		})

		it('should not log an error if a request is double-counted with separate instances of MemoryStore', () => {
			const request = {}
			const store1 = { localKeys: true }
			const store2 = { localKeys: true }
			const key = '1.2.3.4'

			validations.singleCount(request as any, store1 as Store, key)
			validations.singleCount(request as any, store2 as Store, key)
			expect(console.error).not.toBeCalled()
		})

		it('should log an error if a request is double-counted with separate instances of an external store', () => {
			const request = {}
			const store1 = new TestExternalStore()
			const store2 = new TestExternalStore()
			const key = '1.2.3.4'

			validations.singleCount(request as any, store1 as Store, key)
			validations.singleCount(request as any, store2 as Store, key)
			expect(console.error).toBeCalled()
		})

		it('should not log an error for multiple requests from the same key', () => {
			const request1 = {}
			const request2 = {}
			const store = { localKeys: true }
			const key = '1.2.3.4'

			validations.singleCount(request1 as any, store as Store, key)
			expect(console.error).not.toBeCalled()
			validations.singleCount(request2 as any, store as Store, key)
			expect(console.error).not.toBeCalled()
		})
	})

	describe('limit', () => {
		it('should log a warning if max is set to 0', () => {
			validations.limit(0)
			expect(console.warn).toBeCalled()
		})

		it('should not log a warning if max is set to a non zero number', () => {
			validations.limit(3)
			expect(console.warn).not.toBeCalled()
		})
	})

	describe('onLimitReached', () => {
		it('should log a warning if onLimitReached is set', () => {
			validations.onLimitReached(() => {})
			expect(console.warn).toBeCalled()
			expect(console.error).not.toBeCalled()
		})

		it('should not log a warning if onLimitReached is unset', () => {
			validations.onLimitReached(undefined)
			expect(console.warn).not.toBeCalled()
			expect(console.error).not.toBeCalled()
		})
	})

	describe('draft_polli_ratelimit_headers', () => {
		it('should log a warning if draft_polli_ratelimit_headers is set', () => {
			validations.draftPolliHeaders(true)
			expect(console.warn).toBeCalled()
			expect(console.error).not.toBeCalled()
		})

		it('should not log a warning if draft_polli_ratelimit_headers is unset or false', () => {
			validations.draftPolliHeaders(false)
			expect(console.warn).not.toBeCalled()
			expect(console.error).not.toBeCalled()

			validations.draftPolliHeaders(undefined)
			expect(console.warn).not.toBeCalled()
			expect(console.error).not.toBeCalled()
		})
	})

	describe('headersResetTime', () => {
		it('should log an error if resetTime is omitted', () => {
			validations.headersResetTime(undefined)
			expect(console.error).toBeCalled()
		})

		it('should not log an error if resetTime is set', () => {
			validations.headersResetTime(new Date())
			expect(console.error).not.toBeCalled()
		})
	})

	describe('validationsConfig', () => {
		it('should log an error if an unknown validation is disabled', () => {
			validations = getValidations({ invalid: false } as any)

			validations.validationsConfig()
			expect(console.error).toBeCalled()
		})
		it('should log an error if an unknown validation is enabled', () => {
			validations = getValidations({ invalid: false } as any)

			validations.validationsConfig()
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_UNKNOWN_VALIDATION' }),
			)
		})
		it('should not log an error if only valid keys are set', () => {
			validations = getValidations({
				ip: false,
				positiveHits: true,
				default: false,
			})

			validations.validationsConfig()
			expect(console.error).not.toBeCalled()
		})
		it('should not run if disabled by config', () => {
			validations = getValidations({
				invalid: false,
				validationsConfig: false,
			} as any)

			validations.validationsConfig()
			expect(console.error).not.toBeCalled()
		})
		it('should not run if disabled by default', () => {
			validations = getValidations({
				invalid: true,
				default: false,
			} as any)

			validations.validationsConfig()
			expect(console.error).not.toBeCalled()
		})
		it('should run if enabled by config with default: false', () => {
			validations = getValidations({
				invalid: false,
				validationsConfig: true,
				default: false,
			} as any)

			validations.validationsConfig()
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_UNKNOWN_VALIDATION' }),
			)
		})
	})

	describe('disable', () => {
		it('should initialize disabled when passed false', () => {
			const disabledValidator = getValidations(false)

			disabledValidator.ip('badip')
			expect(console.error).not.toBeCalled()
		})

		it('should do nothing after disable() is called', () => {
			validations.disable()

			validations.ip('badip')
			expect(console.error).not.toBeCalled()
		})
	})
})

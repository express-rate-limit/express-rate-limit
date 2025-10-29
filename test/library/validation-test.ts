// /test/library/validation-test.ts
// Tests the validation functions

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from '@jest/globals'
import express from 'express'
import supertest from 'supertest'
import { ipKeyGenerator, MemoryStore } from '../../source/index.js'
import type { Store } from '../../source/types'
import { getValidations } from '../../source/validations.js'

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
			expect(console.error).not.toHaveBeenCalled()
		})

		it('should allow a valid IPv6', () => {
			validations.ip('1200:0000:AB00:1234:0000:2552:7777:1313')
			expect(console.error).not.toHaveBeenCalled()
		})

		it('should log an error for an invalid IP', () => {
			validations.ip('badip')
			expect(console.error).toHaveBeenCalled()
		})

		it('should log an error for an undefined IP', () => {
			validations.ip(undefined)
			expect(console.error).toHaveBeenCalled()
		})

		it('should log an error for an IPv4 with a port', () => {
			validations.ip('1.2.3.4:1234')
			expect(console.error).toHaveBeenCalled()
		})

		it('should log an error for an IPv6 with a port', () => {
			validations.ip('[1200:0000:AB00:1234:0000:2552:7777:1313]:1234')
			expect(console.error).toHaveBeenCalled()
		})
	})

	describe('trustProxy', () => {
		it('should log an error on "trust proxy" = true', () => {
			validations.trustProxy({ app: { get: () => true } } as any)
			expect(console.error).toHaveBeenCalled()
		})

		it('should not log an error on "trust proxy" != true', () => {
			validations.trustProxy({ app: { get: () => false } } as any)
			validations.trustProxy({ app: { get: () => '1.2.3.4' } } as any)
			validations.trustProxy({ app: { get: () => /1.2.3.4/ } } as any)
			validations.trustProxy({ app: { get: () => ['1.2.3.4'] } } as any)
			expect(console.error).not.toHaveBeenCalled()
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
			expect(console.error).not.toHaveBeenCalled()

			validations.xForwardedForHeader({
				app: { get: () => false },
				headers: { 'x-forwarded-for': '1.2.3.4' },
			} as any)
			expect(console.error).toHaveBeenCalled()
		})
	})

	describe('forwardedHeader', () => {
		it('should log an error when the Forwarded set to any value, but not when it is unset', () => {
			validations.forwardedHeader({
				headers: {},
				ip: '1.2.3.4',
				socket: { remoteAddress: '1.2.3.4' },
			} as any)
			expect(console.error).not.toHaveBeenCalled()

			validations.forwardedHeader({
				headers: { forwarded: '5.6.7.8' },
				ip: '1.2.3.4',
				socket: { remoteAddress: '1.2.3.4' },
			} as any)
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_FORWARDED_HEADER' }),
			)
		})

		it('should not log an error when request.ip has been set to a non-default value', () => {
			validations.forwardedHeader({
				headers: {},
				ip: '1.2.3.100',
				socket: { remoteAddress: '1.2.3.4' },
			} as any)
			expect(console.error).not.toHaveBeenCalled()

			validations.forwardedHeader({
				headers: { forwarded: '5.6.7.8' },
				ip: '1.2.3.100',
				socket: { remoteAddress: '1.2.3.4' },
			} as any)
			expect(console.error).not.toHaveBeenCalled()
		})
	})

	describe('positiveHits', () => {
		it('should log an error if hits is non-numeric', () => {
			validations.positiveHits(true)
			expect(console.error).toHaveBeenCalled()
		})

		it('should log an error if hits is less than 1', () => {
			validations.positiveHits(0)
			expect(console.error).toHaveBeenCalled()
		})

		it('should log an error if hits is not an integer', () => {
			validations.positiveHits(1.5)
			expect(console.error).toHaveBeenCalled()
		})

		it('should not log an error if hits is a positive integer', () => {
			validations.positiveHits(1)
			expect(console.error).not.toHaveBeenCalled()
		})
	})

	describe('unsharedStore', () => {
		it('should log an error if a store instance is used in two limiters', () => {
			const store = { localKeys: true }

			validations.unsharedStore(store as Store)
			expect(console.error).not.toHaveBeenCalled()
			validations.unsharedStore(store as Store)
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({
					code: 'ERR_ERL_STORE_REUSE',
				}),
			)
		})

		it('should log a different error for stores without local keys', () => {
			const store = { localKeys: false }

			validations.unsharedStore(store as Store)
			expect(console.error).not.toHaveBeenCalled()
			validations.unsharedStore(store as Store)
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({
					code: 'ERR_ERL_STORE_REUSE',
					message: expect.stringContaining('unique prefix'),
				}),
			)
		})

		it('should not log an error if multiple store instances are used', () => {
			const store1 = { localKeys: true }
			const store2 = { localKeys: true }

			validations.unsharedStore(store1 as Store)
			validations.unsharedStore(store2 as Store)
			expect(console.error).not.toHaveBeenCalled()
		})
	})

	describe('singleCount', () => {
		class TestExternalStore {
			prefix?: string
		}

		it('should log an error if a request is double-counted with a MemoryStore', () => {
			const request = {}
			const store = { localKeys: true }
			const key = '1.2.3.4'

			validations.singleCount(request as any, store as Store, key)
			expect(console.error).not.toHaveBeenCalled()
			validations.singleCount(request as any, store as Store, key)
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({
					code: 'ERR_ERL_DOUBLE_COUNT',
				}),
			)
		})

		it('should log an error if a request is double-counted with an external store', () => {
			const request = {}
			const store = new TestExternalStore()
			const key = '1.2.3.4'

			validations.singleCount(request as any, store as Store, key)
			expect(console.error).not.toHaveBeenCalled()
			validations.singleCount(request as any, store as Store, key)
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({
					code: 'ERR_ERL_DOUBLE_COUNT',
				}),
			)
		})

		it('should not log an error if a request is double-counted with separate instances of MemoryStore', () => {
			const request = {}
			const store1 = { localKeys: true }
			const store2 = { localKeys: true }
			const key = '1.2.3.4'

			validations.singleCount(request as any, store1 as Store, key)
			validations.singleCount(request as any, store2 as Store, key)
			expect(console.error).not.toHaveBeenCalled()
		})

		it('should log an error if a request is double-counted with separate instances of an external store', () => {
			const request = {}
			const store1 = new TestExternalStore()
			const store2 = new TestExternalStore()
			const key = '1.2.3.4'

			validations.singleCount(request as any, store1 as Store, key)
			validations.singleCount(request as any, store2 as Store, key)
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({
					code: 'ERR_ERL_DOUBLE_COUNT',
				}),
			)
		})

		it('should not log an error for multiple requests from the same key', () => {
			const request1 = {}
			const request2 = {}
			const store = { localKeys: true }
			const key = '1.2.3.4'

			validations.singleCount(request1 as any, store as Store, key)
			expect(console.error).not.toHaveBeenCalled()
			validations.singleCount(request2 as any, store as Store, key)
			expect(console.error).not.toHaveBeenCalled()
		})

		it('should not log an error if a request is double-counted with separate instances of an external store with different prefixes', () => {
			const request = {}
			const store1 = new TestExternalStore()
			store1.prefix = 's1'
			const store2 = new TestExternalStore()
			store2.prefix = 's2'
			const key = '1.2.3.4'

			validations.singleCount(request as any, store1 as Store, key)
			validations.singleCount(request as any, store2 as Store, key)
			expect(console.error).not.toHaveBeenCalled()
		})
	})

	describe('limit', () => {
		it('should log a warning if max is set to 0', () => {
			validations.limit(0)
			expect(console.warn).toHaveBeenCalled()
		})

		it('should not log a warning if max is set to a non zero number', () => {
			validations.limit(3)
			expect(console.warn).not.toHaveBeenCalled()
		})
	})

	describe('onLimitReached', () => {
		it('should log a warning if onLimitReached is set', () => {
			validations.onLimitReached(() => {})
			expect(console.warn).toHaveBeenCalled()
			expect(console.error).not.toHaveBeenCalled()
		})

		it('should not log a warning if onLimitReached is unset', () => {
			validations.onLimitReached(undefined)
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).not.toHaveBeenCalled()
		})
	})

	describe('draft_polli_ratelimit_headers', () => {
		it('should log a warning if draft_polli_ratelimit_headers is set', () => {
			validations.draftPolliHeaders(true)
			expect(console.warn).toHaveBeenCalled()
			expect(console.error).not.toHaveBeenCalled()
		})

		it('should not log a warning if draft_polli_ratelimit_headers is unset or false', () => {
			validations.draftPolliHeaders(false)
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).not.toHaveBeenCalled()

			validations.draftPolliHeaders(undefined)
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).not.toHaveBeenCalled()
		})
	})

	describe('headersDraftVersion', () => {
		it('should log an error if standardHeaders is an unsupported version', () => {
			validations.headersDraftVersion('draft-2')
			expect(console.error).toHaveBeenCalled()
		})

		it('should not log an error a valid version is passed as standardHeaders', () => {
			validations.headersDraftVersion('draft-8')
			expect(console.error).not.toHaveBeenCalled()
		})
	})

	describe('headersResetTime', () => {
		it('should log an error if resetTime is omitted', () => {
			validations.headersResetTime(undefined)
			expect(console.error).toHaveBeenCalled()
		})

		it('should not log an error if resetTime is set', () => {
			validations.headersResetTime(new Date())
			expect(console.error).not.toHaveBeenCalled()
		})
	})

	describe('knownOptions', () => {
		it('should log an error if an unknown option is passed in', () => {
			validations.knownOptions({ windowMS: 100 } as any)
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_UNKNOWN_OPTION' }),
			)
		})
	})

	describe('validationsConfig', () => {
		it('should log an error if an unknown validation is disabled', () => {
			validations = getValidations({ invalid: false } as any)

			validations.validationsConfig()
			expect(console.error).toHaveBeenCalled()
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
			expect(console.error).not.toHaveBeenCalled()
		})
		it('should not run if disabled by config', () => {
			validations = getValidations({
				invalid: false,
				validationsConfig: false,
			} as any)

			validations.validationsConfig()
			expect(console.error).not.toHaveBeenCalled()
		})
		it('should not run if disabled by default', () => {
			validations = getValidations({
				invalid: true,
				default: false,
			} as any)

			validations.validationsConfig()
			expect(console.error).not.toHaveBeenCalled()
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
			expect(console.error).not.toHaveBeenCalled()
		})

		it('should do nothing after disable() is called', () => {
			validations.disable()

			validations.ip('badip')
			expect(console.error).not.toHaveBeenCalled()
		})
	})

	describe('creationStack', () => {
		it('should log an error if called in an express request handler with a memory store', async () => {
			const app = express()
			const store = new MemoryStore()

			app.get('/', (request, response) => {
				validations.creationStack(store)
				response.send('hello')
			})

			await supertest(app).get('/').expect('hello')
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_CREATED_IN_REQUEST_HANDLER' }),
			)
			expect(console.warn).not.toHaveBeenCalled()
		})

		it('should log a different error when used with an external store', async () => {
			const app = express()
			const store: Store = { localKeys: false } as any

			app.get('/', (request, response) => {
				validations.creationStack(store)
				response.send('hello')
			})

			await supertest(app).get('/').expect('hello')
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_CREATED_IN_REQUEST_HANDLER' }),
			)
			expect(console.warn).not.toHaveBeenCalled()
		})

		it('should not log an error if called elsewhere', async () => {
			const store = new MemoryStore()

			validations.creationStack(store)
			expect(console.error).not.toHaveBeenCalled()
			expect(console.warn).not.toHaveBeenCalled()
		})
	})

	describe('ipv6Subnet', () => {
		it('should allow numbers in the 32-64 range', () => {
			for (let i = 32; i <= 64; i++) {
				validations.ipv6Subnet(i)
			}

			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).not.toHaveBeenCalled()
		})

		it('should allow false', () => {
			validations.ipv6Subnet(false)
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).not.toHaveBeenCalled()
		})

		it('should error on numbers below 32', () => {
			validations.ipv6Subnet(31)
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_IPV6_SUBNET' }),
			)
		})

		it('should error on numbers above 64', () => {
			validations.ipv6Subnet(65)
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_IPV6_SUBNET' }),
			)
		})

		it('should error on non-integer numbers', () => {
			validations.ipv6Subnet(48.5)
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_IPV6_SUBNET' }),
			)
		})

		it('should error on undefined (return value from configured function)', () => {
			validations.ipv6Subnet(undefined)
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_IPV6_SUBNET' }),
			)
		})
	})

	describe('ipv6SubnetOrKeyGenerator', () => {
		it('should allow one or the other (or none)', () => {
			validations.ipv6SubnetOrKeyGenerator({})
			validations.ipv6SubnetOrKeyGenerator({ ipv6Subnet: 64 })
			validations.ipv6SubnetOrKeyGenerator({
				keyGenerator: (request, response) => 'global',
			})
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).not.toHaveBeenCalled()
		})

		it('should warn on both', () => {
			validations.ipv6SubnetOrKeyGenerator({
				ipv6Subnet: 64,
				keyGenerator: (request, response) => 'global',
			})
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_IPV6SUBNET_OR_KEYGENERATOR' }),
			)
		})

		it('should warn on both when ipv6Subnet is false', () => {
			validations.ipv6SubnetOrKeyGenerator({
				ipv6Subnet: false,
				keyGenerator: (request, response) => 'global',
			})
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_IPV6SUBNET_OR_KEYGENERATOR' }),
			)
		})
	})

	describe('keyGeneratorIpFallback', () => {
		it('should skip on undefined keyGenerator', () => {
			validations.keyGeneratorIpFallback(undefined)
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).not.toHaveBeenCalled()
		})

		it('should not warn on a keyGenerator that does not use req.ip or request.ip', () => {
			validations.keyGeneratorIpFallback(
				(request: any, response: any): string =>
					request.params.apikey as string,
			)
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).not.toHaveBeenCalled()
		})

		it('should warn on a keyGenerator that uses req.ip', () => {
			validations.keyGeneratorIpFallback(
				(request: any, response: any): string =>
					(request.params.apikey || request.ip) as string,
			)
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_KEY_GEN_IPV6' }),
			)
		})

		it('should warn on a keyGenerator that uses request.ip', () => {
			validations.keyGeneratorIpFallback(
				(request: any, response: any) =>
					(request.params.apikey || request.ip) as string,
			)
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_KEY_GEN_IPV6' }),
			)
		})

		it('should not warn on a keyGenerator that uses request.ip and ipKeyGenerator', () => {
			validations.keyGeneratorIpFallback(
				(request: any, response: any): string =>
					(request.params.apikey as string) || ipKeyGenerator(request.ip),
			)
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).not.toHaveBeenCalled()
		})
	})

	describe('windowMs', () => {
		it('should warn on large values, but not in-range values', () => {
			validations.windowMs(5 * 60 * 1000)
			expect(console.warn).not.toHaveBeenCalled()
			expect(console.error).not.toHaveBeenCalled()

			validations.windowMs(30 * 24 * 60 * 60 * 1000)
			expect(console.error).toHaveBeenCalledWith(
				expect.objectContaining({ code: 'ERR_ERL_WINDOW_MS' }),
			)
		})
	})
})

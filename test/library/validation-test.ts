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
import { Validations } from '../../source/validations.js'

describe('validations tests', () => {
	let validations = new Validations(true)

	beforeEach(() => {
		jest.spyOn(console, 'error').mockImplementation(() => {})
	})
	afterEach(() => {
		jest.restoreAllMocks()
		validations = new Validations(true)
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

	describe('disable', () => {
		it('should initialize disabled when passed false', () => {
			const disabledValidator = new Validations(false)
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

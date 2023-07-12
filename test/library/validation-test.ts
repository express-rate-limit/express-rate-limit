// /test/library/validation-test.ts
// Tests the validation functions

import { expect, jest } from '@jest/globals'
import { validateIp } from '../../source/validations.js'

describe('validations tests', () => {
	beforeEach(() => {
		jest.spyOn(console, 'error')
	})
	afterEach(() => {
		jest.restoreAllMocks()
	})

	// This one is a little more extensive because we're also testing the privat
	// `runCheck` method.
	describe('validateIp', () => {
		it('should do nothing when validation is off', () => {
			validateIp(false, 'badip')
			expect(console.error).not.toBeCalled()
		})

		it('should allow a valid IPv4', () => {
			validateIp(true, '1.2.3.4')
			expect(console.error).not.toBeCalled()
		})

		it('should allow a valid IPv6', () => {
			validateIp(true, '1200:0000:AB00:1234:0000:2552:7777:1313')
			expect(console.error).not.toBeCalled()
		})

		it('should log an error for an invalid IP', () => {
			validateIp(true, 'badip')
			expect(console.error).toBeCalled()
		})

		it('shoud log an error for an undefined IP', () => {
			validateIp(true, undefined)
			expect(console.error).toBeCalled()
		})
	})
})

// /test/library/validation-test.ts
// Tests the validation functions

import { expect, jest, test } from '@jest/globals'
import { ValidationLevel } from '../../source/types.js'
import { validateIp } from '../../source/validations.js'

describe('validations tests', () => {
	beforeEach(() => {
		jest.spyOn(console, 'warn')
	})
	afterEach(() => {
		jest.restoreAllMocks()
	})

	// This one is a little more extensive because we're also testing the privat
	// `runCheck` method.
	describe('validateIp', () => {
		it('should do nothing when validation is off', () => {
			validateIp(ValidationLevel.Off, 'badip')
			expect(console.warn).not.toBeCalled()
		})

		it('should allow a valid IPv4', () => {
			validateIp(ValidationLevel.Warn, '1.2.3.4')
			expect(console.warn).not.toBeCalled()
		})

		it('should allow a valid IPv6', () => {
			validateIp(
				ValidationLevel.Warn,
				'1200:0000:AB00:1234:0000:2552:7777:1313',
			)
			expect(console.warn).not.toBeCalled()
		})

		it('warn for an invalid IP', () => {
			validateIp(ValidationLevel.Warn, 'badip')
			expect(console.warn).toBeCalled()
		})

		it('warn for an undefined IP', () => {
			validateIp(ValidationLevel.Warn, undefined as string)
			expect(console.warn).toBeCalled()
		})

		it('throw for an invalid IP when validation level is Throw', () => {
			expect(() => validateIp(ValidationLevel.Throw, 'badip')).toThrow()
		})
	})
})

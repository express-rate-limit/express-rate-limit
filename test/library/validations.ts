import { expect, jest, test } from '@jest/globals'
import { ValidationLevel } from '../../source.js'
import { validateIP } from '../../source/validations.js'

describe('validations tests', () => {
	beforeEach(() => {
		jest.spyOn(console, 'warn')
	})
	afterEach(() => {
		jest.restoreAllMocks()
	})
	// This one is a little more extensive because we're also testing the private runCheck method.
	describe('validateIP', () => {
		it('should do nothing when validation is off', () => {
			validateIP(ValidationLevel.Off, 'badip')
			expect(console.warn).not.toBeCalled()
		})
		it('should allow a valid IPv4', () => {
			validateIP(ValidationLevel.Warn, '1.2.3.4')
			expect(console.warn).not.toBeCalled()
		})
		it('should allow a valid IPv6', () => {
			validateIP(
				ValidationLevel.Warn,
				'1200:0000:AB00:1234:0000:2552:7777:1313',
			)
			expect(console.warn).not.toBeCalled()
		})
		it('warn for an invalid IP', () => {
			validateIP(ValidationLevel.Warn, 'badip')
			expect(console.warn).toBeCalled()
		})
		it('warn for an undefined IP', () => {
			validateIP(ValidationLevel.Warn, undefined as any)
			expect(console.warn).toBeCalled()
		})
		it('throw for an invalid IP when validation level is Throw', () => {
			expect(() => validateIP(ValidationLevel.Throw, 'badip')).toThrow()
		})
	})
})

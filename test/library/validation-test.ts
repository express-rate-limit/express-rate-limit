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
	beforeEach(() => {
		jest.spyOn(console, 'error').mockImplementation(() => {})
	})
	afterEach(() => {
		jest.restoreAllMocks()
	})

	// This one is a little more extensive because we're also testing the privat
	// `runCheck` method.
	describe('validateIp', () => {
		const enabledValidator = new Validations(true)
		const disabledValidator = new Validations(false)

		it('should do nothing when validation is off', () => {
			disabledValidator.ip('badip')
			expect(console.error).not.toBeCalled()
		})

		it('should allow a valid IPv4', () => {
			enabledValidator.ip('1.2.3.4')
			expect(console.error).not.toBeCalled()
		})

		it('should allow a valid IPv6', () => {
			enabledValidator.ip('1200:0000:AB00:1234:0000:2552:7777:1313')
			expect(console.error).not.toBeCalled()
		})

		it('should log an error for an invalid IP', () => {
			enabledValidator.ip('badip')
			expect(console.error).toBeCalled()
		})

		it('shoud log an error for an undefined IP', () => {
			enabledValidator.ip(undefined)
			expect(console.error).toBeCalled()
		})
	})
})

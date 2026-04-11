import { afterEach, beforeEach, expect } from '@jest/globals'
import { ConsoleLogger } from '../../source/console-logger'

describe('ConsoleLogger', () => {
	beforeEach(() => {
		jest.spyOn(console, 'warn').mockImplementation(() => {})
		jest.spyOn(console, 'error').mockImplementation(() => {})
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	describe('error', () => {
		const error = new Error('Mock Error')

		it('forwards the call to the console', () => {
			ConsoleLogger.error(error)

			expect(console.error).toHaveBeenCalledWith(error)
		})

		it('logs the message first if provided', () => {
			ConsoleLogger.error(error, 'An error occurred')

			expect(console.error).toHaveBeenCalledWith('An error occurred', error)
		})
	})

	describe('warn', () => {
		const error = new Error('Mock Error')

		it('forwards the call to the console', () => {
			ConsoleLogger.warn(error)

			expect(console.warn).toHaveBeenCalledWith(error)
		})

		it('logs the message first if provided', () => {
			ConsoleLogger.warn(error, 'An error occurred')

			expect(console.warn).toHaveBeenCalledWith('An error occurred', error)
		})
	})
})

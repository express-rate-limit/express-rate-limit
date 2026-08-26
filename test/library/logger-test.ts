import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConsoleLogger } from '../../source/console-logger'

describe('ConsoleLogger', () => {
	beforeEach(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		vi.spyOn(console, 'error').mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
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

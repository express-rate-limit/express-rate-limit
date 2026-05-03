import type { Logger } from './types'

export const ConsoleLogger: Logger = {
	warn(...args): void {
		console.warn(...args.reverse())
	},
	error(...args) {
		console.error(...args.reverse())
	},
}

/**
 * A logger that also prints debug messages to the console.
 * Debug logging is opt-in — use this instead of `ConsoleLogger` when you want
 * forensic visibility into the rate-limiting process.
 */
export const DebugConsoleLogger: Logger = {
	...ConsoleLogger,
	debug(message: string, context?: unknown): void {
		console.debug(message, context)
	},
}

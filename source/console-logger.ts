import type { Logger } from './types.js'

export const ConsoleLogger: Logger = {
	warn(...args): void {
		console.warn(...args.reverse())
	},
	error(...args) {
		console.error(...args.reverse())
	},
}

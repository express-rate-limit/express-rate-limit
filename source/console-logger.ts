import type { Logger } from './types'

export const ConsoleLogger: Logger = {
	warn(...args): void {
		console.warn(...args.reverse())
	},
	error(...args) {
		console.error(...args.reverse())
	},
	debug(...args) {
		console.debug(...args.reverse())
	},
}

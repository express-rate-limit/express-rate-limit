export type LoggerFn = (context: unknown, message?: string) => void

export type Logger = {
	error: LoggerFn
	warn: LoggerFn
}

export const ConsoleLogger: Logger = {
	warn(...args): void {
		console.warn(...args.reverse())
	},
	error(...args) {
		console.error(...args.reverse())
	},
}

// /test/helpers/create-server.ts
// Create an Express server for testing

import createApp, {
	type Application,
	type Request,
	type RequestHandler,
	type Response,
} from 'express'

/**
 * Create an Express server with the given middleware
 *
 * @param middleware {RequestHandler | RequestHandler[]} - The middleware
 *
 * @returns {Express.Application} - The express server
 */
export const createServer = (
	middleware: RequestHandler | RequestHandler[],
): Application => {
	// Create an Express server
	const app = createApp()

	// Use the middleware
	app.use(middleware)

	// Register test routes
	app.all('/', (_request: Request, response: Response) => {
		response.send('Hi there!')
	})
	app.get('/error', (_request: Request, response: Response) => {
		response.sendStatus(400)
	})
	app.post('/crash', (_request: Request, response: Response) => {
		response.emit('error', new Error('Oops!'))
		response.end()
	})

	// Return the application instance
	return app
}

// /test/helpers/create-server.ts
// Create an Express server for testing

import Express from 'express'

/**
 * Create an Express server with the given middleware
 *
 * @param middleware {Express.RequestHandler | Express.RequestHandler[]} - The middleware
 *
 * @returns {Express.Application} - The express server
 */
export const createServer = (
	middleware: Express.RequestHandler | Express.RequestHandler[],
): Express.Application => {
	// Create an Express server
	const app = Express() // eslint-disable-line new-cap

	// Use the middleware
	app.use(middleware)
	// Register test routes
	app.all('/', (_request, response) => {
		response.send('Hi there!')
	})
	app.get('/error', (_request, response) => {
		response.sendStatus(400)
	})
	app.post('/crash', (_request, response) => {
		response.on('error', () => {
			response.end()
		})

		response.emit('error', new Error('Oops!'))
	})

	// Return the application instance
	return app
}

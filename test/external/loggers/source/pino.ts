// @/index.ts
// Test app test app

import createServer from 'express'
import rateLimit, { MemoryStore } from 'express-rate-limit'

import pino from 'pino-http'

export const logger = pino()
export const store = new MemoryStore()
export const app = createServer()

app.use(logger)

app.use(
	rateLimit({
		limit: 3,
		message: 'Thou must enhanceth thy peace',
		store,
		logger: logger.logger,
		passOnStoreError: true,
	}),
)

app.get('/', (request, response) => {
	response.send(`We welcome thee ${request.body?.name}`)
})

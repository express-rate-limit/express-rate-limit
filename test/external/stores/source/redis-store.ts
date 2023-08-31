// @/index.ts
// Test app test app

import createServer from 'express'
import rateLimit from 'express-rate-limit'

import RedisStore from 'rate-limit-redis'
import { createClient } from 'redis'

const app = createServer()
const client = createClient()
await client.connect()

app.use(
	rateLimit({
		limit: 3,
		message: 'Thou must enhanceth thy peace',
		store: new RedisStore({
			sendCommand: (...args: string[]) => client.sendCommand(args),
		}),
	}),
)

app.get('/', (request, response) => {
	response.send(`We welcome thee ${request.body?.name}`)
})

export default app

// @/index.ts
// Test app test app

import createServer from 'express'
import rateLimit from 'express-rate-limit'

import RedisStore from 'rate-limit-redis'

const app = createServer()
app.use(
	rateLimit({
		max: 3,
		message: 'Thou must enhanceth thy peace',
		store: new RedisStore(),
	}),
)

app.get('/', (request, response) => {
	response.send(`We welcome thee ${request.body?.name}`)
})

export default app

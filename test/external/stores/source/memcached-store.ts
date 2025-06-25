// @/index.ts
// Test app test app

import createServer from 'express'
import rateLimit from 'express-rate-limit'

import { MemcachedStore } from 'rate-limit-memcached'

const app = createServer()
app.use(
	rateLimit({
		limit: 3,
		message: 'Thou must enhanceth thy peace',
		store: new MemcachedStore(),
	}),
)

app.get('/', (request, response) => {
	response.send(`We welcome thee ${request.body?.name}`)
})

export default app

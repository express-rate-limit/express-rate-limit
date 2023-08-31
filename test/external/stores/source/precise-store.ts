// @/index.ts
// Test app test app

import createServer from 'express'
import rateLimit from 'express-rate-limit'

// @ts-expect-error
import PreciseMemoryStore from 'precise-memory-rate-limit'

const app = createServer()
app.use(
	rateLimit({
		limit: 3,
		message: 'Thou must enhanceth thy peace',
		store: new PreciseMemoryStore(60 * 1000, 3),
	}),
)

app.get('/', (request, response) => {
	response.send(`We welcome thee ${request.body?.name}`)
})

export default app

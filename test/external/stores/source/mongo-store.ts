// @/index.ts
// Test app test app

import createServer from 'express'
import rateLimit from 'express-rate-limit'

// @ts-expect-error - no type definitions
import MongoStore from 'rate-limit-mongo'

const app = createServer()
app.use(
	rateLimit({
		limit: 3,
		message: 'Thou must enhanceth thy peace',
		store: new MongoStore({
			uri: 'mongodb://127.0.0.1:27017/test_db',
			errorHandler: console.error.bind(null, 'rate-limit-mongo'),
		}),
	}),
)

app.get('/', (request, response) => {
	response.send(`We welcome thee ${request.body?.name}`)
})

export default app

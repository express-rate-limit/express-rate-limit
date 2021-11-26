import rateLimit = require('../dist/express-rate-limit')

describe('express-rate-limit typescript typings', function () {
	it('should work with non-string messages', () => {
		rateLimit({
			message: { json: 'object' },
		})
		rateLimit({
			message: Buffer.from(`I'm a buffer!`),
		})
	})
})

import { ConsoleLogger, Controller, Get, Logger, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import rateLimit, { MemoryStore } from 'express-rate-limit'

@Controller()
export class AppController {
	@Get()
	hello() {
		return 'Hello World!'
	}
}

@Module({
	controllers: [AppController],
})
export class AppModule {}

export async function boostrap() {
	const app = await NestFactory.create(AppModule, {
		logger: new ConsoleLogger({ json: true }),
	})
	const store = new MemoryStore()
	const logger = new Logger('express-rate-limit')

	app.use(
		rateLimit({
			limit: 3,
			message: 'Thou must enhanceth thy peace',
			store,
			logger: {
				error: (error, message) => {
					if (message) {
						logger.error(message, error)
					} else {
						logger.error(error)
					}
				},
				warn: (error, message) => {
					if (message) {
						logger.warn(message, error)
					} else {
						logger.warn(error)
					}
				},
			},
			passOnStoreError: true,
		}),
	)

	await app.listen(0)

	return { app, logger, store }
}

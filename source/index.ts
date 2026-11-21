// /source/index.ts
// Export away!

import { deprecate } from 'node:util'
import rateLimit from './rate-limit.js'

// Export the IP address based key generator in case someone wants to use it.
export { ipKeyGenerator } from './ip-key-generator.js'

// Export the memory store in case someone wants to use or extend it
// (see https://github.com/nfriedly/express-rate-limit/issues/289)
export { MemoryStore } from './memory-store.js'

// Export the rateLimit function as a named export.
export { rateLimit }

/**
 * Create an instance of IP rate-limiting middleware for Express.
 *
 * @deprecated Use the named export `rateLimit` instead.
 */
const deprecatedRateLimit = deprecate(
	rateLimit,
	"The default export of express-rate-limit is deprecated and will be removed in the next major version. Use the named export instead: import { rateLimit } from 'express-rate-limit'. See https://express-rate-limit.github.io/WRN_ERL_DEPRECATED_DEFAULT_EXPORT/ for more information.",
	'WRN_ERL_DEPRECATED_DEFAULT_EXPORT',
)

// This will be deprecated in the next major version.
export default deprecatedRateLimit

// DAY, HOUR, MINUTE, & SECOND constants for more readable windowMS configurations
export * from './time-constants.js'

// Export all the types as named exports
export * from './types.js'

// /source/index.ts
// Export away!

// Export the IP address based key generator in case someone wants to use it.
export { ipKeyGenerator } from './ip-key-generator.js'

// Export the memory store in case someone wants to use or extend it
// (see https://github.com/nfriedly/express-rate-limit/issues/289)
export { MemoryStore } from './memory-store.js'

// Export the rateLimit function as a named export
export { rateLimit } from './rate-limit.js'

// DAY, HOUR, MINUTE, & SECOND constants for more readable windowMS configurations
export * from './time-constants.js'

// Export all the types as named exports
export * from './types.js'

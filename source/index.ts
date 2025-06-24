// /source/index.ts
// Export away!

// Export the IP address based key generator in case someone wants to use it.
export { ipKeyGenerator } from './ip-key-generator.js'
// Export the memory store in case someone wants to use or extend it
// (see https://github.com/nfriedly/express-rate-limit/issues/289)
export { default as MemoryStore } from './memory-store.js'
// Export the rateLimit function as a default export and as a named export, if
// the default export does not work (see https://github.com/nfriedly/express-rate-limit/issues/280)
export { default, default as rateLimit } from './rate-limit.js'
// Export all the types as named exports
export * from './types.js'

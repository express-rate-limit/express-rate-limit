// /source/index.ts
// Export away!

// Export all the types as named exports
export * from './types.js'

// Export the rateLimit function as a default export and as a named export, if
// the default export does not work (see https://github.com/nfriedly/express-rate-limit/issues/280)
export { default, default as rateLimit } from './lib.js'

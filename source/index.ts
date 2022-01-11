// /source/index.ts
// Export away!

import rateLimit from './lib.js'

// Export all the types as named exports
export * from './types.js'

// Export the rateLimit function as a default export
// https://github.com/timocov/dts-bundle-generator/issues/182
// eslint-disable-next-line unicorn/prefer-export-from
export default rateLimit

// Also export it as a named export if the default export does not work
// (see https://github.com/nfriedly/express-rate-limit/issues/280)

export { default as rateLimit } from './lib.js'

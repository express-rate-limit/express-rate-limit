// /source/index.ts
// Export away!

import rateLimit from './lib.js'

export * from './types.js'
// https://github.com/timocov/dts-bundle-generator/issues/182
// eslint-disable-next-line unicorn/prefer-export-from
export default rateLimit

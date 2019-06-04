import { Options, RateLimitRequestHandler } from './types.js';
/**
 *
 * Create an instance of IP rate-limiting middleware for Express.
 *
 * @param passedOptions {Options} - Options to configure the rate limiter
 *
 * @returns {RateLimitRequestHandler} - The middleware that rate-limits clients based on your configuration
 *
 * @public
 */
declare const rateLimit: (passedOptions?: Partial<Options> | undefined) => RateLimitRequestHandler;
export default rateLimit;

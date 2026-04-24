import type { RequestHandler } from 'express';
import rateLimit from '../source/rate-limit';
import type { RateLimitRequestHandler } from '../source/types';

// Define some custom types for our Express route
interface CustomParams {
    id: string;
}

interface CustomRes {
    message: string;
}

interface CustomReq {
    name: string;
}

interface CustomQuery {
    token: string;
}

// Create a rate limiter
const limiter: RateLimitRequestHandler<CustomParams, CustomRes, CustomReq, CustomQuery> = rateLimit();

// Verify it can be used as a RequestHandler with the same generics
const handler: RequestHandler<CustomParams, CustomRes, CustomReq, CustomQuery> = limiter;

console.log('Types are compatible!');

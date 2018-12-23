import { RequestHandler, Request, Response, NextFunction } from 'express';

export interface Options {
    max?: number;
    message?: string;
    headers?: boolean;
    windowMs?: number;
    statusCode?: number;
    skipFailedRequests?: boolean;
    skipSuccessfulRequests?: boolean;
    skip?(req?: Request, res?: Response): boolean;
    onLimitReached?(req?: Request, res?: Response): void;
    handler?(req: Request, res: Response, next?: NextFunction): void;
    keyGenerator?(req: Request, res?: Response): string | Request['ip'];
}

export interface Store {
    constructor(windowMs: number);
    hits: {
        [key: string]: number;
    };
    resetAll(): void;
    resetTime: number;
    setInterval: NodeJS.Timeout;
    resetKey(key: string | any): void;
    decrement(key: string | any): void;
    incr(key: string | any, cb: (err?: Error, hits?: number) => void): void;
}

export interface ExpressLimiterInterface {
    (options: Options): (req: Request, res: Response, next: NextFunction) => void;
}

declare const ExpressRateLimiter: ExpressLimiterInterface;

export default ExpressRateLimiter;
import { RequestHandler, Request, Response, NextFunction } from "express";

declare namespace RateLimit {}

interface Options {
  max?: number;
  message?: any;
  headers?: boolean;
  windowMs?: number;
  store?: Store | any;
  statusCode?: number;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;

  skip?(req?: Request, res?: Response): boolean;

  onLimitReached?(req?: Request, res?: Response): void;

  handler?(req: Request, res: Response, next?: NextFunction): void;

  keyGenerator?(req: Request, res?: Response): string | Request["ip"];
}

interface Store {
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

interface RateLimitReturnType {
  (req: Request, res: Response, next: NextFunction): void;
}

declare function RateLimit(options?: Options): RateLimitReturnType;

export = RateLimit;

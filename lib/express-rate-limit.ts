import MemoryStore = require("./memory-store");
import express = require("express");

namespace RateLimit {
  export type IncrCallback = (
    error: any,
    hit: number,
    resetTime: Date | undefined
  ) => void;

  export interface Store {
    incr(key: string, cb: IncrCallback): void;
    decrement(key: string): void;
    resetAll(): void;
    resetKey(key: string): void;
  }

  export interface Options {
    readonly windowMs: number; // milliseconds - how long to keep records of requests in memory
    readonly max:
      | number
      | ((req: express.Request, res: express.Response) => number); // max number of recent connections during `window` milliseconds before sending a 429 response
    readonly message: any;
    readonly statusCode: number; // 429 status = Too Many Requests (RFC 6585)
    readonly headers: boolean; // Send custom rate limit header with limit and remaining
    readonly draft_polli_ratelimit_headers: boolean; // Support for the new RateLimit standardization headers
    readonly skipFailedRequests: boolean; // Do not count failed requests (status >= 400)
    readonly skipSuccessfulRequests: boolean; // Do not count successful requests (status < 400)
    // allows to create custom keys (by default user IP is used)
    readonly keyGenerator: (
      req: express.Request,
      res: express.Response
    ) => string;
    readonly skip: (req: express.Request, res: express.Response) => boolean;
    readonly handler: express.RequestHandler;
    readonly onLimitReached: (
      req: express.Request,
      res: express.Response,
      optionsUsed: Options
    ) => void;
    readonly store: Store;
  }

  export interface AugmentedRequest extends express.Request {
    rateLimit: RateLimitInfo;
  }

  export interface RateLimitInfo {
    readonly limit: number;
    readonly current: number;
    readonly remaining: number;
    readonly resetTime: Date | undefined;
  }
}

type RateLimit = express.RequestHandler & {
  readonly resetKey: RateLimit.Store["resetKey"];
  readonly resetIp: RateLimit.Store["resetKey"];
  readonly getRateLimit: (
    req: express.Request
  ) => RateLimit.RateLimitInfo | undefined;
};

function handleOptions(
  incomingOptions: Partial<RateLimit.Options>
): RateLimit.Options {
  const {
    windowMs = 60 * 1000,
    store = new MemoryStore(windowMs)
  } = incomingOptions;

  const options: RateLimit.Options = {
    windowMs,
    store,
    max: 5,
    message: "Too many requests, please try again later.",
    statusCode: 429,
    headers: true,
    draft_polli_ratelimit_headers: false,
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    keyGenerator: function(req) {
      return req.ip;
    },
    skip: function() {
      return false;
    },
    handler: function(req, res) {
      res.status(options.statusCode).send(options.message);
    },
    onLimitReached: function() {},
    ...incomingOptions
  };

  // ensure that the store has the incr method
  if (
    typeof options.store.incr !== "function" ||
    typeof options.store.resetKey !== "function" ||
    (options.skipFailedRequests &&
      typeof options.store.decrement !== "function")
  ) {
    throw new Error("The store is not valid.");
  }

  ["global", "delayMs", "delayAfter"].forEach(key => {
    // note: this doesn't trigger if delayMs or delayAfter are set to 0, because that essentially disables them
    if ((options as any)[key]) {
      throw new Error(
        `The ${key} option was removed from express-rate-limit v3.`
      );
    }
  });

  return options;
}

function RateLimit(incomingOptions: Partial<RateLimit.Options>): RateLimit {
  const options = handleOptions(incomingOptions);

  function rateLimit(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    Promise.resolve(options.skip(req, res))
      .then(skip => {
        if (skip) {
          return next();
        }

        const augmentedReq = req as RateLimit.AugmentedRequest;

        const key = options.keyGenerator(req, res);

        options.store.incr(key, function(err, current, resetTime) {
          if (err) {
            return next(err);
          }

          const maxResult =
            typeof options.max === "function"
              ? options.max(req, res)
              : options.max;

          Promise.resolve(maxResult)
            .then(max => {
              augmentedReq.rateLimit = {
                limit: max,
                current: current,
                remaining: Math.max(max - current, 0),
                resetTime: resetTime
              };

              if (options.headers && !res.headersSent) {
                res.setHeader("X-RateLimit-Limit", max);
                res.setHeader(
                  "X-RateLimit-Remaining",
                  augmentedReq.rateLimit.remaining
                );
                if (resetTime instanceof Date) {
                  // if we have a resetTime, also provide the current date to help avoid issues with incorrect clocks
                  res.setHeader("Date", new Date().toUTCString());
                  res.setHeader(
                    "X-RateLimit-Reset",
                    Math.ceil(resetTime.getTime() / 1000)
                  );
                }
              }
              if (options.draft_polli_ratelimit_headers && !res.headersSent) {
                res.setHeader("RateLimit-Limit", max);
                res.setHeader(
                  "RateLimit-Remaining",
                  augmentedReq.rateLimit.remaining
                );
                if (resetTime) {
                  const deltaSeconds = Math.ceil(
                    (resetTime.getTime() - Date.now()) / 1000
                  );
                  res.setHeader("RateLimit-Reset", Math.max(0, deltaSeconds));
                }
              }

              if (
                options.skipFailedRequests ||
                options.skipSuccessfulRequests
              ) {
                let decremented = false;
                const decrementKey = () => {
                  if (!decremented) {
                    options.store.decrement(key);
                    decremented = true;
                  }
                };

                if (options.skipFailedRequests) {
                  res.on("finish", function() {
                    if (res.statusCode >= 400) {
                      decrementKey();
                    }
                  });

                  res.on("close", () => {
                    if (!res.finished) {
                      decrementKey();
                    }
                  });

                  res.on("error", () => decrementKey());
                }

                if (options.skipSuccessfulRequests) {
                  res.on("finish", function() {
                    if (res.statusCode < 400) {
                      options.store.decrement(key);
                    }
                  });
                }
              }

              if (max && current === max + 1) {
                options.onLimitReached(req, res, options);
              }

              if (max && current > max) {
                if (options.headers && !res.headersSent) {
                  res.setHeader(
                    "Retry-After",
                    Math.ceil(options.windowMs / 1000)
                  );
                }
                return options.handler(req, res, next);
              }

              next();
            })
            .catch(next);
        });
      })
      .catch(next);
  }

  rateLimit.resetKey = options.store.resetKey.bind(options.store);

  // Backward compatibility function
  rateLimit.resetIp = rateLimit.resetKey;

  rateLimit.getRateLimit = function getRateLimit(
    req: express.Request
  ): RateLimit.RateLimitInfo | undefined {
    return isAugmentedRequest(req) ? req.rateLimit : undefined;
  };

  return rateLimit;
}

function isAugmentedRequest(
  input: express.Request
): input is RateLimit.AugmentedRequest {
  const asAny = input as any;
  return (
    "rateLimit" in asAny &&
    typeof asAny.rateLimit.limit === "number" &&
    typeof asAny.rateLimit.current === "number" &&
    typeof asAny.rateLimit.remaining === "number" &&
    (asAny.rateLimit.resetTime === undefined ||
      asAny.rateLimit.resetTime instanceof Date)
  );
}

export = RateLimit;

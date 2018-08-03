"use strict";
const defaults = require("defaults");
const MemoryStore = require("./memory-store");

function RateLimit(options) {
  options = defaults(options, {
    // window, delay, and max apply per-key unless global is set to true
    windowMs: 60 * 1000, // milliseconds - how long to keep records of requests in memory
    delayAfter: 1, // how many requests to allow through before starting to delay responses
    delayMs: 1000, // milliseconds - base delay applied to the response - multiplied by number of recent hits for the same key.
    max: 5, // max number of recent connections during `window` milliseconds before sending a 429 response
    message: "Too many requests, please try again later.",
    statusCode: 429, // 429 status = Too Many Requests (RFC 6585)
    headers: true, //Send custom rate limit header with limit and remaining
    skipFailedRequests: false, // Do not count failed requests (status >= 400)
    skipSuccessfulRequests: false, // Do not count successful requests (status < 400)
    // allows to create custom keys (by default user IP is used)
    keyGenerator: function(req /*, res*/) {
      return req.ip;
    },
    skip: function(/*req, res*/) {
      return false;
    },
    handler: function(req, res /*, next*/) {
      if (options.headers) {
        res.setHeader("Retry-After", Math.ceil(options.windowMs / 1000));
      }
      res.format({
        html: function() {
          res.status(options.statusCode).end(options.message);
        },
        json: function() {
          res.status(options.statusCode).json({ message: options.message });
        }
      });
    },
    onLimitReached: function(/*req, res, optionsUsed*/) {}
  });

  // store to use for persisting rate limit data
  options.store = options.store || new MemoryStore(options.windowMs);

  // ensure that the store has the incr method
  if (
    typeof options.store.incr !== "function" ||
    typeof options.store.resetKey !== "function" ||
    (options.skipFailedRequests &&
      typeof options.store.decrement !== "function")
  ) {
    throw new Error("The store is not valid.");
  }

  if (options.global) {
    throw new Error(
      "The global option was removed from express-rate-limit v2."
    );
  }

  function rateLimit(req, res, next) {
    if (options.skip(req, res)) {
      return next();
    }

    const key = options.keyGenerator(req, res);

    options.store.incr(key, function(err, current) {
      if (err) {
        return next(err);
      }

      req.rateLimit = {
        limit: options.max,
        current: current,
        remaining: Math.max(options.max - current, 0)
      };

      if (options.headers) {
        res.setHeader("X-RateLimit-Limit", options.max);
        res.setHeader("X-RateLimit-Remaining", req.rateLimit.remaining);
      }

      if (options.max && current > options.max) {
        options.onLimitReached(req, res, options);
        return options.handler(req, res, next);
      }

      if (options.skipFailedRequests) {
        res.on("finish", function() {
          if (res.statusCode >= 400) {
            options.store.decrement(key);
          }
        });
      }

      if (options.skipSuccessfulRequests) {
        res.on("finish", function() {
          if (res.statusCode < 400) {
            options.store.decrement(key);
          }
        });
      }

      if (
        options.delayAfter &&
        options.delayMs &&
        current > options.delayAfter
      ) {
        const delay = (current - options.delayAfter) * options.delayMs;
        return setTimeout(next, delay);
      }

      next();
    });
  }

  rateLimit.resetKey = options.store.resetKey.bind(options.store);

  // Backward compatibility function
  rateLimit.resetIp = rateLimit.resetKey;

  return rateLimit;
}

module.exports = RateLimit;

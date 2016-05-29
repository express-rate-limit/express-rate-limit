'use strict';
var defaults = require('defaults');
var MemoryStore = require('./memory-store');

function RateLimit(options) {

    options = defaults(options, {
        // window, delay, and max apply per-key unless global is set to true
        windowMs: 60 * 1000, // milliseconds - how long to keep records of requests in memory
        delayAfter: 1, // how many requests to allow through before starting to delay responses
        delayMs: 1000, // milliseconds - base delay applied to the response - multiplied by number of recent hits for the same key.
        max: 5, // max number of recent connections during `window` milliseconds before sending a 429 response
        message : 'Too many requests, please try again later.',
        statusCode: 429, // 429 status = Too Many Requests (RFC 6585)
        enableRateLimitHeader:false, //Send custom rate limit header with limit and remaining
        // allows to create custom keys (by default user IP is used)
        keyGenerator: function (req /*, res*/) {
            return req.ip;
        },
        handler: function (req, res /*, next*/) {
          res.format({
            html: function(){
              res.status(options.statusCode).end(options.message);
            },
            json: function(){
              res.status(options.statusCode).json({ message: options.message });
            }
          });
        },
        rateLimitHeader: function (res,current) {
          res.setHeader('X-RateLimit-Limit', options.max);
          res.setHeader('X-RateLimit-Remaining', ((options.max-current) > 0)?(options.max-current):0);
        }
    });


    // store to use for persisting rate limit data
    options.store = options.store || new MemoryStore(options.windowMs);


    // ensure that the store has the incr method
    if (typeof options.store.incr !== 'function' || typeof options.store.resetKey !== 'function') {
        throw new Error('The store is not valid.');
    }


    if (options.global) {
        throw new Error('The global option was removed from express-rate-limit v2.');
    }


    function rateLimit(req, res, next) {
        var key = options.keyGenerator(req, res);

        options.store.incr(key, function(err, current) {
          if (err) {
            return next(err);
          }

          if (options.max && current > options.max) {
            if(options.enableRateLimitHeader)
              options.rateLimitHeader(res, current);
              return options.handler(req,res, current,next);
          }

          if (options.delayAfter && options.delayMs && current > options.delayAfter) {
              var delay = (current - options.delayAfter) * options.delayMs;
              setTimeout(next, delay);
          } else {
            if(options.enableRateLimitHeader)
              options.rateLimitHeader(res, current);
              next();
          }
        });
    }

    rateLimit.resetKey = options.store.resetKey.bind(options.store);

    // Backward compatibility function
    rateLimit.resetIp = rateLimit.resetKey;

    return rateLimit;
}

module.exports = RateLimit;

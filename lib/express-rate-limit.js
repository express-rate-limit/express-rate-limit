'use strict';
var defaults = require('defaults');

var MemoryStore = function(windowMs) {
  var hits = {};

  this.incr = function(key, cb) {
    if (hits[key]) {
        hits[key]++;
    } else {
        hits[key] = 1;
    }

    cb(null, hits[key]);
  };

  this.resetAll = function() {
    hits = {};
  };

  // export an API to allow hits from one or all IPs to be reset
  this.resetKey = function(key) {
      delete hits[key];
  };

  // simply reset ALL hits every windowMs
  setInterval(this.resetAll, windowMs);
};

function RateLimit(options) {

    options = defaults(options, {
        // window, delay, and max apply per-key unless global is set to true
        windowMs: 60 * 1000, // milliseconds - how long to keep records of requests in memory: Only used when store is MemoryStore
        delayAfter: 1, // how many requests to allow through before starting to delay responses
        delayMs: 1000, // milliseconds - base delay applied to the response - multiplied by number of recent hits for the same key.
        max: 5, // max number of recent connections during `window` milliseconds before sending a 429 response
        message : 'Too many requests, please try again later.',
        statusCode: 429, // 429 status = Too Many Requests (RFC 6585)
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
        }
    });

    options = defaults(options, {
      store: new MemoryStore(options.windowMs), // store to use for persisting rate limit data
    });


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
              return options.handler(req,res, next);
          }

          if (options.delayAfter && options.delayMs && current > options.delayAfter) {
              var delay = (current - options.delayAfter) * options.delayMs;
              setTimeout(next, delay);
          } else {
              next();
          }
        });
    }

    rateLimit.resetKey = options.store.resetKey.bind(options.store);;

    // Backward compatibility function
    rateLimit.resetIp = options.store.resetKey.bind(options.store);;

    return rateLimit;
}

module.exports = RateLimit;

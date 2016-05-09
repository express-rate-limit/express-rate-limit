'use strict';
var defaults = require('defaults');

function RateLimit(options) {

    options = defaults(options, {
        // window, delay, and max apply per-key unless global is set to true
        windowMs: 60 * 1000, // milliseconds - how long to keep records of requests in memory
        delayAfter: 1, // how many requests to allow through before starting to delay responses
        delayMs: 1000, // milliseconds - base delay applied to the response - multiplied by number of recent hits for the same key.
        max: 5, // max number of recent connections during `window` milliseconds before sending a 429 response
        message : 'Too many requests, please try again later.',
        statusCode: 429, // 429 status = Too Many Requests (RFC 6585)
        realIpHeader: '', // custom user defined header to extract real ip from
        realIpParam: '', // custom user defined request child member to extract real ip from
        // allows to create custom keys (by default user IP is used)
        keyGenerator: function (req /*, res*/) {
            if (!!options.realIpHeader) {
              return req.get(options.realIpHeader);
            }

            if (!!options.realIpParam) {
              return req[options.realIpParam];
            }

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


    if (options.global) {
        throw new Error('The global option was removed from express-rate-limit v2.');
    }


    // this is shared by all endpoints that use this instance
    var hits = {};


    function rateLimit(req, res, next) {
        var key = options.keyGenerator(req, res);

        if (hits[key]) {
            hits[key]++;
        } else {
            hits[key] = 1;
        }

        if (options.max && hits[key] > options.max) {
            return options.handler(req,res, next);
        }

        if (options.delayAfter && options.delayMs && hits[key] > options.delayAfter) {
            var delay = (hits[key] - options.delayAfter) * options.delayMs;
            setTimeout(next, delay);
        } else {
            next();
        }
    }

    function resetAll() {
        hits = {};
    }

    // simply reset ALL hits every windowMs
    setInterval(resetAll, options.windowMs);

    // export an API to allow hits from one or all IPs to be reset
    function resetKey(key) {
        delete hits[key];
    }

    rateLimit.resetKey = resetKey;
    // Backward compatibility function
    rateLimit.resetIp = resetKey;

    return rateLimit;
}

module.exports = RateLimit;

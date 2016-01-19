'use strict';
var defaults = require('defaults');

function RateLimit(options) {

    options = defaults(options, {
        // window, delay, and max apply per-ip unless global is set to true
        windowMs: 60 * 1000, // milliseconds - how long to keep records of requests in memory
        delayAfter: 1, // how many requests to allow through before starting to delay responses
        delayMs: 1000, // milliseconds - base delay applied to the response - multiplied by number of recent hits from user's IP
        max: 5, // max number of recent connections during `window` miliseconds before sending a 429 response
        message : 'Too many requests, please try again later.',
        statusCode: 429, // 429 status = Too Many Requests (RFC 6585)
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
        var ip = req.ip;

        if (hits[ip]) {
            hits[ip]++;
        } else {
            hits[ip] = 1;
        }

        if (options.max && hits[ip] > options.max) {
            return options.handler(req,res, next);
        }

        if (options.delayAfter && options.delayMs && hits[ip] > options.delayAfter) {
            var delay = (hits[ip] - options.delayAfter) * options.delayMs;
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

    function resetIp(ip) {
        delete hits[ip];
    }

    rateLimit.resetIp = resetIp;

    return rateLimit;
}

module.exports = RateLimit;

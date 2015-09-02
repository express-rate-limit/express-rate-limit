'use strict';
var defaults = require('defaults');

function RateLimit(options) {


    // this is shared by all endpoints that use this instance
    var hits = {};

    options = defaults(options, {
        // window, delay, and max apply per-ip unless global is set to true
        windowMs: 60 * 1000, // milliseconds - how long to keep records of requests in memory
        delayAfter: 1, // how many requests to allow through before starting to delay responses
        delayMs: 1000, // milliseconds - base delay applied to the response - multiplied by number of recent hits from user's IP
        max: 5, // max number of recent connections during `window` miliseconds before sending a 429 response
        global: false, // if true, IP address is ignored and setting is applied equally to all requests
        message : 'Too many requests, please try again later.',
        statusCode: 429
    });

    return function rateLimit(req, res, next) {
        var ip = options.global ? 'global' : req.ip;

        if (hits[ip]) {
            hits[ip]++;
        } else {
            hits[ip] = 1;
        }

        setTimeout(function() {
            // cleanup
            if (hits[ip]) {
                hits[ip]--;
            } else {
                delete hits[ip];
            }
        }, options.windowMs);

        if (options.max && hits[ip] > options.max) {
            // 429 status = Too Many Requests (RFC 6585)
            return res.status(options.statusCode).end(options.message);
        }

        if (options.delayAfter && options.delayMs && hits[ip] > options.delayAfter) {
            var delay = (hits[ip] - options.delayAfter) * options.delayMs;
            setTimeout(next, delay);
        } else {
            next();
        }
    };
}

module.exports = RateLimit;

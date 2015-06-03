'use strict';
var defaults = require('defaults');

function RateLimit(options) {


    // this is shared by all endpoints that use this instance
    var hits = {};

    options = defaults(options, {
        // window, delay, and max apply per-ip unless global is set to true
        windowMs: 60 * 1000, // miliseconds - how long to keep records of requests in memory
        delayMs: 1000, // milliseconds - base delay applied to the response - multiplied by number of recent hits from user's IP
        max: 5, // max number of recent connections during `window` miliseconds before sending a 400 response
        global: false, // if true, IP address is ignored and setting is applied equally to all requests
        message : 'Too many requests, please try again later.'
    });

    return function rateLimit(req, res, next) {
        var ip = options.global ? 'global' : req.ip;
        
        if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip) === false) {
            // 444 status = No Response
            return res.status(444).end('Invalid/Missing ip address); 
        }

        if (isNaN(hits[ip])) {
            hits[ip] = 0; // first one's free ;)
        } else {
            hits[ip]++;
        }

        setTimeout(function() {
            // cleanup
            if (!isNaN(hits[ip])) {
                hits[ip]--;
                if (hits[ip] <= 0) {
                    delete hits[ip];
                }
            }
        }, options.windowMs);

        if (hits[ip] >= options.max) {
            // 429 status = Too Many Requests (RFC 6585)
            return res.status(429).end(options.message);
        }

        var delay = hits[ip] * options.delayMs;
        setTimeout(next, delay);
    };
}

module.exports = RateLimit;

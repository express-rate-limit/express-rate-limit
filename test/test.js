/*global describe, it, beforeEach, afterEach */
'use strict';
var express = require('express');
var request = require('supertest');
var rateLimit = require('../lib/express-rate-limit.js');

describe('express-rate-limit node module', function() {

    var start, delay, message;
    var app;

    beforeEach(function() {
        start = Date.now();
        message = 'You have been very naughty.. No API response for you!!';
    });

    afterEach(function() {
        delay = null;
    });

    function createAppWith(limit) {
        app = express();
        app.use(limit);
        app.all('/', function(req, res) {
            res.send('response!');
        });
        return app;
    }

    function goodRequest(errorHandler, successHandler) {
        request(app)
            .get('/')
            .expect(200)
            .expect(/response!/)
            .end(function(err, res) {
                if (err) {
                    return errorHandler(err);
                }
                delay = Date.now() - start;
                if (successHandler) {
                    successHandler(null, res);
                }
            });
    }

    function badRequest(errorHandler, successHandler) {
        request(app)
            .get('/')
            .expect(429)
            .expect(/Too many requests/)
            .end(function(err, res) {
                if (err) {
                    return errorHandler(err);
                }
                delay = Date.now() - start;
                if (successHandler) {
                    successHandler(null, res);
                }
            });
    }

    function badRequestWithMessage(errorHandler, successHandler) {
        request(app)
            .get('/')
            .expect(429)
            .expect(message)
            .end(function(err, res) {
                if (err) {
                    return errorHandler(err);
                }
                delay = Date.now() - start;
                if (successHandler) {
                    successHandler(null, res);
                }
            });
    }


    it("should allow the first request with minimal delay", function(done) {
        createAppWith(rateLimit());
        goodRequest(done, function( /* err, res */ ) {
            delay = Date.now() - start;
            if (delay > 50) {
                done(new Error("First request took too long: " + delay + "ms"));
            } else {
                done();
            }
        });
    });

    it("should apply a small delay to the second request", function(done) {
        createAppWith(rateLimit({
            delayMs: 100
        }));
        goodRequest(done, function( /* err, res */ ) {
            if (delay > 50) {
                done(new Error("First request took too long: " + delay + "ms"));
            }
        });
        goodRequest(done, function( /* err, res */ ) {
            if (delay < 100) {
                return done(new Error("Second request was served too fast: " + delay + "ms"));
            }
            if (delay > 150) {
                return done(new Error("Second request took too long: " + delay + "ms"));
            }
            done();
        });
    });

    it("should apply a larger delay to the subsequent request", function(done) {
        createAppWith(rateLimit({
            delayMs: 100
        }));
        goodRequest(done);
        goodRequest(done);
        goodRequest(done);
        goodRequest(done, function( /* err, res */ ) {
            // should be about 300ms delay on 4th request - because the multiplier starts at 0
            if (delay < 300) {
                return done(new Error("Fourth request was served too fast: " + delay + "ms"));
            }
            if (delay > 400) {
                return done(new Error("Fourth request took too long: " + delay + "ms"));
            }
            done();
        });
    });

    it("should refuse additional connections once IP has reached the max", function(done) {
        createAppWith(rateLimit({
            delayMs: 0,
            max: 2
        }));
        goodRequest(done);
        goodRequest(done);
        badRequest(done, done);
    });

    it("should show the provided message instead of the default message when max connections are reached", function(done) {
        createAppWith(rateLimit({
            delayMs: 0,
            max: 2,
            message: message
        }));
        goodRequest(done);
        goodRequest(done);
        badRequestWithMessage(done, done);
    });

    it("should (eventually) accept new connections from a blocked IP", function(done) {
        createAppWith(rateLimit({
            delayMs: 100,
            max: 2,
            windowMs: 50
        }));
        goodRequest(done);
        goodRequest(done);
        badRequest(done);
        setTimeout(function() {
            start = Date.now();
            goodRequest(done, function( /* err, res */ ) {
                if (delay > 50) {
                    done(new Error("Eventual request took too long: " + delay + "ms"));
                } else {
                    done();
                }
            });
        }, 60);
    });
});

/*global describe, it, beforeEach, afterEach */
'use strict';
var express = require('express');
var assert = require('assert');
var request = require('supertest');
var rateLimit = require('../lib/express-rate-limit.js');

// todo: look into using http://sinonjs.org/docs/#clock instead of actually letting the tests wait on setTimeouts

describe('express-rate-limit node module', function() {

    var start, delay, message, app;

    beforeEach(function() {
        start = Date.now();
        message = 'You have been very naughty.. No API response for you!!';
    });

    afterEach(function() {
        delay = null;
    });

    function createAppWith(limit, checkVar, errorHandler, successHandler) {
        app = express();
        app.all('/', limit, function(req, res) {

            if(checkVar && req.rateLimit.limit === 5 && req.rateLimit.remaining === 4){
               app.end(function(err, res) {
                    if (err) {
                        return errorHandler(err);
                    }
                    return successHandler(null, res);
                });
            }

          res.format({
            html: function () {
              res.send('response!');
            },
            json: function () {
              res.json({
                message: 'response!'
              });
            }
          });
        });
        // helper endpoint to know what ip test requests come from
        // set in headers so that I don't have to deal with the body being a stream
        app.get('/ip', function(req,res) {
            res.setHeader('x-your-ip', req.ip);
            res.status(204).send('');
        });
        return app;
    }

    function InvalidStore() {}

    function MockStore() {
      this.incr_was_called = false;
      this.resetKey_was_called = false;

      var self = this;
      this.incr = function(key, cb) {
        self.incr_was_called = true;

        cb(null, 1);
      };

      this.resetKey = function() {
        self.resetKey_was_called = true;
      };
    }

    function goodRequest(errorHandler, successHandler, key, headerCheck, limit, remaining) {
        var req = request(app)
            .get('/');
        // add optional key parameter
        if (key) {
            req = req.query({key:key});
        }

        if(headerCheck){
            req
            .expect('x-ratelimit-limit', limit)
            .expect('x-ratelimit-remaining', remaining)
            .expect(function(res) {
                if ('retry-after' in res.headers) {
                    throw new Error("Expected no retry-after header, got " + res.headers['retry-after']);
                }
            })
            .expect(200,/response!/)
            .end(function(err, res) {
                if (err) {
                    return errorHandler(err);
                }
                delay = Date.now() - start;
                if (successHandler) {
                    successHandler(null, res);
                }
            });
        }else{
            req
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
    }

    function goodJsonRequest(errorHandler, successHandler) {
        request(app)
            .get('/')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200, {
              message: 'response!'
            })
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

    function badRequest(errorHandler, successHandler, key, headerCheck, limit, remaining, retryAfter) {
        var req = request(app)
            .get('/');

        // add optional key parameter
        if (key) {
            req = req
                .query({key: key});
        }

        req = req
            .expect(429)
            .expect(/Too many requests/);

        if (headerCheck) {
            req = req
                .expect('retry-after', retryAfter)
                .expect('x-ratelimit-limit', limit)
                .expect('x-ratelimit-remaining', remaining);
        }

        req.end(function(err, res) {
            if (err) {
                return errorHandler(err);
            }
            delay = Date.now() - start;
            if (successHandler) {
                successHandler(null, res);
            }
        });
    }

    function badJsonRequest(errorHandler, successHandler) {
        request(app)
            .get('/')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(429, { message: 'Too many requests, please try again later.' })
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

    it("should not allow the use of a store that is not valid", function(done) {
        try {
            rateLimit({
                store: new InvalidStore()
            });
        } catch(e) {
            return done();
        }

        done(new Error("It allowed an invalid store"));
    });

    it("should call incr on the store", function(done) {
      var store = new MockStore();

      createAppWith(rateLimit({
          store: store
      }));

      goodRequest(done, function() {
          if (!store.incr_was_called) {
            done(new Error("incr was not called on the store"));
          } else {
            done();
          }
      });
    });

    it("should call resetKey on the store", function(done) {
      var store = new MockStore();
      var limiter = rateLimit({
          store: store
      });

      limiter.resetKey("key");

      if (!store.resetKey_was_called) {
          done(new Error("resetKey was not called on the store"));
      } else {
          done();
      }
    });

    it("should send correct x-ratelimit-limit and x-ratelimit-remaining", function(done) {
        createAppWith(rateLimit({windowMs: 59100}));
        goodRequest(done, function( /* err, res */ ) {
            delay = Date.now() - start;
            if (delay > 99) {
                done(new Error("First request took too long: " + delay + "ms"));
            } else {
                done();
            }
        }, undefined, true, '5', '4', '60');
    });

    it("should allow the first request with minimal delay", function(done) {
        createAppWith(rateLimit());
        goodRequest(done, function( /* err, res */ ) {
            delay = Date.now() - start;
            if (delay > 99) {
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
            if (delay > 99) {
                done(new Error("First request took too long: " + delay + "ms"));
            }
        });
        goodRequest(done, function( /* err, res */ ) {
            if (delay < 100) {
                return done(new Error("Second request was served too fast: " + delay + "ms"));
            }
            if (delay > 199) {
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

    it("should allow delayAfter requests before delaying responses", function(done) {
        createAppWith(rateLimit({
            delayMs: 100,
            delayAfter: 2
        }));
        goodRequest(done, function( /* err, res */ ) {
            if (delay > 50) {
                done(new Error("First request took too long: " + delay + "ms"));
            }
        });
        goodRequest(done, function( /* err, res */ ) {
            if (delay > 100) {
                done(new Error("Second request took too long: " + delay + "ms"));
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

    it("should allow delayAfter to be disabled entirely", function(done) {
        createAppWith(rateLimit({
            delayMs: 1000,
            delayAfter: 0
        }));
        goodRequest(done);
        goodRequest(done);
        goodRequest(done);
        goodRequest(done, function( /* err, res */ ) {
            // should be about 300ms delay on 4th request - because the multiplier starts at 0
            if (delay > 100) {
                return done(new Error("Fourth request was served too fast: " + delay + "ms"));
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

    it("should return the Retry-After header once IP has reached the max", function(done) {
        createAppWith(rateLimit({
            delayMs: 0,
            max: 1
        }));
        goodRequest(done);
        badRequest(done, done, undefined, true, '1', '0', '60');
    });

    it("should allow max to be disabled entirely", function(done) {
        createAppWith(rateLimit({
            delayMs: 1,
            max: 0
        }));
        goodRequest(done);
        goodRequest(done);
        goodRequest(done, done);
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

    it("should work repeatedly (issues #2 & #3)", function(done) {
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
                }
            });
        }, 60);
    });

    it("should allow the error statusCode to be customized", function(done) {
        // note: node.js places some restrictions on what status codes are allowed
        var errStatusCode = 456;
        createAppWith(rateLimit({
            delayMs: 0,
            max: 1,
            statusCode: errStatusCode
        }));
        goodRequest(done);
        request(app)
            .get('/')
            .expect(errStatusCode)
            .end(done);
    });


    it("should allow individual IP's to be reset", function(done) {

        var limiter = rateLimit({
            delayMs: 100,
            max: 1,
            windowMs: 50
        });
        createAppWith(limiter);

        request(app).get('/ip').expect(204).end(function(err, res) {
            var myIp = res.headers['x-your-ip'];
            if (!myIp) {
                return done(new Error("unable to determine local IP"));
            }
            goodRequest(done);
            badRequest(done, function(err) {
                if (err) {
                    return done(err);
                }
                limiter.resetIp(myIp);
                goodRequest(done, done);
            });
        });
    });


    it ("should respond with the default JSON object", function (done) {
      var limiter = rateLimit({
          delayMs: 0,
          max: 1
      });
      createAppWith(limiter);
      goodJsonRequest(done);
      badJsonRequest(done, done);
    });


    it ("should respond with text/html to browsers real Accept headers", function (done) {
      var limiter = rateLimit({
          delayMs: 0,
          max: 1
      });
      createAppWith(limiter);
      goodRequest(done);
      request(app)
      .get('/')
      .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
      .expect(429, /Too many requests/)
      .end(function (err) {
        if (err) {
          return done(err);
        } else {
          return done();
        }
      });
    });


    it ("should use the custom handler when specified", function (done) {
      var limiter = rateLimit({
          delayMs: 0,
          max: 1,
          handler: function (req, res) {
            res.status(429).end('Custom handler executed!');
          }
      });
      createAppWith(limiter);
      goodRequest(done);
      request(app)
      .get('/')
      .expect(429, 'Custom handler executed!')
      .end(function (err) {
        if (err) {
          return done(err);
        } else {
          return done();
        }
      });
    });

    it ("should allow custom key generators", function (done) {
        var limiter = rateLimit({
            delayMs: 0,
            max: 2,
            keyGenerator: function (req, res) {
                assert.ok(req);
                assert.ok(res);

                var key = req.query.key;
                assert.ok(key);

                return key;
            }
        });

        createAppWith(limiter);
        goodRequest(done, null, 1);
        goodRequest(done, null, 1);
        goodRequest(done, null, 2);
        badRequest(done, function (err) {
            if (err) {
                return done(err);
            }
            goodRequest(done, null, 2);
            badRequest(done, done, 2);
        }, 1);
    });

    it ("should allow custom skip function", function (done) {
        var limiter = rateLimit({
            delayMs: 0,
            max: 2,
            skip: function (req, res) {
                assert.ok(req);
                assert.ok(res);

                return true;
            }
        });

        createAppWith(limiter);
        goodRequest(done, null, 1);
        goodRequest(done, null, 1);
        goodRequest(done, done, 1); // 3rd request would normally fail but we're skipping it
    });

    it ("should pass current hits and limit hits to the next function", function (done) {
      var limiter = rateLimit({
          headers: false
      });
      createAppWith(limiter,true, done, done);
      done();
    });

});

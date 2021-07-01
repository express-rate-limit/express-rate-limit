"use strict";
const express = require("express");
const assert = require("assert");
const request = require("supertest");
const sinon = require("sinon");
const rateLimit = require("../lib/express-rate-limit.js");

// todo: look into using http://sinonjs.org/docs/#clock instead of actually letting the tests wait on setTimeouts

describe("express-rate-limit node module", () => {
  let app, longResponseClosed;

  let clock;
  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  function createAppWith(limit, checkVar, errorHandler, successHandler) {
    app = express();
    app.all("/", limit, (req, res) => {
      if (
        checkVar &&
        req.rateLimit.limit === 5 &&
        req.rateLimit.remaining === 4
      ) {
        app.end((err, res) => {
          if (err) {
            return errorHandler(err);
          }
          return successHandler(null, res);
        });
      }

      res.format({
        html: function () {
          res.send("response!");
        },
        json: function () {
          res.json({
            message: "response!",
          });
        },
      });
    });

    app.all("/bad_response_status", limit, (req, res) => {
      res.status(403).send();
    });

    app.all("/long_response", limit, (req, res) => {
      const timerId = setTimeout(() => res.send("response!"), 100);
      res.on("close", () => {
        longResponseClosed = true;
        clearTimeout(timerId);
      });
    });

    app.all("/response_emit_error", limit, (req, res) => {
      res.on("error", () => {
        res.end();
      });

      res.emit("error", new Error());
    });

    return app;
  }

  function MockStore() {
    this.incr_was_called = false;
    this.resetKey_was_called = false;
    this.decrement_was_called = false;
    this.counter = 0;

    this.incr = (key, cb) => {
      this.counter++;
      this.incr_was_called = true;

      cb(null, this.counter);
    };

    this.decrement = () => {
      this.counter--;
      this.decrement_was_called = true;
    };

    this.resetKey = () => {
      this.resetKey_was_called = true;
      this.counter = 0;
    };
  }

  it("should not allow the use of a store that is not valid", (done) => {
    function InvalidStore() {}

    try {
      rateLimit({
        store: new InvalidStore(),
      });
    } catch (e) {
      return done();
    }

    done(new Error("It allowed an invalid store"));
  });

  it("should let the first request through", async () => {
    const app = createAppWith(rateLimit({ max: 1 }));
    await request(app)
      .get("/")
      .expect(200)
      .expect(/response!/);
  });

  it("should call incr on the store", async () => {
    const store = new MockStore();

    const app = createAppWith(
      rateLimit({
        store: store,
      })
    );

    await request(app).get("/");

    assert(store.incr_was_called, "incr was not called on the store");
  });

  it("should call resetKey on the store", async () => {
    const store = new MockStore();
    const limiter = rateLimit({
      store: store,
    });

    limiter.resetKey("key");

    assert(store.resetKey_was_called, "resetKey was not called on the store");
  });

  it("should refuse additional connections once IP has reached the max", async () => {
    const app = createAppWith(
      rateLimit({
        delayMs: 0,
        max: 2,
      })
    );
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(429);
  });

  it("should show the provided message instead of the default message when max connections are reached", async () => {
    const message = "Test ratelimit message";
    const app = createAppWith(
      rateLimit({
        delayMs: 0,
        max: 2,
        message,
        windowMs: 1000,
      })
    );
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(429).expect(message);
  });

  it("should (eventually) accept new connections from a blocked IP", async () => {
    createAppWith(
      rateLimit({
        max: 2,
        windowMs: 50,
      })
    );
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(429);
    clock.tick(60);
    await request(app).get("/").expect(200);
  });

  it("should work repeatedly (issues #2 & #3)", async () => {
    createAppWith(
      rateLimit({
        max: 2,
        windowMs: 50,
      })
    );

    await request(app).get("/").expect(200);
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(429);
    clock.tick(60);
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(429);
    clock.tick(60);
    await request(app).get("/").expect(200);
  });

  it("should allow the error statusCode to be customized", async () => {
    // note: node.js places some restrictions on what status codes are allowed
    const errStatusCode = 456;
    createAppWith(
      rateLimit({
        delayMs: 0,
        max: 1,
        statusCode: errStatusCode,
      })
    );
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(errStatusCode);
  });

  it("should allow individual IP's to be reset", async () => {
    const limiter = rateLimit({
      max: 1,
      windowMs: 50,
    });
    createAppWith(limiter);

    // set in headers so that I don't have to deal with the body being a stream
    app.get("/ip", (req, res) => {
      res.setHeader("x-your-ip", req.ip);
      res.status(204).send("");
    });

    let myIp = null;

    await request(app)
      .get("/ip")
      .expect(204)
      .expect((res) => {
        myIp = res.headers["x-your-ip"];
        assert(myIp, "unable to determine local IP");
      });
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(429);
    limiter.resetIp(myIp);
    await request(app).get("/").expect(200);
  });

  it("should respond with JSON", async () => {
    const limiter = rateLimit({
      delayMs: 0,
      message: { message: "Too many requests, please try again later." },
      max: 1,
    });
    createAppWith(limiter);
    await request(app)
      .get("/")
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(200, {
        message: "response!",
      });
    await request(app)
      .get("/")
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(429, { message: "Too many requests, please try again later." });
  });

  it("should use the custom handler when specified", async () => {
    const limiter = rateLimit({
      delayMs: 0,
      max: 1,
      handler: function (req, res) {
        res.status(429).end("Custom handler executed!");
      },
    });
    createAppWith(limiter);
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(429, "Custom handler executed!");
  });

  it("should allow custom key generators", async () => {
    const limiter = rateLimit({
      delayMs: 0,
      max: 2,
      keyGenerator: function (req, res) {
        assert.ok(req);
        assert.ok(res);

        const key = req.query.key;
        assert.ok(key);

        return key;
      },
    });

    createAppWith(limiter);
    await request(app).get("/").query({ key: 1 }).expect(200);
    await request(app).get("/").query({ key: 1 }).expect(200);

    await request(app).get("/").query({ key: 2 }).expect(200); // key 2

    await request(app).get("/").query({ key: 1 }).expect(429); // error for key 1

    await request(app).get("/").query({ key: 2 }).expect(200);

    await request(app).get("/").query({ key: 2 }).expect(429); // error for key 2
  });

  it("should allow custom skip function", async () => {
    const limiter = rateLimit({
      delayMs: 0,
      max: 2,
      skip: function (req, res) {
        assert.ok(req);
        assert.ok(res);

        return true;
      },
    });

    createAppWith(limiter);
    await request(app).get("/").query({ key: 1 }).expect(200);
    await request(app).get("/").query({ key: 1 }).expect(200);
    // 3rd request would normally fail but we're skipping it
    await request(app).get("/").query({ key: 1 }).expect(200);
  });

  it("should allow custom skip function that returns a promise", async () => {
    const limiter = rateLimit({
      delayMs: 0,
      max: 2,
      skip: function (req, res) {
        assert.ok(req);
        assert.ok(res);

        return Promise.resolve(true);
      },
    });

    createAppWith(limiter);
    await request(app).get("/").query({ key: 1 }).expect(200);
    await request(app).get("/").query({ key: 1 }).expect(200);
    // 3rd request would normally fail but we're skipping it
    await request(app).get("/").query({ key: 1 }).expect(200);
  });

  it("should pass current hits and limit hits to the next function", (done) => {
    const limiter = rateLimit({
      headers: false,
    });
    createAppWith(limiter, true, done, done);
    done();
  });

  it("should allow max to be a function", async () => {
    createAppWith(
      rateLimit({
        delayMs: 0,
        max: () => 2,
      })
    );
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(429);
  });

  it("should allow max to be a function that returns a promise", async () => {
    createAppWith(
      rateLimit({
        delayMs: 0,
        max: () => Promise.resolve(2),
      })
    );
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(429);
  });

  // https://github.com/nfriedly/express-rate-limit/pull/102
  it("should calculate the remaining hits", async () => {
    createAppWith(
      rateLimit({
        delayMs: 0,
        max: () => Promise.resolve(2),
      })
    );
    await request(app)
      .get("/")
      .expect(200)
      .expect("x-ratelimit-limit", "2") // todo: does this have to be a string?
      .expect("x-ratelimit-remaining", "1")
      .expect((res) => {
        if ("retry-after" in res.headers) {
          throw new Error(
            "Expected no retry-after header, got " + res.headers["retry-after"]
          );
        }
      })
      .expect(200, /response!/);
  });

  it("should decrement hits with success response and skipSuccessfulRequests", async () => {
    const store = new MockStore();
    createAppWith(
      rateLimit({
        skipSuccessfulRequests: true,
        store: store,
      })
    );

    await request(app).get("/").expect(200);
    assert(store.decrement_was_called, "decrement was not called on the store");
  });

  it("should not decrement hits with failed response and skipSuccessfulRequests", async () => {
    const store = new MockStore();
    createAppWith(
      rateLimit({
        skipSuccessfulRequests: true,
        store: store,
      })
    );

    await request(app).get("/bad_response_status").expect(403);

    assert(!store.decrement_was_called, "decrement was called on the store");
  });

  it("should decrement hits with success response with custom 'requestWasSuccessful' option", async () => {
    const store = new MockStore();
    createAppWith(
      rateLimit({
        skipSuccessfulRequests: true,
        requestWasSuccessful: function (req, res) {
          return res.statusCode === 200;
        },
        store: store,
      })
    );

    await request(app).get("/").expect(200);
    assert(store.decrement_was_called, "decrement was called on the store");
  });

  it("should not decrement hits with success response with custom 'requestWasSuccessful' option", async () => {
    const store = new MockStore();
    createAppWith(
      rateLimit({
        skipSuccessfulRequests: true,
        requestWasSuccessful: function (req, res) {
          return res.statusCode === 200;
        },
        store: store,
      })
    );

    await request(app).get("/bad_response_status").expect(403);

    assert(
      !store.decrement_was_called,
      "decrement was not called on the store"
    );
  });

  it("should decrement hits with success response with custom 'requestWasSuccessful' option based on query parameter", async () => {
    const store = new MockStore();
    createAppWith(
      rateLimit({
        skipSuccessfulRequests: true,
        requestWasSuccessful: function (req) {
          return req.query.success === "1";
        },
        store: store,
      })
    );

    await request(app).get("/?success=1");

    assert(store.decrement_was_called, "decrement was called on the store");
  });

  it("should not decrement hits with failed response with custom 'requestWasSuccessful' option based on query parameter", async () => {
    const store = new MockStore();
    createAppWith(
      rateLimit({
        skipSuccessfulRequests: true,
        requestWasSuccessful: function (req) {
          return req.query.success === "1";
        },
        store: store,
      })
    );

    await request(app).get("/?success=0");

    assert(
      !store.decrement_was_called,
      "decrement was not called on the store"
    );
  });

  it("should decrement hits with failed response and skipFailedRequests", async () => {
    const store = new MockStore();
    createAppWith(
      rateLimit({
        skipFailedRequests: true,
        store: store,
      })
    );

    await request(app).get("/bad_response_status").expect(403);
    assert(store.decrement_was_called, "decrement was not called on the store");
  });

  it("should decrement hits with closed response and skipFailedRequests", (done) => {
    // todo: rework this test to not need real time
    clock.restore();

    const store = new MockStore();
    createAppWith(
      rateLimit({
        skipFailedRequests: true,
        store: store,
      })
    );

    const checkStoreDecremented = () => {
      if (longResponseClosed) {
        if (!store.decrement_was_called) {
          done(new Error("decrement was not called on the store"));
        } else {
          done();
        }
      } else {
        setImmediate(checkStoreDecremented);
      }
    };

    request(app)
      .get("/long_response")
      .timeout({
        response: 10,
      })
      .end(checkStoreDecremented);
  });

  it("should decrement hits with response emitting error and skipFailedRequests", async () => {
    const store = new MockStore();
    createAppWith(
      rateLimit({
        skipFailedRequests: true,
        store: store,
      })
    );

    await request(app).get("/response_emit_error");

    assert(store.decrement_was_called, "decrement was not called on the store");
  });

  it("should not decrement hits with success response and skipFailedRequests", async () => {
    const store = new MockStore();
    createAppWith(
      rateLimit({
        skipFailedRequests: true,
        store: store,
      })
    );

    await request(app).get("/").expect(200);

    assert(!store.decrement_was_called, "decrement was called on the store");
  });

  it("should decrement hits with IP hits reached max and skipFailedRequests", async () => {
    const store = new MockStore();
    createAppWith(
      rateLimit({
        delayMs: 0,
        max: 2,
        store: store,
        skipFailedRequests: true,
      })
    );
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(429);
    assert(store.decrement_was_called, "decrement was not called on the store");
  });

  it("should not modify the passed in options object", () => {
    const opts = {};
    rateLimit(opts);
    assert.deepStrictEqual(opts, {});
  });

  it("should handle exceptions", async () => {
    let errorCaught = false;
    const store = new MockStore();
    const app = createAppWith(
      rateLimit({
        max: 1,
        store: store,
        handler: () => {
          const exception = new Error();
          exception.code = 429;
          exception.message = "Too many requests";
          throw exception;
        },
      })
    );
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
      errorCaught = true;
      res.status(err.code).send(err.message);
    });
    await request(app).get("/").expect(200);
    await request(app).get("/").expect(429);
    assert(errorCaught, "error should have been caught");
  });

  it("should handle exceptions thrown in skip function", async () => {
    let errorCaught = false;
    const store = new MockStore();
    const app = createAppWith(
      rateLimit({
        max: 1,
        store: store,
        skip: () => {
          const exception = new Error();
          exception.code = 429;
          exception.message = "Too many requests";
          return Promise.reject(exception);
        },
      })
    );
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
      errorCaught = true;
      res.status(err.code).send(err.message);
    });
    await request(app).get("/").expect(429);
    assert(errorCaught, "error should have been caught");
  });
});

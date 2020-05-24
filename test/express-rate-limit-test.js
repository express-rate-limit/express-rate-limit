"use strict";
const express = require("express");
const assert = require("assert");
const request = require("supertest");
const rateLimit = require("../dist/express-rate-limit.js");

// todo: look into using http://sinonjs.org/docs/#clock instead of actually letting the tests wait on setTimeouts

describe("express-rate-limit node module", () => {
  let app, longResponseClosed;

  function createAppWith(limit) {
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

    app.use(limit);

    app.all("/", (req, res) => {
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

  it("should not allow the use of a store that is not valid", async () => {
    function InvalidStore() {}

    if (headerCheck) {
      req
        .expect("x-ratelimit-limit", limit && limit.toString())
        .expect("x-ratelimit-remaining", remaining && remaining.toString())
        .expect(res => {
          if ("retry-after" in res.headers) {
            throw new Error(
              "Expected no retry-after header, got " +
                res.headers["retry-after"]
            );
          }
        })
        .expect(200, /response!/)
        .end((err, res) => {
          if (err) {
            return errorHandler(err);
          }
          if (successHandler) {
            successHandler(null, res);
          }
        });
    } else {
      req
        .expect(200)
        .expect(/response!/)
        .end((err, res) => {
          if (err) {
            return errorHandler(err);
          }
          if (successHandler) {
            successHandler(null, res);
          }
        });
    }
  }

  function goodJsonRequest(errorHandler, successHandler) {
    request(app)
      .get("/")
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(200, {
        message: "response!"
      })
      .end((err, res) => {
        if (err) {
          return errorHandler(err);
        }
        if (successHandler) {
          successHandler(null, res);
        }
      });
  }

  function badRequest(
    errorHandler,
    successHandler,
    key,
    headerCheck,
    limit,
    remaining,
    retryAfter
  ) {
    let req = request(app).get("/");

    // add optional key parameter
    if (key) {
      req = req.query({ key: key });
    }

    req = req.expect(429).expect(/Too many requests/);

    if (headerCheck) {
      req = req
        .expect("retry-after", retryAfter)
        .expect("x-ratelimit-limit", limit)
        .expect("x-ratelimit-remaining", remaining);
    }

    req.end((err, res) => {
      if (err) {
        return errorHandler(err);
      }
      if (successHandler) {
        successHandler(null, res);
      }
    });
  }

  function badJsonRequest(errorHandler, successHandler) {
    request(app)
      .get("/")
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(429, { message: "Too many requests, please try again later." })
      .end((err, res) => {
        if (err) {
          return errorHandler(err);
        }
        if (successHandler) {
          successHandler(null, res);
        }
      });
  }

  it("should not allow the use of a store that is not valid", done => {
    function InvalidStore() {}

    try {
      rateLimit({
        store: new InvalidStore(),
      });
    }, /store/);
  });

  it("should let the first request through", done => {
    const app = createAppWith(rateLimit({ max: 1 }));
    request(app)
      .get("/")
      .expect(200)
      .expect(/response!/)
      .end(done);
  });

  it("should call incr on the store", done => {
    const store = new MockStore();

    const app = createAppWith(
      rateLimit({
        store: store,
      })
    );

    request(app)
      .get("/")
      .end((err /*, res*/) => {
        if (err) {
          return done(err);
        }
        if (!store.incr_was_called) {
          done(new Error("incr was not called on the store"));
        } else {
          done();
        }
      });
  });

  it("should call resetKey on the store", done => {
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
        max: 2
      })
    );
    await request(app)
      .get("/")
      .expect(200);
    await request(app)
      .get("/")
      .expect(200);
    await request(app)
      .get("/")
      .expect(429);
  });

  it("should show the provided message instead of the default message when max connections are reached", async () => {
    const message = "Test ratelimit message";
    const app = createAppWith(
      rateLimit({
        delayMs: 0,
        max: 2,
        message
      })
    );
    await request(app)
      .get("/")
      .expect(200);
    await request(app)
      .get("/")
      .expect(200);
    await request(app)
      .get("/")
      .expect(429)
      .expect(message);
  });

  it("should (eventually) accept new connections from a blocked IP", done => {
    createAppWith(
      rateLimit({
        max: 2,
        windowMs: 50,
      })
    );
    goodRequest(done);
    goodRequest(done);
    badRequest(done);
    setTimeout(() => {
      goodRequest(done, (/* err, res */) => {
        done();
      });
    }, 60);
  });

  it("should work repeatedly (issues #2 & #3)", done => {
    createAppWith(
      rateLimit({
        max: 2,
        windowMs: 50,
      })
    );

    goodRequest(done);
    goodRequest(done);
    badRequest(done);
    setTimeout(() => {
      goodRequest(done, (/* err, res */) => {
        goodRequest(done);
        badRequest(done);
        setTimeout(() => {
          goodRequest(done, (/* err, res */) => {
            done();
          });
        }, 60);
      });
    }, 60);
  });

  it("should allow the error statusCode to be customized", done => {
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

  it("should allow individual IP's to be reset", done => {
    const limiter = rateLimit({
      max: 1,
      windowMs: 50,
    });
    createAppWith([saveIp, limiter]);

    // set in headers so that I don't have to deal with the body being a stream
    app.get("/ip", (req, res) => {
      res.setHeader("x-your-ip", req.ip);
      res.status(204).send("");
    });

    request(app)
      .get("/ip")
      .expect(204)
      .end((err, res) => {
        const myIp = res.headers["x-your-ip"];
        if (!myIp) {
          return done(new Error("unable to determine local IP"));
        }
        goodRequest(done);
        badRequest(done, err => {
          if (err) {
            return done(err);
          }
          limiter.resetIp(myIp);
          goodRequest(done, done);
        });
      });
  });

  it("should respond with JSON", done => {
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

  it("should use the custom handler when specified", done => {
    const limiter = rateLimit({
      delayMs: 0,
      max: 1,
      handler: function (req, res) {
        res.status(429).end("Custom handler executed!");
      },
    });
    createAppWith(limiter);
    goodRequest(done);
    request(app)
      .get("/")
      .expect(429, "Custom handler executed!")
      .end(err => {
        if (err) {
          return done(err);
        } else {
          return done();
        }
      });
  });

  it("should allow custom key generators", done => {
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
    goodRequest(done, null, 1);
    goodRequest(done, null, 1);
    goodRequest(done, null, 2);
    badRequest(
      done,
      err => {
        if (err) {
          return done(err);
        }
        goodRequest(done, null, 2);
        badRequest(done, done, 2);
      },
      1
    );
  });

  it("should allow custom skip function", done => {
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

  it("should pass current hits and limit hits to the next function", done => {
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

    goodRequest(done, () => {
      if (!store.decrement_was_called) {
        done(new Error("decrement was not called on the store"));
      } else {
        done();
      }
    });
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
    await store.decrementPromise;
    assert(store.decrement_was_called, "decrement was not called on the store");
  });

  it("should decrement hits with closed response and skipFailedRequests", async () => {
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
        response: 10
      })
      .end(checkStoreDecremented);
  });

  it("should decrement hits with response emitting error and skipFailedRequests", done => {
    const store = new MockStore();
    createAppWith(
      rateLimit({
        skipFailedRequests: true,
        store: store
      })
    );

    request(app)
      .get("/response_emit_error")
      .end(() => {
        if (!store.decrement_was_called) {
          done(new Error("decrement was not called on the store"));
        } else {
          done();
        }
      });
  });

  it("should not decrement hits with success response and skipFailedRequests", done => {
    const store = new MockStore();
    createAppWith(
      rateLimit({
        skipFailedRequests: true,
        store: store
      })
    );

    goodRequest(done, () => {
      if (store.decrement_was_called) {
        done(new Error("decrement was called on the store"));
      } else {
        done();
      }
    });
    app.get("/server_hang", (req, res) => {
      // don't send any response - it will eventually time out and close
      res.on("close", _resolve);
    });

    const req = request(app).get("/server_hang").timeout({
      response: 10,
    });

    await assert.rejects(req); // we're expecting a timeout
    await connectionClosed;

    assert(
      store.decrement_was_called,
      "decrement should have been called on the store"
    );
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

  it("should pass current hits and limit hits to the next function in the req.rateLimit property", async () => {
    let lastReq = null;
    const saveReqObj = (req, res, next) => {
      lastReq = req;
      next();
    };

    createAppWith([
      saveReqObj,
      rateLimit({
        headers: false,
      }),
    ]);

    await request(app).get("/").expect(200);
    assert(lastReq);
    assert(lastReq.rateLimit);
    assert.equal(lastReq.rateLimit.limit, 5);
    assert.equal(lastReq.rateLimit.remaining, 4);

    lastReq = null;
    await request(app).get("/").expect(200);
    assert.equal(lastReq.rateLimit.limit, 5); // no change
    assert.equal(lastReq.rateLimit.remaining, 3); // decrement
  });

  it("should handle two rate-limiters with different requestPropertyNames operating independently", async () => {
    const keyLimiter = rateLimit({
      max: 2,
      keyGenerator: function (req, res) {
        assert.ok(req);
        assert.ok(res);

        const key = req.query.key;
        assert.ok(key);

        return key;
      },
      requestPropertyName: "rateLimitKey",
      handler: function (req, res) {
        res.status(429).end("keyLimiter handler executed!");
      },
    });

    const globalLimiter = rateLimit({
      max: 5,
      keyGenerator: () => {
        "global";
      },
      requestPropertyName: "rateLimitGlobal",
      handler: function (req, res) {
        res.status(429).end("globalLimiter handler executed!");
      },
    });

    let lastReq = null;
    const saveReqObj = (req, res, next) => {
      lastReq = req;
      next();
    };
    createAppWith([saveReqObj, keyLimiter, globalLimiter]);

    await request(app).get("/").query({ key: 1 }).expect(200); // keyLimiter[1]: 1, keyLimiter[2]: 0, keyLimiter[3]: 0, global: 1
    assert(lastReq);

    assert(
      lastReq.rateLimitKey,
      "there should be a rateLimitKey property on the req object"
    );
    assert.equal(lastReq.rateLimitKey.limit, 2);
    assert.equal(lastReq.rateLimitKey.remaining, 1);

    assert(
      lastReq.rateLimitGlobal,
      "there should be a rateLimitGlobal property on the req object"
    );
    assert.equal(
      lastReq.rateLimit,
      undefined,
      "there shouldn't be a rateLimit property on the req object (because it was renamed in both instances)"
    );
    assert.equal(lastReq.rateLimitGlobal.limit, 5);
    assert.equal(lastReq.rateLimitGlobal.remaining, 4);

    lastReq = null;
    await request(app).get("/").query({ key: 2 }).expect(200); // keyLimiter[1]: 1, keyLimiter[2]: 1, keyLimiter[3]: 0, global: 2
    assert.equal(lastReq.rateLimitKey.remaining, 1);
    assert.equal(lastReq.rateLimitGlobal.remaining, 3);

    lastReq = null;
    await request(app).get("/").query({ key: 1 }).expect(200); // keyLimiter[1]: 2, keyLimiter[2]: 1, keyLimiter[3]: 0, global: 3
    assert.equal(lastReq.rateLimitKey.remaining, 0);
    assert.equal(lastReq.rateLimitGlobal.remaining, 2);

    lastReq = null;
    await request(app).get("/").query({ key: 2 }).expect(200); // keyLimiter[1]: 2, keyLimiter[2]: 2, keyLimiter[3]: 0, global: 4
    assert.equal(lastReq.rateLimitKey.remaining, 0);
    assert.equal(lastReq.rateLimitGlobal.remaining, 1);

    lastReq = null;
    await request(app)
      .get("/")
      .query({ key: 1 })
      .expect(429, "keyLimiter handler executed!"); // keyLimiter[1]: 3 > 2!
    assert.equal(lastReq.rateLimitKey.remaining, 0);
    // because keyLimiter handled the request, global limiter did not execute

    lastReq = null;
    await request(app).get("/").query({ key: 3 }).expect(200); // keyLimiter[1]: 2, keyLimiter[2]: 2, keyLimiter[3]: 1, global: 5
    await request(app)
      .get("/")
      .query({ key: 3 })
      .expect(429, "globalLimiter handler executed!"); // keyLimiter[1]: 2, keyLimiter[2]: 2, keyLimiter[3]: 2, global: 6 > 5!
    assert.equal(lastReq.rateLimitKey.remaining, 0);
    assert.equal(lastReq.rateLimitGlobal.remaining, 0);
  });

  it("should handle exceptions", done => {
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
        }
      })
    );
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
      errorCaught = true;
      res.status(err.code).send(err.message);
    });
    goodRequest(done);
    badRequest(done, () => {
      assert(errorCaught);
      done();
    });
  });
});

# Express Rate Limit

[![Build Status](https://secure.travis-ci.org/nfriedly/express-rate-limit.png?branch=master)](http://travis-ci.org/nfriedly/express-rate-limit)
[![NPM version](http://badge.fury.io/js/express-rate-limit.png)](https://npmjs.org/package/express-rate-limit "View this project on NPM")
[![Dependency Status](https://david-dm.org/nfriedly/express-rate-limit.png?theme=shields.io)](https://david-dm.org/nfriedly/express-rate-limit)
[![Development Dependency Status](https://david-dm.org/nfriedly/express-rate-limit/dev-status.png?theme=shields.io)](https://david-dm.org/nfriedly/express-rate-limit#info=devDependencies)

Basic rate-limiting middleware for Express. Use to limit repeated requests to public APIs and/or endpoints such as password reset.

Plays nice with [express-slow-down](https://www.npmjs.com/package/express-slow-down).

Note: this module does not share state with other processes/servers by default.
If you need a more robust solution, I recommend using an external store:

### Stores

- Memory Store _(default, built-in)_ - stores hits in-memory in the Node.js process. Does not share state with other servers or processes.
- [Redis Store](https://npmjs.com/package/rate-limit-redis)
- [Memcached Store](https://npmjs.org/package/rate-limit-memcached)

### Alternate Rate-limiters

This module was designed to only handle the basics and didn't even support external stores initially. These other options all are excellent pieces of software and may be more appropriate for some situations:

- [strict-rate-limiter](https://www.npmjs.com/package/strict-rate-limiter)
- [express-brute](https://www.npmjs.com/package/express-brute)
- [rate-limiter](https://www.npmjs.com/package/express-limiter)

## Install

```sh
$ npm install --save express-rate-limit
```

## Usage

For an API-only server where the rate-limiter should be applied to all requests:

```js
const rateLimit = require("express-rate-limit");

app.enable("trust proxy"); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

//  apply to all requests
app.use(limiter);
```

For a "regular" web server (e.g. anything that uses `express.static()`), where the rate-limiter should only apply to certain requests:

```js
const rateLimit = require("express-rate-limit");

app.enable("trust proxy"); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});

// only apply to requests that begin with /api/
app.use("/api/", apiLimiter);
```

Create multiple instances to apply different rules to different routes:

```js
const rateLimit = require("express-rate-limit");

app.enable("trust proxy"); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use("/api/", apiLimiter);

const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // start blocking after 5 requests
  message:
    "Too many accounts created from this IP, please try again after an hour"
});
app.post("/create-account", createAccountLimiter, function(req, res) {
  //...
});
```

A `req.rateLimit` property is added to all requests with the `limit`, `current`, and `remaining` number of requests for usage in your application code and, if the store provides it, a resetTime Date object.

## Configuration

- **windowMs**: milliseconds - how long to keep records of requests in memory. Defaults to `60000` (1 minute).
- **max**: max number of connections during `windowMs` milliseconds before sending a 429 response. Defaults to `5`. Set to `0` to disable.
- **message**: Error message returned when `max` is exceeded. Defaults to `'Too many requests, please try again later.'`
- **statusCode**: HTTP status code returned when `max` is exceeded. Defaults to `429`.
- **headers**: Enable headers for request limit (`X-RateLimit-Limit`) and current usage (`X-RateLimit-Remaining`) on all responses and time to wait before retrying (`Retry-After`) when `max` is exceeded.
- **skipFailedRequests**: when `true` failed requests (response status >= 400) won't be counted. Defaults to `false`.
- **skipSuccessfulRequests**: when `true` successful requests (response status < 400) won't be counted. Defaults to `false`.
- **keyGenerator**: Function used to generate keys. By default user IP address (req.ip) is used. Defaults:

```js
function (req /*, res*/) {
    return req.ip;
}
```

- **skip**: Function used to skip requests. Returning true from the function will skip limiting for that request. Defaults:

```js
function (/*req, res*/) {
    return false;
}
```

- **handler**: The function to execute once the max limit is exceeded. It receives the request and the response objects. The "next" param is available if you need to pass to the next middleware. Defaults:

```js
function (req, res, /*next*/) {
    res.status(options.statusCode).send(options.message);
}
```

- **onLimitReached**: Function to listen each time the limit is reached. You can use it to debug/log. Defaults:

```js
function (req, res, options) {
  /* empty */
}
```

- **store**: The storage to use when persisting rate limit attempts. By default, the [MemoryStore](lib/memory-store.js) is used. It must implement the following in order to function:

```js
function SomeStore() {
  /**
   * Increments the value in the underlying store for the given key.
   * @method function
   * @param {string} key - The key to use as the unique identifier passed
   *                     down from RateLimit.
   * @param {Store~incrCallback} cb - The callback issued when the underlying
   *                                store is finished.
   *
   * The callback should be triggered with three values:
   *  - error (usually null)
   *  - hitCount for this IP
   *  - resetTime - JS Date object (optional, but necessary for X-RateLimit-Reset header)
   */
  this.incr = function(key, cb) {
    // ...
  };

  /**
   * Decrements the value in the underlying store for the given key. Used only when skipFailedRequests is true
   * @method function
   * @param {string} key - The key to use as the unique identifier passed
   *                     down from RateLimit.
   */
  this.decrement = function(key) {
    // ...
  };

  /**
   * This callback is called by the underlying store when an answer to the
   * increment is available.
   * @callback Store~incrCallback
   * @param {?object} err - The error from the underlying store, or null if no
   *                      error occurred.
   * @param {number} value - The current value of the counter
   */

  /**
   * Resets a value with the given key.
   * @method function
   * @param  {[type]} key - The key to reset
   */
  this.resetKey = function(key) {
    // ...
  };
}
```

Avaliable data stores are:

- MemoryStore: _(default)_ Simple in-memory option. Does not share state when app has multiple processes or servers.
- [rate-limit-redis](https://npmjs.com/package/rate-limit-redis): A [Redis](http://redis.io/)-backed store, more suitable for large or demanding deployments.
- [rate-limit-memcached](https://npmjs.org/package/rate-limit-memcached): A [Memcached](https://memcached.org/)-backed store.

## Instance API

- **resetKey(key)**: Resets the rate limiting for a given key. (Allow users to complete a captcha or whatever to reset their rate limit, then call this method.)

## v3 Changes

- Removed `delayAfter` and `delayMs` options; they were moved to a new module: [express-slow-down](https://npmjs.org/package/express-rate-limit).
- Simplified the default `handler` function so that it no longer changes the response format. Now uses [res.send](https://expressjs.com/en/4x/api.html#res.send).
- `onLimitReached` now only triggers once for a given ip and window. only `handle` is called for every blocked request.

## v2 Changes

v2 uses a less precise but less resource intensive method of tracking hits from a given IP. v2 also adds the `limiter.resetKey()` API and removes the `global: true` option.

## License

MIT © [Nathan Friedly](http://nfriedly.com/)

# Express Rate Limit

[![Node.js CI](https://github.com/nfriedly/express-rate-limit/workflows/Node.js%20CI/badge.svg)](https://github.com/nfriedly/express-rate-limit/actions)
[![NPM version](https://img.shields.io/npm/v/express-rate-limit.svg)](https://npmjs.org/package/express-rate-limit "View this project on NPM")
[![npm downloads](https://img.shields.io/npm/dm/express-rate-limit)](https://www.npmjs.com/package/express-rate-limit)


Basic rate-limiting middleware for Express. Use to limit repeated requests to public APIs and/or endpoints such as password reset.

Plays nice with [express-slow-down](https://www.npmjs.com/package/express-slow-down).

Note: this module does not share state with other processes/servers by default. It also buckets all requests to an internal clock rather than starting a new timer for each end-user. It's fine for abuse-prevention but might not produce the desired effect when attempting to strictly enforce API rate-limits or similar. If you need a more robust solution, I recommend using an external store:

### Stores

- Memory Store _(default, built-in)_ - stores hits in-memory in the Node.js process. Does not share state with other servers or processes, and does not start a separate timer for each end user.
- [Redis Store](https://npmjs.com/package/rate-limit-redis)
- [Memcached Store](https://npmjs.org/package/rate-limit-memcached)
- [Mongo Store](https://www.npmjs.com/package/rate-limit-mongo)

### Alternate Rate-limiters

This module was designed to only handle the basics and didn't even support external stores initially. These other options all are excellent pieces of software and may be more appropriate for some situations:

- [rate-limiter-flexible](https://www.npmjs.com/package/rate-limiter-flexible)
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

// Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
// see https://expressjs.com/en/guide/behind-proxies.html
// app.set('trust proxy', 1);

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

// Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
// see https://expressjs.com/en/guide/behind-proxies.html
// app.set('trust proxy', 1);

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

// Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
// see https://expressjs.com/en/guide/behind-proxies.html
// app.set('trust proxy', 1);

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

**Note:** most stores will require additional configuration, such as custom prefixes, when using multiple instances. The default built-in memory store is an exception to this rule.

## Request API

A `req.rateLimit` property is added to all requests with the `limit`, `current`, and `remaining` number of requests and, if the store provides it, a `resetTime` Date object. These may be used in your application code to take additional actions or inform the user of their status.

The property name can be configured with the configuration option `reqRateLimitParam`

## Configuration options

### max

Max number of connections during `windowMs` milliseconds before sending a 429 response.

May be a number, or a function that returns a number or a promise. If `max` is a function, it will be called with `req` and `res` params.

Defaults to `5`. Set to `0` to disable.

### windowMs

Timeframe for which requests are checked/remembered. Also used in the Retry-After header when the limit is reached.

Note: with non-default stores, you may need to configure this value twice, once here and once on the store. In some cases the units also differ (e.g. seconds vs miliseconds)

Defaults to `60000` (1 minute).

### message

Error message sent to user when `max` is exceeded.

May be a String, JSON object, or any other value that Express's [res.send](https://expressjs.com/en/4x/api.html#res.send) supports.

Defaults to `'Too many requests, please try again later.'`

### statusCode

HTTP status code returned when `max` is exceeded.

Defaults to `429`.

### headers

Enable headers for request limit (`X-RateLimit-Limit`) and current usage (`X-RateLimit-Remaining`) on all responses and time to wait before retrying (`Retry-After`) when `max` is exceeded.

Defaults to `true`. Behavior may change in the next major release.

### draft_polli_ratelimit_headers

Enable headers conforming to the [ratelimit standardization proposal](https://tools.ietf.org/id/draft-polli-ratelimit-headers-01.html): `RateLimit-Limit`, `RateLimit-Remaining`, and, if the store supports it, `RateLimit-Reset`. May be used in conjunction with, or instead of the `headers` option.

Defaults to `false`. Behavior and name will likely change in future releases.

### keyGenerator

Function used to generate keys.

Defaults to req.ip:

```js
function (req /*, res*/) {
    return req.ip;
}
```

### handler

The function to handle requests once the max limit is exceeded. It receives the request and the response objects. The "next" param is available if you need to pass to the next middleware.

The`req.rateLimit` object has `limit`, `current`, and `remaining` number of requests and, if the store provides it, a `resetTime` Date object.

Defaults to:

```js
function (req, res, /*next*/) {
    res.status(options.statusCode).send(options.message);
}
```

### onLimitReached

Function that is called the first time a user hits the rate limit within a given window.

The`req.rateLimit` object has `limit`, `current`, and `remaining` number of requests and, if the store provides it, a `resetTime` Date object.

Default is an empty function:

```js
function (req, res, options) {
  /* empty */
}
```

### requestWasSuccessful

Function that is called when `skipFailedRequests` and/or `skipSuccessfulRequests` are set to `true`.
May be overridden if, for example, a service sends out a 200 status code on errors.

Defaults to

```js
function (req, res) {
    return res.statusCode < 400;
}
```

### skipFailedRequests

When set to `true`, failed requests won't be counted. Request considered failed when:

- response status >= 400
- requests that were cancelled before last chunk of data was sent (response `close` event triggered)
- response `error` event was triggrered by response

(Technically they are counted and then un-counted, so a large number of slow requests all at once could still trigger a rate-limit. This may be fixed in a future release.)

Defaults to `false`.

### skipSuccessfulRequests

When set to `true` successful requests (response status < 400) won't be counted.
(Technically they are counted and then un-counted, so a large number of slow requests all at once could still trigger a rate-limit. This may be fixed in a future release.)

Defaults to `false`.

### skip

Function used to skip (whitelist) requests. Returning `true`, or a promise that resolves with `true`, from the function will skip limiting for that request.

Defaults to always `false` (count all requests):

```js
function (/*req, res*/) {
    return false;
}
```

### reqRateLimitParam
Parameter to add to `req`-Object. 

Defaults to `rateLimit`.

### store

The storage to use when persisting rate limit attempts.

By default, the [MemoryStore](lib/memory-store.js) is used.

Available data stores are:

- MemoryStore: _(default)_ Simple in-memory option. Does not share state when app has multiple processes or servers.
- [rate-limit-redis](https://npmjs.com/package/rate-limit-redis): A [Redis](http://redis.io/)-backed store, more suitable for large or demanding deployments.
- [rate-limit-memcached](https://npmjs.org/package/rate-limit-memcached): A [Memcached](https://memcached.org/)-backed store.
- [rate-limit-mongo](https://www.npmjs.com/package/rate-limit-mongo): A [MongoDB](https://www.mongodb.com/)-backed store.

You may also create your own store. It must implement the following in order to function:

```js
function SomeStore() {
  /**
   * Increments the value in the underlying store for the given key.
   * @method function
   * @param {string} key - The key to use as the unique identifier passed
   *                     down from RateLimit.
   * @param {Function} cb - The callback issued when the underlying
   *                                store is finished.
   *
   * The callback should be called with three values:
   *  - error (usually null)
   *  - hitCount for this IP
   *  - resetTime - JS Date object (optional, but necessary for X-RateLimit-Reset header)
   */
  this.incr = function(key, cb) {
    // increment storage
    cb(null, hits, resetTime);
  };

  /**
   * Decrements the value in the underlying store for the given key. Used only when skipFailedRequests is true
   * @method function
   * @param {string} key - The key to use as the unique identifier passed
   *                     down from RateLimit.
   */
  this.decrement = function(key) {
    // decrement storage
  };

  /**
   * Resets a value with the given key.
   * @method function
   * @param  {[type]} key - The key to reset
   */
  this.resetKey = function(key) {
    // remove key from storage or reset it to 0
  };
}
```

## Instance API

### instance.resetKey(key)

Resets the rate limiting for a given key. (Allow users to complete a captcha or whatever to reset their rate limit, then call this method.)

## Summary of breaking changes:

### v5 changes

- Removed index.d.ts. (See [#138](https://github.com/nfriedly/express-rate-limit/issues/138))

### v4 Changes

- Express Rate Limit no longer modifies the passed-in options object, it instead makes a clone of it.

### v3 Changes

- Removed `delayAfter` and `delayMs` options; they were moved to a new module: [express-slow-down](https://npmjs.org/package/express-slow-down).
- Simplified the default `handler` function so that it no longer changes the response format. Now uses [res.send](https://expressjs.com/en/4x/api.html#res.send).
- `onLimitReached` now only triggers once for a given ip and window. only `handle` is called for every blocked request.

### v2 Changes

v2 uses a less precise but less resource intensive method of tracking hits from a given IP. v2 also adds the `limiter.resetKey()` API and removes the `global: true` option.

## License

MIT © [Nathan Friedly](http://nfriedly.com/)
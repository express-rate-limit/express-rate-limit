#  Express Rate Limit

[![Build Status](https://secure.travis-ci.org/nfriedly/express-rate-limit.png?branch=master)](http://travis-ci.org/nfriedly/express-rate-limit)
[![NPM version](http://badge.fury.io/js/express-rate-limit.png)](https://npmjs.org/package/express-rate-limit "View this project on NPM")
[![Dependency Status](https://david-dm.org/nfriedly/express-rate-limit.png?theme=shields.io)](https://david-dm.org/nfriedly/express-rate-limit)
[![Development Dependency Status](https://david-dm.org/nfriedly/express-rate-limit/dev-status.png?theme=shields.io)](https://david-dm.org/nfriedly/express-rate-limit#info=devDependencies)

Basic rate-limiting middleware for Express. Use to limit repeated requests to public APIs and/or endpoints such as password reset.

Note: this module does not share state with other processes/servers by default.
If you need a more robust solution, I recommend adding the [Redis Store][rate-limit-redis] or checking out [strict-rate-limiter](https://www.npmjs.com/package/strict-rate-limiter),  [express-brute](https://www.npmjs.com/package/express-brute), or [rate-limiter](https://www.npmjs.com/package/express-limiter) - all are excellent pieces of software.


## Install

```sh
$ npm install --save express-rate-limit
```

## Usage

For an API-only server where the rate-limiter should be applied to all requests:

```js
var RateLimit = require('express-rate-limit');

app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc)

var limiter = new RateLimit({
  windowMs: 15*60*1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  delayMs: 0 // disable delaying - full speed until the max limit is reached
});

//  apply to all requests
app.use(limiter);
```

For a "regular" web server (e.g. anything that uses `express.static()`), where the rate-limiter should only apply to certain requests:

```js
var RateLimit = require('express-rate-limit');

app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc)

var apiLimiter = new RateLimit({
  windowMs: 15*60*1000, // 15 minutes
  max: 100,
  delayMs: 0 // disabled
});

// only apply to requests that begin with /api/
app.use('/api/', apiLimiter);

```

Create multiple instances to apply different rules to different routes:

```js
var RateLimit = require('express-rate-limit');

app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc)

var apiLimiter = new RateLimit({
  windowMs: 15*60*1000, // 15 minutes
  max: 100,
  delayMs: 0 // disabled
});
app.use('/api/', apiLimiter);

var createAccountLimiter = new RateLimit({
  windowMs: 60*60*1000, // 1 hour window
  delayAfter: 1, // begin slowing down responses after the first request
  delayMs: 3*1000, // slow down subsequent responses by 3 seconds per request
  max: 5, // start blocking after 5 requests
  message: "Too many accounts created from this IP, please try again after an hour"
});
app.post('/create-account', createAccountLimiter, function(req, res) {
 //...
});
```

A `req.rateLimit` property is added to all requests with the `limit`, `current`, and `remaining` number of requests for usage in your application code.

## Configuration

* **windowMs**: milliseconds - how long to keep records of requests in memory. Defaults to `60000` (1 minute).
* **delayAfter**: max number of connections during `windowMs` before starting to delay responses. Defaults to `1`. Set to `0` to disable delaying.  
* **delayMs**: milliseconds - how long to delay the response, multiplied by (number of recent hits - `delayAfter`).  Defaults to `1000` (1 second). Set to `0` to disable delaying.
* **max**: max number of connections during `windowMs` milliseconds before sending a 429 response. Defaults to `5`. Set to `0` to disable.
* **message**: Error message returned when `max` is exceeded. Defaults to `'Too many requests, please try again later.'`
* **statusCode**: HTTP status code returned when `max` is exceeded. Defaults to `429`.
* **headers**: Enable headers for request limit (`X-RateLimit-Limit`) and current usage (`X-RateLimit-Remaining`) on all responses and time to wait before retrying (`Retry-After`) when `max` is exceeded.
* **keyGenerator**: Function used to generate keys. By default user IP address (req.ip) is used. Defaults:
```js
function (req /*, res*/) {
    return req.ip;
}
```
* **skip**: Function used to skip requests. Returning true from the function will skip limiting for that request. Defaults:
```js
function (/*req, res*/) {
    return false;
}
```
* **handler**: The function to execute once the max limit is exceeded. It receives the request and the response objects, "next" function and options. The "next" param is available if you need to pass to the next middleware. Defaults:
```js
function (req, res, next, options) {
  if (options.headers) {
    res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
  }
  res.format({
    html: function(){
      res.status(options.statusCode).end(options.message);
    },
    json: function(){
      res.status(options.statusCode).json({ message: options.message });
    }
  });
}
```
* **onLimitReached**: Function to listen each time the limit is reached. You can use it to debug/log. Defaults:
```js
function (req, res, options) {
  /* empty */
}
```
* **store**: The storage to use when persisting rate limit attempts. By default, the [MemoryStore](lib/memory-store.js) is used. It must implement the following in order to function:
```js
function SomeStore() {
    /**
      * Increments the value in the underlying store for the given key.
      * @method function
      * @param {string} key - The key to use as the unique identifier passed
      *                     down from RateLimit.
      * @param {Store~incrCallback} cb - The callback issued when the underlying
      *                                store is finished.
      */
    this.incr = function(key, cb) {
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
};
```

  Avaliable data stores are:
   * MemoryStore: (default)Simple in-memory option. Does not share state when app has multiple processes or servers.
   * [rate-limit-redis]: [Redis](http://redis.io/)-backed store, more suitable for large or demanding deployments.

The `delayAfter` and `delayMs` options were written for human-facing pages such as login and password reset forms.
For public APIs, setting these to `0` (disabled) and relying on only `windowMs` and `max` for rate-limiting usually makes the most sense.


## Instance API

* **resetKey(key)**: Resets the rate limiting for a given key. (Allow users to complete a captcha or whatever to reset their rate limit, then call this method.)

## v2 changes

v2 uses a less precise but less resource intensive method of tracking hits from a given IP. v2 also adds the `limiter.resetKey()` API and removes the `global: true` option.

## License

MIT © [Nathan Friedly](http://nfriedly.com/)

[rate-limit-redis]: https://npmjs.org/package/rate-limit-redis

# Express Rate Limit

[![Tests](https://github.com/nfriedly/express-rate-limit/workflows/Test/badge.svg)](https://github.com/nfriedly/express-rate-limit/actions)
[![npm version](https://img.shields.io/npm/v/express-rate-limit.svg)](https://npmjs.org/package/express-rate-limit 'View this project on NPM')
[![npm downloads](https://img.shields.io/npm/dm/express-rate-limit)](https://www.npmjs.com/package/express-rate-limit)

Basic rate-limiting middleware for Express. Use to limit repeated requests to
public APIs and/or endpoints such as password reset.

Plays nice with
[express-slow-down](https://www.npmjs.com/package/express-slow-down).

Note: this module does not share state with other processes/servers by default.
If you need a more robust solution, I recommend using an external store. See the
[`stores` section](#store) below for a list of external stores.

### Alternate Rate-limiters

This module was designed to only handle the basics and didn't even support
external stores initially. These other options all are excellent pieces of
software and may be more appropriate for some situations:

- [rate-limiter-flexible](https://www.npmjs.com/package/rate-limiter-flexible)
- [express-brute](https://www.npmjs.com/package/express-brute)
- [rate-limiter](https://www.npmjs.com/package/express-limiter)

## Install

```sh
$ npm install express-rate-limit
```

**This library (v6.0.0 or greater) is now pure ESM**. CommonJS packages will not
be able to synchronously import this package. It is now recommended to use this
library with NodeJS 14 or greater. Take a look at this
[article](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)
for more details.

## Usage

For an API-only server where the rate-limiter should be applied to all requests:

```js
import rateLimit from 'express-rate-limit'

// Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
// see https://expressjs.com/en/guide/behind-proxies.html
// app.set('trust proxy', 1);

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
})

// Apply the rate limiting middleware to all requests
app.use(limiter)
```

For a "regular" web server (e.g. anything that uses `express.static()`), where
the rate-limiter should only apply to certain requests:

```js
import rateLimit from 'express-rate-limit'

// Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
// see https://expressjs.com/en/guide/behind-proxies.html
// app.set('trust proxy', 1);

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
})

// Apply the rate limiting middleware to API calls only
app.use('/api', apiLimiter)
```

Create multiple instances to apply different rules to different routes:

```js
import rateLimit from 'express-rate-limit'

// Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
// see https://expressjs.com/en/guide/behind-proxies.html
// app.set('trust proxy', 1);

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
})

app.use('/api/', apiLimiter)

const createAccountLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 5, // Limit each IP to 5 create account requests per `window` (here, per hour)
	message:
		'Too many accounts created from this IP, please try again after an hour',
})

app.post('/create-account', createAccountLimiter, (request, response) => {
	//...
})
```

> **Note:** most stores will require additional configuration, such as custom
> prefixes, when using multiple instances. The default built-in memory store is
> an exception to this rule.

## Request API

A `request.rateLimit` property is added to all requests with the `limit`,
`current`, and `remaining` number of requests and, if the store provides it, a
`resetTime` Date object. These may be used in your application code to take
additional actions or inform the user of their status.

The property name can be configured with the configuration option
`requestPropertyName`

## Configuration options

### `windowMs`

Time frame for which requests are checked/remembered. Also used in the
`Retry-After` header when the limit is reached.

Note: with non-default stores, you may need to configure this value twice, once
here and once on the store. In some cases the units also differ (e.g. seconds vs
miliseconds)

Defaults to `60000` ms (= 1 minute).

### `max`

Max number of connections during `windowMs` milliseconds before sending a 429
response.

May be a number, or a function that returns a number or a promise. If `max` is a
function, it will be called with `request` and `response` params.

Defaults to `5`. Set to `0` to disable.

Example of using a function:

```js
import rateLimit from 'express-rate-limit'

const isPremium = (request) => {
	// ...
}

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes

	// `max` could also be an async function or return a promise
	max: (request, response) => {
		if (isPremium(request)) return 10
		else return 5
	},
})

// Apply the rate limiting middleware to all requests
app.use(limiter)
```

### `message`

Error message sent to user when `max` is exceeded.

May be a `string`, JSON object, or any other value that Express's
[response.send](https://expressjs.com/en/4x/api.html#response.send) method
supports.

Defaults to `'Too many requests, please try again later.'`

### `statusCode`

HTTP status code returned when `max` is exceeded.

Defaults to `429`.

### `headers`

Enable headers for request limit (`X-RateLimit-Limit`) and current usage
(`X-RateLimit-Remaining`) on all responses and time to wait before retrying
(`Retry-After`) when `max` is exceeded.

Defaults to `true`. Behavior may change in the next major release.

### `useStandardizedHeaders`

Enable headers conforming to the
[ratelimit standardization proposal](https://tools.ietf.org/id/draft-polli-ratelimit-headers-01.html):
`RateLimit-Limit`, `RateLimit-Remaining`, and, if the store supports it,
`RateLimit-Reset`. May be used in conjunction with, or instead of the `headers`
option.

Defaults to `false`. Behavior and name will likely change in future releases.

### `keyGenerator`

Function used to generate keys.

Defaults to `request.ip`, similar to this:

```js
const keyGenerator = (request /*, response*/) => request.ip
```

### `handler`

The function to handle requests once the max limit is exceeded. It receives the
`request` and the `response` objects. The `next` param is available if you need
to pass to the next middleware/route. Finally, the options param has all of the
options that originally passed in when creating the current limiter and the
default values for other options.

The `request.rateLimit` object has `limit`, `current`, and `remaining` number of
requests and, if the store provides it, a `resetTime` Date object.

Defaults to:

```js
const handler = (request, response, options) => {
	response.status(options.statusCode).send(options.message)
}
```

### `onLimitReached`

Function that is called the first time a user hits the rate limit within a given
window.

The `request.rateLimit` object has the rate limit `limit`, number of requests
made so far `current`, the remaining number of requests `remaining` and, if the
store provides it, a Date object for when the hit count for all clients will be
reset `resetTime`.

Default is an empty function:

```js
const onLimitReached = (request, response, options) => {}
```

### `requestWasSuccessful`

Function that is called when `skipFailedRequests` and/or
`skipSuccessfulRequests` are set to `true`. May be overridden if, for example, a
service sends out a 200 status code on errors.

Defaults to

```js
const requestWasSuccessful = (request, response) => response.statusCode < 400
```

### `skipFailedRequests`

When set to `true`, failed requests won't be counted. Request considered failed
when:

- response status >= 400
- requests that were cancelled before last chunk of data was sent (response
  `close` event triggered)
- response `error` event was triggrered by response

(Technically they are counted and then un-counted, so a large number of slow
requests all at once could still trigger a rate-limit. This may be fixed in a
future release.)

Defaults to `false`.

### `skipSuccessfulRequests`

When set to `true` successful requests (response status < 400) won't be counted.
(Technically they are counted and then un-counted, so a large number of slow
requests all at once could still trigger a rate-limit. This may be fixed in a
future release.)

Defaults to `false`.

### `skip`

Function used to skip (whitelist) requests. Returning `true`, or a promise that
resolves with `true`, from the function will skip limiting for that request.

Defaults to always `false` (count all requests):

```js
const skip = (/*request, response*/) => false
```

### `requestPropertyName`

The name of the property that contains the rate limit information to add to the
`request` object.

Defaults to `rateLimit`.

### `store`

The storage to use when persisting rate limit attempts.

By default, the [memory store](source/memory-store.ts) is used.

Available data stores are:

- [memory-store](source/memory-store.ts): _(default)_ Simple in-memory option.
  Does not share state when app has multiple processes or servers.
- [rate-limit-redis](https://npmjs.com/package/rate-limit-redis): A
  [Redis](http://redis.io/)-backed store, more suitable for large or demanding
  deployments.
- [rate-limit-memcached](https://npmjs.org/package/rate-limit-memcached): A
  [Memcached](https://memcached.org/)-backed store.
- [rate-limit-mongo](https://www.npmjs.com/package/rate-limit-mongo): A
  [MongoDB](https://www.mongodb.com/)-backed store.
- [precise-memory-rate-limit](https://www.npmjs.com/package/precise-memory-rate-limit) -
  A memory store similar to the built-in one, except that it stores a distinct
  timestamp for each IP rather than bucketing them together.

You may also create your own store. It must implement the `Store` interface as
follows:

```js
import rateLimit, { Store, IncrementCallback } from 'express-rate-limit'

/**
 * A {@link Store} that stores the hit count for each client.
 *
 * @public
 */
class SomeStore implements Store {
	/**
	 * The duration of time before which all hit counts are reset (in milliseconds).
	 */
	windowMs: number

	/**
	 * @constructor for {@link SomeStore}
	 *
	 * @param windowMs {number} - The duration of a window (in milliseconds)
	 */
	constructor(windowMs: number) {
		this.windowMs = windowMs
	}

	/**
	 * Method to increment a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 * @param callback {IncrementCallback} - The callback to call once the counter is incremented
	 *
	 * @public
	 */
	increment(key: string, callback: IncrementCallback) {
		// ...

		callback(undefined, total, resetTime)
	}

	/**
	 * Method to decrement a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 *
	 * @public
	 */
	decrement(key: string) {
		// ...
	}

	/**
	 * Method to reset a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 *
	 * @public
	 */
	resetKey(key: string) {
		// ...
	}

	/**
	 * Method to reset everyone's hit counter.
	 *
	 * @public
	 */
	resetAll() {
		// ...
	}
}

export default SomeStore
```

## Instance API

### `resetKey(key)`

Resets the rate limiting for a given key. An example use case is to allow users
to complete a captcha or whatever to reset their rate limit, then call this
method.

## License

MIT © [Nathan Friedly](http://nfriedly.com/)

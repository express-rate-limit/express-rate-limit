# <div align="center"> Express Rate Limit </div>

<div align="center">

[![Tests](https://github.com/nfriedly/express-rate-limit/workflows/Test/badge.svg)](https://github.com/nfriedly/express-rate-limit/actions)
[![npm version](https://img.shields.io/npm/v/express-rate-limit.svg)](https://npmjs.org/package/express-rate-limit 'View this project on NPM')
[![npm downloads](https://img.shields.io/npm/dm/express-rate-limit)](https://www.npmjs.com/package/express-rate-limit)

Basic rate-limiting middleware for Express. Use to limit repeated requests to
public APIs and/or endpoints such as password reset. Plays nice with
[express-slow-down](https://www.npmjs.com/package/express-slow-down).

</div>

### Alternate Rate Limiters

> This module does not share state with other processes/servers by default. If
> you need a more robust solution, I recommend using an external store. See the
> [`stores` section](#store) below for a list of external stores.

This module was designed to only handle the basics and didn't even support
external stores initially. These other options all are excellent pieces of
software and may be more appropriate for some situations:

- [rate-limiter-flexible](https://www.npmjs.com/package/rate-limiter-flexible)
- [express-brute](https://www.npmjs.com/package/express-brute)
- [rate-limiter](https://www.npmjs.com/package/express-limiter)

## Installation

From the npm registry:

```sh
# Using npm
> npm install express-rate-limit
# Using yarn or pnpm
> yarn/pnpm add express-rate-limit
```

From Github Releases:

```sh
# Using npm
> npm install https://github.com/nfriedly/express-rate-limit/releases/download/v{version}/express-rate-limit.tgz
# Using yarn or pnpm
> yarn/pnpm add https://github.com/nfriedly/express-rate-limit/releases/download/v{version}/express-rate-limit.tgz
```

Replace `{version}` with the version of the package that you want to your, e.g.:
`6.0.0`.

## Usage

### Importing

This library is provided in ESM as well as CJS forms, and works with both
Javascript and Typescript projects.

**This package requires you to use Node 14 or above.**

Import it in a CommonJS project (`type: commonjs` or no `type` field in
`package.json`) as follows:

```ts
const rateLimit = require('express-rate-limit')
```

Import it in a ESM project (`type: module` in `package.json`) as follows:

```ts
import rateLimit from 'express-rate-limit'
```

### Examples

To use it in an API-only server where the rate-limiter should be applied to all
requests:

```ts
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

// Apply the rate limiting middleware to all requests
app.use(limiter)
```

To use it in a 'regular' web server (e.g. anything that uses
`express.static()`), where the rate-limiter should only apply to certain
requests:

```ts
import rateLimit from 'express-rate-limit'

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

// Apply the rate limiting middleware to API calls only
app.use('/api', apiLimiter)
```

To create multiple instances to apply different rules to different endpoints:

```ts
import rateLimit from 'express-rate-limit'

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

app.use('/api/', apiLimiter)

const createAccountLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 5, // Limit each IP to 5 create account requests per `window` (here, per hour)
	message:
		'Too many accounts created from this IP, please try again after an hour',
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

app.post('/create-account', createAccountLimiter, (request, response) => {
	//...
})
```

To use a custom store:

```ts
import rateLimit from 'express-rate-limit'
import MemoryStore from 'express-rate-limit/memory-store.js'

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	store: new MemoryStore(),
})

// Apply the rate limiting middleware to API calls only
app.use('/api', apiLimiter)
```

> **Note:** most stores will require additional configuration, such as custom
> prefixes, when using multiple instances. The default built-in memory store is
> an exception to this rule.

### Troubleshooting Proxy Issues

If you are behind a proxy/load balancer (usually the case with most hosting
services, e.g. Heroku, Bluemix, AWS ELB, Nginx, Cloudflare, Akamai, Fastly,
Firebase Hosting, Rackspace LB, Riverbed Stingray, etc.), the IP address of the
request might be the IP of the load balancer/reverse proxy (making the rate
limiter effectively a global one and blocking all requests once the limit is
reached) or `undefined`. To solve this issue, add the following line to your
code (right after you create the express application):

```ts
app.set('trust proxy', numberOfProxies)
```

Where `numberOfProxies` is the number of proxies between the user and the
server. To find the correct number, create a test endpoint that returns the
client IP:

```ts
app.set('trust proxy', 1)
app.get('/ip', (request, response) => response.send(request.ip))
```

Go to `/ip` and see the IP address returned in the response. If it matches your
IP address (which you can get by going to http://ip.nfriedly.com/ or
https://api.ipify.org/), then the number of proxies is correct and the rate
limiter should now work correctly. If not, then keep increasing the number until
it does.

For more information about the `trust proxy` setting, take a look at the
[official Express documentation](https://expressjs.com/en/guide/behind-proxies.html).

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

```ts
import rateLimit from 'express-rate-limit'

const isPremium = (request) => {
	// ...
}

const limiter = rateLimit({
	// `max` could also be an async function or return a promise
	max: (request, response) => {
		if (isPremium(request)) return 10
		else return 5
	},
	// ...
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

### `legacyHeaders`

Enable headers for request limit (`X-RateLimit-Limit`) and current usage
(`X-RateLimit-Remaining`) on all responses and time to wait before retrying
(`Retry-After`) when `max` is exceeded.

Defaults to `true`.

> Renamed in `6.x` from `headers` to `legacyHeaders`.

### `standardHeaders`

Enable headers conforming to the
[ratelimit standardization draft](https://github.com/ietf-wg-httpapi/ratelimit-headers/blob/main/draft-ietf-httpapi-ratelimit-headers.md)
adopted by the IETF: `RateLimit-Limit`, `RateLimit-Remaining`, and, if the store
supports it, `RateLimit-Reset`. May be used in conjunction with, or instead of
the `legacyHeaders` option.

This setting also enables the `Retry-After` header when `max` is exceeded.

Defaults to `false` (for backward compatibility), but recommended to use.

> Renamed in `6.x` from `draft_polli_ratelimit_headers` to `standardHeaders`.

### `keyGenerator`

Function used to generate keys.

Defaults to `request.ip`, similar to this:

```ts
const keyGenerator = (request /*, response*/) => request.ip
```

### `handler`

The function to handle requests once the max limit is exceeded. It receives the
`request` and the `response` objects. The `next` param is available if you need
to pass to the next middleware/route. Finally, the `options` param has all of
the options that originally passed in when creating the current limiter and the
default values for other options.

The `request.rateLimit` object has `limit`, `current`, and `remaining` number of
requests and, if the store provides it, a `resetTime` Date object.

Defaults to:

```ts
const handler = (request, response, next, options) => {
	response.status(options.statusCode).send(options.message)
}
```

### `requestWasSuccessful`

Function that is called when `skipFailedRequests` and/or
`skipSuccessfulRequests` are set to `true`. May be overridden if, for example, a
service sends out a 200 status code on errors.

Defaults to

```ts
const requestWasSuccessful = (request, response) => response.statusCode < 400
```

### `skipFailedRequests`

When set to `true`, failed requests won't be counted. Request considered failed
when:

- response status >= 400
- requests that were cancelled before last chunk of data was sent (response
  `close` event triggered)
- response `error` event was triggered by response

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

```ts
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

```ts
import rateLimit, {
	Store,
	Options,
	IncrementResponse,
} from 'express-rate-limit'

/**
 * A {@link Store} that stores the hit count for each client.
 *
 * @public
 */
class SomeStore implements Store {
	/**
	 * Some store-specific parameter.
	 */
	customParam!: string
	/**
	 * The duration of time before which all hit counts are reset (in milliseconds).
	 */
	windowMs!: number

	/**
	 * @constructor for {@link SomeStore}. Only required if the user needs to pass
	 * some store specific parameters. For example, in a Mongo Store, the user will
	 * need to pass the URI, username and password for the Mongo database.
	 *
	 * @param customParam {string} - Some store-specific parameter.
	 */
	constructor(customParam: string) {
		this.customParam = customParam
	}

	/**
	 * Method that actually initializes the store. Must be synchronous.
	 *
	 * @param options {Options} - The options used to setup the middleware.
	 *
	 * @public
	 */
	init(options: Options): void {
		this.windowMs = options.windowMs

		// ...
	}

	/**
	 * Method to increment a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 *
	 * @returns {IncrementResponse} - The number of hits and reset time for that client
	 *
	 * @public
	 */
	async increment(key: string): Promise<IncrementResponse> {
		// ...

		return {
			totalHits,
			resetTime,
		}
	}

	/**
	 * Method to decrement a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 *
	 * @public
	 */
	async decrement(key: string): Promise<void> {
		// ...
	}

	/**
	 * Method to reset a client's hit counter.
	 *
	 * @param key {string} - The identifier for a client
	 *
	 * @public
	 */
	async resetKey(key: string): Promise<void> {
		// ...
	}

	/**
	 * Method to reset everyone's hit counter.
	 *
	 * @public
	 */
	async resetAll(): Promise<void> {
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

## Issues and Contributing

If you encounter a bug or want to see something added/changed, please go ahead
and [open an issue](https://github.com/nfriedly/express-rate-limit/issues/new)!
If you need help with something, feel free to
[start a discussion](https://github.com/nfriedly/express-rate-limit/discussions/new)!

If you wish to contribute to the library, thanks! First, please read
[the contributing guide](contributing.md). Then you can pick up any issue and
fix/implement it!

## License

MIT © [Nathan Friedly](http://nfriedly.com/)

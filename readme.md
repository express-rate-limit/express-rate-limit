# <div align="center"> Express Rate Limit </div>

---

Sponsored by [Zuplo](https://zuplo.link/express-rate-limit) a fully-managed API
Gateway for developers. Add
[dynamic rate-limiting](https://zuplo.link/dynamic-rate-limiting),
authentication and more to any API in minutes. Learn more at
[zuplo.com](https://zuplo.link/express-rate-limit)

---

<div align="center">

[![Tests](https://github.com/express-rate-limit/express-rate-limit/workflows/Test/badge.svg)](https://github.com/express-rate-limit/express-rate-limit/actions)
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

- [`rate-limiter-flexible`](https://www.npmjs.com/package/rate-limiter-flexible)
- [`express-brute`](https://www.npmjs.com/package/express-brute)
- [`rate-limiter`](https://www.npmjs.com/package/express-limiter)

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
> npm install https://github.com/express-rate-limit/express-rate-limit/releases/download/v{version}/express-rate-limit.tgz
# Using yarn or pnpm
> yarn/pnpm add https://github.com/express-rate-limit/express-rate-limit/releases/download/v{version}/express-rate-limit.tgz
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
import rateLimit, { MemoryStore } from 'express-rate-limit'

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
public IP address, then the number of proxies is correct and the rate limiter
should now work correctly. If not, then keep increasing the number until it
does.

For more information about the `trust proxy` setting, take a look at the
[official Express documentation](https://expressjs.com/en/guide/behind-proxies.html).

## Configuration

### `windowMs`

> `number`

Time frame for which requests are checked/remembered. Also used in the
`Retry-After` header when the limit is reached.

Note: with stores that do not implement the `init` function (see the table in
the [`stores` section below](#stores)), you may need to configure this value
twice, once here and once on the store. In some cases the units also differ
(e.g. seconds vs miliseconds).

Defaults to `60000` ms (= 1 minute).

### `max`

> `number | function`

The maximum number of connections to allow during the `window` before rate
limiting the client.

Can be the limit itself as a number or a (sync/async) function that accepts the
Express `request` and `response` objects and then returns a number.

Defaults to `5`. Set it to `0` to disable the rate limiter.

An example of using a function:

```ts
const isPremium = async (user) => {
	// ...
}

const limiter = rateLimit({
	// ...
	max: async (request, response) => {
		if (await isPremium(request.user)) return 10
		else return 5
	},
})
```

### `message`

> `any`

The response body to send back when a client is rate limited.

May be a `string`, JSON object, or any other value that Express's
[`response.send`](https://expressjs.com/en/4x/api.html#res.send) method
supports. It can also be a (sync/async) function that accepts the Express
request and response objects and then returns a `string`, JSON object or any
other value the Express `response.send` function accepts.

Defaults to `'Too many requests, please try again later.'`

An example of using a function:

```ts
const isPremium = async (user) => {
	// ...
}

const limiter = rateLimit({
	// ...
	message: async (request, response) => {
		if (await isPremium(request.user))
			return 'You can only make 10 requests every hour.'
		else return 'You can only make 5 requests every hour.'
	},
})
```

### `statusCode`

> `number`

The HTTP status code to send back when a client is rate limited.

Defaults to `429` (HTTP 429 Too Many Requests - RFC 6585).

### `legacyHeaders`

> `boolean`

Whether to send the legacy rate limit headers for the limit
(`X-RateLimit-Limit`), current usage (`X-RateLimit-Remaining`) and reset time
(if the store provides it) (`X-RateLimit-Reset`) on all responses. If set to
`true`, the middleware also sends the `Retry-After` header on all blocked
requests.

Defaults to `true` (for backward compatibility).

> Renamed in `6.x` from `headers` to `legacyHeaders`.

### `standardHeaders`

> `boolean`

Whether to enable support for headers conforming to the
[ratelimit standardization draft](https://github.com/ietf-wg-httpapi/ratelimit-headers/blob/main/draft-ietf-httpapi-ratelimit-headers.md)
adopted by the IETF (`RateLimit-Limit`, `RateLimit-Remaining`, and, if the store
supports it, `RateLimit-Reset`). If set to `true`, the middleware also sends the
`Retry-After` header on all blocked requests. May be used in conjunction with,
or instead of the `legacyHeaders` option.

Defaults to `false` (for backward compatibility, but its use is recommended).

> Renamed in `6.x` from `draft_polli_ratelimit_headers` to `standardHeaders`.

### `requestPropertyName`

> `string`

The name of the property on the Express `request` object to store the rate limit
info.

Defaults to `'rateLimit'`.

### `skipFailedRequests`

> `boolean`

When set to `true`, failed requests won't be counted. Request considered failed
when the `requestWasSuccessful` option returns `false`. By default, this means
requests fail when:

- the response status >= 400
- the request was cancelled before last chunk of data was sent (response `close`
  event triggered)
- the response `error` event was triggered by response

(Technically they are counted and then un-counted, so a large number of slow
requests all at once could still trigger a rate-limit. This may be fixed in a
future release. PRs welcome!)

Defaults to `false`.

### `skipSuccessfulRequests`

> `boolean`

If `true`, the library will (by default) skip all requests that are considered
'failed' by the `requestWasSuccessful` function. By default, this means requests
succeed when the response status code < 400.

(Technically they are counted and then un-counted, so a large number of slow
requests all at once could still trigger a rate-limit. This may be fixed in a
future release. PRs welcome!)

Defaults to `false`.

### `keyGenerator`

> `function`

Method to retrieve custom identifiers for clients, such as their IP address,
username, or API Key.

Should be a (sync/async) function that accepts the Express `request` and
`response` objects and then returns a string.

By default, the client's IP address is used:

```ts
const limiter = rateLimit({
	// ...
	keyGenerator: (request, response) => request.ip,
})
```

Note: if a keyGenerator returns the same value for every user, it becomes a
global rate limiter. This could be combined with a second instance of 
express-rate-limit to have both global and per-user limits.

### `handler`

> `function`

Express request handler that sends back a response when a client is
rate-limited.

By default, sends back the `statusCode` and `message` set via the `options`,
similar to this:

```ts
const limiter = rateLimit({
	// ...
	handler: (request, response, next, options) =>
		response.status(options.statusCode).send(options.message),
})
```

### `onLimitReached`

> `function`

A (sync/async) function that accepts the Express `request` and `response`
objects that is called when a client has reached their rate limit, and will be
rate limited on their next request.

This method was
[deprecated in v6](https://github.com/express-rate-limit/express-rate-limit/releases/v6.0.0) -
Please use a custom `handler` that checks the number of hits instead.

### `skip`

> `function`

Function to determine whether or not this request counts towards a client's
quota. Should be a (sync/async) function that accepts the Express `request` and
`response` objects and then returns `true` or `false`.

Could also act as an allowlist for certain keys:

```ts
const allowlist = ['192.168.0.56', '192.168.0.21']

const limiter = rateLimit({
	// ...
	skip: (request, response) => allowlist.includes(request.ip),
})
```

By default, it skips no requests:

```ts
const limiter = rateLimit({
	// ...
	skip: (request, response) => false,
})
```

### `requestWasSuccessful`

> `function`

Method to determine whether or not the request counts as 'succesful'. Used when
either `skipSuccessfulRequests` or `skipFailedRequests` is set to true. Should
be a (sync/async) function that accepts the Express `request` and `response`
objects and then returns `true` or `false`.

By default, requests with a response status code less than 400 are considered
successful:

```ts
const limiter = rateLimit({
	// ...
	requestWasSuccessful: (request, response) => response.statusCode < 400,
})
```

### `store`

> `Store`

The `Store` to use to store the hit count for each client.

By default, the [`memory-store`](source/memory-store.ts) is used.

Here is a list of external stores:

| Name                                                                                   | Description                                                                                           | Legacy/Modern       |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------- |
| [`memory-store`](source/memory-store.ts)                                               | _(default)_ Simple in-memory option. Does not share state when app has multiple processes or servers. | Modern as of v6.0.0 |
| [`rate-limit-redis`](https://npmjs.com/package/rate-limit-redis)                       | A [Redis](http://redis.io/)-backed store, more suitable for large or demanding deployments.           | Modern as of v3.0.0 |
| [`rate-limit-memcached`](https://npmjs.org/package/rate-limit-memcached)               | A [Memcached](https://memcached.org/)-backed store.                                                   | Legacy              |
| [`rate-limit-mongo`](https://www.npmjs.com/package/rate-limit-mongo)                   | A [MongoDB](https://www.mongodb.com/)-backed store.                                                   | Legacy              |
| [`precise-memory-rate-limit`](https://www.npmjs.com/package/precise-memory-rate-limit) | A memory store similar to the built-in one, except that it stores a distinct timestamp for each key.  | Legacy              |

Take a look at
[this guide](https://github.com/express-rate-limit/express-rate-limit/wiki/Creating-Your-Own-Store)
if you wish to create your own store.

## Request API

A `request.rateLimit` property is added to all requests with the `limit`,
`current`, and `remaining` number of requests and, if the store provides it, a
`resetTime` Date object. These may be used in your application code to take
additional actions or inform the user of their status.

The property name can be configured with the configuration option
`requestPropertyName`.

## Instance API

### `resetKey(key)`

Resets the rate limiting for a given key. An example use case is to allow users
to complete a captcha or whatever to reset their rate limit, then call this
method.

## Issues and Contributing

If you encounter a bug or want to see something added/changed, please go ahead
and
[open an issue](https://github.com/nfriexpress-rate-limitedly/express-rate-limit/issues/new)!
If you need help with something, feel free to
[start a discussion](https://github.com/express-rate-limit/express-rate-limit/discussions/new)!

If you wish to contribute to the library, thanks! First, please read
[the contributing guide](contributing.md). Then you can pick up any issue and
fix/implement it!

## License

MIT © [Nathan Friedly](http://nfriedly.com/)

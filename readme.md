# <div align="center"> Express Rate Limit </div>

---

Sponsored by [Zuplo](https://zuplo.link/express-rate-limit) a fully-managed API
Gateway for developers. Add
[dynamic rate-limiting](https://zuplo.link/dynamic-rate-limiting),
authentication and more to any API in minutes. Learn more at
[zuplo.com](https://zuplo.link/express-rate-limit)

---

<div align="center">

[![tests](https://github.com/express-rate-limit/express-rate-limit/actions/workflows/ci.yaml/badge.svg)](https://github.com/express-rate-limit/express-rate-limit/actions/workflows/ci.yaml)
[![npm version](https://img.shields.io/npm/v/express-rate-limit.svg)](https://npmjs.org/package/express-rate-limit 'View this project on NPM')
[![npm downloads](https://img.shields.io/npm/dm/express-rate-limit)](https://www.npmjs.com/package/express-rate-limit)

Basic rate-limiting middleware for [Express](http://expressjs.com/). Use to
limit repeated requests to public APIs and/or endpoints such as password reset.
Plays nice with
[express-slow-down](https://www.npmjs.com/package/express-slow-down).

</div>

## Use Cases

Depending on your use case, you may want to switch to a different
[store](#store).

### Abuse Prevention

The default `MemoryStore` is probably fine.

### API Rate Limit Enforcement

You may want to switch to a different [store](#store), especially if you have
multiple servers or processes (for example, with the
[node:cluster](https://nodejs.org/api/cluster.html) module). Using an external
data store to syhcnronize hits
([redis](https://npmjs.com/package/rate-limit-redis),
[memcached](https://npmjs.org/package/rate-limit-memcached), [etc.](#store))
guarentees the expected result even if some requests get handled by different
servers/processes or a server is restarted.

### Alternate Rate Limiters

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

**This package requires you to use Node 16 or above.**

Import it in a CommonJS project (`type: commonjs` or no `type` field in
`package.json`) as follows:

```ts
const { rateLimit } = require('express-rate-limit')
```

Import it in a ESM project (`type: module` in `package.json`) as follows:

```ts
import { rateLimit } from 'express-rate-limit'
```

### Examples

To use it in an API-only server where the rate-limiter should be applied to all
requests:

```ts
import { rateLimit } from 'express-rate-limit'

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	// store: ... , // Use an external store for more precise rate limiting
})

// Apply the rate limiting middleware to all requests
app.use(limiter)
```

To use it in a 'regular' web server (e.g. anything that uses
`express.static()`), where the rate-limiter should only apply to certain
requests:

```ts
import { rateLimit } from 'express-rate-limit'

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: 'draft-7', // Set `RateLimit` and `RateLimit-Policy` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	// store: ... , // Use an external store for more precise rate limiting
})

// Apply the rate limiting middleware to API calls only
app.use('/api', apiLimiter)
```

To create multiple instances to apply different rules to different endpoints:

```ts
import { rateLimit } from 'express-rate-limit'

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	// store: ... , // Use an external store for more precise rate limiting
})

app.use('/api/', apiLimiter)

const createAccountLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	limit: 5, // Limit each IP to 5 create account requests per `window` (here, per hour)
	message:
		'Too many accounts created from this IP, please try again after an hour',
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

app.post('/create-account', createAccountLimiter, (req, res) => {
	//...
})
```

To use a custom store:

```ts
import { rateLimit } from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import RedisClient from 'ioredis'

const redisClient = new RedisClient()
const rateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	store: new RedisStore({
		/* ... */
	}), // Use the external store
})

// Apply the rate limiting middleware to all requests
app.use(rateLimiter)
```

> **Note:** most stores will require additional configuration, such as custom
> prefixes, when using multiple instances. The default built-in memory store is
> an exception to this rule.

### Troubleshooting Proxy Issues

Please take a look at
[the wiki page](https://github.com/express-rate-limit/express-rate-limit/wiki/Troubleshooting-Proxy-Issues)
on this issue.

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

### `limit`

> `number | function`

The maximum number of connections to allow during the `window` before rate
limiting the client.

Can be the limit itself as a number or a (sync/async) function that accepts the
Express `req` and `res` objects and then returns a number.

~Set it to `0` to disable the rate limiter.~ As of version 7.0.0, setting `max`
to zero will no longer disable the rate limiter - instead, it will 'block' all
requests to that endpoint.

Defaults to `5`.

> Renamed in v7.x from `max` to `limit`. However, `max` will still be supported
> for backwards-compatibility.

An example of using a function:

```ts
const isPremium = async (user) => {
	// ...
}

const limiter = rateLimit({
	// ...
	limit: async (req, res) => {
		if (await isPremium(req.user)) return 10
		else return 5
	},
})
```

### `message`

> `any`

The response body to send back when a client is rate limited.

May be a `string`, JSON object, or any other value that Express's
[`res.send`](https://expressjs.com/en/4x/api.html#res.send) method supports. It
can also be a (sync/async) function that accepts the Express request and
response objects and then returns a `string`, JSON object or any other value the
Express `res.send` function accepts.

Defaults to `'Too many requests, please try again later.'`

An example of using a function:

```ts
const isPremium = async (user) => {
	// ...
}

const limiter = rateLimit({
	// ...
	message: async (req, res) => {
		if (await isPremium(req.user))
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

> `boolean` | `'draft-6'` | `'draft-7'`

Whether to enable support for headers conforming to the
[RateLimit header fields for HTTP standardization draft](https://github.com/ietf-wg-httpapi/ratelimit-headers)
adopted by the IETF.

If set to `draft-6`, separate `RateLimit-Policy` `RateLimit-Limit`,
`RateLimit-Remaining`, and, if the store supports it, `RateLimit-Reset` headers
are set on the response, in accordance with
[draft-ietf-httpapi-ratelimit-headers-06](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers-06).

If set to `draft-7`, a combined `RateLimit` header is set containing limit,
remaining, and reset values, and a `RateLimit-Policy` header is set, in
accordiance with
[draft-ietf-httpapi-ratelimit-headers-07](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers-07).
`windowMs` is used for the reset value if the store does not provide a reset
time.

If set to `true`, it is treated as `draft-6`, however this behavior may change
in a future semver major release.

If set to any truthy value, the middleware also sends the `Retry-After` header
on all blocked requests.

The `standardHeaders` option may be used in conjunction with, or instead of the
`legacyHeaders` option.

ℹ️ Tip: use
[ratelimit-header-parser](https://www.npmjs.com/package/ratelimit-header-parser)
in clients to read/parse any form of express-rate-limit's headers.

Defaults to `false`.

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
	keyGenerator: (req, res) => req.ip,
})
```

> **Note** If a `keyGenerator` returns the same value for every user, it becomes
> a global rate limiter. This could be combined with a second instance of
> `express-rate-limit` to have both global and per-user limits.

### `handler`

> `function`

Express request handler that sends back a response when a client is
rate-limited.

By default, sends back the `statusCode` and `message` set via the `options`,
similar to this:

```ts
const limiter = rateLimit({
	// ...
	handler: (req, res, next, options) =>
		res.status(options.statusCode).send(options.message),
})
```

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
	skip: (req, res) => allowlist.includes(req.ip),
})
```

By default, it skips no requests:

```ts
const limiter = rateLimit({
	// ...
	skip: (req, res) => false,
})
```

### `requestWasSuccessful`

> `function`

Method to determine whether or not the request counts as 'succesful'. Used when
either `skipSuccessfulRequests` or `skipFailedRequests` is set to true. Should
be a (sync/async) function that accepts the Express `req` and `res` objects and
then returns `true` or `false`.

By default, requests with a response status code less than 400 are considered
successful:

```ts
const limiter = rateLimit({
	// ...
	requestWasSuccessful: (req, res) => res.statusCode < 400,
})
```

### `validate`

> `boolean | Object`

When enabled, a set of validation checks are run at creation and on the first
request to detect common misconfigurations with proxies, etc. Prints an error to
the console if any issue is detected.

Automatically disables after the first request is processed.

If set to `true` or `false`, all validations are enabled or disabled.

If set to an object, individual validations can be enabled or disabled by name,
and the key `default` controls all unspecified validations. For example:

```js
const limiter = rateLimit({
	validate: {
		xForwardedForHeader: false,
		default: true,
	},
	// ...
})
```

Supported options are `ip`, `trustProxy`, `xForwardedForHeader`, `positiveHits`,
`singleCount`, `limit`, `draftPolliHeaders`, `onLimitReached`,
`headersResetTime`, `validationsConfig`, and `default`.

See https://github.com/express-rate-limit/express-rate-limit/wiki/Error-Codes
for more info.

Defaults to `true`.

### `store`

> `Store`

The `Store` to use to store the hit count for each client.

By default, the [`memory-store`](source/memory-store.ts) is used.

Legacy Stores do not return the reset time, and therfore Reset and Retry-After
headers will be mising or less accurate.

Here is a list of external stores:

| Name                                                                                   | Description                                                                                           | Legacy/Modern       |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------- |
| [`memory-store`](source/memory-store.ts)                                               | _(default)_ Simple in-memory option. Does not share state when app has multiple processes or servers. | Modern as of v6.0.0 |
| [`rate-limit-redis`](https://npmjs.com/package/rate-limit-redis)                       | A [Redis](http://redis.io/)-backed store, more suitable for large or demanding deployments.           | Modern as of v3.0.0 |
| [`rate-limit-memcached`](https://npmjs.org/package/rate-limit-memcached)               | A [Memcached](https://memcached.org/)-backed store.                                                   | Modern as of v1.0.0 |
| [`rate-limit-mongo`](https://www.npmjs.com/package/rate-limit-mongo)                   | A [MongoDB](https://www.mongodb.com/)-backed store.                                                   | Legacy              |
| [`precise-memory-rate-limit`](https://www.npmjs.com/package/precise-memory-rate-limit) | A memory store similar to the built-in one, except that it stores a distinct timestamp for each key.  | Modern as of v2.0.0 |
| [`rate-limit-postgresql`](https://www.npmjs.com/package/@acpr/rate-limit-postgresql)   | A [PostgreSQL](https://www.postgresql.org/)-backed store.                                             | Modern as of v1.1.0 |

Take a look at
[this guide](https://github.com/express-rate-limit/express-rate-limit/wiki/Creating-Your-Own-Store)
if you wish to create your own store.

## Request API

A `req.rateLimit` property is added to all requests with the `limit`, `used`,
and `remaining` number of requests and, if the store provides it, a `resetTime`
Date object. These may be used in your application code to take additional
actions or inform the user of their status.

Note that `used` includes the current request, so it should always be > 0.

The property name can be configured with the configuration option
`requestPropertyName`.

## Instance API

### `resetKey(key)`

Resets the rate limiting for a given key. An example use case is to allow users
to complete a captcha to reset their rate limit, then call this function.

### `getKey(key)`

Retrieves the hit count and reset time from the store for a given key.

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

MIT © [Nathan Friedly](http://nfriedly.com/),
[Vedant K](https://github.com/gamemaker1)

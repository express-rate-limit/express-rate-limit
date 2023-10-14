<h1 align="center"> <code>express-rate-limit</code> </h1>

<div align="center">

[![tests](https://img.shields.io/github/actions/workflow/status/express-rate-limit/express-rate-limit/ci.yaml)](https://github.com/express-rate-limit/express-rate-limit/actions/workflows/ci.yaml)
[![npm version](https://img.shields.io/npm/v/express-rate-limit.svg)](https://npmjs.org/package/express-rate-limit 'View this project on NPM')
[![npm downloads](https://img.shields.io/npm/dm/express-rate-limit)](https://www.npmjs.com/package/express-rate-limit)
[![license](https://img.shields.io/npm/l/express-rate-limit)](license.md)

</div>

---

Sponsored by [Zuplo](https://zuplo.link/express-rate-limit) a fully-managed API
Gateway for developers. Add
[dynamic rate-limiting](https://zuplo.link/dynamic-rate-limiting),
authentication and more to any API in minutes. Learn more at
[zuplo.com](https://zuplo.link/express-rate-limit)

---

Basic rate-limiting middleware for [Express](http://expressjs.com/). Use to
limit repeated requests to public APIs and/or endpoints such as password reset.
Plays nice with
[express-slow-down](https://www.npmjs.com/package/express-slow-down).

## Quickstart

From the `npm` registry:

```sh
# Using npm
> npm install express-rate-limit
# Using yarn or pnpm
> yarn/pnpm add express-rate-limit
```

> Note that this library requires you to use `node` version 16 or above.

An example of its use is as follows:

```ts
// const { rateLimit } = require('express-rate-limit') // Use this for `commonjs` projects.
import { rateLimit } from 'express-rate-limit'

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	// store: ... , // Use an external store for more precise rate limiting.
})

// Apply the rate limiting middleware to all requests
app.use(limiter)
```

> **Note:** most stores will require additional configuration, such as custom
> prefixes, when using multiple instances. The default built-in memory store is
> an exception to this rule.

A more in-depth documentation is available on-line at
[express-rate-limit.mintlify.app](https://express-rate-limit.mintlify.app/overview).
If you are offline, you can view the documentation sources directly - they are
written in `mdx` and stored in the `docs/` folder.

> Thanks to
> [Mintlify](https://mintlify.com/?utm_campaign=devmark&utm_medium=readme&utm_source=express-rate-limit)
> for generously hosting the documentation!

## Issues and Contributing

If you encounter a bug or want to see something added/changed, please go ahead
and
[open an issue](https://github.com/nfriexpress-rate-limitedly/express-rate-limit/issues/new)!
If you need help with something, feel free to
[start a discussion](https://github.com/express-rate-limit/express-rate-limit/discussions/new)!

If you wish to contribute to the library, thanks! First, please read
[the contributing guide](docs/guides/contributing.mdx). Then you can pick up any
issue and fix/implement it!

## License

MIT © [Nathan Friedly](http://nfriedly.com/),
[Vedant K](https://github.com/gamemaker1)

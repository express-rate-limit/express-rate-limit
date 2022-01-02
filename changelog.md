# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [6.0.4](https://github.com/nfriedly/express-rate-limit/releases/tag/v6.0.4)

### Changed

- Add ` main` and `module` fields to `package.json`. This helps tools such as
  ESLint that do not yet support the `exports` field.

## [6.0.3](https://github.com/nfriedly/express-rate-limit/releases/tag/v6.0.3)

### Changed

- Bumped minimum Node version from 12.9 to 14.5 because the transpiled output
  uses the nullish coalescing operator (`??`), which
  [isn't supported in node.js prior to 14.x](https://node.green/#ES2020-features--nullish-coalescing-operator-----).

## [6.0.2](https://github.com/nfriedly/express-rate-limit/releases/v6.0.2)

### Fixed

- Ensure CommonJS projects can import the module.

### Added

- Add additional tests that test:
  - importing the library in `js-cjs`, `js-esm`, `ts-cjs`, `ts-esm`
    environments.
  - usage of the library with external stores (`redis`, `mongo`, `memcached`,
    `precise`).

### Changed

- Use [`esbuild`](https://esbuild.github.io/) to generate ESM and CJS output.
  This reduces the size of the built package from 138 kb to 13kb and build time
  to 4 ms! :rocket:
- Use [`dts-bundle-generator`](https://github.com/timocov/dts-bundle-generator)
  to generate a single Typescript declaration file.

## [6.0.1](https://github.com/nfriedly/express-rate-limit/releases/v6.0.1)

### Fixed

- Ensure CommonJS projects can import the module.

## [6.0.0](https://github.com/nfriedly/express-rate-limit/releases/v6.0.0)

### Added

- `express` 4.x as a peer dependency.
- Better Typescript support (the library was rewritten in Typescript).
- Export the package as both ESM and CJS.
- Publish the built package (`.tgz` file) on GitHub releases as well as the npm
  registry.
- Issue and PR templates.
- A contributing guide.

### Changed

- Rename the `draft_polli_ratelimit_headers` option to `standardHeaders`.
- Rename the `headers` option to `legacyHeaders`.
- `Retry-After` header is now sent if either `legacyHeaders` or
  `standardHeaders` is set.
- Allow `keyGenerator` to be an async function/return a promise.
- Change the way custom stores are defined.
  - Add the `init` method for stores to set themselves up using options passed
    to the middleware.
  - Rename the `incr` method to `increment`.
  - Allow the `increment`, `decrement`, `resetKey` and `resetAll` methods to
    return a promise.
  - Old stores will automatically be promisified and used.
- The package can now only be used with NodeJS version 12.9.0 or greater.
- The `onLimitReached` configuration option is now deprecated. Replace it with a
  custom `handler` that checks the number of hits.

### Removed

- Remove the deprecated `limiter.resetIp` method (use the `limiter.resetKey`
  method instead).
- Remove the deprecated options `delayMs`, `delayAfter` (the delay functionality
  was moved to the
  [`express-slow-down`](https://github.com/nfriedly/express-slow-down) package)
  and `global` (use a key generator that returns a constant value).

## [5.x](https://github.com/nfriedly/express-rate-limit/releases/tag/v5.5.1)

### Added

- The middleware ~throws~ logs an error if `request.ip` is undefined.

### Removed

- Removes typescript typings. (See
  [#138](https://github.com/nfriedly/express-rate-limit/issues/138))

## [4.x](https://github.com/nfriedly/express-rate-limit/releases/tag/v4.0.4)

### Changed

- The library no longer modifies the passed-in options object, it instead makes
  a clone of it.

## [3.x](https://github.com/nfriedly/express-rate-limit/releases/tag/v3.5.2)

### Added

- Simplifies the default `handler` function so that it no longer changes the
  response format. The default handler also uses
  [response.send](https://expressjs.com/en/4x/api.html#response.send).

### Changes

- `onLimitReached` now only triggers once for a client and window. However, the
  `handle` method is called for every blocked request.

### Removed

- The `delayAfter` and `delayMs` options; they were moved to the
  [express-slow-down](https://npmjs.org/package/express-slow-down) package.

## [2.x](https://github.com/nfriedly/express-rate-limit/releases/tag/v2.14.2)

### Added

- A `limiter.resetKey()` method to reset the hit counter for a particular client

### Changes

- The rate limiter now uses a less precise but less resource intensive method of
  tracking hits from a client.

### Removed

- The `global` option.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [7.1.0](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v7.1.0)

### Changed

- The `getKey` method is now always defined. If the store does not have the
  required `get` method, `getKey` will throw an error explaining this.

## [7.0.2](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v7.0.2)

### Added

- Added `cluster-memory-store` to the readme and made a couple of other minor
  clarifications.

## [7.0.1](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v7.0.1)

### Added

- Added `rate-limit-postgresql` to the `stores` list in the readme.

## [7.0.0](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v7.0.0)

### Breaking

- Changed behavior when `max` is set to 0:
  - Previously, `max: 0` was treated as a 'disable' flag and would allow all
    requests through.
  - Starting with v7, all requests will be blocked when max is set to 0.
  - To replicate the old behavior, use the
    [skip](https://github.com/express-rate-limit/express-rate-limit#skip)
    function instead.
- Renamed `req.rateLimit.current` to `req.rateLimit.used`.
  - `current` is now a hidden getter that will return the `used` value, but it
    will not appear when iterating over the keys or calling `JSON.stringify()`.
- Changed the minimum required Node version from v14 to v16.
  - `express-rate-limit` now targets `es2022` in TypeScript/ESBuild.
- Bumped TypeScript from v4 to v5 and `dts-bundle-generator` from v7 to v8.

### Deprecated

- Removed the `draft_polli_ratelimit_headers` option (it was deprecated in v6).
  - Use `standardHeaders: 'draft-6'` instead.
- Removed the `onLimitReached` option (it was deprecated in v6).
  - [This](<(https://github.com/express-rate-limit/express-rate-limit/wiki/Error-Codes#wrn_erl_deprecated_on_limit_reached)>)
    is an example of how to replicate it's behavior with a custom `handler`
    option.

### Changed

- The `MemoryStore` now uses precise, per-user reset times rather than a global
  window that resets all users at once.
- The `limit` configuration option is now prefered to `max`.
  - It still shows the same behavior, and `max` is still supported. The change
    was made to better align with terminology used in the IETF standard drafts.

### Added

- The `validate` config option can now be an object with keys to enable or
  disable specific validation checks. For more information, see
  [this](https://github.com/express-rate-limit/express-rate-limit#validate).

## [6.11.2](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v6.11.2)

### Fixed

- Restored `IncrementResponse ` TypeScript type (See
  [#397](https://github.com/express-rate-limit/express-rate-limit/pull/397))

## [6.11.1](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v6.11.1)

### Fixed

- Check for prefixed keys when validating that the stores have single counted
  keys (See
  [#395](https://github.com/express-rate-limit/express-rate-limit/issues/395)).

## [6.11.0](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v6.11.0)

### Added

- Support for retrieving the current hit count and reset time for a given key
  from a store (See
  [#390](https://github.com/express-rate-limit/express-rate-limit/issues/389)).

## [6.10.0](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v6.10.0)

### Added

- Support for combined `RateLimit` header from the
  [RateLimit header fields for HTTP standardization draft](https://github.com/ietf-wg-httpapi/ratelimit-headers)
  adopted by the IETF. Enable by setting `standardHeaders: 'draft-7'`.
- New `standardHeaders: 'draft-6'` option, treated equivalent to
  `standardHeaders: true` from previous releases. Note that `true` and `false`
  are still supported.
- New `RateLimit-Policy` header added when `standardHeaders` is set to
  `'draft-6'`, `'draft-7'`, or `true`.
- Warning when using deprecated `draft_polli_ratelimit_headers` option.
- Warning when using deprecated `onLimitReached` option.
- Warning when `totalHits` value returned from Store is invalid.

## [6.9.0](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v6.9.0)

### Added

- New validaion check for double-counted requests.
- Added help link to each validation error, directing users to the appropriate
  wiki page for more info.

### Changed

- Miscellaneous documenation improvements.

## [6.8.1](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v6.8.0) & [6.7.2](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v6.8.0)

### Changed

- Revert 6.7.1 change that bumped typescript from 5.x to 4.x and
  dts-bundle-generator from 8.x to 7.x (See
  [#360](https://github.com/express-rate-limit/express-rate-limit/issues/360)).

## [6.8.0](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v6.8.0)

### Added

- Added a set of validation checks that will log an error if failed. See
  https://github.com/express-rate-limit/express-rate-limit/wiki/Error-Codes for
  a list of potential errors. Can be disabled by setting `validate: false` in
  the configuration. Automatically disables after the first request. (See
  [#358](https://github.com/express-rate-limit/express-rate-limit/issues/358)).

## [6.7.1](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v6.7.1)

### Fixed

- Fixed compatibility with TypeScript's TypeScript new `node16` module
  resolution strategy (See
  [#355](https://github.com/express-rate-limit/express-rate-limit/issues/355)).

### Changed

- Bumped development dependencies
  - This initially include bumping typescript from 4.x to 5.x and
    dts-bundle-generator from 7.x to 8.x
- Added `node` 20 to list of versions the CI jobs run on.

No functional changes.

## [6.7.0](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v6.7.0)

### Changed

- Updated links to point to the new `express-rate-limit` organization on GitHub.
- Added advertisement to `readme.md` for project sponsor
  [Zuplo](https://zuplo.link/express-rate-limit).
- Updated to `typescript` version 5 and bumped other dependencies.
- Dropped `node` 12, and added `node` 19 to the list of versions the CI jobs run
  on.

No functional changes.

## [6.6.0](https://github.com/nfriedly/express-rate-limit/releases/tag/v6.6.0)

### Added

- Added `shutdown` method to the Store interface and the MemoryStore.

## [6.5.2](https://github.com/nfriedly/express-rate-limit/releases/tag/v6.5.2)

### Fixed

- Fixed an issue with missing types in ESM monorepos.

## [6.5.1](https://github.com/nfriedly/express-rate-limit/releases/tag/v6.5.1)

### Added

- The message option can now be a (sync/asynx) function that returns a value
  (#311)

### Changed

- Updated all dependencies

Note: 6.5.0 was not released due to CI automation issues.

## [6.4.0](https://github.com/nfriedly/express-rate-limit/releases/tag/v6.3.0)

### Added

- Adds Express 5 (`5.0.0-beta.1`) as a supported peer dependency (#304)

### Changed

- Tests are now run on Node 12, 14, 16 and 18 on CI (#305)
- Updated all development dependencies (#306)

## [6.3.0](https://github.com/nfriedly/express-rate-limit/releases/tag/v6.3.0)

### Changed

- Changes the build target to es2019 so that ESBuild outputs code that can run
  with Node 12.
- Changes the minimum required Node version to 12.9.0.

## [6.2.1](https://github.com/nfriedly/express-rate-limit/releases/tag/v6.2.1)

### Fixed

- Use the default value for an option when `undefined` is passed to the rate
  limiter.

## [6.2.0](https://github.com/nfriedly/express-rate-limit/releases/tag/v6.2.0)

### Added

- Export the `MemoryStore`, so it can now be imported as a named import
  (`import { MemoryStore } from 'express-rate-limit'`).

### Fixed

- Deprecate the `onLimitReached` option (this was supposed to be deprecated in
  v6.0.0 itself); developers should use a custom handler function that checks if
  the rate limit has been exceeded instead.

## [6.1.0](https://github.com/nfriedly/express-rate-limit/releases/tag/v6.1.0)

### Added

- Added a named export `rateLimit` in case the default import does not work.

### Fixed

- Added a named export `default`, so Typescript CommonJS developers can
  default-import the library (`import rateLimit from 'express-rate-limit'`).

## [6.0.5](https://github.com/nfriedly/express-rate-limit/releases/tag/v6.0.5)

### Fixed

- Use named imports for ExpressJS types so users do not need to enable the
  `esModuleInterop` flag in their Typescript compiler configuration.

## [6.0.4](https://github.com/nfriedly/express-rate-limit/releases/tag/v6.0.4)

### Fixed

- Upload the built package as a `.tgz` to GitHub releases.

### Changed

- Add ` main` and `module` fields to `package.json`. This helps tools such as
  ESLint that do not yet support the `exports` field.
- Bumped the minimum node.js version in `package-lock.json` to match
  `package.json`

## [6.0.3](https://github.com/nfriedly/express-rate-limit/releases/tag/v6.0.3)

### Changed

- Bumped minimum Node version from 12.9 to 14.5 in `package.json` because the
  transpiled output uses the nullish coalescing operator (`??`), which
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

- Support external stores (from version 2.3.0) onwards.
- A `limiter.resetKey()` method to reset the hit counter for a particular client

### Changes

- The rate limiter now uses a less precise but less resource intensive method of
  tracking hits from a client.

### Removed

- The `global` option.

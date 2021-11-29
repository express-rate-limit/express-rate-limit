# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- Better Typescript support (the library was rewritten in Typescript).

### Changed

- **This library is now pure ESM**. CommonJS packages will not be able to
  synchronously import this package. It is now recommended to use this library
  with NodeJS 14 or greater.
- Remove the deprecated `limiter.resetIp` method.
- Rename the `draft_polli_ratelimit_headers` option to `useStandardizedHeaders`.

### Changes

## [5.x](https://github.com/nfriedly/express-rate-limit/releases/tag/5.5.1)

### Added

- The middleware ~throws~ logs an error if `request.ip` is undefined.

### Removed

- Removes typescript typings. (See
  [#138](https://github.com/nfriedly/express-rate-limit/issues/138))

## [4.x](https://github.com/nfriedly/express-rate-limit/releases/tag/4.0.4)

### Changed

- The library no longer modifies the passed-in options object, it instead makes
  a clone of it.

## [3.x](https://github.com/nfriedly/express-rate-limit/releases/tag/3.5.2)

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

## [2.x](https://github.com/nfriedly/express-rate-limit/releases/tag/2.14.2)

### Added

- A `limiter.resetKey()` method to reset the hit counter for a particular client

### Changes

- The rate limiter now uses a less precise but less resource intensive method of
  tracking hits from a client.

### Removed

- The `global` option.

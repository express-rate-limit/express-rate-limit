#  Express Rate Limit

[![Build Status](https://secure.travis-ci.org/nfriedly/express-rate-limit.png?branch=master)](http://travis-ci.org/nfriedly/express-rate-limit)
[![NPM version](http://badge.fury.io/js/express-rate-limit.png)](https://npmjs.org/package/express-rate-limit "View this project on NPM")
[![Dependency Status](https://david-dm.org/nfriedly/express-rate-limit.png?theme=shields.io)](https://david-dm.org/nfriedly/express-rate-limit)
[![Development Dependency Status](https://david-dm.org/nfriedly/express-rate-limit/dev-status.png?theme=shields.io)](https://david-dm.org/nfriedly/express-rate-limit#info=devDependencies)

Basic rate-limiting middleware for Express. Use to limit repeated requests to public endpoints such as account creation and password reset.

Note: this module does not share state with other processes/servers.
If you need a more robust solution, I recommend checking out the excellent [strict-rate-limiter](https://www.npmjs.com/package/strict-rate-limiter)


## Install

```sh
$ npm install --save express-rate-limit
```

## Configuration

* **windowMs**: milliseconds - how long to keep records of requests in memory. Defaults to `60000` (1 minute).
* **delayAfter**: max number of connections during `windowMs` before starting to delay responses. Defaults to `1`. Set to `0` to disable delaying.  
* **delayMs**: milliseconds - how long to delay the response, multiplied by (number of recent hits - `delayAfter`).  Defaults to `1000` (1 second). Set to `0` to disable delaying.
* **max**: max number of connections during `windowMs` milliseconds before sending a 429 response. Defaults to `5`. Set to `0` to disable.
* **message**: Error message returned when `max` is exceeded. Defaults to `'Too many requests, please try again later.'`
* **statusCode**: HTTP status code returned when `max` is exceeded. Defaults to `429`.
* **handler**: The function to execute once the max limit is exceeded. It receives the request and the response objects. The "next" param is available if you need to pass to the next middleware. Defaults:
```js
function (req, res, /*next*/) {
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

The `delayAfter` and `delayMs` options were written for human-facing pages such as login and password reset forms.
For public APIs, setting these to `0` (disabled) and relying on only `windowMs` and `max` for rate-limiting usually makes the most sense.

## Usage

For an API-only server where the rate-limiter should be applied to all requests:

```js
var rateLimit = require('express-rate-limit');

app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc)

// default options shown below
var limiter = rateLimit({/* config */});

//  apply this globally
app.use(limiter);
```

For a "regular" web server (e.g. anything that uses `express.static()`), where the rate-limiter should only apply to certain requests:

```js
var rateLimit = require('express-rate-limit');

app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc)

var limiter = rateLimit({/* config */});

// apply to all requests that begin with /api/
app.use('/api/', limiter);

// apply to an individual endpoint
app.post('/create-account', limiter, function(req, res) {
   // ...
}

// optionally set up an endpoint to reset the rate limit for an IP
var limiter2 = rateLimit({/* altConfig */);  // we can't use the same rateLimit instance on the reset endpoint, but we probably do want it limited.
app.post('/reset-rate-limit', limiter2, function(req, res) {
   // validate that requester has filled out a captcha properly or whatever and then...
  limiter.resetIp(req.ip);
  // ...
}
```

## Instance API

* **resetIp(ip)**: Resets the rate limiting for a given ip.

## v2 changes

v2 uses a less precise but less resource intensive method of tracking hits from a given IP. v2 also adds the `limiter.resetIp()` API and removes the `global: true` option.

## License

MIT © [Nathan Friedly](http://nfriedly.com/)

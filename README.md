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
* **global**: If `true`, IP address is ignored and a single global hit counter is used. Defaults to `false`.
* **message**: Error message returned when `max` is exceeded. Defaults to `'Too many requests, please try again later.'`
* **statusCode**: HTTP status code returned when `max` is exceeded. Defaults to `429`.

The `delayAfter` and `delayMs` options were written for human-facing pages such as login and password reset forms. 
For public APIs, setting these to `0` (disabled) and relying on only `windowMs` and `max` for rate-limiting usually makes the most sense.

## Usage

```js
var RateLimit = require('express-rate-limit');

app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc)

// default options shown below
var limiter = RateLimit({
        windowMs: 60 * 1000,
        delayAfter: 1,
        delayMs: 1000,
        max: 5,
        global: false,
        message: 'Too many requests, please try again later.',
        statusCode: 429
});

// for an API-only web app, you can apply this globally
app.use(limiter);

// for a "regular" website, apply this only to specific endpoints
// (this includes Single Page Apps if you serve the assets with express.static())
app.post('/create-account', limiter, function(req, res) {
   // ...
}
```

You **could** apply this globally (`app.use(limiter);`) on a regular website, but be aware that it would then trigger on images, css, etc. So I wouldn't recommend it.


## License

MIT © [Nathan Friedly](http://nfriedly.com/)

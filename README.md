#  Express Rate Limit

[![Build Status](https://secure.travis-ci.org/nfriedly/express-rate-limit.png?branch=master)](http://travis-ci.org/nfriedly/express-rate-limit)
[![NPM version](http://badge.fury.io/js/express-rate-limit.png)](https://npmjs.org/package/express-rate-limit "View this project on NPM")
[![Dependency Status](https://david-dm.org/nfriedly/express-rate-limit.png?theme=shields.io)](https://david-dm.org/nfriedly/express-rate-limit)
[![Development Dependency Status](https://david-dm.org/nfriedly/express-rate-limit/dev-status.png?theme=shields.io)](https://david-dm.org/nfriedly/express-rate-limit#info=devDependencies)

Basic rate-limiting middleware for Express. Use to limit access to public endpoints such as account creation and password reset.

Note: this module does not share state with other processes/servers, so if you need a more robust solution, I recommend checking out the excellent [strict-rate-limiter](https://www.npmjs.com/package/strict-rate-limiter)


## Install

```sh
$ npm install --save express-rate-limit
```


## Usage

```js
var RateLimit = require('express-rate-limit');

app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc)

// default options shown below
var limiter = RateLimit({
        // window, delay, and max apply per-ip unless global is set to true
        windowMs: 60 * 1000 // miliseconds - how long to keep records of requests in memory
        delayMs: 1000, // milliseconds - base delay applied to the response - multiplied by number of recent hits from user's IP
        max: 5, // max number of recent connections during `window` miliseconds before (temporarily) bocking the user.
        global: false // if true, IP address is ignored and setting is applied equally to all requests
});

// for an API-only web app, you can apply this globally
app.use(limiter);

// for a "regular" website, apply this only to specific endpoints
app.post('/create-account', limiter, function(req, res) {
   // ...
}
```

You **could** apply this globally on a regular website, but be aware that it would then trigger on images, css, etc. So I wouldn't recommend it.

## License

MIT © [Nathan Friedly](http://nfriedly.com/)

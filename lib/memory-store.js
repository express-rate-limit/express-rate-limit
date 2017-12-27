"use strict";
function MemoryStore(windowMs) {
  var hits = {};
  var timeReset = {};

  this.incr = function(key, cb) {
    if (hits[key]) {
      hits[key]++;
    } else {
      hits[key] = 1;
    }

    if (!timeReset[key]) {
      timeReset[key] =
        parseInt((new Date().getTime() / 1000).toFixed(0), 10) +
        windowMs / 1000;
    }

    cb(null, hits[key], timeReset[key]);
  };

  this.decrement = function(key) {
    if (hits[key]) {
      hits[key]--;
    }
  };

  // export an API to allow hits all IPs to be reset
  this.resetAll = function() {
    hits = {};
    timeReset = {};
  };

  // export an API to allow hits from one IP to be reset
  this.resetKey = function(key) {
    delete hits[key];
    delete timeReset[key];
  };

  // simply reset ALL hits every windowMs
  var interval = setInterval(this.resetAll, windowMs);
  if (interval.unref) {
    interval.unref();
  }
}

module.exports = MemoryStore;

"use strict";

const time = () => {
  let d = new Date();
  return Date.now();
}

function calculateNextResetTime(windowMs) {
  const d = new Date();
  d.setMilliseconds(d.getMilliseconds() + windowMs);
  return d;
}

class DefaultDict {
  constructor(defaultVal) {
    return new Proxy({}, {
      get: (target, name) => name in target ? target[name] : defaultVal
    });
  }
}

class ExpiringDict {
  constructor() {
    this.data = new DefaultDict(0)
    this.expiry_data = {};
  }

  get(key) {
    if (this.expiry_data[key] === undefined) {
      return this.data[key];
    }
    if (this.expiry_data[key] <= time()) {
      delete this.expiry_data[key];
      delete this.data[key];
      this.data[key]++;
    }
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
  }

  incr(key) {
    this.data[key]++;
  }

  expire(key, expiry) {
    if (this.expiry_data[key] === undefined) {
      this.expiry_data[key] = time() + expiry;
    }
  }
}

function MemoryStore(windowMs) {
  let hits = new ExpiringDict();
  let resetTime = calculateNextResetTime(windowMs);

  this.incr = function (key, cb) {
    hits.incr(key);
    hits.expire(key, windowMs);
    cb(null, hits.get(key), resetTime);
  };

  this.decrement = function (key) {
    if (hits.get(key) > 0) {
      hits.set(key, hits.get(key) - 1);
    }
  };

  // export an API to allow hits all IPs to be reset
  this.resetAll = function () {
    hits = new ExpiringDict();
    resetTime = calculateNextResetTime(windowMs);
  };

  // export an API to allow hits from one IP to be reset
  this.resetKey = function (key) {
    delete hits.data[key];
    delete hits.expiry_data[key];
  };
}

module.exports = MemoryStore;
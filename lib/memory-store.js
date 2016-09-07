'use strict';
function MemoryStore(windowMs) {
  var hits = {};

  this.incr = function(key, cb) {
      if (hits[key]) {
          hits[key]++;
      } else {
          hits[key] = 1;
      }

      cb(null, hits[key]);
  };

  this.resetAll = function() {
      hits = {};
  };

  // export an API to allow hits from one or all IPs to be reset
  this.resetKey = function(key) {
      delete hits[key];
  };
  
  this.stop = function() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  };

  // simply reset ALL hits every windowMs
  this.interval = setInterval(this.resetAll, windowMs);
}

module.exports = MemoryStore;

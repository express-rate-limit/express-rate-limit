"use strict";

function calculateNextResetTime(windowMs) {
  const d = new Date();
  d.setMilliseconds(d.getMilliseconds() + windowMs);
  return d;
}

function MemoryStore(windowMs, precision) {
  // Buckets divide `windowMs` into multiple subparts that can be cleared
  // individually, allowing for better precision when clearing outdated requests.
  // After a bucket has expired, all requests that were assigned to it's time window
  // are removed and the bucket is replaced with new one in a circular buffer manner.
  let buckets = Array.from({ length: precision }, () => new Object());
  let currentBucketIdx = 0;

  let resetTime = calculateNextResetTime(windowMs);

  this.incr = function (key, cb) {
    const currentBucket = buckets[currentBucketIdx];
    if (currentBucket[key]) {
      currentBucket[key]++;
    } else {
      currentBucket[key] = 1;
    }

    const keyHits = buckets
      .map((mappedBucket) => mappedBucket[key] || 0)
      .reduce((rollingSum, hits) => rollingSum + hits, 0);
    cb(null, keyHits, resetTime);
  };

  this.decrement = function (key) {
    const currentBucket = buckets[currentBucketIdx];
    if (currentBucket[key]) {
      currentBucket[key]--;
    }
  };

  // export an API to allow hits all IPs to be reset
  this.resetAll = function () {
    buckets = Array.from({ length: precision }, () => new Object());
    currentBucketIdx = 0;
  };

  this.resetBucket = function () {
    resetTime = calculateNextResetTime(windowMs);
    currentBucketIdx = (currentBucketIdx + 1) % buckets.length;
    buckets[currentBucketIdx] = {};
  };

  // export an API to allow hits from one IP to be reset
  this.resetKey = function (key) {
    for (const bucket of buckets) {
      delete bucket[key];
    }
  };

  const bucketTime = windowMs / precision;
  const bucketResetInterval = setInterval(this.resetBucket, bucketTime);
  if (bucketResetInterval.unref) {
    bucketResetInterval.unref();
  }
}

module.exports = MemoryStore;

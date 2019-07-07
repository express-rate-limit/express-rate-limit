import RateLimit = require("./express-rate-limit");

function calculateNextResetTime(windowMs: number): Date {
  const d = new Date();
  d.setMilliseconds(d.getMilliseconds() + windowMs);
  return d;
}

class MemoryStore implements RateLimit.Store {
  windowMs: number;
  hits: Record<string, number | undefined>;
  resetTime: Date;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
    this.hits = {};
    this.resetTime = calculateNextResetTime(windowMs);

    // simply reset ALL hits every windowMs
    const interval = setInterval(() => this.resetAll(), windowMs);
    if (interval.unref) {
      interval.unref();
    }
  }

  incr(key: string, cb: RateLimit.IncrCallback) {
    const current = (this.hits[key] || 0) + 1;
    this.hits[key] = current;

    cb(null, current, this.resetTime);
  }

  decrement(key: string) {
    const current = this.hits[key];
    if (current) {
      this.hits[key] = current - 1;
    }
  }

  // export an API to allow hits all IPs to be reset
  resetAll() {
    this.hits = {};
    this.resetTime = calculateNextResetTime(this.windowMs);
  }

  // export an API to allow hits from one IP to be reset
  resetKey(key: string) {
    delete this.hits[key];
  }
}

export = MemoryStore;

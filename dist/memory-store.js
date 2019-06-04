// /source/memory-store.ts
// A memory store for hit counts
/**
 * Calculates the time when all hit counters will be reset.
 *
 * @param windowMs {number} - The duration of a window (in milliseconds)
 *
 * @returns {Date}
 *
 * @private
 */
const calculateNextResetTime = (windowMs) => {
    const resetTime = new Date();
    resetTime.setMilliseconds(resetTime.getMilliseconds() + windowMs);
    return resetTime;
};
/**
 * A {@link Store} that stores the hit count for each client in
 * memory.
 *
 * @public
 */
export default class MemoryStore {
    /**
     * @constructor for {@link MemoryStore}
     *
     * @param windowMs {number} - The duration of a window (in milliseconds)
     */
    constructor(windowMs) {
        this.windowMs = windowMs;
        this.hits = {};
        this.resetTime = calculateNextResetTime(windowMs);
        // Reset hit counts for ALL clients every windowMs
        const interval = setInterval(() => {
            this.resetAll();
        }, windowMs);
        if (interval.unref) {
            interval.unref();
        }
    }
    /**
     * Method to increment a client's hit counter.
     *
     * @param key {string} - The identifier for a client
     * @param callback {IncrementCallback} - The callback to call once the counter is incremented
     *
     * @public
     */
    increment(key, callback) {
        var _a;
        const current = ((_a = this.hits[key]) !== null && _a !== void 0 ? _a : 0) + 1;
        this.hits[key] = current;
        callback(undefined, current, this.resetTime);
    }
    /**
     * Method to decrement a client's hit counter.
     *
     * @param key {string} - The identifier for a client
     *
     * @public
     */
    decrement(key) {
        const current = this.hits[key];
        if (current) {
            this.hits[key] = current - 1;
        }
    }
    /**
     * Method to reset a client's hit counter.
     *
     * @param key {string} - The identifier for a client
     *
     * @public
     */
    resetKey(key) {
        delete this.hits[key];
    }
    /**
     * Method to reset everyone's hit counter.
     *
     * @public
     */
    resetAll() {
        this.hits = {};
        this.resetTime = calculateNextResetTime(this.windowMs);
    }
}
//# sourceMappingURL=memory-store.js.map
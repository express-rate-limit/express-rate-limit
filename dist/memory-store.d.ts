import { Store, IncrementCallback } from '.';
/**
 * A {@link Store} that stores the hit count for each client in
 * memory.
 *
 * @public
 */
export default class MemoryStore implements Store {
    /**
     * The duration of time before which all hit counts are reset (in milliseconds).
     */
    windowMs: number;
    /**
     * The map that stores the number of hits for each client in memory.
     */
    hits: {
        [key: string]: number | undefined;
    };
    /**
     * The time at which all hit counts will be reset.
     */
    resetTime: Date;
    /**
     * @constructor for {@link MemoryStore}
     *
     * @param windowMs {number} - The duration of a window (in milliseconds)
     */
    constructor(windowMs: number);
    /**
     * Method to increment a client's hit counter.
     *
     * @param key {string} - The identifier for a client
     * @param callback {IncrementCallback} - The callback to call once the counter is incremented
     *
     * @public
     */
    increment(key: string, callback: IncrementCallback): void;
    /**
     * Method to decrement a client's hit counter.
     *
     * @param key {string} - The identifier for a client
     *
     * @public
     */
    decrement(key: string): void;
    /**
     * Method to reset a client's hit counter.
     *
     * @param key {string} - The identifier for a client
     *
     * @public
     */
    resetKey(key: string): void;
    /**
     * Method to reset everyone's hit counter.
     *
     * @public
     */
    resetAll(): void;
}

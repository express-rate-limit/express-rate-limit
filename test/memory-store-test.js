"use strict";

const MemoryStore = require("../lib/memory-store.js");

describe("MemoryStore store", () => {
  it("sets the value to 1 on first incr", done => {
    const store = new MemoryStore(-1);
    const key = "test-store";

    store.incr(key, (err, value) => {
      if (err) {
        done(err);
      } else {
        if (value === 1) {
          done();
        } else {
          done(new Error("incr did not set the key on the store to 1"));
        }
      }
    });
  });

  it("increments the key for the store each incr", done => {
    const store = new MemoryStore(-1);
    const key = "test-store";

    store.incr(key, () => {
      store.incr(key, (err, value) => {
        if (err) {
          done(err);
        } else {
          if (value === 2) {
            done();
          } else {
            done(new Error("incr did not increment the store"));
          }
        }
      });
    });
  });

  it("resets the key for the store when used with resetKey", done => {
    const store = new MemoryStore(-1);
    const key = "test-store";

    store.incr(key, () => {
      // value should be 1 now
      store.resetKey(key);
      // value should be 0 now
      store.incr(key, (err, value) => {
        // value should be 1 now
        if (value === 1) {
          done();
        } else {
          done(
            new Error("resetKey did not reset the store for the key provided")
          );
        }
      });
    });
  });

  it("resets all keys for the store when used with resetAll", done => {
    const store = new MemoryStore(-1);
    const keyOne = "test-store-one";
    const keyTwo = "test-store-two";

    store.incr(keyOne, () => {
      // valueOne should be 1 now
      store.incr(keyTwo, () => {
        // valueTwo should be 1 now
        store.resetAll();
        // valueOne should be 0 now
        // valueTwo should be 0 now
        store.incr(keyOne, (err, valueOne) => {
          // valueOne should be 1 now
          if (valueOne === 1) {
            store.incr(keyTwo, (err, valueTwo) => {
              // valueTwo should be 1 now
              if (valueTwo === 1) {
                done();
              } else {
                done(
                  new Error("resetAll did not reset all the keys in the store")
                );
              }
            });
          } else {
            done(new Error("resetAll did not reset all the keys in the store"));
          }
        });
      });
    });
  });

  it("resets all keys for the store when the timeout is reached", done => {
    const store = new MemoryStore(50);
    const keyOne = "test-store-one";
    const keyTwo = "test-store-two";

    store.incr(keyOne, () => {
      // valueOne should be 1 now
      store.incr(keyTwo, () => {
        // valueTwo should be 1 now
        setTimeout(() => {
          // valueOne and valueTwo should be 0 now
          store.incr(keyOne, (err, valueOne) => {
            // valueOne should be 1 now
            if (valueOne === 1) {
              store.incr(keyTwo, (err, valueTwo) => {
                // valueTwo should be 1 now
                if (valueTwo === 1) {
                  done();
                } else {
                  done(
                    new Error(
                      "reaching the timeout did not reset all the keys in the store"
                    )
                  );
                }
              });
            } else {
              done(
                new Error(
                  "reaching the timeout did not reset all the keys in the store"
                )
              );
            }
          });
        }, 60);
      });
    });
  });

  describe("timeout", () => {
    const originalSetInterval = setInterval;
    let timeoutId = 1;
    let realTimeoutId;

    beforeEach(() => {
      timeoutId = 1;
      // eslint-disable-next-line  no-global-assign
      setInterval = function(callback, timeout) {
        realTimeoutId = originalSetInterval(callback, timeout);
        return timeoutId++;
      };
    });

    it("can run in electron where setInterval does not return a Timeout object with an unset function", done => {
      const store = new MemoryStore(-1);
      const key = "test-store";

      store.incr(key, (err, value) => {
        if (err) {
          done(err);
        } else {
          if (value === 1) {
            done();
          } else {
            done(new Error("incr did not set the key on the store to 1"));
          }
        }
      });
    });

    afterEach(() => {
      // eslint-disable-next-line  no-global-assign
      setInterval = originalSetInterval;
      clearTimeout(realTimeoutId);
    });
  });

  it("decrements the key for the store each decrement", done => {
    const store = new MemoryStore(-1);
    const key = "test-store";

    store.incr(key, () => {
      store.decrement(key);
      store.incr(key, (error, value) => {
        if (value === 1) {
          done();
        } else {
          done(new Error("decrease does not work"));
        }
      });
    });
  });
});

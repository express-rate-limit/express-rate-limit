require("ts-node/register");
const rateLimit = require("../lib/express-rate-limit.ts");

describe("express-rate-limit typescript typings", function() {
  it("should work with non-string messages", () => {
    rateLimit({
      message: { json: "object" }
    });
    rateLimit({
      message: Buffer.from("I'm a buffer!")
    });
  });
});

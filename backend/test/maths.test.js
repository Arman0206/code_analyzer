const test = require("node:test");
const assert = require("node:assert");
const { calculateFinalScore } = require("../maths");

test("no penalties -> 100", () => assert.strictEqual(calculateFinalScore({}), 100));
test("score never below 0", () => assert.strictEqual(calculateFinalScore({ bug: 1000, sec: 1000 }), 0));
test("weights must sum to 1", () => assert.throws(() => calculateFinalScore({}, { bug: 0.9 })));
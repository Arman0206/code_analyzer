const test = require("node:test");
const assert = require("node:assert");
const { detect } = require("../src/router");

test("C++ using const is not mistaken for JavaScript", () => {
  assert.strictEqual(detect("#include <iostream>\nint main(){ const int x = 1; }").lang, "cpp");
});
test("Java class without main is detected", () => {
  assert.strictEqual(detect("public class A { int f(){ return 1; } }").lang, "java");
});
test("Python function", () => {
  assert.strictEqual(detect("def add(a, b):\n    return a + b").lang, "python");
});
test("gibberish is unknown", () => {
  assert.strictEqual(detect("hello world").lang, "unknown");
});
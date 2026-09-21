const test = require("node:test");
const assert = require("node:assert");
const { redactAndDetect } = require("../security");

test("detects and redacts a hardcoded password", () => {
  const { cleanCode, detections } = redactAndDetect('const password = "hunter2";\nconsole.log(1);');
  assert.strictEqual(detections.length, 1);
  assert.strictEqual(detections[0].line, 1);
  assert.ok(!cleanCode.includes("hunter2"));
});
test("clean code has no detections", () => {
  assert.strictEqual(redactAndDetect("let a = 1;").detections.length, 0);
});
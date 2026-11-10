#!/usr/bin/env node
const { main } = require("../src/cli/main");
// Set exitCode instead of calling process.exit() so piped stdout is fully flushed first.
main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
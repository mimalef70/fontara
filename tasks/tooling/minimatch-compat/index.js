const minimatch = require("minimatch")

// ESLint 9 and multimatch 6 use the callable CommonJS/default export from v3.
// Delegate every operation to the patched implementation, retaining its API.
module.exports = Object.assign(minimatch.minimatch, minimatch)

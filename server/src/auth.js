/**
 * CommonJS compatibility bridge: runtime loads compiled auth helpers from dist/.
 * Source of truth: auth.ts (build via `npm run build:ts`).
 */
module.exports = require("../dist/auth");

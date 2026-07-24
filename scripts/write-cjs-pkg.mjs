// The package is "type": "module", so the CJS build needs its own nested
// package.json flipping the type — otherwise Node (and TypeScript's
// node16 resolution) would read dist/cjs/*.js as ESM.
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync(new URL("../dist/cjs", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../dist/cjs/package.json", import.meta.url),
  JSON.stringify({ type: "commonjs" }) + "\n"
);

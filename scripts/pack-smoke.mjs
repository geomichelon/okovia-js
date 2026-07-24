// Packaging smoke test: packs the real tarball, installs it into a clean
// temp project, and consumes every published surface. This is the guard
// that would have caught the 0.2.0 gaps (broken source maps, missing
// ./package.json export) before they reached npm.
//
//   npm run test:pack
//
// Exits non-zero on the first failure. Node stdlib only.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const sdkRoot = fileURLToPath(new URL("..", import.meta.url));
const workDir = mkdtempSync(join(tmpdir(), "okovia-pack-"));
let tarball = "";

function step(label, fn) {
  process.stdout.write(`  · ${label} ... `);
  fn();
  process.stdout.write("ok\n");
}

try {
  console.log("pack-smoke");

  step("npm pack", () => {
    const out = execFileSync("npm", ["pack", "--json", "--pack-destination", workDir], {
      cwd: sdkRoot,
      encoding: "utf8"
    });
    tarball = join(workDir, JSON.parse(out)[0].filename);
  });

  step("clean install of the tarball", () => {
    writeFileSync(join(workDir, "package.json"), JSON.stringify({ name: "smoke", private: true }));
    execFileSync("npm", ["install", tarball, "--no-audit", "--no-fund"], { cwd: workDir });
  });

  step("ESM import", () => {
    writeFileSync(
      join(workDir, "esm-check.mjs"),
      [
        'import defaultExport, { OkoviaClient, VikingClient, createEventId } from "okovia";',
        'if (typeof OkoviaClient !== "function") throw new Error("OkoviaClient missing");',
        'if (VikingClient !== OkoviaClient) throw new Error("VikingClient alias broken");',
        'if (defaultExport !== OkoviaClient) throw new Error("default export broken");',
        'if (typeof createEventId !== "function") throw new Error("createEventId missing");'
      ].join("\n")
    );
    execFileSync(process.execPath, [join(workDir, "esm-check.mjs")]);
  });

  step("CJS require", () => {
    writeFileSync(
      join(workDir, "cjs-check.cjs"),
      [
        'const { OkoviaClient, VikingClient } = require("okovia");',
        'const pkg = require("okovia/package.json");',
        'if (typeof OkoviaClient !== "function") throw new Error("OkoviaClient missing in CJS");',
        'if (VikingClient !== OkoviaClient) throw new Error("VikingClient alias broken in CJS");',
        'if (pkg.name !== "okovia" || !pkg.version) throw new Error("package.json export broken");'
      ].join("\n")
    );
    execFileSync(process.execPath, [join(workDir, "cjs-check.cjs")]);
  });

  step("CLI runs from the installed package", () => {
    const version = execFileSync(
      process.execPath,
      [join(workDir, "node_modules", "okovia", "bin", "okovia.mjs"), "--version"],
      { encoding: "utf8" }
    ).trim();
    const expected = JSON.parse(
      execFileSync(process.execPath, ["-p", 'JSON.stringify(require("okovia/package.json").version)'], {
        cwd: workDir,
        encoding: "utf8"
      })
    );
    if (version !== expected) throw new Error(`CLI version ${version} != package ${expected}`);
  });

  step("source maps resolve (src/ is published)", () => {
    const installed = join(workDir, "node_modules", "okovia");
    for (const file of ["src/client.ts", "dist/client.js.map", "dist/cjs/index.js", "dist/okovia.tag.js"]) {
      if (!existsSync(join(installed, file))) throw new Error(`${file} missing from tarball`);
    }
  });

  console.log("pack-smoke: all surfaces ok");
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

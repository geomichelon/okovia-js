import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const bin = fileURLToPath(new URL("../bin/okovia.mjs", import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function run(args: string[]): string {
  return execFileSync(process.execPath, [bin, ...args], { encoding: "utf8" });
}

describe("npx okovia CLI", () => {
  it("info (also the default command) describes the installed package", () => {
    const out = run(["info"]);
    expect(out).toContain(`okovia ${pkg.version}`);
    expect(out).toContain("OkoviaClient");
    expect(out).toContain("vik_pub_");
    expect(out).toContain("doctor");
    expect(run([])).toBe(out);
  });

  it("--version prints the package.json version", () => {
    expect(run(["--version"]).trim()).toBe(pkg.version);
  });

  it("doctor fails fast against an unreachable endpoint", () => {
    expect(() =>
      execFileSync(process.execPath, [bin, "doctor", "--endpoint", "http://127.0.0.1:9"], {
        encoding: "utf8"
      })
    ).toThrowError(expect.objectContaining({ status: 1 }));
  });

  it("unknown commands exit 2 with a hint", () => {
    expect(() => execFileSync(process.execPath, [bin, "frobnicate"], { encoding: "utf8" })).toThrowError(
      expect.objectContaining({ status: 2 })
    );
  });
});

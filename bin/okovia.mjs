#!/usr/bin/env node
// okovia — post-install CLI for the npm package (Node stdlib only, no
// build step, no dependencies — same constraint as the SDK itself).
//
// npm ≥7 hides lifecycle-script output, so an install banner can never
// answer "what did I just install?". This command can, on demand:
//
//   npx okovia            what's in the package + quickstart (alias: info)
//   npx okovia doctor     connectivity check against the OkOvia API
//   npx okovia --version  package version
//
// Mirrors the Python CLI (`pip install okovia` → `okovia doctor`). The SDK
// itself runs in the browser; doctor only validates endpoint reachability,
// credentials are checked at runtime by the client.

import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const DEFAULT_ENDPOINT = "https://api.okovia.com";

function infoCmd() {
  console.log(
    [
      `okovia ${pkg.version} — OkOvia browser telemetry SDK`,
      pkg.description,
      "",
      "Installed (zero runtime dependencies, ESM + TypeScript types):",
      "  OkoviaClient        typed client — track(), batching, auto-flush, retries",
      "  createEventId       deterministic event ids (server-side dedupe)",
      "  sanitizeProperties  strips unsafe values from event properties",
      "  VikingClient        back-compat alias of OkoviaClient",
      "",
      "Privacy contract: product behavior context only — never prompts,",
      "responses, DOM content, cookies, headers, or form data.",
      "",
      "Quickstart:",
      '  import { OkoviaClient } from "okovia";',
      "  const okovia = new OkoviaClient({",
      '    publicKey: "vik_pub_...",   // console → Settings → General',
      '    projectId: "project_...",',
      `    endpoint: "${DEFAULT_ENDPOINT}"`,
      "  });",
      '  okovia.track("ai_interaction_requested", { operationId: "op_123", feature: "checkout" });',
      "",
      "Next steps:",
      "  npx okovia doctor              check connectivity to the OkOvia API",
      "  https://okovia.com             console — mint your vik_pub_ key",
      `  ${pkg.homepage === "https://okovia.com" ? "https://github.com/geomichelon/okovia-js" : pkg.homepage}`
    ].join("\n")
  );
  return 0;
}

function get(url, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = target.protocol === "http:" ? httpRequest : httpsRequest;
    const req = request(target, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout after ${timeoutMs}ms`)));
    req.on("error", reject);
    req.end();
  });
}

async function doctorCmd(args) {
  const flagIndex = args.indexOf("--endpoint");
  const endpoint =
    (flagIndex >= 0 && args[flagIndex + 1]) || process.env.OKOVIA_ENDPOINT || DEFAULT_ENDPOINT;

  console.log("okovia doctor");
  console.log(`  · endpoint: ${endpoint}`);
  try {
    const status = await get(`${endpoint.replace(/\/$/, "")}/v1/health`);
    if (status === 200) {
      console.log(`  ✓ API reachable — HTTP ${status}`);
      console.log("\nresult: ready. Configure OkoviaClient with a vik_pub_ key and track().");
      return 0;
    }
    console.log(`  ✗ API reachable — HTTP ${status}`);
  } catch (error) {
    console.log(`  ✗ API reachable — ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log("\nresult: NOT ready — check the endpoint (--endpoint or $OKOVIA_ENDPOINT).");
  return 1;
}

async function main() {
  const [, , command = "info", ...rest] = process.argv;
  switch (command) {
    case "info":
    case "help":
    case "--help":
    case "-h":
      return infoCmd();
    case "version":
    case "--version":
    case "-v":
      console.log(pkg.version);
      return 0;
    case "doctor":
      return doctorCmd(rest);
    default:
      console.error(`error: unknown command "${command}" — try: npx okovia info | doctor`);
      return 2;
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
);

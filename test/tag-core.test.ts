import { describe, expect, it } from "vitest";

import {
  ANONYMOUS_ID_KEY,
  DEFAULT_TAG_ENDPOINT,
  createOperationId,
  featureFromPath,
  getOrCreateId,
  parseCorrelatePaths,
  resolveTagConfig,
  shouldCorrelate,
} from "../src/tag-core.js";

describe("resolveTagConfig", () => {
  it("reads the public key and defaults the endpoint", () => {
    expect(resolveTagConfig({ key: "vik_pub_abc" })).toEqual({
      publicKey: "vik_pub_abc",
      endpoint: DEFAULT_TAG_ENDPOINT,
    });
  });

  it("honors a custom endpoint and strips trailing slashes", () => {
    expect(resolveTagConfig({ key: "vik_pub_abc", endpoint: "https://stage-api.okovia.com/" })).toEqual({
      publicKey: "vik_pub_abc",
      endpoint: "https://stage-api.okovia.com",
    });
  });

  it("returns null (tag inert) without a key", () => {
    expect(resolveTagConfig(undefined)).toBeNull();
    expect(resolveTagConfig({})).toBeNull();
    expect(resolveTagConfig({ key: "   " })).toBeNull();
  });
});

describe("featureFromPath", () => {
  it("uses the first path segment", () => {
    expect(featureFromPath("/checkout/review")).toBe("checkout");
    expect(featureFromPath("/docs")).toBe("docs");
  });

  it("maps the root to home", () => {
    expect(featureFromPath("/")).toBe("home");
    expect(featureFromPath("")).toBe("home");
  });
});

describe("getOrCreateId", () => {
  function memoryStorage(): { getItem(k: string): string | null; setItem(k: string, v: string): void } {
    const data = new Map<string, string>();
    return {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
    };
  }

  it("mints once and then returns the stored id", () => {
    const storage = memoryStorage();
    const first = getOrCreateId(storage, ANONYMOUS_ID_KEY);
    const second = getOrCreateId(storage, ANONYMOUS_ID_KEY);
    expect(first).toMatch(/^anon_/);
    expect(second).toBe(first);
  });

  it("falls back to an ephemeral id without storage", () => {
    const id = getOrCreateId(undefined, ANONYMOUS_ID_KEY);
    expect(id).toMatch(/^anon_/);
  });

  it("survives storage that throws (private mode)", () => {
    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(getOrCreateId(throwing, ANONYMOUS_ID_KEY)).toMatch(/^anon_/);
  });
});

describe("parseCorrelatePaths", () => {
  it("splits and trims path prefixes", () => {
    expect(parseCorrelatePaths("/api/ai, /chat")).toEqual(["/api/ai", "/chat"]);
  });

  it("drops entries that are not absolute paths", () => {
    expect(parseCorrelatePaths("api,https://x.com/a,/ok")).toEqual(["/ok"]);
  });

  it("is empty (correlation off) without config", () => {
    expect(parseCorrelatePaths(undefined)).toEqual([]);
    expect(parseCorrelatePaths("")).toEqual([]);
  });
});

describe("shouldCorrelate", () => {
  const origin = "https://app.example.com";
  const prefixes = ["/api/ai"];

  it("matches same-origin requests under an opted-in prefix", () => {
    expect(shouldCorrelate("/api/ai/summarize", origin, prefixes)).toBe(true);
    expect(shouldCorrelate("https://app.example.com/api/ai/x", origin, prefixes)).toBe(true);
  });

  it("never touches cross-origin requests", () => {
    expect(shouldCorrelate("https://api.openai.com/v1/chat", origin, prefixes)).toBe(false);
  });

  it("ignores non-matching paths and empty prefix lists", () => {
    expect(shouldCorrelate("/health", origin, prefixes)).toBe(false);
    expect(shouldCorrelate("/api/ai/x", origin, [])).toBe(false);
  });
});

describe("createOperationId", () => {
  it("mints op_-prefixed unique ids", () => {
    const a = createOperationId();
    const b = createOperationId();
    expect(a).toMatch(/^op_/);
    expect(a).not.toBe(b);
  });
});

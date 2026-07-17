import { describe, expect, it } from "vitest";

import {
  ANONYMOUS_ID_KEY,
  DEFAULT_TAG_ENDPOINT,
  createOperationId,
  featureFromPath,
  getOrCreateId,
  resolveTagConfig,
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

describe("createOperationId", () => {
  it("mints op_-prefixed unique ids", () => {
    const a = createOperationId();
    const b = createOperationId();
    expect(a).toMatch(/^op_/);
    expect(a).not.toBe(b);
  });
});

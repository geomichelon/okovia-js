import type { JsonValue, MetadataJson } from "./types.js";

const SENSITIVE_KEY_PATTERNS = [
  /(^|_)cpf($|_)/i,
  /(^|_)ssn($|_)/i,
  /credit.?card/i,
  /card.?number/i,
  /bank.?account/i,
  /account.?number/i,
  /password/i,
  /secret/i,
  /token/i,
  /api.?key/i,
  /^prompt$/i,
  /full.?prompt/i,
  /raw.?prompt/i,
  /response.?text/i,
];

export function sanitizeProperties(properties: Record<string, JsonValue | undefined>): MetadataJson {
  return sanitizeObject(properties);
}

function sanitizeObject(input: Record<string, JsonValue | undefined>): MetadataJson {
  const output: MetadataJson = {};

  for (const [key, value] of Object.entries(input)) {
    if (isSensitiveKey(key)) {
      continue;
    }

    if (value === undefined) {
      continue;
    }

    const sanitized = sanitizeValue(value);
    if (sanitized !== undefined) {
      output[key] = sanitized;
    }
  }

  return output;
}

function sanitizeValue(value: JsonValue): JsonValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item))
      .filter((item): item is JsonValue => item !== undefined);
  }

  return sanitizeObject(value);
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

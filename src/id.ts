const EVENT_ID_PREFIX = "evt";

export function createEventId(): string {
  const cryptoObject = globalThis.crypto;

  if (cryptoObject && typeof cryptoObject.randomUUID === "function") {
    return `${EVENT_ID_PREFIX}_${cryptoObject.randomUUID()}`;
  }

  const randomPart = Math.random().toString(36).slice(2, 12);
  const timePart = Date.now().toString(36);
  return `${EVENT_ID_PREFIX}_${timePart}_${randomPart}`;
}

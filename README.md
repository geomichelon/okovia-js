# okovia

OkOvia browser telemetry SDK for web applications.

The SDK is intentionally narrow: it sends product behavior context only. It does not capture prompts, responses, DOM content, cookies, headers, local storage, forms, or sensitive data automatically.

> Prefer a drop-in script tag? The [OkOvia Tag](https://okovia.com) (`okovia.com/js/okovia.js`) is a bundled build of this same SDK — no npm needed. Use this package when you want typed, programmatic control.

## Install

```bash
npm install okovia
```

The package is intentionally tiny: zero runtime dependencies, just the compiled ESM modules and TypeScript types. After installing, ask it what you got:

```bash
npx okovia            # what's in the package + quickstart
npx okovia doctor     # connectivity check against the OkOvia API
```

## Usage

```ts
import { OkoviaClient } from "okovia";

const okovia = new OkoviaClient({
  publicKey: "vik_pub_xxx",
  projectId: "project_123",
  endpoint: "https://api.okovia.com",
});

okovia.track("ai_interaction_requested", {
  operationId: "op_123",
  feature: "credit_card_explanation",
  channel: "web",
});
```

`operationId` is required because OkOvia uses it to correlate product behavior with backend usage events and cost calculations.

> `VikingClient` remains exported as an alias, so existing integrations keep working after moving to the `okovia` package.

## Configuration

```ts
const okovia = new OkoviaClient({
  publicKey: "vik_pub_xxx",
  projectId: "project_123",
  endpoint: "https://api.okovia.com",
  batchSize: 10,
  flushIntervalMs: 5000,
  maxRetries: 3,
  retryBaseDelayMs: 500,
});
```

Options:

- `publicKey`: required. Must start with `vik_pub_`. Never use a secret key in the browser.
- `projectId`: required. Identifies the project that owns the event.
- `endpoint`: required. OkOvia API base URL.
- `workspaceId`: optional. OkOvia Cloud can derive workspace scope from the public key; self-hosted deployments may require this until the API derives it server-side.
- `batchSize`: optional. Number of queued events that triggers an automatic flush. Default: `10`.
- `flushIntervalMs`: optional. Time-based automatic flush interval. Default: `5000`.
- `maxRetries`: optional. Retry attempts per event. Default: `3`.
- `retryBaseDelayMs`: optional. Base delay for exponential backoff. Default: `500`.

## Manual Flush

```ts
await okovia.flush();
```

Use `flush()` before route transitions, sign-out, or other moments where you want to force pending events to be sent.

## Event Shape

`track()` sends a client event to:

```text
POST /v1/events/client
```

The SDK generates `event_id` automatically and sends the public key in the `X-API-Key` header.

Example payload:

```json
{
  "event_id": "evt_550e8400-e29b-41d4-a716-446655440000",
  "operation_id": "op_123",
  "project_id": "project_123",
  "event_name": "ai_interaction_requested",
  "channel": "web",
  "properties_json": {
    "feature": "credit_card_explanation"
  }
}
```

## Sensitive Data

Do not pass prompts, completions, documents, card numbers, bank account numbers, CPF/SSN values, passwords, API keys, auth tokens, secrets, or raw user content to `track()`.

The SDK performs defensive key-based filtering for obvious sensitive field names, but callers remain responsible for sending only safe metadata.

## License

MIT — see [LICENSE](./LICENSE).

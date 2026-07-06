# @viking/telemetry-js

Browser SDK for sending Viking client events from web applications.

The SDK is intentionally narrow: it sends product behavior context only. It does not capture prompts, responses, DOM content, cookies, headers, local storage, forms, or sensitive data automatically.

## Install

```bash
npm install @viking/telemetry-js
```

## Usage

```ts
import { VikingClient } from "@viking/telemetry-js";

const viking = new VikingClient({
  publicKey: "vk_pub_xxx",
  projectId: "project_123",
  endpoint: "https://api.viking.dev",
});

viking.track("ai_interaction_requested", {
  operationId: "op_123",
  feature: "credit_card_explanation",
  channel: "web",
});
```

`operationId` is required because Viking uses it to correlate product behavior with backend usage events and cost calculations.

## Configuration

```ts
const viking = new VikingClient({
  publicKey: "vk_pub_xxx",
  projectId: "project_123",
  endpoint: "https://api.viking.dev",
  batchSize: 10,
  flushIntervalMs: 5000,
  maxRetries: 3,
  retryBaseDelayMs: 500,
});
```

Options:

- `publicKey`: required. Must start with `vk_pub_`. Never use a secret key in the browser.
- `projectId`: required. Identifies the project that owns the event.
- `endpoint`: required. Viking API base URL.
- `workspaceId`: optional. Viking Cloud can derive workspace scope from the public key; self-hosted MVP deployments may require this until the API derives it server-side.
- `batchSize`: optional. Number of queued events that triggers an automatic flush. Default: `10`.
- `flushIntervalMs`: optional. Time-based automatic flush interval. Default: `5000`.
- `maxRetries`: optional. Retry attempts per event. Default: `3`.
- `retryBaseDelayMs`: optional. Base delay for exponential backoff. Default: `500`.

## Manual Flush

```ts
await viking.flush();
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

## Development

```bash
npm install
npm run build
npm test
```

The package is TypeScript-first and emits ESM JavaScript plus `.d.ts` declarations in `dist/`.

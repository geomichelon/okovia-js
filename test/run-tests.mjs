import assert from "node:assert/strict";
import { VikingClient, sanitizeProperties } from "../dist/index.js";

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function okResponse(status = 202) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return "";
    },
  };
}

test("track queues a client event and flush sends it to Viking", async () => {
  const requests = [];
  const client = new VikingClient({
    publicKey: "vk_pub_test",
    workspaceId: "workspace_123",
    projectId: "project_123",
    endpoint: "https://api.viking.dev",
    fetch: async (input, init) => {
      requests.push({ input, init });
      return okResponse();
    },
  });

  const result = client.track("ai_interaction_requested", {
    operationId: "op_123",
    feature: "credit_card_explanation",
    channel: "web",
  });

  assert.equal(result.queued, true);
  assert.match(result.eventId, /^evt_/);
  assert.equal(client.getQueueSize(), 1);

  const flushResult = await client.flush();
  assert.deepEqual(flushResult, { sent: 1, failed: 0 });
  assert.equal(client.getQueueSize(), 0);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].input, "https://api.viking.dev/v1/events/client");
  assert.equal(requests[0].init.headers["X-API-Key"], "vk_pub_test");

  const body = JSON.parse(requests[0].init.body);
  assert.equal(body.operation_id, "op_123");
  assert.equal(body.workspace_id, "workspace_123");
  assert.equal(body.project_id, "project_123");
  assert.equal(body.event_name, "ai_interaction_requested");
  assert.equal(body.channel, "web");
  assert.equal(body.properties_json.feature, "credit_card_explanation");
});

test("constructor rejects secret keys in browser SDK", () => {
  assert.throws(
    () =>
      new VikingClient({
        publicKey: "vk_sec_test",
        projectId: "project_123",
        endpoint: "https://api.viking.dev",
        fetch: async () => okResponse(),
      }),
    /Secret keys are not allowed/
  );
});

test("flush retries failed events with exponential backoff state", async () => {
  let callCount = 0;
  const client = new VikingClient({
    publicKey: "vk_pub_test",
    projectId: "project_123",
    endpoint: "https://api.viking.dev/",
    retryBaseDelayMs: 100000,
    fetch: async () => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error("network down");
      }
      return okResponse();
    },
  });

  client.track("ai_interaction_requested", {
    operationId: "op_retry",
    channel: "web",
  });

  assert.deepEqual(await client.flush(), { sent: 0, failed: 1 });
  assert.equal(client.getQueueSize(), 1);
  assert.deepEqual(await client.flush(), { sent: 1, failed: 0 });
  assert.equal(client.getQueueSize(), 0);
});

test("sanitizeProperties removes obvious sensitive fields", () => {
  const sanitized = sanitizeProperties({
    feature: "document_analysis",
    prompt: "full prompt should not leave the browser",
    nested: {
      credit_card_number: "4111111111111111",
      safe_count: 2,
    },
  });

  assert.deepEqual(sanitized, {
    feature: "document_analysis",
    nested: {
      safe_count: 2,
    },
  });
});

let failures = 0;

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}

import { describe, expect, it } from "vitest";

import { VikingClient, createEventId, sanitizeProperties } from "../src/index";

function okResponse(status = 202) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return "";
    }
  };
}

describe("VikingClient", () => {
  it("tracks and flushes a client event", async () => {
    const requests: Array<{ input: string; init: any }> = [];
    const client = new VikingClient({
      publicKey: "vk_pub_test",
      workspaceId: "workspace_123",
      projectId: "project_123",
      endpoint: "https://api.viking.dev",
      fetch: async (input, init) => {
        requests.push({ input, init });
        return okResponse();
      }
    });

    const result = client.track("ai_interaction_requested", {
      operationId: "op_123",
      feature: "credit_card_explanation",
      channel: "web"
    });

    expect(result.queued).toBe(true);
    expect(result.eventId).toMatch(/^evt_/);
    expect(client.getQueueSize()).toBe(1);

    await expect(client.flush()).resolves.toEqual({ sent: 1, failed: 0 });
    expect(requests).toHaveLength(1);
    expect(requests[0].input).toBe("https://api.viking.dev/v1/events/client");
    expect(requests[0].init.headers["X-API-Key"]).toBe("vk_pub_test");

    const body = JSON.parse(requests[0].init.body);
    expect(body).toMatchObject({
      operation_id: "op_123",
      workspace_id: "workspace_123",
      project_id: "project_123",
      event_name: "ai_interaction_requested",
      channel: "web"
    });
    expect(body.properties_json.feature).toBe("credit_card_explanation");
  });

  it("generates event ids", () => {
    expect(createEventId()).toMatch(/^evt_/);
  });

  it("sends automatically when batch size is reached", async () => {
    const requests: unknown[] = [];
    const client = new VikingClient({
      publicKey: "vk_pub_test",
      projectId: "project_123",
      endpoint: "https://api.viking.dev",
      batchSize: 2,
      fetch: async (input, init) => {
        requests.push({ input, init });
        return okResponse();
      }
    });

    client.track("first", { operationId: "op_1" });
    expect(client.getQueueSize()).toBe(1);

    client.track("second", { operationId: "op_2" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(requests).toHaveLength(2);
    expect(client.getQueueSize()).toBe(0);
  });

  it("retries failed events with mocked transport", async () => {
    let calls = 0;
    const client = new VikingClient({
      publicKey: "vk_pub_test",
      projectId: "project_123",
      endpoint: "https://api.viking.dev",
      retryBaseDelayMs: 100000,
      fetch: async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error("temporary network failure");
        }
        return okResponse();
      }
    });

    client.track("ai_interaction_requested", { operationId: "op_retry" });

    await expect(client.flush()).resolves.toEqual({ sent: 0, failed: 1 });
    expect(client.getQueueSize()).toBe(1);

    await expect(client.flush()).resolves.toEqual({ sent: 1, failed: 0 });
    expect(client.getQueueSize()).toBe(0);
  });

  it("filters obvious sensitive metadata keys", () => {
    expect(
      sanitizeProperties({
        feature: "document_analysis",
        prompt: "full prompt should not leave the browser",
        nested: {
          credit_card_number: "4111111111111111",
          safe_count: 2
        }
      })
    ).toEqual({
      feature: "document_analysis",
      nested: {
        safe_count: 2
      }
    });
  });

  it("rejects secret keys", () => {
    expect(
      () =>
        new VikingClient({
          publicKey: "vk_sec_test",
          projectId: "project_123",
          endpoint: "https://api.viking.dev",
          fetch: async () => okResponse()
        })
    ).toThrow(/Secret keys are not allowed/);
  });
});

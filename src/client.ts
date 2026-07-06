import { createEventId } from "./id.js";
import { sanitizeProperties } from "./safety.js";
import type {
  ClientEventPayload,
  FetchLike,
  FlushResult,
  MetadataJson,
  QueuedEvent,
  TrackProperties,
  TrackResult,
  VikingClientOptions,
} from "./types.js";

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;

export class VikingClient {
  private readonly publicKey: string;
  private readonly projectId: string;
  private readonly workspaceId?: string;
  private readonly endpoint: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly fetchImpl: FetchLike;
  private queue: QueuedEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private isFlushing = false;

  constructor(options: VikingClientOptions) {
    assertNonEmpty(options.publicKey, "publicKey");
    assertNonEmpty(options.projectId, "projectId");
    assertNonEmpty(options.endpoint, "endpoint");

    if (!options.publicKey.startsWith("vk_pub_")) {
      throw new Error("VikingClient must be initialized with a public browser key. Secret keys are not allowed.");
    }

    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error("VikingClient requires fetch. Provide options.fetch when running in an unsupported environment.");
    }

    this.publicKey = options.publicKey;
    this.projectId = options.projectId;
    this.workspaceId = options.workspaceId;
    this.endpoint = options.endpoint.replace(/\/+$/, "");
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.fetchImpl = fetchImpl.bind(globalThis) as FetchLike;
  }

  track(eventName: string, properties: TrackProperties): TrackResult {
    assertNonEmpty(eventName, "eventName");
    assertNonEmpty(properties.operationId, "properties.operationId");

    const eventId = createEventId();
    const payload = this.createPayload(eventId, eventName, properties);
    this.queue.push({ payload, attempts: 0 });

    if (this.queue.length >= this.batchSize) {
      void this.flush();
    } else {
      this.scheduleFlush();
    }

    return { eventId, queued: true };
  }

  async flush(): Promise<FlushResult> {
    if (this.isFlushing) {
      return { sent: 0, failed: this.queue.length };
    }

    this.clearFlushTimer();
    this.clearRetryTimer();
    this.isFlushing = true;

    const batch = this.queue.splice(0, this.batchSize);
    let sent = 0;
    const failedEvents: QueuedEvent[] = [];

    for (const item of batch) {
      try {
        await this.sendEvent(item.payload);
        sent += 1;
      } catch {
        if (item.attempts < this.maxRetries) {
          failedEvents.push({ payload: item.payload, attempts: item.attempts + 1 });
        }
      }
    }

    if (failedEvents.length > 0) {
      this.queue.unshift(...failedEvents);
      this.scheduleRetry(Math.max(...failedEvents.map((event) => event.attempts)));
    }

    if (this.queue.length > 0 && failedEvents.length === 0) {
      this.scheduleFlush();
    }

    this.isFlushing = false;
    return { sent, failed: failedEvents.length };
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  private createPayload(eventId: string, eventName: string, properties: TrackProperties): ClientEventPayload {
    const {
      operationId,
      channel,
      sessionId,
      anonymousId,
      externalUserIdHash,
      ...remainingProperties
    } = properties;

    const metadata = sanitizeProperties(remainingProperties);
    const payload: ClientEventPayload = {
      event_id: eventId,
      operation_id: operationId,
      project_id: this.projectId,
      event_name: eventName,
    };

    if (this.workspaceId) {
      payload.workspace_id = this.workspaceId;
    }

    if (channel) {
      payload.channel = channel;
    }

    if (sessionId) {
      payload.session_id = sessionId;
    }

    if (anonymousId) {
      payload.anonymous_id = anonymousId;
    }

    if (externalUserIdHash) {
      payload.external_user_id_hash = externalUserIdHash;
    }

    if (Object.keys(metadata).length > 0) {
      payload.properties_json = metadata;
    }

    return payload;
  }

  private async sendEvent(payload: ClientEventPayload): Promise<void> {
    const response = await this.fetchImpl(`${this.endpoint}/v1/events/client`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.publicKey,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Viking client event failed with ${response.status}: ${body}`);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== undefined) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  private scheduleRetry(attempts: number): void {
    if (this.retryTimer !== undefined) {
      clearTimeout(this.retryTimer);
    }

    const delay = this.retryBaseDelayMs * 2 ** Math.max(attempts - 1, 0);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.flush();
    }, delay);
  }

  private clearFlushTimer(): void {
    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== undefined) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
  }
}

function assertNonEmpty(value: string, fieldName: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`VikingClient requires ${fieldName}.`);
  }
}

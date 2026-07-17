export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type MetadataJson = Record<string, JsonValue>;

export type VikingChannel = "web" | "ios" | "android" | "backend" | string;

export interface VikingClientOptions {
  publicKey: string;
  /** Optional: the API derives the project from the public key when
   *  omitted, which is how the drop-in tag ships with only a key. */
  projectId?: string;
  endpoint: string;
  workspaceId?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  fetch?: FetchLike;
}

export interface TrackProperties {
  [key: string]: JsonValue | undefined;
  operationId: string;
  feature?: string;
  channel?: VikingChannel;
  sessionId?: string;
  anonymousId?: string;
  externalUserIdHash?: string;
}

export interface ClientEventPayload {
  event_id: string;
  operation_id: string;
  workspace_id?: string;
  project_id?: string;
  event_name: string;
  channel?: VikingChannel;
  session_id?: string;
  anonymous_id?: string;
  external_user_id_hash?: string;
  properties_json?: MetadataJson;
}

export interface TrackResult {
  eventId: string;
  queued: true;
}

export interface FlushResult {
  sent: number;
  failed: number;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    keepalive?: boolean;
  }
) => Promise<FetchResponseLike>;

export interface QueuedEvent {
  payload: ClientEventPayload;
  attempts: number;
}

// OkOvia is the public brand. `Viking*` names stay exported for
// back-compat, so existing integrations keep working after `okovia`
// becomes the package name.
import { VikingClient } from "./client.js";

export { VikingClient } from "./client.js";
export { VikingClient as OkoviaClient } from "./client.js";
export { createEventId } from "./id.js";
export { sanitizeProperties } from "./safety.js";
export type {
  ClientEventPayload,
  FetchLike,
  FlushResult,
  MetadataJson,
  TrackProperties,
  TrackResult,
  VikingChannel,
  VikingChannel as OkoviaChannel,
  VikingClientOptions,
  VikingClientOptions as OkoviaClientOptions,
} from "./types.js";

// Value-level alias so `new OkoviaClient(...)` works at runtime too.
export default VikingClient;

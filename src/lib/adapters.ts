import type { Incident, ServiceStatus, StatusChangeEvent } from "./types.js";

/** Uniform result returned by every source adapter. */
export interface IngestionResult {
  status: ServiceStatus;
  incidents?: Incident[];
}

/** A source adapter fetches vendor status from an external system. */
export interface SourceAdapter {
  /** Identifier matching the ingestion type in catalog.json (e.g. "statuspage-api"). */
  readonly type: string;

  /** Fetch current status and incidents from the source. */
  fetch(url: string, vendorId: string, config?: Record<string, unknown>): Promise<IngestionResult>;
}

/** Configuration passed to a destination adapter for delivery. */
export interface DestinationConfig {
  url: string;
  secret?: string;
}

/** A destination adapter delivers status change alerts to an external system. */
export interface DestinationAdapter {
  /** Identifier matching the alert target type (e.g. "slack", "webhook", "teams"). */
  readonly type: string;

  /** Send a status change event to the destination. */
  send(config: DestinationConfig, event: StatusChangeEvent): Promise<void>;
}

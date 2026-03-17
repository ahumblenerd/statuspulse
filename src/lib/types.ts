export const NormalizedStatus = {
  Operational: "operational",
  Degraded: "degraded",
  Outage: "outage",
  Maintenance: "maintenance",
} as const;

export type NormalizedStatusType = (typeof NormalizedStatus)[keyof typeof NormalizedStatus];

export type IngestionType = "statuspage-api" | "rss" | "atom" | "scrape";

export interface VendorConfig {
  id: string;
  name: string;
  category: string;
  statusPageUrl: string;
  ingestion: {
    type: IngestionType;
    url: string;
    selector?: string; // for scrape type
  };
  pollIntervalSeconds: number;
  defaultEnabled: boolean;
}

export interface ServiceStatus {
  vendorId: string;
  status: NormalizedStatusType;
  description: string;
  lastCheckedAt: string;
  components?: ComponentStatus[];
}

export interface ComponentStatus {
  name: string;
  status: NormalizedStatusType;
  description?: string;
}

export interface Incident {
  id: string;
  vendorId: string;
  externalId?: string;
  title: string;
  status: NormalizedStatusType;
  impact: string;
  shortlink?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  updates: IncidentUpdate[];
}

export interface IncidentUpdate {
  id: string;
  incidentId: string;
  status: string;
  body: string;
  createdAt: string;
}

export interface AlertTarget {
  id: string;
  type: "slack" | "webhook";
  name: string;
  config: {
    url: string;
    secret?: string;
  };
  enabled: boolean;
  createdAt: string;
}

export interface StatusChangeEvent {
  vendorId: string;
  vendorName: string;
  previousStatus: NormalizedStatusType;
  currentStatus: NormalizedStatusType;
  description: string;
  timestamp: string;
  region?: string;
  category?: string;
}

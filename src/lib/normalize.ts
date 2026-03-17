import { NormalizedStatus, type NormalizedStatusType } from "./types.js";

// Atlassian Statuspage status mappings
const statuspageIndicatorMap: Record<string, NormalizedStatusType> = {
  none: NormalizedStatus.Operational,
  operational: NormalizedStatus.Operational,
  minor: NormalizedStatus.Degraded,
  degraded_performance: NormalizedStatus.Degraded,
  partial_outage: NormalizedStatus.Degraded,
  major: NormalizedStatus.Outage,
  major_outage: NormalizedStatus.Outage,
  critical: NormalizedStatus.Outage,
  maintenance: NormalizedStatus.Maintenance,
  under_maintenance: NormalizedStatus.Maintenance,
};

export function normalizeStatuspageIndicator(indicator: string): NormalizedStatusType {
  return statuspageIndicatorMap[indicator.toLowerCase()] ?? NormalizedStatus.Operational;
}

export function normalizeStatuspageComponentStatus(status: string): NormalizedStatusType {
  return statuspageIndicatorMap[status.toLowerCase()] ?? NormalizedStatus.Operational;
}

// RSS/generic text-based status detection
const statusPatterns: [RegExp, NormalizedStatusType][] = [
  [/outage|down|unavailable|critical|major/i, NormalizedStatus.Outage],
  [/degraded|partial|slow|elevated|minor/i, NormalizedStatus.Degraded],
  [/maintenance|scheduled|planned/i, NormalizedStatus.Maintenance],
  [/operational|resolved|up|normal|ok/i, NormalizedStatus.Operational],
];

export function normalizeFromText(text: string): NormalizedStatusType {
  for (const [pattern, status] of statusPatterns) {
    if (pattern.test(text)) return status;
  }
  return NormalizedStatus.Operational;
}

/**
 * Return the most severe status from a list.
 * Severity ranking: operational < maintenance < degraded < outage.
 * Maintenance is intentionally ranked below degraded because maintenance is
 * planned/expected, while degraded indicates an unplanned issue affecting users.
 */
export function worstStatus(statuses: NormalizedStatusType[]): NormalizedStatusType {
  const severity: Record<NormalizedStatusType, number> = {
    operational: 0,
    maintenance: 1,
    degraded: 2,
    outage: 3,
  };
  let worst: NormalizedStatusType = NormalizedStatus.Operational;
  for (const s of statuses) {
    if (severity[s] > severity[worst]) worst = s;
  }
  return worst;
}

import { describe, it, expect } from "vitest";
import {
  normalizeStatuspageIndicator,
  normalizeStatuspageComponentStatus,
  normalizeFromText,
  worstStatus,
} from "../../lib/normalize.js";

describe("normalizeStatuspageIndicator", () => {
  it.each([
    ["none", "operational"],
    ["operational", "operational"],
    ["minor", "degraded"],
    ["degraded_performance", "degraded"],
    ["partial_outage", "degraded"],
    ["major", "outage"],
    ["major_outage", "outage"],
    ["critical", "outage"],
    ["maintenance", "maintenance"],
    ["under_maintenance", "maintenance"],
  ])("maps '%s' → '%s'", (input, expected) => {
    expect(normalizeStatuspageIndicator(input)).toBe(expected);
  });

  it("defaults unknown indicators to operational", () => {
    expect(normalizeStatuspageIndicator("unknown_thing")).toBe("operational");
    expect(normalizeStatuspageIndicator("")).toBe("operational");
  });

  it("is case-insensitive", () => {
    expect(normalizeStatuspageIndicator("MAJOR")).toBe("outage");
    expect(normalizeStatuspageIndicator("Minor")).toBe("degraded");
    expect(normalizeStatuspageIndicator("MAINTENANCE")).toBe("maintenance");
  });
});

describe("normalizeStatuspageComponentStatus", () => {
  it.each([
    ["operational", "operational"],
    ["degraded_performance", "degraded"],
    ["partial_outage", "degraded"],
    ["major_outage", "outage"],
    ["under_maintenance", "maintenance"],
  ])("maps '%s' → '%s'", (input, expected) => {
    expect(normalizeStatuspageComponentStatus(input)).toBe(expected);
  });
});

describe("normalizeFromText", () => {
  it("detects outage keywords", () => {
    expect(normalizeFromText("Service is down")).toBe("outage");
    expect(normalizeFromText("Major outage affecting users")).toBe("outage");
    expect(normalizeFromText("System unavailable")).toBe("outage");
    expect(normalizeFromText("Critical failure")).toBe("outage");
  });

  it("detects degraded keywords", () => {
    expect(normalizeFromText("Degraded performance")).toBe("degraded");
    expect(normalizeFromText("Partial connectivity issues")).toBe("degraded");
    expect(normalizeFromText("Slow response times")).toBe("degraded");
    expect(normalizeFromText("Elevated error rates")).toBe("degraded");
    expect(normalizeFromText("Minor issue detected")).toBe("degraded");
  });

  it("detects maintenance keywords", () => {
    expect(normalizeFromText("Scheduled maintenance")).toBe("maintenance");
    expect(normalizeFromText("Planned maintenance window")).toBe("maintenance");
  });

  it("prioritizes outage when 'down' appears before maintenance keywords", () => {
    // "downtime" contains "down" which matches outage pattern first
    expect(normalizeFromText("Planned downtime tonight")).toBe("outage");
  });

  it("detects operational keywords", () => {
    expect(normalizeFromText("All systems operational")).toBe("operational");
    expect(normalizeFromText("Issue resolved")).toBe("operational");
    expect(normalizeFromText("Service is up and running")).toBe("operational");
  });

  it("defaults to operational for unrecognized text", () => {
    expect(normalizeFromText("Lorem ipsum dolor sit amet")).toBe("operational");
    expect(normalizeFromText("")).toBe("operational");
  });

  it("prioritizes outage over degraded when both present", () => {
    // outage pattern matches first in the array
    expect(normalizeFromText("Major outage with degraded fallback")).toBe("outage");
  });
});

describe("worstStatus", () => {
  it("returns operational for empty array", () => {
    expect(worstStatus([])).toBe("operational");
  });

  it("returns the single status", () => {
    expect(worstStatus(["degraded"])).toBe("degraded");
    expect(worstStatus(["outage"])).toBe("outage");
  });

  it("returns outage when mixed with others", () => {
    expect(worstStatus(["operational", "degraded", "outage"])).toBe("outage");
  });

  it("returns degraded over maintenance and operational", () => {
    expect(worstStatus(["operational", "maintenance", "degraded"])).toBe("degraded");
  });

  it("returns maintenance over operational", () => {
    expect(worstStatus(["operational", "maintenance"])).toBe("maintenance");
  });

  it("returns operational when all operational", () => {
    expect(worstStatus(["operational", "operational", "operational"])).toBe("operational");
  });

  it("handles all four statuses", () => {
    expect(worstStatus(["operational", "maintenance", "degraded", "outage"])).toBe("outage");
  });
});

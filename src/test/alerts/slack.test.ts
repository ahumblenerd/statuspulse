import { http, HttpResponse } from "msw";
import { describe, it, expect } from "vitest";
import { sendSlackAlert } from "../../alerts/slack.js";
import type { StatusChangeEvent } from "../../lib/types.js";
import { server } from "../msw/server.js";

describe("sendSlackAlert", () => {
  const baseEvent: StatusChangeEvent = {
    vendorId: "github",
    vendorName: "GitHub",
    previousStatus: "operational",
    currentStatus: "degraded",
    description: "Actions experiencing elevated error rates",
    timestamp: "2026-03-15T06:00:00.000Z",
  };

  it("sends correctly formatted Block Kit message", async () => {
    let capturedBody: any = null;

    server.use(
      http.post("https://hooks.slack.com/services/test", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ok: true });
      })
    );

    await sendSlackAlert("https://hooks.slack.com/services/test", baseEvent);

    expect(capturedBody).toBeDefined();
    expect(capturedBody.blocks).toBeDefined();
    expect(capturedBody.blocks.length).toBe(4);

    // Header block
    expect(capturedBody.blocks[0].type).toBe("header");
    expect(capturedBody.blocks[0].text.text).toContain("GitHub");

    // Status fields
    expect(capturedBody.blocks[1].type).toBe("section");
    expect(capturedBody.blocks[1].fields[0].text).toContain("operational");
    expect(capturedBody.blocks[1].fields[1].text).toContain("degraded");

    // Description
    expect(capturedBody.blocks[2].text.text).toContain("elevated error rates");

    // Context footer
    expect(capturedBody.blocks[3].type).toBe("context");
  });

  it.each([
    ["operational", ":large_green_circle:"],
    ["degraded", ":large_yellow_circle:"],
    ["outage", ":red_circle:"],
    ["maintenance", ":wrench:"],
  ] as const)("uses correct emoji for %s status", async (status, emoji) => {
    let capturedBody: any = null;

    server.use(
      http.post("https://hooks.slack.com/services/test", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ok: true });
      })
    );

    await sendSlackAlert("https://hooks.slack.com/services/test", {
      ...baseEvent,
      currentStatus: status,
    });

    const currentField = capturedBody.blocks[1].fields[1].text;
    expect(currentField).toContain(emoji);
  });

  it("throws on webhook failure", async () => {
    server.use(
      http.post("https://hooks.slack.com/services/test", () => {
        return new HttpResponse(null, { status: 403 });
      })
    );

    await expect(
      sendSlackAlert("https://hooks.slack.com/services/test", baseEvent)
    ).rejects.toThrow(/403/);
  });
});

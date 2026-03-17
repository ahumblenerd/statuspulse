import { createHmac } from "crypto";
import { http, HttpResponse } from "msw";
import { describe, it, expect } from "vitest";
import { sendWebhookAlert } from "../../alerts/http-webhook.js";
import type { StatusChangeEvent } from "../../lib/types.js";
import { server } from "../msw/server.js";

describe("sendWebhookAlert", () => {
  const event: StatusChangeEvent = {
    vendorId: "github",
    vendorName: "GitHub",
    previousStatus: "operational",
    currentStatus: "outage",
    description: "Major outage",
    timestamp: "2026-03-15T06:00:00.000Z",
  };

  it("sends correct JSON payload", async () => {
    let capturedBody: any = null;

    server.use(
      http.post("https://webhook.example.com/status", async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      })
    );

    await sendWebhookAlert("https://webhook.example.com/status", event);

    expect(capturedBody).toBeDefined();
    expect(capturedBody.event).toBe("status_change");
    expect(capturedBody.vendor_id).toBe("github");
    expect(capturedBody.vendor_name).toBe("GitHub");
    expect(capturedBody.previous_status).toBe("operational");
    expect(capturedBody.current_status).toBe("outage");
    expect(capturedBody.description).toBe("Major outage");
    expect(capturedBody.timestamp).toBe("2026-03-15T06:00:00.000Z");
  });

  it("includes HMAC-SHA256 signature when secret provided", async () => {
    let capturedSignature = "";
    let capturedRawBody = "";

    server.use(
      http.post("https://webhook.example.com/status", async ({ request }) => {
        capturedSignature = request.headers.get("X-StatusPulse-Signature") ?? "";
        capturedRawBody = await request.text();
        return new HttpResponse(null, { status: 200 });
      })
    );

    const secret = "test-hmac-secret";
    await sendWebhookAlert("https://webhook.example.com/status", event, secret);

    expect(capturedSignature).toBeTruthy();
    expect(capturedSignature).toMatch(/^sha256=[a-f0-9]{64}$/);

    // Verify the signature is correct
    const expectedSig = createHmac("sha256", secret).update(capturedRawBody).digest("hex");
    expect(capturedSignature).toBe(`sha256=${expectedSig}`);
  });

  it("omits signature header when no secret", async () => {
    let capturedHeaders: Record<string, string> = {};

    server.use(
      http.post("https://webhook.example.com/status", async ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return new HttpResponse(null, { status: 200 });
      })
    );

    await sendWebhookAlert("https://webhook.example.com/status", event);

    expect(capturedHeaders["x-statuspulse-signature"]).toBeUndefined();
  });

  it("sets User-Agent header", async () => {
    let ua = "";

    server.use(
      http.post("https://webhook.example.com/status", async ({ request }) => {
        ua = request.headers.get("User-Agent") ?? "";
        return new HttpResponse(null, { status: 200 });
      })
    );

    await sendWebhookAlert("https://webhook.example.com/status", event);

    expect(ua).toBe("StatusPulse/1.0");
  });

  it("throws on webhook failure", async () => {
    server.use(
      http.post("https://webhook.example.com/status", () => {
        return new HttpResponse(null, { status: 502 });
      })
    );

    await expect(sendWebhookAlert("https://webhook.example.com/status", event)).rejects.toThrow(
      /502/
    );
  });
});

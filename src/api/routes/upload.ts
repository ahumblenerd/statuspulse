import { Hono } from "hono";
import { detectVendorsFromImage } from "../../vision/detect.js";

export const uploadRoutes = new Hono();

// Upload image for vendor detection
uploadRoutes.post("/detect", async (c) => {
  const contentType = c.req.header("Content-Type") ?? "";

  let imageBase64: string;
  let mediaType: string;

  if (contentType.includes("application/json")) {
    const body = await c.req.json();
    imageBase64 = body.image; // base64 encoded
    mediaType = body.mediaType ?? "image/png";
  } else if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    const file = formData.get("image") as File;
    if (!file) {
      return c.json({ error: "No image provided" }, 400);
    }
    const buffer = await file.arrayBuffer();
    imageBase64 = Buffer.from(buffer).toString("base64");
    mediaType = file.type || "image/png";
  } else {
    return c.json({ error: "Unsupported content type" }, 400);
  }

  try {
    const result = await detectVendorsFromImage(imageBase64, mediaType);
    return c.json(result);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

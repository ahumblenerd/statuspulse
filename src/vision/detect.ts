import Anthropic from "@anthropic-ai/sdk";
import { config } from "../lib/config.js";
import { searchVendors, getAllVendors } from "../vendors/registry.js";

interface DetectionResult {
  vendors: Array<{
    name: string;
    matchedVendorId: string | null;
    apparentStatus: string;
    confidence: number;
  }>;
  raw: string;
}

export async function detectVendorsFromImage(
  imageBase64: string,
  mediaType: string
): Promise<DetectionResult> {
  if (!config.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

  const catalogNames = getAllVendors()
    .map((v) => v.name)
    .join(", ");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as any,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `Analyze this image and identify any SaaS/cloud service vendors shown, along with their apparent status.

Known vendors in our catalog: ${catalogNames}

Return a JSON array of objects with:
- "name": the vendor name as shown
- "apparent_status": one of "operational", "degraded", "outage", "maintenance"
- "confidence": 0-1 confidence score

Return ONLY the JSON array, no other text.`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  let parsed: Array<{
    name: string;
    apparent_status: string;
    confidence: number;
  }>;
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    parsed = [];
  }

  const vendors = parsed.map((item) => {
    // Fuzzy match against catalog
    const matches = searchVendors(item.name);
    return {
      name: item.name,
      matchedVendorId: matches.length > 0 ? matches[0].id : null,
      apparentStatus: item.apparent_status,
      confidence: item.confidence,
    };
  });

  return { vendors, raw: text };
}

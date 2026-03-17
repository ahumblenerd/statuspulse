import { client } from "@/api/client.gen";

client.setConfig({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE ?? "/api",
});

export { client };

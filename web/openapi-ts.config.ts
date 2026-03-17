import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "../openapi.json",
  output: { path: "src/api", format: "prettier" },
  plugins: [
    "@hey-api/typescript",
    "@hey-api/client-fetch",
    "@tanstack/react-query",
  ],
});

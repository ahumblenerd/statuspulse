import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import-x";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    plugins: { "import-x": importPlugin },
    rules: {
      // File length limit — 200 lines max
      "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],

      // TypeScript
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // Import ordering
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "never",
          alphabetize: { order: "asc" },
        },
      ],
      "import-x/no-duplicates": "error",

      // General quality
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      "no-throw-literal": "error",
      curly: ["error", "multi-line"],
    },
  },
  {
    // Relax rules for test and mock files (fixture/scenario data)
    files: ["src/test/**", "src/mock/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "max-lines": "off",
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Relax for config files
    files: ["*.config.*", "drizzle.config.ts"],
    rules: {
      "max-lines": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    ignores: [
      "dist/",
      "dist-web/",
      "node_modules/",
      "web/",
      "data/",
      "drizzle/",
    ],
  }
);

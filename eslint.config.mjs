import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Law 3: model and speech providers are reachable only from ai/.
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    ignores: ["ai/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "ai",
              message: "Model calls live in ai/ only (CLAUDE.md Law 3). Import a role from @/ai instead.",
            },
          ],
          patterns: [
            {
              group: ["@ai-sdk/*"],
              message: "Model calls live in ai/ only (CLAUDE.md Law 3). Import a role from @/ai instead.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "docs/**",
    ".claude/**",
    "supabase/.temp/**",
    // The video is its own package with its own checks (video/README.md, D93).
    "video/**",
    ".release/**",
  ]),
]);

export default eslintConfig;

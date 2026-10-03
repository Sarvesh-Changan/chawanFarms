import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import * as importX from "eslint-plugin-import-x";
import security from "eslint-plugin-security";
import tseslint from "typescript-eslint";

const importRules = Object.fromEntries(
  Object.entries(importX.flatConfigs.recommended.rules).map(
    ([rule, setting]) => [
      rule,
      setting === "warn"
        ? "error"
        : Array.isArray(setting) && setting[0] === "warn"
          ? ["error", ...setting.slice(1)]
          : setting,
    ],
  ),
);

const securityRules = Object.fromEntries(
  Object.keys(security.configs.recommended.rules).map((rule) => [
    rule,
    "error",
  ]),
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...tseslint.configs.strict,
  {
    ...importX.flatConfigs.recommended,
    rules: importRules,
  },
  {
    ...security.configs.recommended,
    rules: securityRules,
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    settings: {
      "import-x/resolver": {
        typescript: true,
        node: true,
      },
    },
    rules: {
      "import-x/no-duplicates": "error",
      "import-x/order": [
        "error",
        {
          alphabetize: { caseInsensitive: true, order: "asc" },
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          pathGroups: [
            { pattern: "@/**", group: "internal", position: "before" },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
        },
      ],
    },
  },
  {
    files: ["src/**/*.client.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server", "@/server/*", "@/server/**"],
              message: "Client modules must not import server-only code.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

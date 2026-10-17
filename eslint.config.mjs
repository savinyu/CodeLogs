import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["extension/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        chrome: "readonly",
        document: "readonly",
        window: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
        Response: "readonly",
        console: "readonly",
      },
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "spike-output/**",
    ".claude/**",
    ".preview/**",
  ]),
]);

export default eslintConfig;

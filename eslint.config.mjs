import { defineConfig } from "eslint/config"
import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Só `error`/`warn` em app code: `log`/`info`/`debug` viram warning
    // (não falha o `eslint .` do package.json, que não usa --max-warnings).
    // `prisma/**` e o log dev do magic link são CLI/dev por contrato.
    rules: {
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
  {
    // `scripts/**` é lintado (o ignore `*.cjs` só cobre a raiz): o
    // gen-og-image.cjs usa console como CLI.
    files: ["prisma/**", "scripts/**", "src/auth/auth.config.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "node_modules/**",
      ".github/**",
      ".husky/**",
      "*.cjs",
    ],
  },
])

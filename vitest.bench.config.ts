import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

const rootPkg = (name: string): string =>
  fileURLToPath(new URL(`./node_modules/${name}`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      ioredis: rootPkg("ioredis"),
      pino: rootPkg("pino"),
    },
  },
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/bench/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      enabled: false,
    },
  },
})

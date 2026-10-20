import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

// socket-service/ tem node_modules próprios (npm ci no Dockerfile). Sem isto,
// `vi.mock("ioredis" | "pino")` chama na cópia da raiz e a importação vinda de
// socket-service/src resolve a cópia aninhada — mock não intercepta, o cliente
// real tenta DNS (ENOTFOUND) e close() trava na fila offline (timeout local
// que não reproduz no CI, que não instala o aninhado).
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
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
})

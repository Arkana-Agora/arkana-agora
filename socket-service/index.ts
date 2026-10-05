import { parseSocketEnv } from "./src/lib/env"
import { createSocketServer } from "./src/server"

// Entry point do mini-service Socket.io (plano T066, ADR-007).
// Dev: `bun run dev:ws` (tsx socket-service/index.ts).

async function main(): Promise<void> {
  const env = parseSocketEnv(process.env)
  const handle = await createSocketServer({ env })
  const address = handle.httpServer.address()
  const port =
    typeof address === "object" && address !== null
      ? address.port
      : env.SOCKET_PORT

  process.stdout.write(
    `{"level":30,"service":"socket-service","port":${port},"msg":"socket.io escutando"}\n`,
  )

  let shuttingDown = false
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    process.stdout.write(
      `{"level":30,"service":"socket-service","msg":"encerrando (${signal})"}\n`,
    )
    await handle.close()
    process.exit(0)
  }

  process.on("SIGINT", () => void shutdown("SIGINT"))
  process.on("SIGTERM", () => void shutdown("SIGTERM"))
}

main().catch((err: unknown) => {
  process.stderr.write(
    `{"level":50,"service":"socket-service","msg":"falha ao iniciar","err":${JSON.stringify(
      String(err),
    )}}\n`,
  )
  process.exit(1)
})

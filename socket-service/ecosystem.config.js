// T068 — PM2 cluster mode (ADR-007): instances 'max' distribui conexões
// WebSocket entre CPUs. Exige REDIS_URL definido: sem Redis, cada worker
// tem Event Bus/adapter em memória isolado (architecture.md §6.4) e os
// eventos publicados pelo Next.js não alcançam todos os sockets.
// ESM (`export default`) porque o package.json raiz tem "type": "module".
const config = {
  apps: [
    {
      name: "socket-service",
      script: "npx",
      args: "tsx socket-service/index.ts",
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
        SOCKET_PORT: 3003,
      },
    },
  ],
}

export default config

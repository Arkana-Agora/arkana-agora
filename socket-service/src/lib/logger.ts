// [fronteira I-c] pino PROPRIO (nao @/lib/logger): o closure do
// socket-service nao pode importar o alias @/ — a imagem Docker copia so
// socket-service/, sem src/ raiz do monólito (o logger de la puxa Prisma).
// Trocar por @/lib/logger quebraria o build da imagem.
//
// Instancia ÚNICA do serviço (revisão consistência): antes bus.ts,
// server.ts e redis-auth.ts criavam cada um `pino({ name })` idêntico.
// (emitters.ts continua em @/lib/logger — só roda no processo do Next.)
import { pino } from "pino"

export const logger = pino({ name: "socket-service" })

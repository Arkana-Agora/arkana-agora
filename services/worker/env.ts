// Carregamento de env do worker (T098/T102) — espelho do padrão do
// socket-service (`loadSocketEnvFiles`): em produção as env vars vêm do
// orquestrador (PM2/host); carregar arquivos .env do cwd seria um vetor
// de injeção de config (ex.: AI_HOROSCOPE_API_KEY forjada).
//
// `./env` é o PRIMEIRO import do `index.ts` de propósito: `@/lib/prisma`
// lê `DATABASE_URL` no import (PrismaPg `connectionString`) e imports ESM
// executam em ordem de declaração — dotenv precisa rodar antes de qualquer
// `@/*`. Precedência igual ao Next: ambiente já setado > .env.local > .env
// (dotenv nunca sobrescreve — a 1ª chamada vence por chave).
import { config as loadDotenv } from "dotenv"

if (process.env.NODE_ENV !== "production") {
  loadDotenv({ path: ".env.local" })
  loadDotenv({ path: ".env" })
}

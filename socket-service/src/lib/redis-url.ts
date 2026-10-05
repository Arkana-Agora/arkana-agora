// Revisão de consistência (bus.ts / redis-auth.ts): o padrão
// configure/resolve de URL do Redis era duplicado nos dois módulos. O helper
// guarda estado POR INSTÂNCIA — cada módulo tem seu próprio
// configure/reset para os testes resetarem de forma independente. Sem
// configuração explícita (lado Next/token-service) cai em
// process.env.REDIS_URL.
export interface RedisUrlResolver {
  configure(url: string | undefined): void
  reset(): void
  resolve(): string | undefined
}

export function createRedisUrlResolver(): RedisUrlResolver {
  let configuredUrl: string | undefined
  let configured = false

  return {
    configure(url: string | undefined): void {
      configured = true
      configuredUrl = url
    },
    reset(): void {
      configured = false
      configuredUrl = undefined
    },
    resolve(): string | undefined {
      return configured ? configuredUrl : process.env.REDIS_URL
    },
  }
}

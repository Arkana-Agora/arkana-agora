# Architecture Decision Records — arkana-agora

> Registro de decisões arquiteturais do projeto arkana-agora.
> Cada ADR segue o formato padrão: Título, Status, Contexto, Decisão, Consequências, Alternativas Consideradas.

---

## ADR-001: Next.js 16 App Router

### Status
**Aceito** ✅

### Contexto
O arkana-agora precisa de uma plataforma web com bom SEO (landing pages, perfis públicos), renderização no servidor para performance e suporte a streaming de dados em tempo real. A equipe tem experiência prévia com React e ecossistema Next.js.

### Decisão
Utilizar **Next.js 16** com **App Router** como framework principal da aplicação web.

### Consequências

**Positivas:**
- React Server Components reduzem o JavaScript enviado ao cliente (~40% menos bundle para páginas de leitura)
- Streaming nativo de respostas IA via SSE integrado ao framework
- SEO otimizado com metadados dinâmicos para páginas públicas (perfis, postagens)
- Rotação de código (code splitting) automática por rota
- `next/image` com otimização de imagens das cartas de tarot
- Ecossistema maduro com amplo suporte da comunidade

**Negativas:**
- Vendor lock-in com a Vercel (embora Next.js seja open-source)
- Curva de aprendizado do App Router vs Pages Router
- Complexidade adicional com Server vs Client Components

### Alternativas Consideradas

| Alternativa | Por que não escolhida |
|-------------|----------------------|
| Remix | Ecossistema menor, menos integrações com shadcn/ui |
| Astro | Ótimo para conteúdo estático, mas limitado para funcionalidades dinâmicas (real-time, auth) |
| Nuxt.js | Equipe mais familiarizada com TypeScript/React do que com Vue |
| SPA pura (Vite) | Perda de SEO e primeira carga mais lenta |

---

## ADR-002: Prisma ORM sobre Drizzle ou TypeORM

### Status
**Aceito** ✅

### Contexto
O projeto precisa de um ORM que suporte SQLite (desenvolvimento local) e PostgreSQL (produção), com migrações versionadas, tipagem forte e boa experiência de desenvolvedor.

### Decisão
Utilizar **Prisma ORM** como camada de acesso ao banco de dados.

### Consequências

**Positivas:**
- Schema declarativo em `schema.prisma` funciona como documentação viva
- Migrações automáticas com `prisma migrate`
- Tipos TypeScript gerados automaticamente a partir do schema
- Studio visual (`prisma studio`) para inspeção de dados em dev
- Suporte a SQLite (dev) e PostgreSQL (prod) sem mudança de código
- Comunidade brasileira ativa e extensa documentação em PT-BR

**Negativas:**
- Pacote `@prisma/client` adiciona peso ao bundle (edge runtime limitado)
- Queries complexas com JOINs múltiplos podem ser verbosas
- Cold starts levemente mais longos em serverless (geração do client)
- Não suporta queries raw tipadas nativamente tão bem quanto Drizzle

### Alternativas Consideradas

| Alternativa | Por que não escolhida |
|-------------|----------------------|
| Drizzle ORM | Mais novo, menos documentação e ferramentas (sem studio visual) |
| TypeORM | API mais complexa, tipagem menos segura, mais pesado |
| Kysely | Apenas query builder (sem ORM), mais trabalho manual |
| Raw SQL (pg) | Perda de produtividade, sem tipagem automática |

---

## ADR-003: Zustand + TanStack Query para gerenciamento de estado

### Status
**Aceito** ✅

### Contexto
A aplicação possui dois tipos de estado: estado de UI/cliente (tema, modais abertos, deck selecionado) e estado de servidor (leituras, feed, dados do usuário). É necessário gerenciar ambos de forma eficiente sem prop drilling excessivo.

### Decisão
Utilizar **Zustand** para estado do cliente e **TanStack Query** (React Query) para estado do servidor.

### Consequências

**Positivas:**
- **Zustand**: API mínima (~1KB), sem providers, suporte a persistência (localStorage), ideal para estado de UI
- **TanStack Query**: Cache inteligente, invalidação automática, background refetch, otimistic updates, suporte a SSE
- Separação clara de responsabilidades entre estado local e remoto
- DevTools excelentes para debug de ambos
- Compatível com Server Components (TanStack Query v5)

**Negativas:**
- Duas bibliotecas para aprender (embora ambas sejam simples)
- Configuração inicial de TanStack Query requer setup de QueryClient
- Limite de tamanho do store Zustand (não recomendado para dados complexos — usar TanStack Query para isso)

### Alternativas Consideradas

| Alternativa | Por que não escolhida |
|-------------|----------------------|
| Redux Toolkit | Boilerplate excessivo para o tamanho do projeto, complexidade desnecessária |
| Jotai | Estado atômico pode gerar confusão em domínios complexos como leituras |
| React Context apenas | Re-render desnecessário, sem cache de servidor, sem invalidação |
| SWR | TanStack Query oferece mais features (mutations, infinite queries, devtools) |

---

## ADR-004: SSE Streaming para leituras IA (não WebSocket)

### Status
**Aceito** ✅

### Contexto
As interpretações de IA das leituras de tarot são geradas pelo GPT-4o e podem levar de 5 a 30 segundos. A experiência do usuário exige que o texto apareça progressivamente (token a token), criando uma sensação de "a carta sendo revelada".

### Decisão
Utilizar **Server-Sent Events (SSE)** para streaming de interpretações IA, em vez de WebSocket.

### Consequências

**Positivas:**
- Comunicação unidirecional (servidor → cliente) é suficiente para interpretações
- Reconexão automática nativa do navegador (`EventSource` API)
- Mais simples de implementar e debugar que WebSocket bidirecional
- Compatível com React Server Components e streaming do Next.js
- Não requer porta separada — funciona nas API Routes padrão
- Funciona através de proxies e CDNs sem configuração especial

**Negativas:**
- Apenas texto — não suporta binário nativamente
- Limite de 6 conexões simultâneas por domínio no navegador (HTTP/1.1)
- Não suporta envio de dados do cliente durante o stream
- Requer cuidado com conexões abertas e timeout do servidor

### Alternativas Consideradas

| Alternativa | Por que não escolhida |
|-------------|----------------------|
| WebSocket (Socket.io) | Bidirecional é overkill para streaming unidirecional de IA |
| Long Polling | Latência maior, mais requisições, pior experiência |
| Chunked Transfer Encoding | Menos semântico, sem reconexão automática |

---

## ADR-005: Monorepo com Turborepo (futuro)

### Status
**Proposto** 🔄 (implementação planejada para V1+)

### Contexto
O MVP é um monolito Next.js único. Porém, a evolução planejada inclui aplicativo mobile (Expo), painel admin, e microsserviços. Gerenciar múltiplos repositórios criaria duplicação de código e complexidade de versionamento.

### Decisão
Adotar **Turborepo** com **pnpm workspaces** para gerenciar o monorepo quando a migração for iniciada.

### Consequências

**Positivas:**
- Compartilhamento de tipos, componentes e utilitários entre web, mobile e admin
- Build paralelo com cache de artefatos (reduz tempo de CI em ~60%)
- Versionamento consistente com changesets
- Comandos simples: `turbo run build`, `turbo run test`, `turbo run dev`

**Negativas:**
- Complexidade inicial de setup (turbo.json, configuração de pacotes)
- Curva de aprendizado da equipe para práticas de monorepo
- Possíveis problemas de dependência circular entre pacotes
- Debugging mais complexo com múltiplos pacotes

### Alternativas Consideradas

| Alternativa | Por que não escolhida |
|-------------|----------------------|
| Nx | Mais pesado e complexo que Turborepo para o tamanho do projeto |
| Lerna | Em manutenção reduzida, menos features que Turborepo |
| Múltiplos repositórios (polyrepo) | Duplicação massiva de código, versionamento caótico |
| NPM workspaces apenas | Sem cache de build, sem paralelismo, sem execução incremental |

---

## ADR-006: shadcn/ui sobre Material UI

### Status
**Aceito** ✅

### Contexto
O projeto precisa de um sistema de design consistente, acessível e personalizável. As opções principais são bibliotecas de componentes prontos (Material UI, Chakra UI) ou coleções copiáveis (shadcn/ui).

### Decisão
Utilizar **shadcn/ui** (estilo **New York**) como base do sistema de design.

### Consequências

**Positivas:**
- Componentes são copiados para o projeto — controle total sobre o código
- Estilo New York é elegante e minimalista, ideal para tema místico/esotérico
- Baseado em Radix UI primitivos — acessibilidade (a11y) de primeira classe
- Tailwind CSS nativo — sem conflito de estilos
- Customização fácil para tema personalizado (cores de tarot, gradientes místicos)
- Bundle menor — apenas componentes utilizados são incluídos

**Negativas:**
- Sem playground visual (diferente de MUI Storybook)
- Menos componentes prontos que MUI (sem DataGrid, DatePicker avançado)
- Atualizações manuais — não há `npm update` para componentes
- Documentação menos extensa que MUI

### Alternativas Consideradas

| Alternativa | Por que não escolhida |
|-------------|----------------------|
| Material UI (MUI) | Visual "Google" não combina com tema místico, bundle pesado, estilos próprios conflitam com Tailwind |
| Chakra UI | Runtime styling menor performance, menos popular que Tailwind |
| Headless UI | Sem estilos base — mais trabalho de customização |
| Radix UI diretamente | Muito low-level — shadcn/ui já abstrai sobre o Radix |

---

## ADR-007: Socket.io mini-service separado

### Status
**Aceito** ✅

### Contexto
A plataforma precisa de funcionalidades em tempo real: feed de atualizações, notificações instantâneas, indicador de presença (online/offline). O Next.js suporta WebSocket via API Routes, mas com limitações em serverless e sem escala horizontal nativa.

### Decisão
Implementar um **mini-service Socket.io separado** na porta **3003**, comunicando-se com o app Next.js via Event Bus.

### Consequências

**Positivas:**
- Escala independente — o serviço de WS pode ser escalado separamente do web app
- Sem impacto na performance do Next.js (conexões WebSocket não consomem recursos do server web)
- Ciclo de deploy independente — atualizações do WS não exigem redeploy do web
- Suporte a Redis adapter para escala horizontal multi-instância
- Separação clara de responsabilidades (HTTP vs real-time)

**Negativas:**
- Infraestrutura adicional para manter (mais um container/serviço)
- Necessidade de autenticação separada (validar JWT do NextAuth no Socket.io)
- Comunicação inter-service requer Event Bus ou chamadas HTTP
- Debugging mais complexo com dois processos

### Alternativas Consideradas

| Alternativa | Por que não escolhida |
|-------------|----------------------|
| Socket.io dentro do Next.js | Não funciona bem em serverless (Vercel), limita horizontal scaling |
| Pusher (SaaS) | Custo recorrente, vendor lock-in, latência adicional por ser externo |
| Supabase Realtime | Acoplamento ao Supabase, menos controle sobre canais e eventos |
| Server-Sent Events para tudo | Não suporta comunicação bidirecional (presença, chat) |

---

## ADR-008: Mercado Pago como gateway de pagamento (Brasil)

### Status
**Aceito** ✅

### Contexto
O marketplace do arkana-agora permite que profissionais de tarot vendam leituras, produtos esotéricos e consultorias. O público-alvo é brasileiro, e o pagamento precisa suportar PIX, cartão de crédito e boleto. A plataforma cobra uma comissão sobre cada transação.

### Decisão
Utilizar **Mercado Pago** como gateway de pagamento principal.

### Consequências

**Positivas:**
- Domínio completo do mercado brasileiro de pagamentos digitais
- Suporte nativo a PIX (instantâneo, sem custo adicional para o comprador)
- Split de pagamento nativo (plataforma recebe comissão, vendedor recebe o restante)
- Suporte a assinaturas recorrentes (plano PLUS)
- Webhooks confiáveis com retry automático
| Sandbox completo para testes em staging
| SDK oficial para Node.js com tipagem TypeScript
| Aceitação ampla — maioria dos brasileiros já tem conta Mercado Pago

**Negativas:**
- Vendor lock-in com ecossistema Mercado Livre
- Taxas podem ser mais altas que alternativas (2,99% a 7,49% dependendo do método)
- Documentação pode ser confusa e mudar com frequência
- Limitações para pagamentos internacionais (foco é Brasil)
- Dependência de disponibilidade do serviço (SLA não é 100% garantido)

### Alternativas Consideradas

| Alternativa | Por que não escolhida |
|-------------|----------------------|
| Stripe | Excelente API, mas suporte limitado a PIX e métodos brasileiros |
| PagSeguro | API menos moderna, documentação inferior, split de pagamento mais complexo |
| Iugu | Menor market share, menos recursos, split menos flexível |
| Pagar.me | Boa opção, mas adquirida pela Stone — futuro incerto |
| Asaas | Focado em recorrência, menos flexível para marketplace |

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*

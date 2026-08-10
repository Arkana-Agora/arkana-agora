# Marcos do Projeto Arkana Agora

> **Projeto**: Arkana Agora  
> **Identificador**: `arkana-agora`  
> **Início planejado**: Semana 1  
> **Conclusão V1 planejada**: Semana 18  

---

## Visão Geral da Linha do Tempo

```
Semana  1───3───5──────8──────13──────18────────26
        │   │    │      │       │       │        │
        ▼   ▼    ▼      ▼       ▼       ▼        ▼
       [M0]      [M1]          [M2]          [M3]   [M4]
      Chão    MVP       Comunidade    Monetização  Escala
     Pronto  Funcional    Ativa         Ativa    & Evolução
```

---

## M0 — "Chão Tá Preparado"

> **Infraestrutura pronta, deploy automático, autenticação funcionando**

| Campo | Detalhe |
|-------|--------|
| **Data alvo** | Semana 3 |
| **Sprint** | Sprint 0 |
| **Status** | Planejamento |

### Critérios de Conclusão

- [ ] Monorepo Turborepo + pnpm buildando sem erros
- [ ] `docker compose up` sobe toda a stack em < 60 segundos
- [ ] CI/CD pipeline verde: lint → test → build → deploy
- [ ] Deploy automático em staging (Vercel) a cada push na `main`
- [ ] NextAuth.js: login com Google OAuth redirecionando corretamente
- [ ] NextAuth.js: magic link enviando email e autenticando
- [ ] PostgreSQL conectado via Prisma, migrations aplicadas
- [ ] Tabelas `User`, `UserProfile`, `Subscription` criadas
- [ ] Design system shadcn/ui renderizando em tema claro e escuro
- [ ] Health check (`/api/health`) retornando 200 com status dos serviços
- [ ] Sentry capturando erros de produção
- [ ] Documentação de setup local completa e testada por terceiro

### Métricas a Acompanhar

| Métrica | Meta |
|---------|------|
| Tempo de build local | < 30s (cache hit) |
| Tempo de deploy CI/CD | < 5 minutos |
| Uptime do staging | > 99% |
| Cobertura de lint | 100% de arquivos |

### Celebração 🎉

- Primeiro deploy em produção (staging)
- Time compartilha print do pipeline verde no Slack
- Live demo do design system para stakeholders

---

## M1 — "MVP Funcional"

> **Primeira tiragem de tarot com IA, usuário consegue usar a plataforma**

| Campo | Detalhe |
|-------|--------|
| **Data alvo** | Semana 8 |
| **Sprint** | Sprint 1 |
| **Status** | Planejamento |

### Critérios de Conclusão

- [ ] Usuário se cadastra via Google ou email com sucesso
- [ ] Perfil criado com signo e arcano pessoal calculados automaticamente
- [ ] Tiragem de 3 cartas com animação de virar
- [ ] Interpretação IA gerada com streaming SSE (texto aparecendo em tempo real)
- [ ] Tarot do dia exibido na home do usuário logado
- [ ] Arcano Pessoal calculado via método de Pitágoras com resultado detalhado
- [ ] Histórico de tiragens acessível e paginado
- [ ] PWA instalável no celular (testado em iOS e Android)
- [ ] Landing page completa com SEO (hero, features, pricing, FAQ)
- [ ] PostHog trackeando eventos: `signup`, `reading_created`, `ai_interpretation`
- [ ] Zero bugs críticos em produção
- [ ] Lighthouse score > 80 em Performance, Accessibility, Best Practices

### Métricas a Acompanhar

| Métrica | Meta |
|---------|------|
| Cadastros (beta) | 50+ usuários |
| Tiragens realizadas | 200+ |
| Taxa de conclusão de tiragem | > 80% |
| Tempo de resposta IA (first token) | < 2 segundos |
| Lighthouse Performance | > 80 |
| PWA install rate | > 30% dos acessos mobile |

### Celebração 🎉

- Primeira tiragem de tarot pública (post no feed)
- Convite para 50 beta testers via lista de espera
- Demo ao time completo com tiragem ao vivo
- Newsletter: "Arkana Agora está vivo!"

---

## M2 — "Comunidade Ativa"

> **Feed social, horóscopos, 100+ usuários beta**

| Campo | Detalhe |
|-------|--------|
| **Data alvo** | Semana 13 |
| **Sprint** | Sprint 2 |
| **Status** | Planejamento |

### Critérios de Conclusão

- [ ] Feed timeline funcional com posts de seguidos
- [ ] Sistema de follow/unfollow operacional
- [ ] Likes e comentários funcionando em posts
- [ ] Horóscopo Ocidental calculando e exibindo para os 12 signos
- [ ] Horóscopo Chinês com animal e elemento corretos
- [ ] Kin Maya calculado via algoritmo Tzolkin (20 Selos × 13 Tons)
- [ ] Onda Encantada gerada com 9 posições
- [ ] Gifts virtuais enviáveis (6 tipos)
- [ ] Moeda virtual "Versos" com saldo funcional
- [ ] Notificações in-app para interações sociais
- [ ] Página Explore com busca de usuários
- [ ] Baralho Cigano (Lenormand) com 36 cartas e tiragens
- [ ] 100+ usuários ativos na plataforma

### Métricas a Acompanhar

| Métrica | Meta |
|---------|------|
| Usuários ativos (beta) | 100+ |
| DAU (Daily Active Users) | 30+ |
| Posts criados | 500+ |
| Interações (likes + comentários) | 2.000+ |
| Horóscopos consultados/dia | 50+ |
| Kin Maya calculados | 200+ |
| Gifts enviados | 300+ |
| Retenção D7 | > 30% |

### Celebração 🎉

- Marcamos 100 usuários com post especial no blog
- Evento online de tiragem coletiva para a comunidade
- Release notes publicado com todas as novas features
- Parceiros/esotéricos convidados para testar horóscopos

---

## M3 — "Monetização Ativa"

> **Marketplace + assinaturas + pagamentos processando**

| Campo | Detalhe |
|-------|--------|
| **Data alvo** | Semana 18 |
| **Sprint** | Sprint 3 |
| **Status** | Planejamento |

### Critérios de Conclusão

- [ ] Marketplace com produtos listados e carrinho funcional
- [ ] Pagamento via PIX processando e confirmando automaticamente
- [ ] Pagamento via cartão de crédito com parcelamento até 12x
- [ ] Webhooks Mercado Pago processando eventos corretamente
- [ ] Assinatura Akasha Plus com trial de 7 dias
- [ ] Recursos premium acessíveis apenas para assinantes
- [ ] Perfil profissional com agenda e avaliações
- [ ] Admin dashboard com métricas (MAU, receita, tiragens)
- [ ] Relatórios financeiros básicos
- [ ] Primeira transação real concluída ( PIX ou cartão)
- [ ] Zero fraudes ou chargebacks no primeiro mês
- [ ] Termos de uso e política de privacidade publicados

### Métricas a Acompanhar

| Métrica | Meta |
|---------|------|
| Usuários cadastrados | 500+ |
| Assinantes Akasha Plus | 20+ (beta) |
| Produtos no marketplace | 30+ |
| Transações processadas | 50+ |
| Taxa de conversão (free → plus) | > 4% |
| Receita MRR | R$ 600+ (beta) |
| NPS | > 50 |
| Taxa de erro em pagamentos | < 2% |

### Celebração 🎉

- Primeiro pagamento real recebido (momento simbólico)
- Anúncio público do Arkana Agora (press release)
- Convite para vendedores esotéricos conhecerem o marketplace
- Planejamento estratégico V2 com base nos dados coletados

---

## M4 — "Escala e Evolução"

> **10K+ usuários, chat real-time, app nativo roadmap**

| Campo | Detalhe |
|-------|--------|
| **Data alvo** | Semana 26 |
| **Sprint** | V2 (3-4 sprints) |
| **Status** | Roadmap |

### Critérios de Conclusão

- [ ] 10.000+ usuários cadastrados
- [ ] 1.000+ DAU (Daily Active Users)
- [ ] Chat real-time entre usuários (Socket.io)
- [ ] App nativo React Native disponível nas lojas (Beta)
- [ ] i18n: suporte a espanhol e inglês
- [ ] Notificações push mobile funcionando
- [ ] Geração de artes IA para cartas personalizadas
- [ ] IA generativa avançada (leituras contextuais multi-sessão)
- [ ] Programa de afiliados operacional
- [ ] Retenção D30 > 20%
- [ ] Tempo de resposta P95 < 500ms

### Métricas a Acompanhar

| Métrica | Meta |
|---------|------|
| Usuários cadastrados | 10.000+ |
| DAU | 1.000+ |
| Assinantes Plus | 500+ |
| MRR | R$ 15.000+ |
| Retenção D30 | > 20% |
| App Store rating | > 4.5 ★ |
| NPS | > 60 |
| Uptime | > 99,9% |

### Celebração 🎉

- Festa de lançamento oficial do app nativo
- Case study publicado
- Participação em eventos de esoterismo e tecnologia
- Planejamento V3 com expansão para LATAM

---

## Resumo dos Marcos

| Marco | Nome | Semana | Sprint | Status |
|-------|------|--------|--------|--------|
| M0 | Chão Tá Preparado | 3 | Sprint 0 | Planejamento |
| M1 | MVP Funcional | 8 | Sprint 1 | Planejamento |
| M2 | Comunidade Ativa | 13 | Sprint 2 | Planejamento |
| M3 | Monetização Ativa | 18 | Sprint 3 | Planejamento |
| M4 | Escala e Evolução | 26 | V2 | Roadmap |

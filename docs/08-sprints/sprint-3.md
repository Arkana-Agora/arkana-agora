# Sprint 3 — Marketplace + Monetização

> **Projeto**: Arkana Agora  
> **Identificador**: `arkana-agora`  
> **Duração**: 5 semanas  
> **Equipe**: 2-3 desenvolvedores + 1 backend specialist  
> **Status**: Planejamento  
> **Dependência**: Sprint 2 completo, conta Mercado Pago aprovada

---

## Objetivo

Implementar o marketplace de produtos esotéricos, sistema de pagamentos via Mercado Pago (PIX e cartão de crédito), assinatura Arkana Plus, perfis profissionais para consultórios e painel administrativo.

---

## User Stories

| # | User Story | Critério de Aceite | Prioridade |
|---|-----------|-------------------|------------|
| US-030 | Como vendedor, quero listar produtos no marketplace | CRUD de produtos com fotos, preço, descrição e categorias | Alta |
| US-031 | Como comprador, quero comprar com PIX ou cartão de crédito | Checkout funcional, confirmação de pagamento, webhook recebido | Crítica |
| US-032 | Como profissional, quero oferecer consultas personalizadas | Perfil profissional com agenda, tipos de consulta e preços | Média |
| US-033 | Como usuário, quero assinar o Arkana Plus para recursos premium | Assinatura recorrente, recursos desbloqueados, cancelamento funcional | Alta |
| US-034 | Como usuário, quero usar o baralho cigano (Lenormand) | 36 cartas ciganas com tiragens e interpretações IA | Alta |
| US-035 | Como administrador, quero gerenciar a plataforma | Dashboard com métricas, gestão de usuários e conteúdo | Média |
| US-036 | Como comprador, quero avaliar produtos e vendedores | Sistema de estrelas + comentário pós-compra | Média |
| US-037 | Como vendedor, quero resolver disputas de pedidos | Fluxo de disputa com timeline de interações | Baixa |

---

## Tasks Detalhadas

### Marketplace
- [ ] 1. Modelo de dados: `Product` (name, description, price, images, category, seller_id)
- [ ] 2. Modelo de dados: `ProductCategory` (hierarquia de categorias)
- [ ] 3. CRUD de produtos: criação, edição, exclusão (soft delete)
- [ ] 4. Upload de imagens de produto (Cloudflare R2)
- [ ] 5. Catálogo: listagem com filtros (categoria, preço, avaliação)
- [ ] 6. Busca de produtos (full-text search)
- [ ] 7. Página de detalhe do produto
- [ ] 8. Carrinho de compras (adicionar, remover, alterar quantidade)

### Pagamentos (Mercado Pago)
- [ ] 9. Integração Mercado Pago SDK (sandbox → produção)
- [ ] 10. Checkout com PIX: gerar QR Code, confirmar pagamento via webhook
- [ ] 11. Checkout com cartão de crédito: tokenização, parcelamento até 12x
- [ ] 12. Webhook handler: processar eventos de pagamento (approved, rejected, pending)
- [ ] 13. Modelo `Order`: status tracking (pending, paid, shipped, delivered, cancelled)
- [ ] 14. Modelo `OrderItem`: itens do pedido
- [ ] 15. Página de confirmação e histórico de pedidos

### Assinatura Arkana Plus
- [ ] 16. Plano de assinatura: mensal R$ 19,90
- [ ] 17. Integração assinatura recorrente Mercado Pago
- [ ] 18. Middleware de verificação de assinatura ativa
- [ ] 19. Gating de recursos premium: leituras ilimitadas, baralhos exclusivos, sem anúncios
- [ ] 20. Página de pricing com comparação Free vs Plus
- [ ] 21. Fluxo de cancelamento de assinatura
- [ ] 22. Período trial de 7 dias

### Baralho Cigano (Lenormand)
- [ ] 23. Dados das 36 cartas Lenormand (nome, número, significado)
- [ ] 24. Templates de espalhamento: 3 cartas, 9 cartas (Grande Tableau)
- [ ] 25. Prompt engineering específico para interpretações Lenormand
- [ ] 26. Interface de tiragem adaptada para 36 cartas

### Perfil Profissional
- [ ] 27. Modelo `ProfessionalProfile`: especialidades, certificações, bio
- [ ] 28. Sistema de agenda disponibilidade
- [ ] 29. Tipos de consulta: Tarot, Rúnico, Astrologia, Terapia Holística
- [ ] 30. Página de perfil profissional pública
- [ ] 31. Sistema de avaliações (1-5 estrelas + comentário)

### Admin Dashboard
- [ ] 32. Dashboard: métricas (MAU, receita, tiragens, assinantes)
- [ ] 33. Gestão de usuários: banir, suspender, promover para profissional
- [ ] 34. Gestão de conteúdo: remover posts, moderar reports
- [ ] 35. Gestão de marketplace: aprovar produtos, resolver disputas
- [ ] 36. Relatórios financeiros: receita por período, comissões, chargebacks

### Segurança e Compliance
- [ ] 37. Validação de webhook signature (Mercado Pago)
- [ ] 38. Criptografia de dados sensíveis (cartão, CPF)
- [ ] 39. Rate limiting em endpoints de pagamento
- [ ] 40. Audit log para ações administrativas

---

## Critérios de Aceite do Sprint

- [x] Marketplace funcional com CRUD de produtos e carrinho
- [x] Pagamentos processando via PIX e cartão de crédito
- [x] Webhooks recebendo e processando eventos corretamente
- [x] Assinatura Arkana Plus com trial, renovação e cancelamento
- [x] Recursos premium acessíveis apenas para assinantes
- [x] Baralho Cigano (Lenormand) com 36 cartas e tiragens
- [x] Perfil profissional com agenda e avaliações
- [x] Admin dashboard com métricas e gestão
- [x] Relatórios financeiros básicos

---

## Dependências

| Dependência | Tipo | Status |
|------------|------|--------|
| Sprint 2 completo | Bloqueante | Necessário |
| Conta Mercado Pago aprovada (produção) | Externa | Solicitar com 2 semanas de antecedência |
| Dados das 36 cartas Lenormand | Conteúdo | Preparar antes do início |
| Termos de uso e política de privacidade | Legal | Revisar com jurídico |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Aprovação Mercado Pago demorada | Média | Alto | Iniciar processo cedo, ter plano B (Stripe) |
| Chargebacks e fraudes | Média | Alto | Verificação de identidade, limite de compra inicial |
| Complexidade de assinatura recorrente | Média | Médio | Sandbox extenso, edge cases documentados |
| Disputas de pedido | Baixa | Médio | Sistema de disputa claro, suporte humano |
| Performance do admin dashboard | Baixa | Baixo | Agregações via cron, materialized views |

---

## Estimativa

| Módulo | Horas | Dias Úteis |
|--------|-------|-------------|
| Marketplace (CRUD + catálogo) | 48h | 6d |
| Pagamentos Mercado Pago | 56h | 7d |
| Assinatura Arkana Plus | 40h | 5d |
| Baralho Cigano (Lenormand) | 32h | 4d |
| Perfil Profissional | 32h | 4d |
| Admin Dashboard | 48h | 6d |
| Segurança + Compliance | 24h | 3d |
| Testes de integração | 24h | 3d |
| **Total** | **~304h** | **38d (5 semanas)** |

---

## Entregáveis

- Marketplace completo com catálogo e carrinho
- Sistema de pagamentos PIX e cartão (Mercado Pago)
- Assinatura Arkana Plus com trial e gating
- Baralho Cigano Lenormand (36 cartas)
- Perfis profissionais com agenda e avaliações
- Admin dashboard com métricas e gestão
- Relatórios financeiros
- Documentação de segurança e compliance

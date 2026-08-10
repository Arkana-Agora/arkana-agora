# SPEC-008: Marketplace

**Plataforma**: Arkana Agora
**Versao**: MVP
**Status**: Pendente
**Data**: 2025-01-01

---

## 1. Visao Geral

Este documento define os requisitos do Marketplace do Arkana Agora. O marketplace permite que vendedores profissionais oferecam produtos e servicos relacionados a tarot, esoterismo, astrologia e bem-estar espiritual. Os compradores podem navegar, buscar, comprar e avaliar produtos.

---

## 2. Requisitos Funcionais

### RF-MKT-001: CRUD de Produtos
Vendedores com perfil profissional (plano Plus) podem gerenciar produtos no marketplace:

**Campos do produto:**
- Titulo (obrigatorio, 10-120 caracteres)
- Descricao (obrigatoria, 50-5000 caracteres, suporta markdown)
- Categoria (obrigatoria, selecionada da taxonomia)
- Preco em reais (obrigatorio, R$ 0,01 a R$ 99.999,00)
- Preco promocional (opcional, menor que o preco original)
- Estoque (obrigatorio para produtos fisicos, 0-99.999)
- Tipo: fisico ou digital
- Imagens (1-8, JPEG/PNG/WebP, max 5MB cada, principal obrigatória)
- Variantes (opcional): cor, tamanho, material (ex.: tamanho do colar)
- Especificacoes adicionais (opcional): peso, dimensoes, materiais
- Frete gratis (toggle)
- Prazo de entrega em dias uteis (obrigatorio para fisicos)

**Regras:**
- Vendedor pode ter ate 100 produtos ativos simultaneamente
- Produto pode estar nos status: rascunho, ativo, pausado, esgotado, encerrado
- Edicao de produto ativo requer re-aprovacao se alterar titulo, categoria ou preco
- Produto digital: ao comprar, gerar link de download unico (valido por 72h)

### RF-MKT-002: Categorias e Taxonomia
O sistema deve organizar produtos em uma hierarquia de categorias:

**Categorias principais:**
- Baralhos e Cartas (sub: RWS, Thoth, Lenormand, Oracle, personalizados)
- Acessorios (sub: mantas de tiragem, caixas, cristais, incensos)
- Roupas e Joias (sub: colares, aneis, camisetas, capas)
- Livros e Cursos (sub: ebooks, fisicos, online, workshops)
- Consultas e Servicos (sub: tarot online, astrologia, numerologia, coaching)
- Cristais e Pedras (sub: quartzo, ametista, turmalina, jogos de pedras)
- Incensos e Aromas (sub: varas, cones, oleos essenciais, defumadores)

Cada subcategoria possui filtros especificos (material, preco, avaliacao).

### RF-MKT-003: Busca e Filtros
O sistema deve oferecer busca e filtros avancados:
- **Busca textual**: busca por titulo e descricao com suporte a fuzzy matching (tolerancia de 1 erro de digitacao)
- **Filtros por categoria**: navegacao por hierarquia (principal > sub)
- **Filtros por preco**: slider com valor minimo e maximo
- **Filtros por avaliacao**: minimo de estrelas
- **Filtros por tipo**: fisico, digital, servico
- **Ordenacao**: relevancia, menor preco, maior preco, mais recentes, mais vendidos, melhor avaliados
- **Paginacao**: 24 produtos por pagina
- Os filtros selecionados sao refletidos na URL (query params) para compartilhamento

### RF-MKT-004: Sistema de Avaliacoes e Reviews
Compradores podem avaliar produtos apos a compra:
- Nota de 1 a 5 estrelas (obrigatoria)
- Titulo do review (opcional, ate 100 caracteres)
- Texto do review (opcional, ate 1000 caracteres)
- Fotos do review (opcional, ate 3, max 2MB cada)
- Apenas 1 review por compra
- Review visivel apos 24h (para moderacao automatica)
- Vendedor pode responder ao review (1 resposta por review)
- Media de avaliacoes exibida no card do produto
- Filtros nos reviews: por nota, com fotos, mais recentes

### RF-MKT-005: Painel do Vendedor
Vendedores profissionais possuem um painel dedicado com:
- **Dashboard**: resumo de vendas (hoje, esta semana, este mes), receita, pedidos pendentes
- **Lista de produtos**: tabela com todos os produtos, filtros por status, acoes em lote
- **Pedidos**: lista de pedidos com status (pendente, pago, enviado, entregue, cancelado)
- **Avaliacoes**: lista de todos os reviews dos seus produtos com filtro por nota
- **Relatorios**: grafico de vendas por periodo, top produtos, ticket medio
- **Financeiro**: saldo disponivel, historico de saques, proximo saque programado

### RF-MKT-006: Resolucao de Disputas
O sistema deve ter um fluxo de resolucao de disputas entre comprador e vendedor:
- Comprador pode abrir disputa em ate 7 dias apos a compra
- Motivos: produto nao entregue, produto diferente do descrito, produto com defeito, outro
- Upload de fotos como evidencia (ate 5)
- Fases: aberta, em negociacao, em analise (equipe), resolvida (favor comprador/vendedor/ambos)
- Negociacao: comprador e vendedor podem enviar mensagens por ate 5 dias
- Se nao houver acordo: equipe de moderacao analisa e decide
- Decisao: reembolso total, reembolso parcial, sem reembolso
- Historico completo acessivel por ambas as partes

---

## 3. Requisitos Nao Funcionais

### RNF-MKT-001: Performance de Busca
A busca textual deve retornar resultados em menos de 300ms (P95) para ate 10.000 produtos indexados. Utilizar busca full-text do PostgreSQL ou buscar delegar para servico externo no futuro.

### RNF-MKT-002: Upload de Imagens
O upload de ate 8 imagens de produto deve completar em menos de 15 segundos (P95) em conexoes 4G.

---

## 4. Dependencias

| Dependencia | Versao | Proposito |
|---|---|---|
| Cloudflare R2 | - | Armazenamento de imagens de produto |
| sharp | >=0.33.x | Resize e processamento de imagens |
| Prisma | >=5.x | ORM e queries |
| TanStack Table | >=8.x | Tabelas de dados no painel do vendedor |

---

## 5. Criterios de Aceite

| ID | Criterio | Metodo de Validacao |
|---|---|---|
| CA-MKT-001 | Um vendedor cria um produto com todos os campos obrigatorios e ele aparece na listagem do marketplace | Teste E2E |
| CA-MKT-002 | A busca por "baralho rider" retorna produtos relevantes mesmo com erro de digitacao | Teste de integracao |
| CA-MKT-003 | Um comprador deixa avaliacao 5 estrelas com texto e foto; a media do produto e atualizada | Teste E2E |
| CA-MKT-004 | O painel do vendedor exibe grafico de vendas semanal correto | Teste de integracao com dados de seed |
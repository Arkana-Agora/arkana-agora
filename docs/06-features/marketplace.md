# Marketplace — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Marketplace | **Versão**: V1

---

## Descrição

O Marketplace do **Arkana Agora** é uma vitrine digital para produtos e serviços esotéricos, conectando criadores e profissionais a compradores interessados. A plataforma suporta vendas de produtos digitais (e-books, cursos, artes), produtos físicos (amuletos, runas, cristais) e serviços personalizados (consultas de Tarot, mapas astrais). Cada vendedor possui um painel de gestão completo com controle de anúncios, pedidos e receita.

As categorias organizam o conteúdo de forma intuitiva: Amuletos, Runas, Cursos, Consultas, E-books e Artes. O sistema de busca inclui filtros por categoria, faixa de preço, avaliação e tipo de entrega. Produtos digitais são entregues automaticamente após a confirmação do pagamento, enquanto produtos físicos seguem o fluxo de rastreamento padrão de e-commerce. Em caso de disputa entre comprador e vendedor, a plataforma atua como mediadora com política clara de reembolso.

---

## Funcionalidades

- **Listagem de produtos** com imagem, título, descrição, preço e categoria
- **Categorias**: Amuletos, Runas, Cursos, Consultas, E-books, Artes
- **Página de detalhe** com galeria de imagens, descrição completa, avaliações e seções relacionadas
- **Sistema de avaliações** (1 a 5 estrelas) com comentários obrigatórios
- **Busca com filtros** (categoria, preço, avaliação, tipo de produto)
- **Painel do vendedor**: gerenciar anúncios, visualizar pedidos, acompanhar receita
- **Entrega automática** de produtos digitais após pagamento confirmado
- **Rastreamento de pedidos** físicos com código de rastreio
- **Resolução de disputas** com medição pela plataforma
- **Política de reembolso** conforme categoria do produto

---

## Fluxo Principal

1. O usuário acessa o Marketplace pelo menu principal
2. Navega pelas categorias ou utiliza a barra de busca com filtros
3. Clica em um produto para visualizar a página de detalhes
4. Verifica avaliações, descrição e informações do vendedor
5. Clica em "Comprar" e é redirecionado ao checkout
6. Seleciona a forma de pagamento (PIX, cartão de crédito, boleto) via Mercado Pago
7. Após pagamento confirmado, recebe a confirmação e acesso ao produto (digital) ou rastreio (físico)
8. O vendedor é notificado do novo pedido em seu painel
9. Após receber/consumir, o comprador pode deixar avaliação
10. Em caso de problema, qualquer das partes pode abrir disputa

---

## Versão

| Feature | Versão |
|---|---|
| Listagem e busca de produtos | V1 |
| Checkout via Mercado Pago | V1 |
| Entrega automática de digitais | V1 |
| Painel do vendedor | V1 |
| Sistema de avaliações | V1 |
| Resolução de disputas | V1 |
| Cupons de desconto | V2 |
| Assinatura de cursos | V2 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Login para compra e venda |
| Perfil | Módulo interno | Dados do vendedor |
| Pagamentos | Módulo interno | Integração Mercado Pago |
| Notificações | Módulo interno | Alertas de pedidos e atualizações |
| Armazenamento de arquivos | Infraestrutura | Imagens dos produtos |
| **Mercado Pago SDK** | **API externa** | Processamento de pagamentos (PIX, cartão, boleto) |

---

## Critérios de Aceite

- **CA-01**: A busca deve retornar resultados em menos de 1 segundo para um catálogo de até 10.000 produtos
- **CA-02**: O checkout deve ser concluído em menos de 3 etapas e o pagamento deve ser processado em menos de 10 segundos
- **CA-03**: Produtos digitais devem ser disponibilizados para download em menos de 30 segundos após a confirmação do pagamento
- **CA-04**: O painel do vendedor deve exibir métricas de receita, pedidos e avaliações com dados atualizados em tempo real
- **CA-05**: Uma disputa deve ser aberta em menos de 2 cliques e a plataforma deve responder em até 48 horas úteis
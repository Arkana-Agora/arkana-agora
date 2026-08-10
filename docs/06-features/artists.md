# Artistas e Criadores — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Artistas e Criadores | **Versão**: V2

---

## Descrição

O módulo de Artistas e Criadores do **Arkana Agora** reconhece e valoriza o trabalho de ilustradores, designers e criadores de baralhos esotéricos. A plataforma oferece um espaço dedicado para que artistas exibam seus portfólios, conectem-se com a comunidade e monetizem seu trabalho através de baralhos licenciados e encomendas personalizadas. Cada artista possui um perfil diferenciado com galeria de trabalhos, biografia e links para redes sociais.

Um dos diferenciais do módulo é o sistema de **repartição de receita** (revenue sharing): quando um baralho criado por um artista é utilizado por outros usuários em suas leituras, o artista recebe uma porcentagem da receita gerada. O sistema de encomendas permite que usuários solicitem ilustrações personalizadas (cartas individuais, baralhos completos, arte para perfil) diretamente pelo perfil do artista, com valores e prazos definidos pelo próprio criador.

---

## Funcionalidades

- **Perfil de artista** com galeria de portfólio, biografia e especialidades
- **Galeria de trabalhos** com imagens em alta resolução e categorização
- **Baralhos licenciados** — upload de baralhos completos para uso na plataforma
- **Repartição de receita** (revenue sharing) por uso de baralhos
- **Sistema de encomendas** com formulário de solicitação personalizada
- **Painel do artista**: métricas de uso, receita, encomendas ativas
- **Certificação de artista verificado** (selo na plataforma)
- **Processo de curadoria** para novos baralhos

---

## Modelo de Repartição de Receita

```
Receita bruta por leitura com baralho licenciado: R$ 0,10
Distribuição:
  - Artista criador: 60% (R$ 0,06)
  - Plataforma: 40% (R$ 0,04)

Receita por venda de baralho no Marketplace:
  - Artista criador: 70%
  - Plataforma: 30%

Pagamento ao artista: mensal, via PIX, mínimo R$ 50,00
```

---

## Fluxo Principal

1. O usuário solicita o upgrade para perfil de artista em suas configurações
2. Preenche as informações: portfólio, especialidades, links sociais
3. A equipe de curadoria avalia o perfil e os trabalhos (até 7 dias úteis)
4. Após aprovação, o artista recebe o selo verificado e o painel é liberado
5. O artista pode enviar baralhos para licenciamento na plataforma
6. O baralho passa por curadoria de qualidade (imagens, significados, consistência)
7. Após aprovação, o baralho fica disponível para todos os usuários
8. O artista acompanha métricas de uso e receita no painel
9. Usuários podem solicitar encomendas diretamente pelo perfil do artista
10. O artista recebe pagamentos mensais via PIX

---

## Versão

| Feature | Versão |
|---|---|
| Perfil de artista com portfólio | V2 |
| Upload e curadoria de baralhos | V2 |
| Repartição de receita | V2 |
| Sistema de encomendas | V2 |
| Painel do artista com métricas | V2 |
| Loja de arte dentro da plataforma | V3 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Usuário autenticado com perfil completo |
| Perfil | Módulo interno | Upgrade do perfil para artista |
| Tarot / Lenormand | Módulo interno | Infraestrutura de baralhos |
| Marketplace | Módulo interno | Venda de baralhos e arte |
| Pagamentos | Módulo interno | Repartição de receita via PIX |
| Armazenamento de arquivos | Infraestrutura | Galeria de alta resolução |
| Moderação (Admin) | Módulo interno | Curadoria de baralhos |

---

## Critérios de Aceite

- **CA-01**: O upload de um baralho completo (78 imagens + metadados) deve ser processado e validado em menos de 5 minutos
- **CA-02**: A repartição de receita deve ser calculada com precisão centesimal e consolidada mensalmente até o dia 5
- **CA-03**: O perfil de artista deve carregar com galeria em menos de 3 segundos, mesmo com 50+ imagens
- **CA-04**: O processo de encomenda deve permitir envio de briefing, orçamento e prazo em menos de 2 minutos
- **CA-05**: O selo de artista verificado deve ser exibido em todas as ocorrências do nome do artista na plataforma
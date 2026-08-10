# Profissionais (Tarólogos) — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Profissionais | **Versão**: V1

---

## Descrição

O módulo de Profissionais permite que tarólogos e praticantes de esoterismo ofereçam seus serviços de consulta diretamente dentro do **Arkana Agora**, criando um ecossistema completo que vai da autoleitura à consulta especializada. Cada profissional possui um perfil diferenciado com suas especialidades (Tarot, Lenormand, Astrologia, Numerologia, etc.), certificações, avaliações de clientes e um calendário de disponibilidade integrado ao sistema de agendamento.

O sistema de reservas (booking) permite que clientes escolham data, horário e tipo de consulta diretamente no perfil do profissional. As consultas são realizadas por chat (MVP) com integração de videochamada planejada para versões futuras. O sistema de avaliações pós-consulta garante transparência e qualidade, enquanto as métricas de satisfação influenciam o posicionamento do profissional nos resultados de busca e na página Explorar.

---

## Funcionalidades

- **Perfil profissional diferenciado** com especialidades, certificações e biografia
- **Sistema de agendamento** com calendário de disponibilidade e fuso horário
- **Tipos de consulta**: chat por texto, chat por áudio, videochamada (futura)
- **Avaliações e ratings** (1 a 5 estrelas) obrigatórias pós-consulta
- **Calendário de disponibilidade** com gestão de horários e férias
- **Painel do profissional**: agenda, histórico de consultas, receita, avaliações
- **Listagem com busca e filtros** (especialidade, preço, avaliação, disponibilidade)
- **Verificação de profissional** (documentação, certificações)
- **Integração de videochamada** (planejado para V2)

---

## Fluxo Principal

1. O usuário solicita o upgrade para perfil profissional nas configurações
2. Preenche dados profissionais: especialidades, certificações, valor por consulta, descrição
3. Envia documentação para verificação (CPF, certificado, comprovante de experiência)
4. A equipe de moderação avalia a solicitação (até 5 dias úteis)
5. Após aprovação, o perfil profissional é ativado com selo verificado
6. O profissional configura sua disponibilidade no calendário
7. Um cliente acessa a página do profissional e visualiza perfil, avaliações e horários
8. O cliente seleciona data, horário e tipo de consulta
9. O sistema processa o pagamento e confirma o agendamento
10. Na data/hora marcada, o chat da consulta é aberto para ambas as partes
11. Após a conclusão, o cliente é convidado a deixar avaliação
12. O profissional recebe a receita conforme política de repartição

---

## Versão

| Feature | Versão |
|---|---|
| Perfil profissional com especialidades | V1 |
| Sistema de agendamento (chat por texto) | V1 |
| Avaliações pós-consulta | V1 |
| Calendário de disponibilidade | V1 |
| Painel do profissional | V1 |
| Videochamada integrada | V2 |
| Consultas por áudio (whisper) | V2 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Usuário autenticado com perfil completo |
| Perfil | Módulo interno | Upgrade para profissional |
| Social | Módulo interno | Avaliações e posicionamento |
| Pagamentos | Módulo interno | Processamento e repartição |
| Notificações | Módulo interno | Lembretes de agendamento |
| Chat/Notificações em tempo real | Infraestrutura | WebSocket para consultas ao vivo |
| Moderação (Admin) | Módulo interno | Verificação de profissionais |

---

## Critérios de Aceite

- **CA-01**: O processo de agendamento deve ser concluído em menos de 5 cliques (perfil → horário → pagamento → confirmação)
- **CA-02**: A avaliação pós-consulta deve ser obrigatória e exibida em menos de 24 horas após a conclusão da sessão
- **CA-03**: O calendário de disponibilidade deve suportar múltiplos fusos horários e exibir horários no fuso do cliente
- **CA-04**: O painel do profissional deve exibir receita do mês, consultas realizadas e nota média com dados atualizados em tempo real
- **CA-05**: A busca de profissionais deve retornar resultados em menos de 1 segundo com filtros combinados (especialidade + faixa de preço + avaliação mínima)
# Tarot Diário — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Tarot Diário | **Versão**: MVP

---

## Descrição

O Tarot Diário oferece ao usuário uma carta de orientação pessoal calculada de forma determinística a partir da data atual combinada com um seed único do usuário. Diferente de um sorteio aleatório, esse mecanismo garante que o mesmo usuário veja a mesma carta ao longo de todo o dia, criando uma experiência consistente e previsível. A interpretação é gerada por IA e armazenada em cache, sendo atualizada automaticamente à meia-noite (fuso horário do usuário).

O módulo inclui rastreamento de sequência (streak) para incentivar o hábito diário de consulta, exibindo o número de dias consecutivos em que o usuário realizou a leitura. O histórico completo das cartas diárias fica disponível para consulta, permitindo ao usuário observar padrões e tendências ao longo do tempo. Notificações push opcionais lembram o usuário de realizar sua leitura diária no horário preferido.

---

## Funcionalidades

- **Seleção determinística de carta** baseada em `hash(data + userId) % 78`
- **Interpretação diária gerada por IA** e armazenada em cache
- **Atualização automática à meia-noite** (fuso horário do usuário)
- **Rastreamento de sequência (streak)** com contador de dias consecutivos
- **Histórico completo** de cartas diárias com interpretações
- **Notificação push opcional** no horário configurado pelo usuário
- **Indicador visual de streak** (fogo/consecutivos) na tela inicial

---

## Algoritmo de Seleção Determinística

```
seed = hash_sha256(userId + YYYY-MM-DD)
cardIndex = parseInt(seed.substring(0, 8), 16) % 78
isReversed = (parseInt(seed.substring(8, 10), 16) % 10) < 3  // 30% de chance invertida
card = deck[cardIndex]
```

A mesma combinação de `userId + data` sempre produzirá a mesma carta, garantindo consistência.

---

## Fluxo Principal

1. O usuário acessa a tela inicial ou a seção de Tarot Diário
2. O sistema verifica se já existe uma leitura diária em cache para o usuário na data atual
3. Se não existir, calcula a carta via algoritmo determinístico (hash da data + userId)
4. O sistema solicita a interpretação por IA (ou recupera do cache se já foi gerada)
5. A carta e sua interpretação são exibidas ao usuário
6. O sistema registra a consulta e atualiza a sequência (streak) do usuário
7. À meia-noite (fuso do usuário), o cache é invalidado e uma nova carta fica disponível
8. O usuário pode navegar pelo histórico de cartas diárias anteriores

---

## Versão

| Feature | Versão |
|---|---|
| Carta diária determinística | MVP |
| Interpretação por IA com cache | MVP |
| Rastreamento de streak | MVP |
| Histórico de cartas diárias | MVP |
| Notificação push lembrete | V1 |
| Estatísticas de padrões mensais | V2 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Identificação do usuário para seed |
| Perfil | Módulo interno | Fuso horário do usuário |
| AI Service | Serviço interno | Geração de interpretação |
| Notificações | Módulo interno | Push de lembrete diário |
| Cache (Redis) | Infraestrutura | Armazenamento de interpretações diárias |

---

## Critérios de Aceite

- **CA-01**: A mesma carta deve ser exibida para o mesmo usuário durante todo o dia, independente do dispositivo ou número de acessos
- **CA-02**: O streak deve ser atualizado em tempo real e persistir corretamente mesmo se o usuário acessar após a meia-noite
- **CA-03**: A interpretação em cache deve ser entregue em menos de 500ms; a geração inicial por IA deve ocorrer em menos de 5 segundos
- **CA-04**: O histórico deve exibir todas as cartas diárias anteriores com paginação infinita (20 por carregamento)
- **CA-05**: A notificação push deve ser enviada no horário configurado pelo usuário com tolerância de 5 minutos

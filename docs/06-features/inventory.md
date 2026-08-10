# Inventário e Coleções — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Inventário e Coleções | **Versão**: V2

---

## Descrição

O módulo de Inventário e Coleções gamifica a experiência do **Arkana Agora**, transformando o uso da plataforma em uma jornada de coleção e conquista. Os usuários desbloqueiam itens virtuais — cartas especiais, amuletos, planos de fundo para leituras, molduras para avatar — através de marcos de uso, conquistas e participação em eventos. Cada item possuído é exibido no inventário pessoal e pode ser equipado para personalização do perfil e das leituras.

O sistema de **conquistas (badges)** recompensa marcos significativos: primeira leitura, sequência de 7 dias, 30 leituras realizadas, 100 seguidores, entre outros. As conquistas são exibidas no perfil público e geram notificações ao serem desbloqueadas. O sistema de troca (planejado para futuras versões) permitirá que usuários troquem itens duplicados entre si, criando uma economia interna de colecionadores.

---

## Funcionalidades

- **Inventário virtual** com categorias: Cartas Especiais, Amuletos, Planos de Fundo, Molduras, Emblemas
- **Desbloqueio por conquistas** — itens concedidos automaticamente ao atingir marcos
- **Desbloqueio por evento** — itens exclusivos de eventos sazonais
- **Conquistas (badges)** com ícone, nome, descrição e data de obtenção
- **Equipamento de itens** — selecionar itens ativos para perfil e leituras
- **Galeria de coleção** — visualização de todos os itens (possuídos e não possuídos)
- **Progresso de conquistas** — exibição do progresso para conquistas não concluídas
- **Sistema de troca** (futuro) — troca de itens duplicados entre usuários

---

## Conquistas Disponíveis

| Conquista | Descrição | Recompensa | Tipo |
|---|---|---|---| 
| Primeira Carta | Realizar sua primeira leitura | Moldura "Iniciante" | Marco |
| Sete Dias de Luz | Streak de 7 dias no Tarot Diário | Plano de Fundo "Aurora" | Streak |
| Trinta Dias | Streak de 30 dias no Tarot Diário | Plano de Fundo "Cosmos" | Streak |
| Explorador | Realizar 10 tipos diferentes de tiragem | Amuleto "Bússola" | Diversidade |
| Oráculo | Realizar 100 leituras | Carta Especial "O Universo Dourado" | Volume |
| Comunicador | Fazer 50 comentários | Moldura "Conversador" | Social |
| Estrela Nascente | Alcançar 100 seguidores | Emblema "Estrela" | Social |
| Tarólogo Certificado | Tornar-se profissional verificado | Moldura "Mestre" | Profissional |
| Colecionador | Desbloquear 50% dos itens | Amuleto "Chave Mestra" | Colecionador |

---

## Fluxo Principal

1. O usuário acessa seu inventário pelo menu ou perfil
2. Visualiza todos os itens organizados por categoria
3. Itens possuídos são exibidos em cores; itens bloqueados ficam em cinza
4. O usuário toca em um item possuído para ver detalhes e equipá-lo
5. Itens equipados são exibidos no perfil e/ou nas leituras
6. Ao atingir um marco, o sistema desbloqueia automaticamente o item e envia notificação
7. O usuário pode visualizar o progresso das conquistas pendentes
8. (Futuro) O usuário pode iniciar uma troca de itens com outro usuário

---

## Versão

| Feature | Versão |
|---|---|
| Inventário virtual básico | V2 |
| Conquistas (badges) | V2 |
| Desbloqueio por marcos | V2 |
| Equipamento de itens | V2 |
| Itens sazonais de eventos | V2 |
| Sistema de troca entre usuários | V3 |
| Loja de itens premium | V3 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Usuário autenticado |
| Perfil | Módulo interno | Exibição de itens equipados |
| Tarot / Lenormand | Módulo interno | Marcos de leitura |
| Social | Módulo interno | Marcos sociais (seguidores, comentários) |
| Tarot Diário | Módulo interno | Marcos de streak |
| Notificações | Módulo interno | Alerta de conquista desbloqueada |

---

## Critérios de Aceite

- **CA-01**: O inventário deve carregar com até 200 itens em menos de 2 segundos
- **CA-02**: Uma conquista deve ser detectada, desbloqueada e notificada em menos de 5 segundos após o marco ser atingido
- **CA-03**: O equipamento de um item deve refletir visualmente no perfil em menos de 1 segundo
- **CA-04**: O progresso das conquistas deve ser exibido com precisão (ex.: "35/100 leituras")
- **CA-05**: Itens sazonais devem ter data de expiração clara e não devem ficar disponíveis após o evento
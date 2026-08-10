# Requisitos -- Arkana Agora

Documentacao de requisitos funcionais e nao funcionais do projeto `arkana-agora`.

---

## Requisitos Funcionais (RF)

### Autenticacao e Cadastro (RF-001 a RF-005)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RF-001 | O sistema deve permitir cadastro via Google OAuth 2.0 | Critico | MVP |
| RF-002 | O sistema deve permitir cadastro via Facebook Login | Critico | MVP |
| RF-003 | O sistema deve permitir cadastro via email/senha com confirmacao por email | Critico | MVP |
| RF-004 | O sistema deve exigir nome completo e data de nascimento no cadastro | Critico | MVP |
| RF-005 | O sistema deve permitir exclusao de conta com direito ao esquecimento (LGPD) | Critico | MVP |

### Motor de Tiragem (RF-006 a RF-012)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RF-006 | O sistema deve realizar tiragem aleatoria com animacao de revelacao de cartas | Critico | MVP |
| RF-007 | O sistema deve suportar no minimo 3 espalhamentos: Carta Unica, Passado/Presente/Futuro (3 cartas), Cruz Celta Simplificada (5 cartas) | Critico | MVP |
| RF-008 | O sistema deve respeitar a ordem de revelacao conforme o espalhamento selecionado | Critico | MVP |
| RF-009 | O sistema deve suportar cartas invertidas (probabilidade configuravel) | Alto | MVP |
| RF-010 | O sistema deve oferecer o Tarot do Dia (1 carta automatica, sem custo) | Critico | MVP |
| RF-011 | O sistema deve impedir que o usuario veja a mesma carta mais de uma vez na mesma tiragem (sem reposicao) | Critico | MVP |
| RF-012 | O sistema deve suportar espalhamentos exclusivos para usuarios Plus (Cruz Celta completa 10 cartas, Relacionamento 7 cartas) | Alto | V1 |

### Leitura por IA (RF-013 a RF-016)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RF-013 | O sistema deve gerar interpretacao de tiragem via GPT-4o com streaming SSE | Critico | MVP |
| RF-014 | O sistema deve permitir que o usuario insira uma pergunta ou tema antes da tiragem | Alto | MVP |
| RF-015 | A interpretacao IA deve considerar: cartas reveladas, posicoes, pergunta do usuario e arcano pessoal do usuario | Critico | MVP |
| RF-016 | O sistema deve exibir aviso de que a leitura e de carater reflexivo e nao preditivo | Critico | MVP |

### Arcano Pessoal (RF-017 a RF-019)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RF-017 | O sistema deve calcular o Arcano Pessoal pela reducao pitagorica da data de nascimento e nome completo | Critico | MVP |
| RF-018 | O sistema deve mapear o resultado numerico (0-21) para o Arcano Maior correspondente do Tarot RWS | Critico | MVP |
| RF-019 | O sistema deve gerar interpretacao personalizada do Arcano Pessoal via IA, considerando nome e data | Alto | MVP |

### Horoscopos (RF-020 a RF-023)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RF-020 | O sistema deve calcular e exibir o horoscopo do dia para os 12 signos zodiacais ocidentais | Critico | MVP |
| RF-021 | O sistema deve calcular o Kin Maya (Tzolkin) a partir da data de nascimento | Alto | V1 |
| RF-022 | O sistema deve calcular o signo e elemento do horoscopo chines a partir do ano lunar de nascimento | Alto | V1 |
| RF-023 | O sistema deve gerar horoscopo do dia personalizado combinando signo ocidental + arcano pessoal | Alto | V1 |

### Social (RF-024 a RF-028)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RF-024 | O sistema deve permitir ao usuario criar versos (tiragens compartilhaveis) no feed | Alto | V1 |
| RF-025 | O sistema deve exibir feed cronologico com versos de usuarios seguidos | Alto | V1 |
| RF-026 | O sistema deve permitir seguir e deixar de seguir usuarios | Alto | V1 |
| RF-027 | O sistema deve permitir curtir e comentar versos | Medio | V1 |
| RF-028 | O sistema deve suportar envio de gifts virtuais entre usuarios | Medio | V1 |

### Marketplace (RF-029 a RF-031)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RF-029 | O sistema deve permitir que profissionais verificados cadastrem servicos de leitura com preco e descricao | Alto | V1 |
| RF-030 | O sistema deve exibir catalogo de profissionais com filtros (tipo de leitura, preco, avaliacao) | Alto | V1 |
| RF-031 | O sistema deve processar pagamentos de servicos via Mercado Pago | Critico | V1 |

### Pagamentos e Assinatura (RF-032 a RF-034)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RF-032 | O sistema deve oferecer plano Akasha Plus por R$19,90/mes e R$179,90/ano | Critico | V1 |
| RF-033 | O sistema deve oferecer trial de 7 dias para Akasha Plus com cancelamento facilitado | Alto | V1 |
| RF-034 | O sistema deve manter o acesso Plus ate o fim do periodo pago apos cancelamento | Critico | V1 |

### Administracao (RF-035 a RF-037)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RF-035 | O sistema deve possuir painel administrativo com dashboard de metricas (usuarios, tiragens, receita) | Medio | V1 |
| RF-036 | O sistema deve permitir ao admin gerenciar usuarios (suspender, banir, promover a profissional) | Medio | V1 |
| RF-037 | O sistema deve permitir ao admin gerenciar conteudo reportado e aplicar acoes de moderacao | Alto | V1 |

---

## Requisitos Nao Funcionais (RNF)

### Performance (RNF-001 a RNF-003)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RNF-001 | O tempo de resposta para endpoint de tiragem (sem IA) deve ser inferior a 500ms no percentil 95 | Critico | MVP |
| RNF-002 | O streaming de interpretacao IA deve iniciar em ate 3 segundos apos a revelacao da ultima carta | Critico | MVP |
| RNF-003 | A aplicacao deve carregar o First Contentful Paint (FCP) em ate 1,5 segundo em redes 4G | Alto | MVP |

### Seguranca (RNF-004 a RNF-006)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RNF-004 | Toda comunicacao deve utilizar HTTPS (TLS 1.2+) | Critico | MVP |
| RNF-005 | O sistema deve implementar RBAC com pelo menos 4 papeis: USER, PLUS, PROFESSIONAL, ADMIN | Critico | MVP |
| RNF-006 | Dados sensiveis (senha, token) devem ser armazenados com hashing (bcrypt) e nunca logados | Critico | MVP |

### Usabilidade (RNF-007 a RNF-009)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RNF-007 | A interface deve ser responsiva e mobile-first, funcionando em telas de 320px a 1920px | Critico | MVP |
| RNF-008 | O fluxo de primeira tiragem deve ser concluido em no maximo 5 toques (taps) | Alto | MVP |
| RNF-009 | A plataforma deve estar em conformidade com WCAG 2.1 nivel AA | Medio | V2 |

### Escalabilidade (RNF-010 a RNF-011)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RNF-010 | A arquitetura deve suportar 10.000 usuarios simultaneos sem degradacao significativa | Alto | V1 |
| RNF-011 | O sistema de streaming SSE deve suportar 1.000 conexoes simultaneas | Alto | V1 |

### Compatibilidade (RNF-012 a RNF-013)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RNF-012 | A aplicacao deve funcionar nos ultimos 2 anos de Chrome, Firefox, Safari e Edge (mobile e desktop) | Critico | MVP |
| RNF-013 | A aplicacao deve funcionar como PWA com suporte a instalacao no Android e iOS | Alto | V1 |

### Observabilidade (RNF-014 a RNF-015)

| ID | Requisito | Prioridade | Versao |
|----|-----------|------------|--------|
| RNF-014 | O sistema deve registrar logs estruturados (JSON) com correlacao de request ID | Alto | MVP |
| RNF-015 | O sistema deve monitorar metricas de saude (uptime, latencia, erros) com alertas configurados | Alto | V1 |

---

## Matriz de Rastreabilidade

### Por Versao

| Versao | RFs | RNFs |
|--------|-----|-------|
| MVP | RF-001 a RF-010, RF-013 a RF-020 | RNF-001 a RNF-005, RNF-007, RNF-008, RNF-012, RNF-014 |
| V1 | RF-011, RF-012, RF-021 a RF-037 | RNF-006, RNF-009, RNF-010, RNF-011, RNF-013, RNF-015 |
| V2 | -- | RNF-009 (completo) |

### Por Prioridade

| Prioridade | RFs | RNFs |
|------------|-----|-------|
| Critico | 15 | 6 |
| Alto | 15 | 6 |
| Medio | 7 | 3 |
| Baixo | 0 | 0 |

---

*Documento: requirements.md | Versao: 1.0.0 | Identificador: arkana-agora*
# LGPD — Lei Geral de Proteção de Dados

> **Identificador**: `arkana-agora` | **Módulo**: Conformidade LGPD | **Versão**: MVP

---

## Descrição

O **Arkana Agora** trata a conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) como requisito fundamental de sua operação. Este documento estabelece as diretrizes, procedimentos e controles necessários para garantir que o tratamento de dados pessoais dos usuários esteja em total conformidade com a legislação brasileira. A plataforma coleta e trata dados pessoais para fins específicos, explicitados ao titular no momento da coleta, e mantém registros detalhados de todas as operações de tratamento.

A conformidade LGPD é um requisito transversal que impacta todos os módulos da plataforma — desde o cadastro inicial (coleta mínima de dados) até a exclusão da conta (eliminação completa). Este documento serve como referência para desenvolvedores, produto e equipe jurídica, garantindo que cada feature seja projetada e implementada com privacidade por design (privacy by design) e privacidade padrão (privacy by default).

---

## Bases Legais Utilizadas

| Base Legal | Art. LGPD | Quando Utilizamos | Exemplos no Arkana Agora |
|---|---|---|---|
| **Consentimento** | Art. 7º, I | Dados sensíveis e marketing | Cookies de análise, notificações push, compartilhamento no feed |
| **Execução de contrato** | Art. 7º, V | Dados necessários para o serviço | E-mail, senha, nome, data de nascimento (para cálculos esotéricos) |
| **Legítimo interesse** | Art. 7º, IX | Funcionamento da plataforma | Segurança da plataforma, melhoria de serviços, prevenção de fraude |

> **Nota**: Dados sensíveis (como crenças religiosas/espirituais inferidos por uso de Tarot) são tratados com base em **consentimento explícito** do titular.

---

## Direitos do Titular

| Direito | Art. LGPD | Como Exercer | Prazo de Resposta |
|---|---|---|---|
| **Acesso** | Art. 18, II | Configurações → "Meus Dados" → "Exportar meus dados" | 15 dias |
| **Correção** | Art. 18, III | Editar campos diretamente no perfil | Imediato |
| **Eliminação** | Art. 18, VI | Configurações → "Excluir conta" | 30 dias (grace period: 30 dias) + hard delete anonimização |
| **Portabilidade** | Art. 18, V | Configurações → "Exportar meus dados" (JSON/CSV) | 15 dias |
| **Revogação do consentimento** | Art. 18, IX | Configurações → Privacidade → Desativar | Imediato |
| **Oposição** | Art. 18, IV | Configurações → Privacidade | Imediato |
| **Informação sobre compartilhamento** | Art. 18, I | Política de Privacidade | Disponível sempre |

---

## Política de Cookies

### Categorias de Cookies

| Categoria | Descrição | Exemplos | Consentimento |
|---|---|---|---|
| **Necessários** | Essenciais para o funcionamento | `akasha_session`, `csrf_token` | Não requerido |
| **Funcionais** | Lembram preferências do usuário | `theme`, `locale`, `notifications_prefs` | Sim (padrão: aceito) |
| **Análise** | Métricas de uso e performance | `_ga`, `_gid` (Google Analytics) | Sim (padrão: recusado) |
| **Marketing** | Publicidade e recomendações | `_fbp`, anúncios personalizados | Sim (padrão: recusado) |

### Cookie Banner
- Exibido na primeira visita ao site
- Três opções: "Aceitar todos", "Rejeitar não necessários", "Personalizar"
- Preferência salva em cookie `cookie_consent` (validade: 1 ano)
- Acesso à personalização a qualquer momento via rodapé

---

## Mapeamento de Dados Pessoais

| Dado Pessoal | Finalidade | Base Legal | Retenção | Sensível |
|---|---|---|---|---|
| E-mail | Autenticação, comunicação, recuperação | Execução de contrato | Enquanto ativo + 30 dias | Não |
| Senha (hash) | Autenticação | Execução de contrato | Enquanto ativo | Não |
| Nome completo | Perfil, cálculo do Arcana Pessoal | Execução de contrato | Enquanto ativo | Não |
| Data de nascimento | Arcana Pessoal, Kin Maya, Zodiacal, Chinês | Execução de contrato | Enquanto ativo | Não |
| Biografia | Perfil público | Consentimento | Enquanto ativo | Não |
| Localização | Perfil, recomendações | Legítimo interesse | Enquanto ativo | Não |
| Foto (avatar) | Perfil, reconhecimento social | Consentimento | Enquanto ativo | Não |
| Histórico de leituras | Funcionalidade da plataforma | Execução de contrato | Enquanto ativo + 90 dias | Sim* |
| Histórico de pagamentos | Obrigação legal, fiscal | Obrigação legal | 5 anos (fiscal) | Não |
| Preferências de notificação | Funcionamento do serviço | Consentimento | Enquanto ativo | Não |
| Dados de dispositivo | Push notifications | Consentimento | Enquanto ativo | Não |

> \* Leituras de Tarot podem revelar crenças espirituais — tratado como dado sensível quando identificado.

---

## DPO — Encarregado de Proteção de Dados

### Funções e Responsabilidades

1. **Receber e responder** às solicitações dos titulares de dados
2. **Orientar** a equipe sobre boas práticas de proteção de dados
3. **Monitorar** o cumprimento da LGPD internamente
4. **Realizar** o Registro de Operações de Tratamento (ROPA)
5. **Avaliar** o impacto das operações de tratamento nos dados pessoais (RIA)
6. **Comunicar** à ANPD e aos titulares em caso de incidentes de segurança
7. **Interagir** com a Autoridade Nacional de Proteção de Dados (ANPD)
8. **Revisar** periodicamente as políticas de privacidade e segurança

> **Canal do DPO**: dpo@arkanaagora.com.br

---

## Política de Retenção de Dados

| Tipo de Dado | Período de Retenção | Justificativa |
|---|---|---|
| Dados da conta (ativo) | Enquanto a conta estiver ativa | Execução do contrato |
| Dados da conta (excluída) | 30 dias após exclusão | Grace period para reativação |
| Dados da conta (excluída definitiva) | Eliminados/anonimizados após 30 dias | Eliminação LGPD (T16 hard-delete job: `src/jobs/hard-delete-accounts.ts`, Vercel Cron 03:00 UTC) |
| Histórico de leituras | 90 dias após exclusão da conta | Backup e segurança |
| Dados financeiros | 5 anos | Obrigação fiscal (Lei 9.613/98) |
| Logs de acesso | 90 dias | Segurança e auditoria |
| Cookies de análise | 13 meses | Padrão do Google Analytics |
| Tokens de sessão | 30 dias | Segurança da sessão |
| Tokens de recuperação | 1 hora | Segurança da conta |

---

## Protocolo de Incidente de Segurança (Breach)

### Notificação em 72 Horas

Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares:

1. **Detecção** — identificar o escopo do incidente (quais dados, quantos titulares)
2. **Contenção** — isolar os sistemas afetados em até 4 horas
3. **Avaliação de risco** — classificar o risco (baixo, médio, alto, crítico)
4. **Notificação à ANPD** — em até 72 horas, contendo:
   - Natureza dos dados pessoais afetados
   - Titulares possivelmente afetados
   - Medidas técnicas e organizacionais adotadas
   - Riscos decorrentes do incidente
   - Medidas adotadas para mitigar os riscos
5. **Comunicação ao titular** — se o risco for alto ou crítico:
   - Notificação via e-mail em até 72 horas
   - Orientações sobre medidas protetivas
   - Canal de suporte dedicado
6. **Documentação** — registrar incidente no log de segurança com post-mortem

---

## Checklist LGPD por Feature

Antes do lançamento de qualquer feature, responder:

- [ ] Quais dados pessoais são coletados?
- [ ] Qual a base legal para cada tipo de dado?
- [ ] O titular foi informado sobre a coleta?
- [ ] O consentimento foi obtido (quando necessário)?
- [ ] Os dados são minimizados (coleta mínima)?
- [ ] Há controles de acesso adequados?
- [ ] Os dados são armazenados com criptografia?
- [ ] O período de retenção está definido?
- [ ] O titular pode exercer seus direitos?
- [ ] O impacto na privacidade foi avaliado?
- [ ] Há logs de auditoria das operações?
- [ ] A política de privacidade foi atualizada?

---

## Checklist da Política de Privacidade

A Política de Privacidade do Arkana Agora deve conter:

- [ ] Identificação do controlador (razão social, CNPJ, endereço, contato)
- [ ] Dados do DPO (nome, e-mail, endereço)
- [ ] Dados pessoais coletados e finalidades
- [ ] Bases legais para cada tratamento
- [ ] Compartilhamento de dados com terceiros
- [ ] Transferência internacional de dados (se aplicável)
- [ ] Períodos de retenção de dados
- [ ] Direitos do titular e como exercê-los
- [ ] Cookies e tecnologias de rastreamento
- [ ] Medidas de segurança adotadas
- [ ] Procedimento em caso de incidente
- [ ] Última atualização da política
- [ ] Link para o formulário de contato/ouvidoria

---

## Critérios de Aceite

- **CA-01**: O banner de cookies deve ser exibido em 100% das primeiras visitas e registrar a escolha do usuário
- **CA-02**: A solicitação de exclusão de conta deve eliminar todos os dados pessoais em até 30 dias, exceto dados com obrigação legal de retenção
- **CA-03**: O exportador de dados deve gerar arquivo JSON/CSV com 100% dos dados pessoais do titular em menos de 60 segundos
- **CA-04**: O protocolo de incidente deve ser executável em menos de 4 horas para contenção e 72 horas para notificação
- **CA-05**: Todas as features devem passar pelo checklist LGPD antes do lançamento em produção
# SPEC-001: Sistema de Autenticacao e Autorizacao

**Plataforma**: Arkana Agora
**Versao**: MVP
**Status**: Pendente
**Data**: 2025-01-01

---

## 1. Visao Geral

Este documento define os requisitos do sistema de autenticacao e autorizacao do Arkana Agora. O sistema deve suportar multiplos metodos de entrada, garantir a seguranca dos dados pessoais conforme a LGPD e fornecer uma experiencia fluida de onboarding.

---

## 2. Requisitos Funcionais

### RF-AUTH-001: Cadastro por Email/Senha
O sistema deve permitir o cadastro de novos usuarios utilizando endereco de email e senha. O formulario de cadastro deve validar:
- Email: formato valido (RFC 5322), unico no sistema, case-insensitive
- Senha: minimo 8 caracteres, pelo menos 1 maiuscula, 1 minuscula, 1 numero, 1 caractere especial
- Confirmacao de senha: deve ser identica ao campo de senha
- Aceite dos Termos de Uso e Politica de Privacidade (checkbox obrigatorio)
- Nome de exibicao: obrigatorio, minimo 2 caracteres, maximo 50 caracteres

Apos o cadastro, o usuario deve receber um email de verificacao com link valido por 24 horas.

### RF-AUTH-002: Login Social (Google OAuth)
O sistema deve integrar com o Google Identity Services para autenticacao via conta Google. O fluxo deve:
- Redirecionar para a tela de consentimento do Google
- Extrair email, nome e foto do perfil Google
- Criar a conta automaticamente caso o email nao exista no sistema
- Vincular a conta Google ao usuario existente caso o email ja esteja cadastrado
- Armazenar o `googleId` no registro do usuario para futuras autenticacoes

### RF-AUTH-003: Magic Link por Email
O sistema deve permitir login sem senha via magic link. O fluxo deve:
- Aceitar apenas o email como input
- Validar se o email esta cadastrado e verificado
- Gerar um token aleatorio de 64 caracteres com validade de 15 minutos
- Enviar email com link contendo o token
- Ao clicar no link, autenticar o usuario e redirecionar para o dashboard
- Invalidar o token apos uso (single-use)
- Limite de 3 magic links por hora por email

### RF-AUTH-004: Recuperacao de Senha
O sistema deve permitir que usuarios esquecidos da senha iniciem o processo de recuperacao. O fluxo deve:
- Solicitar o email cadastrado
- Gerar token de reset com validade de 1 hora
- Enviar email com link para redefinicao de senha
- O formulario de reset deve exigir nova senha (mesmas regras de validacao do cadastro)
- Invalidar todos os tokens de sessao ativos apos a redefinicao
- Registrar log de seguranca da alteracao de senha

### RF-AUTH-005: Verificacao de Email
O sistema deve exigir verificacao de endereco de email antes de conceder acesso completo a plataforma. Regras:
- Token de verificacao com validade de 24 horas
- Possibilidade de reenvio do email (limite de 1 por minuto)
- Acesso restrito a tela de "verifique seu email" ate a confirmacao
- Envio automatico de novo token se o anterior expirar

### RF-AUTH-006: Gerenciamento de Sessao JWT
O sistema deve gerenciar sessoes utilizando tokens JWT no formato access/refresh:
- **Access Token**: JWT assinado com HS256, validade de 15 minutos, conteudo: `{ sub, email, role, iat, exp }`
- **Refresh Token**: JWT assinado com HS256, validade de 7 dias, conteudo: `{ sub, tokenId, iat, exp }`
- Access token enviado no header `Authorization: Bearer <token>`
- Refresh token armazenado em cookie httpOnly, secure, sameSite=strict
- Rotacao automatica de refresh token a cada renovacao
- Revogacao de refresh token em caso de suspeita de comprometimento

### RF-AUTH-007: Logout e Revogacao de Token
O sistema deve implementar logout seguro com revogacao de tokens:
- Invalidar o refresh token no servidor (remover da base)
- Limpar cookies de autenticacao no cliente
- Limpar estado de autenticacao no Zustand store
- Redirecionar para a pagina inicial
- Suportar logout de todos os dispositivos (revogar todos os refresh tokens do usuario)

### RF-AUTH-008: Delecao de Conta (LGPD)
O sistema deve permitir que o usuario solicite a exclusao permanente de sua conta, em conformidade com a LGPD:
- Botao de "Excluir conta" nas configuracoes de perfil
- Confirmacao com digitacao do email do usuario
- Periodo de carencia de 30 dias (soft delete com `deletedAt`)
- Durante a carencia: conta inacessivel, dados preservados para reversao
- Apos a carencia: exclusao definitiva (hard delete) de dados pessoais
- Dados anonimizados mantidos para fins estatisticos
- Email de confirmacao enviado em ambas as etapas

---

## 3. Requisitos Nao Funcionais

### RNF-AUTH-001: Tempo de Resposta
Todas as operacoes de autenticacao (login, cadastro, verificacao, logout) devem responder em menos de 500ms (P95) em condicoes normais de carga.

### RNF-AUTH-002: Hashing de Senhas
Todas as senhas devem ser armazenadas utilizando o algoritmo bcrypt com custo minimo de 12 rounds. A biblioteca utilizada sera `bcryptjs` (implementacao pura em JavaScript para compatibilidade com ambientes serverless).

### RNF-AUTH-003: Expiracao de Tokens
Os tokens JWT devem seguir rigorosamente as seguintes politicas de expiracao:
- Access Token: 15 minutos
- Refresh Token: 7 dias
- Magic Link Token: 15 minutos
- Email Verification Token: 24 horas
- Password Reset Token: 1 hora

### RNF-AUTH-004: Rate Limiting
O sistema deve implementar limitacao de requisicoes para prevenir abuso:
- Login: maximo 5 tentativas por hora por IP/email
- Cadastro: maximo 3 contas por IP por hora
- Magic Link: maximo 3 solicitacoes por hora por email
- Reset de Senha: maximo 3 solicitacoes por hora por email
- Verificacao de Email: maximo 1 reenvio por minuto

---

## 4. Dependencias

| Dependencia | Versao | Proposito |
|---|---|---|
| NextAuth.js | v4 | Framework de autenticacao para Next.js |
| Google OAuth 2.0 | - | Login social via conta Google |
| bcryptjs | >=2.4.3 | Hashing de senhas |
| jose | >=4.x | Manipulacao de tokens JWT (Edge Runtime compatible) |
| Resend / Nodemailer | - | Envio de emails transacionais |
| Prisma | >=5.x | ORM para persistencia de dados de usuario |
| Zustand | >=4.x | Gerenciamento de estado no cliente |

---

## 5. Criterios de Aceite

| ID | Criterio | Metodo de Validacao |
|---|---|---|
| CA-AUTH-001 | Um usuario consegue se cadastrar com email/senha, receber o email de verificacao, clicar no link e acessar a plataforma com a sessao ativa | Teste E2E automatizado (Playwright) |
| CA-AUTH-002 | O login com Google OAuth cria uma nova conta ou vincula a uma existente sem duplicacao | Teste E2E com conta Google de teste |
| CA-AUTH-003 | O magic link e enviado, e ao ser clicado dentro de 15 minutos, autentica o usuario; apos 15 minutos, retorna erro 410 | Teste unitario com mock de tempo |
| CA-AUTH-004 | A 6a tentativa de login com credenciais invalidas em 1 hora retorna HTTP 429 com mensagem em portugues | Teste de integracao com rate limiter |
| CA-AUTH-005 | A solicitacao de delecao de conta aplica soft delete imediato e o hard delete apos 30 dias, conforme verificado via banco de dados | Teste de integracao com cron job simulado |
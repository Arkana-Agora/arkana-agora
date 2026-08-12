# Autenticação — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Autenticação | **Versão**: MVP

---

## Descrição

O módulo de autenticação do **Arkana Agora** é responsável por gerenciar todo o ciclo de vida do usuário, desde o cadastro inicial até o encerramento da conta. O sistema suporta múltiplos fluxos de registro — incluindo e-mail/senha, OAuth social (Google, Facebook) e magic link — para reduzir atrito na entrada de novos usuários. A segurança é tratada com hash de senhas via bcrypt (12 rounds) e tokens JWT assinados com RS256, garantindo integridade e confidencialidade das sessões.

A gestão de sessões utiliza um modelo de access token curto (15 min) com refresh token rotativo, armazenado em cookie httpOnly seguro. O fluxo de recuperação de senha segue o padrão de token temporário com expiração de 1 hora, enviado exclusivamente para o e-mail cadastrado. Todo o sistema foi projetado para estar em conformidade com a LGPD, incluindo a possibilidade de exclusão completa da conta e todos os dados associados.

---

## Funcionalidades

- **Cadastro por e-mail e senha** com validação de formato, força da senha e verificação de e-mail
- **Cadastro via OAuth social** (Google, Facebook) com mapeamento automático de dados
- **Login por magic link** enviado ao e-mail cadastrado, válido por 15 minutos
- **Gestão de sessão** com JWT (access token + refresh token rotativo)
- **Recuperação de senha** com token temporário de 1 hora
- **Verificação de e-mail** obrigatória para ativação da conta
- **Exclusão de conta** com confirmação dupla e eliminação de dados em até 30 dias (LGPD)
- **Sessões ativas** — visualização e revogação de dispositivos conectados

---

## Fluxo Principal

1. O usuário acessa a tela de cadastro e informa e-mail, senha e confirmação de senha
2. O sistema valida os campos (formato, força da senha, e-mail não cadastrado)
3. É enviado um e-mail de verificação com link de ativação (expiração: 24h)
4. O usuário clica no link e a conta é ativada
5. O usuário realiza login com e-mail e senha
6. O sistema gera um access token (15 min) e um refresh token (30 dias, opaco)
7. O refresh token é armazenado em cookie httpOnly (path=/api/v1/auth); o access token é retornado no body da resposta
8. A cada requisição, o access token é enviado no header `Authorization: Bearer <token>`
9. Quando o access token expira, o cliente utiliza o refresh token para obter um novo par de tokens
10. O usuário pode solicitar recuperação de senha a qualquer momento
11. O usuário pode solicitar exclusão da conta, com confirmação via e-mail e grace period de 30 dias

---

## Versão

| Feature | Versão |
|---|---|
| Cadastro e-mail/senha | MVP |
| Login OAuth (Google, Facebook) | MVP |
| Magic Link | V1 |
| Exclusão de conta (LGPD) | MVP |
| Verificação de e-mail | MVP |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| `bcrypt` | Biblioteca | Hash de senhas (12 rounds) |
| `jsonwebtoken` | Biblioteca | Geração e validação de JWT (RS256) |
| Banco de dados | Infraestrutura | Tabela `users`, `sessions`, `verification_tokens` |
| Serviço de e-mail | Serviço externo | Envio de e-mails de verificação e recuperação |
| Google OAuth / Facebook Login | API externa | Autenticação social |
| `zod` | Biblioteca | Validação de inputs |

---

## Critérios de Aceite

- **CA-01**: O cadastro por e-mail/senha deve ser concluído em menos de 5 segundos e enviar e-mail de verificação em até 10 segundos
- **CA-02**: O login deve retornar access token e refresh token válidos; o access token deve expirar em 15 minutos
- **CA-03**: A recuperação de senha deve gerar um token exclusivo com validade de 1 hora; após redefinição, o token deve ser invalidado
- **CA-04**: A exclusão de conta deve marcar o registro para exclusão em 30 dias, com possibilidade de reativação em até 30 dias
- **CA-05**: Tentativas de login com credenciais inválidas devem ser limitadas a 5 tentativas por IP em 15 minutos (rate limiting)

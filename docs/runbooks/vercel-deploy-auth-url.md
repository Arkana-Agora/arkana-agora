# Vercel Deploy: Missing AUTH_URL in Production

> **Category**: ci-cd / vercel / auth · **Date**: 2026-08-24 · **Updated**: 2026-09-23 · **Status**: solved

## Summary

Runtime (SSR) ou endpoint de auth falha com erro no boot do Auth.js:

```
Error: AUTH_URL é obrigatório em produção — previne host-header poisoning do magic link (NODE_ENV=production, VERCEL_ENV=…, AUTH_URL_in_env=…, AUTH_URL_empty=…)
```

Mensagem de produção também pode ser:
- `AUTH_URL deve usar https:// em produção (got scheme=…)`
- `AUTH_SECRET environment variable is required for production operation (VERCEL_ENV=…)`

> **Gotcha (2026-09-23):** a variável **aparecer** no dashboard Vercel (Production + Preview) **não basta**. Se `AUTH_URL_in_env=false` no log, a env está **ausente** naquele runtime; se `AUTH_URL_in_env=true` e `AUTH_URL_empty=true`, a chave existe mas o **valor está vazio**. Env novas/alteradas no Vercel exigem **novo deploy**.

## Trigger

- 500 em `/api/auth/session`, `/tirar`, ou qualquer página que carregue `src/auth/auth.config.ts` em SSR com `NODE_ENV=production`.
- Guard roda **fora** de `NEXT_PHASE=phase-production-build` (build passa; **runtime** falha).
- **Não** confundir com build OOM PostCSS/Turbopack (`Zone Allocation failed`) — ver `docs/solutions/ci-cd/turbopack-postcss-oom.md`.

## Root Cause

O arquivo `src/auth/auth.config.ts` valida no load do módulo (runtime, após build):

```typescript
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  if (!process.env.AUTH_URL) {
    throw new Error(
      `AUTH_URL é obrigatório em produção — … AUTH_URL_in_env=${"AUTH_URL" in process.env}, AUTH_URL_empty=${process.env.AUTH_URL === ""} …`,
    )
  }
  const authUrlScheme = (() => {
    try {
      return new URL(process.env.AUTH_URL).protocol
    } catch {
      return "invalid-url"
    }
  })()
  if (authUrlScheme !== "https:") {
    throw new Error(`AUTH_URL deve usar https:// em produção (got scheme=${authUrlScheme})`)
  }
  if (!process.env.AUTH_SECRET) {
    throw new Error(
      `AUTH_SECRET environment variable is required for production operation (VERCEL_ENV=…)`,
    )
  }
}
```

Em desenvolvimento, `AUTH_URL=http://localhost:3000`. Em produção/preview, a env precisa existir **não-vazia** e com `https://` (`new URL(...).protocol === "https:"` — URL malformada reporta `got scheme=invalid-url`).

## Steps to Recover

### 0. Diagnóstico rápido (2026-09-23)

1. No log de runtime, confira `AUTH_URL_in_env=` / `AUTH_URL_empty=`:
   - `in_env=false` → env **ausente** naquele deployment (mesmo que o dashboard mostre a chave).
   - `in_env=true` + `empty=true` → chave existe, **valor vazio**.
   - erro de scheme → valor sem `https://`.
2. Vercel → Settings → Environment Variables (cada ambiente com valor **não vazio** e `https://`):
   - **Production**: `AUTH_URL=https://arkanaagora.com.br`
   - **Preview**: `AUTH_URL=https://arkana-agora.vercel.app` (ou `https://staging.arkanaagora.com.br` se configurado) — mesma regra de `docs/02-architecture/deployment.md` §4.2
   - `AUTH_SECRET` preenchido nos mesmos ambientes.
3. **Redeploy** após qualquer edição de env (Vercel não injeta mudanças em deploys antigos).
4. Reproduza: `GET https://arkanaagora.com.br/api/auth/session` → 200 (body de sessão/`null`), sem 500.

### 1. Add AUTH_URL to Deploy Workflow

**Arquivo**: `.github/workflows/ci.yml` → `deploy-staging`

Antes do `vercel-action@v25`, adicionar env vars com a URL de produção:

> **Gotcha:** env no workflow GitHub Actions **não** grava as variáveis de runtime do projeto Vercel — e o guard roda em runtime (o build é pulado via `NEXT_PHASE`). O fix efetivo para o erro deste runbook é o **Passo 0** (dashboard + redeploy); o passo abaixo só cobre o processo de deploy.

```yaml
steps:
  - uses: actions/checkout@v4
  - env:
      AUTH_URL: https://arkanaagora.com.br
      AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
      AUTH_TRUST_HOST: true
    run: |
      echo "AUTH_URL is set to production"
  - uses: amondnet/vercel-action@v25
    with:
      github-token: ${{ github.token }}
      vercel-token: ${{ secrets.VERCEL_TOKEN }}
      vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
      vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
      github-comment: true
      github-deployment: false
```

### 2. Add AUTH_SECRET to GitHub Secrets

No painel da Vercel (ou settings do repositório):

1. Acesse `https://vercel.com/dedsdeads-projects/arkana-agora/settings/environment-variables`
2. Adicione a variável:
   - **Name**: `AUTH_SECRET`
   - **Value**: Sua secret de produção (do repositório GitHub)
   - **Environments**: Production, Preview, Development (se quiser usar em todas)

### 3. Re-run the Workflow

```bash
# Force re-run do workflow
gh workflow run ci.yml
```

Ou acessar:
1. Acesse a aba **Actions** do repositório
2. Selecione o workflow `ci.yml`
3. Selecione a execução falhada
4. Clique em **Re-run failed jobs**

### 4. Verify Production Deploy

Após a execução bem-sucedida:

1. Acesse a URL do deploy de produção: `https://arkanaagora.com.br`
2. Tente acessar o endpoint `/api/auth/session` em produção
3. Deve retornar 200 OK e retornar uma sessão válida ou NULL se não autenticado
4. Verifique se o login com Google OAuth ou magic link funciona corretamente

## Prevention

### 1. Documentar Environment Variables

Atualize `docs/02-architecture/deployment.md` com a variável de ambiente para produção:

```env
# Auth (Auth.js v5 — ADR-010)
# AUTH_URL: origem canônica da aplicação (impede host-header poisoning do magic link em prod — HTTPS obrigatório)
AUTH_URL=https://arkanaagora.com.br
AUTH_SECRET=<production-secret>
AUTH_TRUST_HOST=true
```

### 2. Automate Env Var Setup

Adicione passos automáticos no workflow para verificar se as env vars estão configuradas:

```yaml
deploy-staging:
  name: Deploy Staging (Vercel preview)
  runs-on: ubuntu-latest
  needs: [build, gate-deploy]
  if: >-
    needs.gate-deploy.outputs.has_creds == 'true' &&
    github.event_name == 'push' &&
    github.ref == 'refs/heads/main'
  env:
    AUTH_URL: https://arkanaagora.com.br
    AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
    AUTH_TRUST_HOST: true
  steps:
    - uses: actions/checkout@v4
    - uses: amondnet/vercel-action@v25
      with:
        github-token: ${{ github.token }}
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
        vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
        github-comment: true
        github-deployment: false
```

### 3. Validate Required Secrets

Adicione uma verificação antes do deploy:

```yaml
- name: Validate required environment variables
  run: |
    if [ -z "$AUTH_URL" ] || [ -z "$AUTH_SECRET" ]; then
      echo "❌ Missing AUTH_URL or AUTH_SECRET"
      exit 1
    fi
```

## Verification Checklist

- [ ] Workflow `deploy-staging` executa sem erro
- [ ] No logs do Vercel CLI não há erro de AUTH_URL
- [ ] `/api/auth/session` retorna 200 OK
- [ ] Login com Google OAuth funciona em produção
- [ ] Magic link funciona em produção (se SMTP configurado)
- [ ] Deploy automático em cada push na `main` funciona

## Escalation

Se o problema persistir mesmo após configurar as env vars:

1. **Suporte da Vercel**: Verificar se o token tem permissão de deploy
2. **Suporte do Auth.js**: Verificar se a configuração do Auth.js v5 está correta

## Post-Incident

### Documentation Updates

- [ ] Atualizar este runbook com o problema e solução
- [ ] Atualizar `docs/02-architecture/deployment.md` com a variável de ambiente AUTH_URL

### Cleanup

- [ ] Verificar se o workflow está rodando como esperado após o fix
- [ ] Garantir que não há outras variáveis de ambiente faltando em produção

## References

- [Next.js Auth Configuration](https://next-auth.js.org/configuration/callbacks)
- [Vercel Environment Variables](https://vercel.com/docs/build-and-deploy/environment-variables)
- Workflow: `.github/workflows/ci.yml` → `deploy-staging`
- Runbooks: `docs/runbooks/vercel-deploy-github-token.md` (mais `vercel-deploy-project-settings.md` — planejado, arquivo ainda ausente; ver `docs/runbooks/README.md`)

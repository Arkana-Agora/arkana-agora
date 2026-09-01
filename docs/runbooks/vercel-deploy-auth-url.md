# Vercel Deploy: Missing AUTH_URL in Production

> **Category**: ci-cd / vercel / auth · **Date**: 2026-08-24 · **Status**: solved

## Summary

Deploy em produção falha com erro no endpoint `/api/auth/session`:

```
Error: AUTH_URL é obrigatório em produção — previne host-header poisoning do magic link
```

## Trigger

O workflow de deploy staging retorna 500 no endpoint `/api/auth/session` porque a variável de ambiente `AUTH_URL` não está configurada em produção.

## Root Cause

O arquivo `src/auth/auth.config.ts` valida que `AUTH_URL` está presente e usa HTTPS em produção:

```typescript
if (!process.env.AUTH_URL) {
  throw new Error(
    "AUTH_URL é obrigatório em produção — previne host-header poisoning do magic link",
  )
}
if (!process.env.AUTH_URL.startsWith("https://")) {
  throw new Error("AUTH_URL deve usar https:// em produção")
}
```

Em desenvolvimento, a `AUTH_URL=http://localhost:3000`. Em produção, ela não está configurada, causando o erro 500 no endpoint de session do Auth.js v5.

## Steps to Recover

### 1. Add AUTH_URL to Deploy Workflow

**Arquivo**: `.github/workflows/ci.yml` → `deploy-staging`

Antes do `vercel-action@v25`, adicionar env vars com a URL de produção:

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
- Runbooks: `docs/runbooks/vercel-deploy-github-token.md`, `docs/runbooks/vercel-deploy-project-settings.md`

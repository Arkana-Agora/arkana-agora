# Vercel Deploy: Missing GitHub Token

> **Category**: ci-cd / vercel · **Date**: 2026-08-24 · **Status**: solved

## Summary

Deploy staging no Vercel falha com erro de credenciais:

```
Error! Could not retrieve Project Settings. To link your Project, remove the `.vercel` directory and deploy again.
```

## Trigger

O workflow de deploy staging (`deploy-staging` job) falha porque o `amondnet/vercel-action@v25` não está recebendo o `GITHUB_TOKEN` para criar deployments e comentários no PR.

## Root Cause

O `vercel-action@v25` requer explicitamente o parâmetro `github-token` nas `with:` para:

1. Criar o deployment no Vercel
2. Criar comentários no PR (`github-comment: true`)
3. Realizar operações de checkout de forma completa

Sem o `github-token`, o action não consegue criar o deployment, mesmo com as credenciais Vercel corretas.

## Steps to Recover

### 1. Fix the Workflow

**Arquivo**: `.github/workflows/ci.yml` → `deploy-staging` job

Adicionar `github-token` nas `with:` do `vercel-action@v25`:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: amondnet/vercel-action@v25
    with:
      github-token: ${{ github.token }}  # <--- ADICIONAR ESTA LINHA
      vercel-token: ${{ secrets.VERCEL_TOKEN }}
      vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
      vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
      github-comment: true
      github-deployment: false
```

### 2. Verify Token Permissions

1. No GitHub, vá em Settings → Actions → General
2. Role the token: **Admin** (default) — deve ter permissão de escrita para criar deployments
3. Verifique se as permissões padrão estão corretas (Create deployments, Read repository, Write to issues)

### 3. Re-run the Workflow

```bash
# Forçar re-run do workflow
gh workflow run ci.yml
```

Ou acessar:
1. Acesse a aba **Actions** do repositório
2. Selecione o workflow `ci.yml` que falhou
3. Selecione a execução falhada
4. Clique em **Re-run failed jobs**

### 4. Verify Deploy

Após a execução bem-sucedida:

1. Acesse a URL do preview no Vercel
2. Teste o endpoint `/api/health` → deve retornar **200** com `{"status":"ok",...,"services":{"database":{"status":"ok"},"redis":{"status":"ok"}}}`
3. Verifique se um comentário foi criado no PR com o URL do preview

## Prevention

### 1. Documentar o Requisito

Adicionar no workflow uma verificação de credenciais:

```yaml
- name: Verify all required secrets are present
  run: |
    if [ -z "$VERCEL_TOKEN" ] || [ -z "$VERCEL_ORG_ID" ] || [ -z "$VERCEL_PROJECT_ID" ]; then
      echo "❌ Missing Vercel credentials"
      exit 1
    fi
    if [ -z "$GITHUB_TOKEN" ]; then
      echo "❌ Missing GitHub Token (should be injected automatically)"
      exit 1
    fi
```

### 2. Adicionar Verificação no Gate-deploy

```yaml
gate-deploy:
  name: Gate (secrets Vercel)
  runs-on: ubuntu-latest
  outputs:
    has_creds: ${{ steps.check.outputs.has_creds }}
  steps:
    - id: check
      env:
        VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
        VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        GITHUB_TOKEN: ${{ github.token }}
      run: |
        if [ -n "$VERCEL_TOKEN" ] && [ -n "$VERCEL_ORG_ID" ] && [ -n "$VERCEL_PROJECT_ID" ] && [ -n "$GITHUB_TOKEN" ]; then
          echo "has_creds=true" >> "$GITHUB_OUTPUT"
        else
          echo "has_creds=false" >> "$GITHUB_OUTPUT"
        fi
```

### 3. Testar Localmente

Antes de pushar:

1. Faça um checkout da branch `main`
2. Verifique se o workflow passa no job `gate-deploy`
3. Se tudo passar, o deploy staging deve funcionar

## Verification Checklist

- [ ] Workflow `deploy-staging` executa sem erro
- [ ] Comentário no PR é criado com URL do preview
- [ ] URL do preview está acessível
- [ ] `/api/health` retorna 200
- [ ] Deploys automáticos em cada push na `main` funcionam

## Escalation

Se o problema persistir mesmo após adicionar o `github-token`:

1. **Suporte da Vercel**: Abrir ticket se houver problema de permissão no token
2. **Suporte do GitHub**: Verificar se o token do GitHub Actions está bloqueado por regras

## Post-Incident

### Documentation Updates

- [ ] Atualizar este runbook com o problema e solução
- [ ] Adicionar verificação de credenciais no workflow (pré-deploy)

### Cleanup

- [ ] Verificar se o workflow está rodando como esperado após o fix
- [ ] Garantir que não há outras branches com o mesmo problema

## References

- [Vercel Action Documentation](https://github.com/marketplace/actions/deploy-with-vercel#github-token)
- Workflow: `.github/workflows/ci.yml` → `deploy-staging`
- Runbook: `docs/runbooks/vercel-deploy-project-settings.md`

# SPEC-002: Perfil do Usuario -- Design Tecnico

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## 1. Componentes de Interface

### 1.1 ProfileHeader
- Avatar circular (120x120px) com fallback para iniciais
- Nome de exibicao em destaque (tipografia h1)
- Username com prefixo "@" em cor secundaria
- Badge de plano (Free/Plus) ao lado do username
- Badge verificado (para perfis profissionais validados)
- Bio em texto normal, maximo 3 linhas com "ver mais"
- Botao "Editar perfil" (visivel apenas para o dono do perfil)
- Botao "Seguir" / "Seguindo" (visivel para outros usuarios)

### 1.2 ProfileStats
- Grid de 3 colunas: Tiragens, Seguidores, Seguindo
- Cada estatistica com numero grande e label abaixo
- Animacao de contagem (count-up) ao carregar a pagina
- Valores formatados em portugues (ex.: "1.234")

### 1.3 ProfileAstrology
- Card lateral com dados astrológicos/núnerológicos
- Signo solar com ícone temático
- Arcano pessoal com imagem da carta e número
- Kin Maya com selo e tom
- Cada item com tooltip explicativo
- Link "Saiba mais" para página de detalhes

### 1.4 ProfileEditForm
- Formulário em modal (shadcn Dialog) ou página dedicada `/perfil/editar`
- Campos organizados em seções: Dados pessoais, Aparência, Privacidade
- Upload de avatar com preview
- Botão de remover avatar (com confirmação)
- Validação inline de todos os campos
- Salvamento **explícito** (botão "Salvar") com feedback "Salvo às HH:MM" — **não** auto-save com debounce (ver `src/components/profile/profile-edit-form.tsx`, testid `profile-saved`)

### 1.5 PrivacySettings
- Página dedicada `/perfil/privacidade` (`src/components/profile/privacy-settings.tsx`), não seção embutida no ProfileEditForm
- Selects para: `profileVisibility`, `statsVisibility`, `arcanaVisibility`, `whoCanFollow`, `whoCanComment`
- Salvamento explícito via `PATCH /api/v1/users/me/privacy` (não "tempo real" / não auto-save)
- Feedback de sucesso: testid `privacy-saved`

### 1.6 ProProfileSection
- Seção condicional (apenas plano Plus)
- Campos de título profissional, certificações
- Agenda semanal com faixas de horário
- Faixa de preço com máscara monetária (R$)
- Galeria com upload múltiplo (grid de imagens)
- Média de avaliações e contagem total

---

## 2. Fluxo de Dados

```
    PERFIL PUBLICO - FLUXO DE LEITURA
    ================================

    [1] GET /perfil/[username]
         |
         v
    [2] TanStack Query (cache 5min)
         |
         +-> Cache HIT: retorna dados do cache
         +-> Cache MISS: faz requisicao ao servidor
                            |
                            v
         [3] GET /api/v1/users/[username]/profile
                            |
                            v
         [4] Prisma: busca usuario + estatísticas
              SELECT u.name, u.username, u.bio, u.avatarUrl,
                     u.birthDate, u.plan, u.createdAt,
                     (SELECT COUNT(*) FROM readings WHERE userId = u.id),
                     (SELECT COUNT(*) FROM follows WHERE followingId = u.id),
                     (SELECT COUNT(*) FROM follows WHERE followerId = u.id)
              FROM User u WHERE u.username = ? AND u.deletedAt IS NULL
                            |
                            v
         [5] Aplica regras de privacidade do usuario alvo
              (filtra campos conforme PrivacySettings)
                            |
                            v
         [6] Calcula signo/arcano/kin se birthDate preenchido
                            |
                            v
         [7] Retorna JSON -> TanStack Query cacheia -> Render


    EDICAO DE PERFIL - FLUXO DE ESCRITA
    ================================

    [1] Usuario edita campo
         |
         v
    [2] Submit explicito (botao Salvar) — sem debounce/auto-save
         |
         v
    [3] PATCH /api/v1/users/me/profile
         |  Body: { displayName?, bio?, birthDate?, birthPlace?, location?, website?, username? }
         |  Header: Authorization: Bearer <token>
         v
    [4] Server: valida com Zod, atualiza Prisma
         |
         v
    [5] Invalida cache TanStack Query (queryClient.invalidateQueries)
         |
         v
    [6] UI atualiza com novos dados


    UPLOAD DE AVATAR
    ================

    [1] Usuario seleciona arquivo
         |
         v
    [2] Cliente: valida tamanho (max 5MB) e tipo (JPEG/PNG/WebP)
         |
         v
    [3] POST /api/v1/users/me/avatar/presign
         |  Body: { contentType }
         v
    [4] Server: gera presigned URL (Cloudflare R2)
         |  Retorna: { uploadUrl, key }
         v
    [5] Cliente: faz PUT direto para o Cloudflare R2 (presigned URL)
         |
         v
    [6] PATCH /api/v1/users/me/avatar/confirm
         |  Body: { fileKey }
         v
    [7] Server: processa imagem (sharp: 3 tamanhos), salva URLs no perfil
         |  Retorna: { avatarUrl, variants: string[] }
         |
         v
    [8] Invalida cache, atualiza UI
```

---

## 3. API Endpoints

### GET /api/v1/users/:username/profile
**Descrição**: Retorna o perfil público de um usuário.
**Response 200**:
```json
{
  "id": "clx...",
  "name": "Maria Silva",
  "username": "maria_silva",
  "bio": "Apaixonada por tarot há 10 anos",
  "avatarUrl": "https://r2.arkanaagora.com/avatars/.../120.webp",
  "plan": "PLUS",
  "isVerified": true,
  "stats": {
    "readingsCount": 142,
    "followersCount": 89,
    "followingCount": 34
  },
  "astrology": {
    "sunSign": "Áries",
    "personalArcana": { "number": 5, "name": "O Hierofante" },
    "kinMaya": { "seal": "Dragão", "tone": "3" }
  },
  "isFollowing": false,
  "privacy": {
    "profileVisibility": "public",
    "statsVisibility": "public",
    "arcanaVisibility": "public",
    "whoCanFollow": "all",
    "whoCanComment": "all"
  }
}
```
**Response 404**: `{ "error": "USER_NOT_FOUND" }`

### GET /api/v1/users/me/profile
**Descrição**: Retorna o perfil completo do usuário logado (inclui configurações de privacidade).
**Headers**: `Authorization: Bearer <token>`
**Response 200**: Mesmo objeto acima + campo `privacy` completo + `email`.

### PATCH /api/v1/users/me/profile
**Descrição**: Atualiza campos editáveis do perfil.
**Implementado em**: `src/app/api/v1/users/me/profile/route.ts` (schema `updateProfileSchema` em `src/lib/validators/profile.ts`, `.strict()`).
**Headers**: `Authorization: Bearer <token>`
**Body**: `{ displayName?, bio?, birthDate?, birthPlace?, location?, website?, username? }`
**Sem campo `gender`** — removido do schema (nunca implementado).
**Strings vazias limpam o valor**: `birthDate: ""` → `null` + limpa `astrologicalSign`/`mayanKin`; `bio`/`location`/`website`/`birthPlace` `""` → `null`.
**Response 200**: `{ "message": "Perfil atualizado" }` (flat, sem `user` no body)
**Response 409**: `{ "error": { "code": "USERNAME_TAKEN", ... }, "meta": { "requestId" } }`
**Response 422**: `{ "error": { "code": "VALIDATION_ERROR", "details": [...] }, "meta": { "requestId" } }`

### POST /api/v1/users/me/avatar/presign
**Descrição**: Gera URL pré-assinada para upload de avatar.
**Response 200**: `{ "uploadUrl": "...", "key": "..." }`

### PATCH /api/v1/users/me/avatar/confirm
**Descrição**: Confirma o upload e processa a imagem.
**Body**: `{ "fileKey": "string" }`
**Response 200**: `{ "avatarUrl": "...", "variants": ["..."] }`

### DELETE /api/v1/users/me/avatar
**Descrição**: Remove o avatar do usuário.
**Response 200**: `{ "message": "Avatar removido" }`

### PATCH /api/v1/users/me/privacy
**Descrição**: Atualiza configurações de privacidade.
**Implementado em**: `src/app/api/v1/users/me/privacy/route.ts` (schema `privacySchema` em `src/lib/validators/profile.ts`).
**Body**: `{ profileVisibility?, statsVisibility?, arcanaVisibility?, whoCanFollow?, whoCanComment? }`
- `profileVisibility`/`statsVisibility`/`arcanaVisibility`: `["public","private"]` (não existe valor `followers`)
- `whoCanFollow`/`whoCanComment`: `["all","following","nobody"]`
**Response 200**: `{ "message": "Privacidade atualizada" }`

### GET /api/v1/users/check-username/:username
**Descrição**: Verifica disponibilidade de username.
**Response 200**: `{ "available": true }` ou `{ "available": false }`

---

## 4. Database Schema

### Tabela: UserProfile (fonte da verdade: `prisma/schema.prisma`)

> **Implementado** como `model UserProfile` (`@@map` ausente — tabela se chama `UserProfile` no banco).
> Campos de privacidade ficam em **`privacy Json?`**, não em colunas booleanas separadas.
> Colunas `gender`/`showBirthDate`/`showStats`/`showAstrology`/`isPublic` **não existem** no schema implementado.
> Campos `pro*` (ProProfileSection) são **planejados** (V1), não implementados.

```prisma
model UserProfile {
  id         String   @id @default(cuid())
  userId     String   @unique
  username   String?
  bio        String?
  birthPlace String?
  location   String?
  website    String?
  socialLinks Json?
  privacy    Json?    // { profileVisibility, statsVisibility, arcanaVisibility, whoCanFollow, whoCanComment }
  proTitle   String?  // [planejado — V1]
  // ... proCertifications/proSchedule/proPrice*/proVerified: planejados (V1)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 5. Estado (Zustand + TanStack Query)

### ProfileStore (Zustand)
```typescript
interface ProfileState {
  isEditing: boolean;
  dirtyFields: Set<string>;
  isSaving: boolean;
  lastSavedAt: Date | null;

  setEditing: (value: boolean) => void;
  markDirty: (field: string) => void;
  clearDirty: () => void;
}
```

### Queries (TanStack Query)
```typescript
// Buscar perfil público
const usePublicProfile = (username: string) =>
  useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.get(`/users/${username}/profile`),
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  });

// Buscar perfil próprio (inclui privacidade)
const useMyProfile = () =>
  useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => api.get('/users/me/profile'),
    staleTime: 2 * 60 * 1000,
  });

// Verificar username
const useCheckUsername = (username: string) =>
  useQuery({
    queryKey: ['check-username', username],
    queryFn: () => api.get(`/users/check-username/${username}`),
    enabled: username.length >= 3,
    staleTime: 30 * 1000,
  });

// Mutacao de atualizacao
const useUpdateProfile = () =>
  useMutation({
    mutationFn: (data: UpdateProfileData) => api.patch('/users/me/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
```

---

## 6. Rotas da Aplicação

| Rota | Componente | Protegida | Descrição |
|---|---|---|---|
| `/perfil/:username` | ProfilePage | Nao | Perfil público do usuário |
| `/perfil/editar` | ProfileEditPage | Sim (dono) | Formulário de edição |
| `/perfil/privacidade` | PrivacyPage | Sim (dono) | Configurações de privacidade |
| `/perfil/pro` | ProProfilePage | Sim (Plus) | Gerenciamento de perfil profissional |

---

## 7. Calculos Automaticos

### Signo Solar
Determinado pela data de nascimento:
- Áries: 21/03 - 19/04
- Touro: 20/04 - 20/05
- Gêmeos: 21/05 - 20/06
- Câncer: 21/06 - 22/07
- Leão: 23/07 - 22/08
- Virgem: 23/08 - 22/09
- Libra: 23/09 - 22/10
- Escorpião: 23/10 - 21/11
- Sagitário: 22/11 - 21/12
- Capricórnio: 22/12 - 19/01
- Aquário: 20/01 - 18/02
- Peixes: 19/02 - 20/03

### Arcano Pessoal
Calculado pela redução pitagórica da data de nascimento (ver SPEC-005 para detalhes completos).
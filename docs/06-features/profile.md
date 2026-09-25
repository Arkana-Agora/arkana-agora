# Perfil do Usuário — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Perfil | **Versão**: MVP

---

## Descrição

O perfil do usuário no **Arkana Agora** é a identidade digital dentro da plataforma, combinando dados pessoais editáveis com cálculos esotéricos automáticos. A página pública exibe o avatar, biografia, estatísticas de leituras e os arcanos pessoais calculados — Aracana Pessoal (numerologia pitagórica), Signo Zodiacal e Kin Maya. Esses dados são calculados automaticamente a partir da data de nascimento e do nome cadastrado, utilizando a tabela pitagórica padrão (A=1, B=2, C=3, D=4, E=5, F=6, G=7, H=8, I=9, J=1, K=2, L=3, M=4, N=5, O=6, P=7, Q=8, R=9, S=1, T=2, U=3, V=4, W=5, X=6, Y=7, Z=8), com redução a um dígito (exceto números mestres 11, 22 e 33). A soma dos dígitos da data de nascimento é somada à soma dos dígitos do nome para obter o número do Arcana Pessoal.

O módulo inclui configurações de privacidade granulares — o usuário pode definir se suas leituras são públicas ou privadas, se aparece na página Explorar e quais informações são visíveis no perfil. Há também um caminho de upgrade para perfil profissional, permitindo ao usuário adicionar especialidades, preços e disponibilidade para consultas pagas.

---

## Funcionalidades

- **Página "Meu perfil"** (`/perfil`) — página real (server component lendo o DB direto) + client `OwnProfile` (`src/app/(app)/perfil/own-profile.tsx`): ProfileHeader + ProfileStats + ProfileAstrology + links Editar/Privacidade/público
- **Página de perfil público** (`/perfil/:username`) com avatar, biografia, estatísticas de leituras e arcanos calculados
- **Campos editáveis**: `displayName`, `bio`, `birthDate`, `birthPlace`, `location`, `website`, `username` (`updateProfileSchema` em `src/lib/validators/profile.ts` — **sem `gender`**) — `socialLinks` existe no model mas **não** é editável via PATCH
- **Arcana Pessoal** — cálculo automático via numerologia pitagórica (nome + data de nascimento)
- **Signo Zodiacal** — cálculo automático a partir da data de nascimento
- **Kin Maya** — cálculo automático baseado no calendário Tzolkin (data de referência: 26/07/1954 = Kin 1 — Dragão Magnético)
- **Horóscopo Chinês** — cálculo automático baseado no ano lunar (12 animais × 5 elementos)
- **Configurações de privacidade** (JSON em `UserProfile.privacy`): `profileVisibility`, `statsVisibility`, `arcanaVisibility` (`public`|`private`), `whoCanFollow`, `whoCanComment` (`all`|`following`|`nobody`) — `PATCH /api/v1/users/me/privacy`
- **Upgrade para perfil profissional**: especialidades, preço, disponibilidade
- **Galeria de leituras salvas** no perfil

---

## Cálculo do Arcana Pessoal

```
Tabela Pitagórica:
A=1  B=2  C=3  D=4  E=5  F=6  G=7  H=8  I=9
J=1  K=2  L=3  M=4  N=5  O=6  P=7  Q=8  R=9
S=1  T=2  U=3  V=4  W=5  X=6  Y=7  Z=8

Algoritmo:
1. Converter cada letra do nome completo em seu valor numérico
2. Somar todos os valores → soma_nome
3. Somar todos os dígitos da data de nascimento (DD/MM/AAAA) → soma_data
4. soma_total = soma_nome + soma_data
5. Reduzir soma_total a um único dígito (exceto 11, 22, 33)
6. O resultado é o número do Arcana Pessoal
```

> **Implementação real:** `src/lib/arcana/calculate.ts` (`calculatePersonalArcana` /
> `explainPersonalArcana`), que soma os dígitos da data em formato `AAAAMMDD` + os valores do nome e
> delega a redução a `reduceToArcana` (`src/lib/arcana/reduce.ts`).
>
> - `reduceToArcana` reduz até ≤ 22 e **mapeia `0 → 22`** — o cálculo emite **`1–22`**, nunca `0`.
>   `22` = "O Louco" (número mestre).
> - A extração da data usa **getters UTC** (`getUTCFullYear`/`getUTCMonth`/`getUTCDate`), logo o
>   resultado é **independente de timezone** (dev BRT = prod UTC) e determinístico entre leituras.
> - `personalArcana` é **persistido** em `User.personalArcana` por `GET /api/v1/arcana/calculate`
>   (best-effort) e recalculado por `PATCH /api/v1/users/me/profile` — ver
>   §Notas operacionais (2026-09-25).

## Cálculo do Kin Maya

```
Calendário Tzolkin: 20 Selos Solares × 13 Tons Galácticos = 260 dias
Data de referência: 26/07/1954 = Kin 1 (Dragão Magnético)

Algoritmo:
1. Calcular dias corridos desde 26/07/1954 até a data de nascimento
2. kin_number = (dias_corridos % 260) + 1
3. Tom Galáctico = ((kin_number - 1) % 13) + 1
4. Selo Solar = ((kin_number - 1) % 20) + 1
```

---

## Páginas e Navegação (implementado)

| Rota | Página | Implementação |
|---|---|---|
| `/perfil` | **"Meu perfil"** — server component lendo o DB direto + client `OwnProfile` (ProfileHeader + ProfileStats + ProfileAstrology + links Editar/Privacidade/público) | `src/app/(app)/perfil/page.tsx` + `src/app/(app)/perfil/own-profile.tsx` |
| `/perfil/:username` | Perfil público (respeita `privacy.profileVisibility`) | `src/app/(app)/perfil/[username]/page.tsx` |
| `/perfil/editar` | Formulário de edição (BackLink → `/perfil`) | `src/app/(app)/perfil/editar/page.tsx` |
| `/perfil/privacidade` | Configurações de privacidade (BackLink → `/perfil`) | `src/app/(app)/perfil/privacidade/page.tsx` |
| `/meu-arcano` | Arcana Pessoal — pré-preenche nome/data e exibe o arcano salvo (fetch de mount em `GET /api/v1/arcana/calculate`); cálculo manual continua client-side | `src/app/(app)/meu-arcano/page.tsx` + `src/components/arcana/arcana-calculator.tsx` |
| `/meu-arcano/:arcana` | Detalhe de qualquer arcano (`1-22`; copy de erro "Valores validos: 1-22") | `src/app/(app)/meu-arcano/[arcana]/page.tsx` |

> **`/perfil` NÃO é redirect (2026-09-24).** Antes redirecionava para `/perfil/:username` (se username existisse) ou `/perfil/editar` — causava loop no botão voltar ("editar perfil volta para /perfil que redireciona para editar perfil"). Agora é página real "Meu perfil".

---

## Fluxo Principal

1. O usuário acessa `/perfil` ("Meu perfil") e clica em "Editar perfil"
2. Preenche os campos: nome de exibição (`displayName`), biografia, data de nascimento, local de nascimento, localização, site, username
3. O sistema calcula automaticamente: Arcana Pessoal, Signo Zodiacal, Kin Maya e Horóscopo Chinês — o `personalArcana` é **recalculado e salvo** em `User.personalArcana` no mesmo `PATCH`
4. O usuário configura as opções de privacidade (`profileVisibility`/`statsVisibility`/`arcanaVisibility` + `whoCanFollow`/`whoCanComment`) em `/perfil/privacidade`
5. O sistema salva as alterações e atualiza a página de perfil público
6. Outros usuários podem visualizar o perfil público (`/perfil/:username`) com base nas configurações de privacidade
7. (Opcional) O usuário solicita upgrade para perfil profissional e preenche dados adicionais

---

## Notas operacionais (2026-09-24)

- **`PATCH /api/v1/users/me/profile` — `birthPlace` pertence a `UserProfile`, não a `User`.** Enviar `birthPlace` a `tx.user.update()` causava **500** (campo inexistente no model `User`). O route agora roteia `birthPlace` (e `bio`/`location`/`website`/`username`) para `userProfile.upsert` dentro de `prisma.$transaction`; os builders são tipados (`Prisma.UserUpdateInput` / `Partial<Prisma.UserProfileUncheckedCreateInput>`).
- **Privacy JSON parseado com `privacySchema.passthrough().safeParse(...)`** em `perfil/page.tsx` e `perfil/[username]/page.tsx` (runtime-safe) — não usar `as PrivacySettings`.
- **`ProfileHeader` aceita `headingLevel="h1"|"h2"`** (default `h1`); `OwnProfile` passa `h2` (o `h1` da página é "Meu perfil").
- **Navegação**: desktop `AppHeader` (`src/components/layout/app-header.tsx` — sticky, `hidden md:block`, 5 itens Home/Tirar/Histórico/Meu Arcano/Perfil, active-state via `isAppNavActive` de `src/lib/navigation.ts`, prefix-based; Histórico também acende em `/tiragem/*`) montado em `src/app/(app)/layout.tsx` (que envolve children com `pb-16 md:pb-0` para o MobileNav fixo não sobrepor conteúdo no mobile). `BackLink` compartilhado (`src/components/layout/back-link.tsx` — ArrowLeft + label, default "Voltar"). `/tiragem` (bare) redireciona para `/minhas-tiragens` (`src/app/(app)/tiragem/page.tsx`).

### Pendente (não implementado)

- Active-state do MobileNav é **exact-match** enquanto o AppHeader é **prefix-match** (inconsistente); MobileNav tem 4 itens vs 5 no desktop.
- `ProfileStats` exibe zeros fixos (seguidores/seguindo não implementados) — stats reais pendentes.
- Normalização `birthDate` round-trip (ISO datetime vs `YYYY-MM-DD` no formulário de edição) — pre-existente.

---

## Notas operacionais (2026-09-25) — Arcana Pessoal não salvo / não exibido

Bug de fundo: o cálculo client-side em `/meu-arcano` renderizava o arcano, mas **nunca persistia
`User.personalArcana`**. Consequências: o perfil público não tinha arcano, o valor se perdia a cada
nova visita e `/meu-arcano` abria sempre em branco. As seções 1–3 são as três frentes do fix; as
seções 4–5 são correções de determinismo e de range que o mesmo bug expôs.

### 1. `GET /api/v1/arcana/calculate` persiste `personalArcana` (com self-heal CAS)

Quando `User.personalArcana === null`, a rota faz **best-effort** `prisma.user.update({ data: { personalArcana } })`
**antes** de gravar o histórico em `arcana_calculations`. Regras:

- Só grava quando o campo está `null` — um valor **já cacheado nunca é sobrescrito** (o cache é a fonte
  de verdade da resposta: `user.personalArcana ?? calculatePersonalArcana(...)`).
- **Self-heal CAS (fix 2026-09-25):** se o valor cacheado (`observed`) difere do recalculado (`recomputed`), a rota
  executa `updateMany({ where: { id, personalArcana: observed }, data: { personalArcana: recomputed } })`
  para curar cache stale **no read** — o CAS garante que só cura se ninguém mais mudou o campo entre o read
  e o write. A resposta continua servindo o valor canônico (`observed` ou `recomputed` conforme o CAS).
- Falha de persistência é **não-fatal**: `logger.warn("[arcana/calculate] falha ao persistir arcano pessoal")`
  e a resposta segue **200** com o arcano calculado.
- A gravação do histórico (`arcana_calculations`) é igualmente best-effort e independente.
- Continua exigindo `User.birthDate` **e** `User.name` (422 `INCOMPLETE_PROFILE` caso contrário) —
  a rota **não aceita query params**; lê tudo do banco.

Coberto por `tests/integration/arcana-calculate.test.ts` (persiste quando `null`; não sobrescreve cache; self-heal CAS).

### 2. `PATCH /api/v1/users/me/profile` recalcula com null-out explícito

Enviar `birthDate` com data válida **recalcula** `personalArcana` via `calculatePersonalArcana(bd, currentUser.name)`.
O `name` é lido **dentro da transação**, então o arcano reflete o nome persistido no momento do write.

**Null-out semantics (fix 2026-09-25):** se `calculatePersonalArcana` retorna `null` (porque `name` está vazio),
o campo **é explicitamente nulado** (`personalArcana: null` no `tx.user.update`) — **não preserva** o valor anterior.
`birthDate: ""` continua sendo o único caminho de reset completo (zera `birthDate`, `astrologicalSign`, `mayanKin` e `personalArcana`).
Enviar uma data válida **nunca** zera o arcano, exceto quando `name` está vazio (caso em que o arcano é nulado).

Detalhes em `docs/04-api/users.md` §PATCH `/users/me/profile`.

### 3. `/meu-arcano` pré-preenche via `useMyProfile()` (sem fetch de mount)

`src/app/(app)/meu-arcano/page.tsx` (client) **não chama mais** `GET /api/v1/arcana/calculate` no mount.
O pré-fill agora vem do hook `useMyProfile()` (TanStack Query, cacheado, **`staleTime: 5 minutes`**) que já expõe `name` e `birthDate`
do perfil do usuário autenticado — o endpoint `GET /api/v1/arcana/calculate` passa a ser chamado **apenas
por callers explícitos/manuais** (clique no botão "Calcular").

`ArcanaCalculator` (`src/components/arcana/arcana-calculator.tsx`) recebe `initialName`/`initialBirthDate`
do `useMyProfile()` via props opcionais com o padrão *"adjusting state when a prop changes"* (tracking via
`prevInitialName`/`prevInitialBirthDate`): quando o pré-fill chega, os campos são atualizados —
**e o usuário continua podendo limpar o campo**, pois o sync só dispara quando a prop realmente muda de valor.

**Dirty invariant (fix 2026-09-25):** o componente usa **state** (`nameDirty`/`birthDateDirty` booleans)
em vez de `ref` para rastrear se o usuário editou os campos — isso satisfaz a regra `react-hooks/exhaustive-deps`
e evita o anti-pattern de mutar refs no render. O `hasUserCalculated` guard permanece como `ref` (apenas
para o race condition do fetch assíncrono, não para dirty tracking).

Coberto por `tests/components/arcana-calculator.test.tsx` (pré-fill via useMyProfile + permite limpar + dirty invariant).

### 4. Determinismo de timezone (corrige divergência dev/prod)

`src/lib/arcana/calculate.ts` — `calculateArcanaByDate`, `calculatePersonalArcana` e
`explainPersonalArcana` passaram a usar `getUTCFullYear`/`getUTCMonth`/`getUTCDate` (antes getters
locais). O mesmo `birthDate` agora produz **o mesmo arcano** em dev (BRT, UTC-3) e em prod (UTC) —
antes um usuário nascido perto da meia-noite podia ter o arcano **persistido diferente** do recalculado
em outro ambiente, o que fazia o `/meu-arcano` "pular" de carta ao recarregar. Consistente com
`calculateZodiacSign` (`src/lib/calculations/zodiac.ts`), que já usava UTC.

Coberto por `tests/arcana.test.ts`.

### 5. Faixa de arcano válida: `1-22` (enforced end-to-end)

`reduceToArcana` (`src/lib/arcana/reduce.ts`) reduz até ≤ 22 e **mapeia `0 → 22`** — o cálculo **nunca
emite `0`**. A copy de erro de `/meu-arcano/[arcana]` foi corrigida de "Valores validos: 0-21" para
"1-22", alinhada com o output real do calculador.

**Enforcement points (fix 2026-09-25):**
- `POST /ai/arcana-interpret`: schema Zod `arcanaInterpretSchema` usa `min(1).max(22)` (antes `min(0).max(21)`).
- `/meu-arcano/[arcana]` page: guard `if (arcanaNumber < 1 || arcanaNumber > 22)` retorna 404 com copy "Valores válidos: 1-22".
- `getArcanaByNumber(22)` (`src/data/arcana.ts`) retorna **entry 22** (com `roman: "XXII"`) — não faz mais short-circuit para `ARCANA_MAP[0]`. A chave `22` existe em `ARCANA_MAP` com conteúdo idêntico ao índice 0 ("O Louco"), mas o número 22 é agora a representação canônica do número mestre.

> ⚠️ **Divergência conhecida com documentos de produto (não corrigida aqui — requer decisão de
> produto).** Os documentos de produto ainda descrevem o intervalo como `0-21`:
> `docs/01-product/requirements.md` (RF-018), `docs/01-product/business-rules.md` (BR-ARC-003,
> "0 = O Louco"), `docs/00-overview/glossary.md` e `docs/glossary.md`
> ("Destiny Number mapped to 0–21"). Isso reflete o **modelo de domínio** (numeração tradicional do
> Tarot RWS, em que O Louco é o 0/XXI), enquanto o **código** normaliza `0 → 22` porque o número
> mestre 22 já ocupa o slot "O Louco" no sistema. A tabela de mapeamento em
> `.specs/005-arcana-personal/requirements.md` também lista `0 | O Louco` **e** `22 = O Louco`.
> Os dois modelos são defensáveis e **coexistem**: a API aceita `0` como alias histórico
> (`min(0).max(22)` em rotas legadas), mas toda a saída do cálculo é `1–22` e as novas rotas usam `min(1)`.
> **Não "corrigir" BR-ARC-003/RF-018 unilateralmente** — a decisão de qual convenção é a canônica pertence a produto. Referência técnica
> canônica: este documento + `docs/03-database/entities.md` + `docs/04-api/ai.md`.

---

## Versão

| Feature | Versão |
|---|---|
| Perfil público básico | MVP |
| Cálculos esotéricos automáticos | MVP |
| Configurações de privacidade | MVP |
| Horóscopo Chinês | V1 |
| Upgrade para profissional | V1 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Usuário deve estar autenticado |
| Armazenamento de arquivos | Infraestrutura | Upload de avatar (Cloudflare R2) |
| Banco de dados | Infraestrutura | Tabelas `User`, `UserProfile` (privacidade em coluna JSON `privacy`; **não** existe tabela `privacy_settings` — ver `prisma/schema.prisma`) |
| Módulo de cálculos | Módulo interno | Biblioteca de cálculos esotéricos |

---

## Critérios de Aceite

- **CA-01**: O Arcana Pessoal deve ser calculado corretamente para qualquer nome e data de nascimento válidos, seguindo a tabela pitagórica e regras de redução
- **CA-02**: O Kin Maya deve ser calculado corretamente com base na data de referência 26/07/1954 = Kin 1 (Dragão Magnético)
- **CA-03**: As configurações de privacidade devem ser aplicadas em menos de 1 segundo após a alteração
- **CA-04**: O perfil deve ser acessível publicamente por URL única (slug) e respeitar as configurações de privacidade do usuário
- **CA-05**: O upload de avatar deve aceitar imagens até 5 MB nos formatos JPG, PNG e WebP, com redimensionamento automático para 400×400px

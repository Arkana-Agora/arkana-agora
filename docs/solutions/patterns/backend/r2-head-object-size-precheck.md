---
title: "Precheck R2 Object Size with HeadObject (Fail-Open) — Project Pattern"
problem_type: pattern
category: backend
components:
  - backend
tags:
  - patterns
  - r2
  - head-object
  - presign
  - upload-validation
  - size-cap
  - fail-open
  - s2-12
module: uploads (src/lib/r2.ts → post images + avatar confirm)
date: 2026-10-05
established_in: "S2-12 size-cap on POST /social/posts + review C3 on avatar confirm (branch sprint2-f2, 2026-10-04): HeadObject-based 5MB guard without re-downloading the object, fail-open on null; 3 new tests in tests/integration/social-feed.test.ts"
---

# Pattern: Precheck R2 Object Size with HeadObject (Fail-Open)

## Problem / When to Use This

Use this pattern whenever the server must enforce a size limit on an object the **client uploaded directly to R2 with a presigned URL** — the server never sees the bytes on the write path, so the limit cannot be checked where it looks most natural. Two traps make the obvious implementations wrong: (1) a `Content-Length` check on the presign request is **dead** — that header is the size of the JSON body (`{images:[...]}`), not the image (the old posts-presign check was removed in fix wave W4–W8); (2) checking size by downloading the object buffers an unbounded upload in memory — a 5MB cap must not turn a 5GB object into an OOM. The correct place is the **route that finally consumes the key** (post creation, avatar confirm): validate the key format first, then `HeadObject` → `ContentLength`, reject `> MAX` with 422, and let `null` (object missing / header absent) **fail open** into the normal path, which re-validates after download. Two consumers already exist: `src/app/api/v1/social/posts/route.ts` (HEAD per image key, before `post.create`) and `src/app/api/v1/users/me/avatar/confirm/route.ts` (HEAD before `GetObject`).

## Source of Truth Files

- `src/lib/r2.ts` — `headObjectSize(key)` (`HeadObjectCommand`, never throws, `null` on any failure)
- `src/app/api/v1/social/posts/route.ts` — `MAX_IMAGE_BYTES` + key-pattern loop + HEAD loop (S2-12, resolved 2026-10-04)
- `src/app/api/v1/users/me/avatar/confirm/route.ts` — `MAX_BYTES`, HEAD-before-GetObject **plus** post-download re-check (review C3)
- `src/app/api/v1/social/posts/images/presign/route.ts` — doc comment stating the presign deliberately does NOT check size
- `tests/integration/social-feed.test.ts` — the 3 S4 cases (`imageUrls acima de 5MB (HeadObject) → 422 sem criar o post (S2-12)`, `uma chave gigante entre válidas → 422 (todas são checadas)`, `imageUrls dentro de 5MB segue a criação normalmente (S2-12)`)
- `tests/integration/avatar.test.ts` — `rejects oversized upload by R2 head size without downloading it` + `returns 429 when upload limit is exceeded` (HEAD not called when rate-limited)
- `docs/04-api/social.md` — "Fluxo S2-12", item 4 (presign size), etapa 5 da criação do post, tabela 422; `docs/04-api/users.md` (avatar confirm); `docs/06-features/social.md` (W4–W8 note)

## Current Implementation Snapshot

- `headObjectSize(key): Promise<number | null>` (`src/lib/r2.ts`) sends `HeadObjectCommand` and returns `response.ContentLength` when it is a `number`, otherwise `null`; **any throw is swallowed → `null`** (object absent, credentials hiccup, missing header).
- Posts route order: CSRF → auth → JSON → Zod → viewer tier → `enforceSocialLimit({limit:"post"})` → **key regex** `^posts/{userId}/\d+-[0-3]\.(?:jpg|png|webp)$` per key → **HEAD loop** per key → moderation → reading ownership → 1 `$transaction`.
- Rejection: `apiError("VALIDATION_ERROR", "Imagem muito grande. Maximo 5MB.", reqId, 422, { field: "imageUrls", message: ... }, rate.headers)` — `details.field` + rate-limit headers preserved, and `post.create` is never reached.
- `size !== null && size > MAX_IMAGE_BYTES` is the **only** reject condition; `null` falls through to the normal creation path (same fail-open contract as avatar).
- Avatar confirm: key prefix `avatars/{userId}/` + `..` check → rate limit → `headObjectSize` → `> MAX_BYTES` → 422 **without calling `getObjectBuffer`**; after a successful HEAD/GET it **re-checks `original.length > MAX_BYTES`** (defense in depth, because HEAD is fail-open).
- Limits are per-file constants: `MAX_IMAGE_BYTES = 5 * 1024 * 1024` (posts) and `MAX_BYTES = 5 * 1024 * 1024` (avatar) — currently duplicated by design, kept equal.
- Presign routes check no size at all: `posts/images/presign` doc comment documents that `Content-Length` is the JSON's and that the 5MB guard belongs to the post-creation `HeadObject`.
- Tests mock the whole module: `r2Mock = vi.hoisted(() => ({ generatePresignedUrl: vi.fn(), headObjectSize: vi.fn() }))`, `vi.mock("@/lib/r2", () => r2Mock)`, default `r2Mock.headObjectSize.mockResolvedValue(null)` in `beforeEach`.

## Planned / Optional Extensions (NOT implemented yet)

- Extract the duplicated 5MB constant into a shared source (e.g. `MAX_IMAGE_BYTES` in `src/lib/r2.ts` or `src/lib/social/limits.ts`) consumed by both routes and referenced by the client-side ≤5MB composer validation — today the two route-local constants must be edited in lockstep.
- `headObjectSize` precheck for any future direct-upload consumer (comments with images, profile banner, marketplace media): same key-validate → HEAD → fail-open sequence.

## Pattern Overview

Validate the presign-issued key format first, then measure the uploaded object with a metadata-only `HeadObject` at the consuming route; reject oversize with 422 before any download or persistence, treat `null` as "not my problem here" and let the downstream path re-validate.

## Implementation Steps

### Step 1: Metadata-only size helper (never throws)

[File: `src/lib/r2.ts` — `headObjectSize`]

```typescript
export async function headObjectSize(key: string): Promise<number | null> {
  try {
    const response = await getR2Client().send(
      new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }),
    )
    return typeof response.ContentLength === "number"
      ? response.ContentLength
      : null
  } catch {
    return null
  }
}
```

Key points:
- Return type is `number | null` — the caller must handle `null`; the helper must never reject (a transient R2 error must not 500 a business route).
- `HeadObject` costs one round trip and transfers no body — this is the whole point of the pattern.
- Do not add caching here; each route call is cheap enough and caching would complicate test mocks.

### Step 2: Validate the key BEFORE any HEAD

[File: `src/app/api/v1/social/posts/route.ts`]

```typescript
const keyPattern = new RegExp(
  `^posts/${auth.userId}/\\d+-[0-3]\\.(?:jpg|png|webp)$`,
)
for (const key of imageUrls) {
  if (!keyPattern.test(key)) {
    return apiError("VALIDATION_ERROR", "Chave de imagem invalida", reqId, 422,
      { field: "imageUrls", message: "Chave de imagem invalida" }, rate.headers)
  }
}
```

Key points:
- The regex must bind `auth.userId` and the full presign shape (`{ts}-{i}.{jpg|png|webp}`) — a bare `startsWith("posts/{userId}/")` accepted `posts/{userId}/../other-user/file` (traversal, review Phase 2).
- **Never HEAD an attacker-supplied key**: `HeadObject` on someone else's key is an existence/size oracle for foreign objects. Key validation is a security precondition of the HEAD, not a nicety.
- Rate limit runs before the HEAD loop too — a user over quota pays zero R2 calls (pinned by the avatar 429 test asserting `headObjectSize` not called).

### Step 3: HEAD loop with fail-open rejection, before persistence

[File: `src/app/api/v1/social/posts/route.ts`]

```typescript
for (const key of imageUrls) {
  const size = await headObjectSize(key)
  if (size !== null && size > MAX_IMAGE_BYTES) {
    return apiError(
      "VALIDATION_ERROR",
      "Imagem muito grande. Maximo 5MB.",
      reqId, 422,
      { field: "imageUrls", message: "Imagem muito grande. Maximo 5MB." },
      rate.headers,
    )
  }
}
```

Key points:
- Iterate **every** key (test: one oversized key among valid ones → 422).
- Check runs before moderation/reading lookups and before `prisma.$transaction` — reject cheap, reject early; the test asserts `prismaMock.post.create` not called.
- Pass `rate.headers` through so the 422 does not drop rate-limit state; `details.field = "imageUrls"` keeps the error machine-readable.
- `null` falls through — do not 404/422 on a missing object here; the contract is fail-open (Step 4 re-checks downstream).

### Step 4: Keep a re-validation at the download site (defense in depth)

[File: `src/app/api/v1/users/me/avatar/confirm/route.ts`]

```typescript
const headSize = await headObjectSize(body.fileKey)
if (headSize !== null && headSize > MAX_BYTES) { /* 422 */ }

const original = await getObjectBuffer(body.fileKey)

if (original.length > MAX_BYTES) { /* 422 — mesmo message */ }
```

Key points:
- Because `headObjectSize` fails open, the consumer that actually downloads must re-check `buffer.length` — the HEAD is an optimization, not the only guard.
- The posts route has no download step, so "normal path" there means the Zod/DB flow; the object simply never gets served oversized through this API.

### Step 5: Presign routes stay size-blind (and say why)

[File: `src/app/api/v1/social/posts/images/presign/route.ts` — doc comment]

```typescript
 * Tamanho NÃO é checado aqui: o `Content-Length` deste request é o do JSON
 * (não da imagem) — o guard de 5MB é do objeto APÓS o PUT: a criação do
 * post faz `HeadObject` por chave e rejeita imagem acima do limite.
```

Key points:
- The comment is load-bearing: it stops the next engineer from "restoring" the dead `Content-Length` check.
- Client-side ≤5MB validation in the composer is UX only — never the enforcement.

### Step 6: Pin it with TDD tests

[Files: `tests/integration/social-feed.test.ts`, `tests/integration/avatar.test.ts`]

```typescript
r2Mock.headObjectSize.mockResolvedValue(5 * 1024 * 1024 + 1)
const res = await callPost({ type: "image", content: "vejam",
  imageUrls: ["posts/usr_1/1770000000-0.jpg"] })
expect(res.status).toBe(422)
expect(res.headers.get("X-RateLimit-Remaining")).toBeTruthy() // rate.headers preservados
expect(prismaMock.post.create).not.toHaveBeenCalled()
```

Required cases (already implemented — extend, don't delete):
1. oversize single key → 422, `headObjectSize` called with the key, `post.create` never called;
2. one oversized key among valid ones → 422 (all keys checked);
3. within limit → 201 (fail-open path really continues);
4. avatar: HEAD oversize → 422 **and `getObjectBuffer` not called** (no download happened);
5. rate-limited → `headObjectSize` not called (ordering).

Key points:
- Mock the whole `@/lib/r2` module via `vi.hoisted` + default `mockResolvedValue(null)` in `beforeEach`, otherwise every existing social-feed/avatar test starts failing on an undefined mock.

## Complete Example

End-to-end shape for a new direct-upload consumer (e.g. a banner):

```typescript
// src/lib/r2.ts
export async function headObjectSize(key: string): Promise<number | null> {
  try {
    const r = await getR2Client().send(new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }))
    return typeof r.ContentLength === "number" ? r.ContentLength : null
  } catch { return null }
}

// rota que CONSUME a chave (nunca o presign)
const rate = await enforceSocialLimit({ limit: "upload", userId: auth.userId, reqId })
if (!rate.allowed) return rate.response

if (!keyPattern.test(body.fileKey)) return keyError422(reqId, rate.headers) // 1º: valida a chave

const size = await headObjectSize(body.fileKey)
if (size !== null && size > MAX_BYTES) return tooLarge422(reqId, rate.headers) // 2º: HEAD fail-open

const buffer = await getObjectBuffer(body.fileKey)
if (buffer.length > MAX_BYTES) return tooLarge422(reqId, rate.headers) // 3º: re-check se baixa
```

## Project-Specific Constraints

- [ ] Key format/prefix validation **precedes** every `headObjectSize()` call (posts: full presign regex bound to `auth.userId`; avatar: `avatars/{userId}/` prefix + `..` rejection) — HEAD on a foreign key is an object oracle.
- [ ] Rate limit runs before the HEAD (`enforceSocialLimit`) — the avatar 429 test asserts `headObjectSize` not called.
- [ ] `headObjectSize()` returns `number | null`, catches everything, and is never allowed to reject.
- [ ] Reject only on `size !== null && size > MAX`; `null` falls through to the normal path (documented fail-open contract in `docs/04-api/social.md` and `docs/04-api/users.md`).
- [ ] 422 payload shape: `VALIDATION_ERROR` + `details.field` (`imageUrls`) + `rate.headers` on the social route; message contains `5MB`.
- [ ] Rejection happens **before** `post.create` / before `getObjectBuffer` (tests assert both).
- [ ] Downloading consumers re-check `buffer.length` after `GetObject` (defense in depth for the fail-open HEAD).
- [ ] Presign routes carry the "no size check here" comment and must never grow a `Content-Length` check.
- [ ] Keep `MAX_IMAGE_BYTES` (`posts/route.ts`) and `MAX_BYTES` (`avatar/confirm/route.ts`) equal at `5 * 1024 * 1024`.
- [ ] Tests mock `@/lib/r2` wholesale with `headObjectSize: vi.fn()` defaulted to `null`.

## Anti-Patterns (What NOT to Do)

- ❌ Checking `Content-Length` on the presign request — it measures the JSON body, not the image (the removed W4–W8 guard was dead code).
- ❌ Calling `getObjectBuffer`/`GetObject` to *measure* size — buffers the whole upload; the cap exists to bound memory.
- ❌ HEAD before key validation — leaks existence/size of other users' objects.
- ❌ Failing closed on `null` (422/404 "object missing") — turns a benign race or transient R2 error into a user-facing failure; the contract is fail-open + downstream re-check.
- ❌ Checking only `imageUrls[0]` — the multi-image test pins "all keys are checked".
- ❌ Placing the check after the `$transaction` or inside the presign — reject before persistence, never at presign.
- ❌ Duplicating the check ad hoc with raw `HeadObjectCommand` in a route instead of reusing `headObjectSize` — the fail-open semantics live in that helper.

## Related Patterns / Docs

- `docs/04-api/social.md` — Fluxo S2-12, item 4 (presign), etapa 5 da criação, tabela 422 (written contract)
- `docs/04-api/users.md` — avatar confirm size check via `headObjectSize()` before download (review C3)
- `docs/06-features/social.md` — W4–W8 note (dead Content-Length removal) + avatar review C3
- `src/lib/validators/social.ts` — `EXT_BY_TYPE` / `postImagesPresignSchema` (the key shape the regex must match)
- `docs/solutions/patterns/security/rate-limit-before-user-lookup.md` — sibling ordering rule: cheap gate before expensive/observable operation

## Safe Change Checklist for Future AI Work

1. **Limit change**: update `MAX_IMAGE_BYTES` in `src/app/api/v1/social/posts/route.ts` **and** `MAX_BYTES` in `src/app/api/v1/users/me/avatar/confirm/route.ts` (duplicated constants) plus the client-side composer validation and the messages containing "5MB".
2. **New direct-upload flow**: add the check in the *consuming* route (key regex → `headObjectSize` → 422 with `rate.headers`), never in the presign route; copy the presign "não checado aqui" comment.
3. **Test sync**: extend the S4 cases in `tests/integration/social-feed.test.ts` and the HEAD cases in `tests/integration/avatar.test.ts`; keep `headObjectSize` in the `vi.hoisted` r2 mock and defaulted to `null`.
4. **Docs sync**: `docs/04-api/social.md`, `docs/04-api/users.md`, `docs/06-features/social.md` must describe the same ordering and fail-open rule.
5. **Verification**: `bun run test tests/integration/social-feed.test.ts tests/integration/avatar.test.ts` (run through the `test` **script** — it carries `--max-old-space-size=4096`, never bare `npx vitest run`, see `docs/solutions/ci-cd/turbopack-postcss-oom.md`), then `bun run type-check` and `bun run lint`; full suite before merge: `bun run test`.

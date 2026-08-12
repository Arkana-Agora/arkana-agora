# ProviderId Normalization Convention

> **Category**: security / auth
> **Pattern Type**: Convention
> **Related**: `docs/07-security/permissions.md`, `docs/04-api/authentication.md`, `prisma/schema.prisma`

## Problem

Different authentication providers use different identifier schemes (OAuth subject IDs vs email addresses). Inconsistent provider ID values complicate:
- Unique constraint enforcement (`@@unique([provider, providerId])`)
- Authentication flow logic
- Database queries
- Audit logging

## Solution

Adopt a **provider-specific normalization convention**:

- **EMAIL provider**: `providerId = email` normalized to lowercase
- **OAuth providers (GOOGLE/FACEBOOK)**: `providerId = OAuth subject ID`

This aligns with the `email @unique` constraint and provides a consistent, queryable identifier for each auth provider.

## Key Elements

### 1. Database Schema

```prisma
model User {
  id         String       @id @default(uuid())
  email      String       @unique
  provider   AuthProvider @default(EMAIL)
  providerId String       // Normalized per convention (see sprint-0.clarifications.md)

  @@unique([provider, providerId])
}

enum AuthProvider {
  EMAIL
  GOOGLE
  FACEBOOK
}
```

**Gotcha:** `providerId` is `NOT NULL` without a default. Email accounts must set `providerId` explicitly during registration.

### 2. Registration Logic

```typescript
async function registerUser(email: string, password: string): Promise<User> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      provider: 'EMAIL',
      providerId: normalizedEmail, // EMAIL → email normalized to lowercase
      // ...
    }
  });

  return user;
}

async function registerOAuthUser(provider: 'GOOGLE' | 'FACEBOOK', subjectId: string): Promise<User> {
  const user = await prisma.user.create({
    data: {
      provider: provider,
      providerId: subjectId, // GOOGLE/FACEBOOK → OAuth subject ID
      // ...
    }
  });

  return user;
}
```

**Gotcha:** Email normalization must be done in the service layer before Prisma creation. Prisma doesn't provide automatic normalization.

### 3. Authentication Flow

```typescript
async function authenticateUser(provider: 'EMAIL', email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: {
      provider: 'EMAIL',
      providerId: normalizedEmail
    }
  });

  return user;
}

async function authenticateOAuthUser(provider: 'GOOGLE' | 'FACEBOOK', subjectId: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: {
      provider: provider,
      providerId: subjectId
    }
  });

  return user;
}
```

**Gotcha:** For OAuth, `subjectId` is the unique identifier from the OAuth provider (Google `sub`, Facebook `id`). This is different from the `email` address associated with the OAuth account.

### 4. Recovery Flow

```typescript
async function linkEmailToOAuthAccount(
  oauthProvider: 'GOOGLE' | 'FACEBOOK',
  oauthSubjectId: string,
  email: string
): Promise<void> {
  // Check if OAuth user exists
  let user = await prisma.user.findUnique({
    where: {
      provider: oauthProvider,
      providerId: oauthSubjectId
    }
  });

  if (user) {
    // Update user's email if not already set
    if (!user.email) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: email.toLowerCase().trim(),
          providerId: email.toLowerCase().trim() // EMAIL → normalized email
        }
      });
    }
  } else {
    // Create new user with OAuth + email
    await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        provider: 'EMAIL',
        providerId: email.toLowerCase().trim(),
        // ...
      }
    });
  }
}
```

### 5. API Contract

```typescript
// POST /api/v1/auth/register
// EMAIL registration
{
  "email": "Maria@email.com", // Case-insensitive in request
  "password": "SenhaForte123"
}

// POST /api/v1/auth/social (deprecated — OAuth via NextAuth /api/auth/*, ADR-009)
// OAuth registration (legacy)
{
  "provider": "google",
  "subjectId": "12345678901234567890" // OAuth subject ID
}
```

**Gotcha:** API request bodies should be case-insensitive for email fields. Normalize on the service layer.

## When to Use

- New user registration with multiple auth providers
- OAuth integration (Google, Facebook, etc.)
- Email-based auth accounts that may be linked to OAuth
- Multi-provider login flows

## Related Patterns

- **RBAC with Plan Dimension**: Separate role (`UserRole`) from plan (`UserPlan`)
- **Consistent Auth Patterns**: Same authentication flow for all providers

## Gotchas

1. **Email normalization**: Always normalize emails to lowercase and trim whitespace before storage. Inconsistent casing breaks the `@unique` constraint.

2. **OAuth subject ID uniqueness**: Each OAuth provider issues a unique `subjectId` for each user. Do NOT use `email` as the OAuth `subjectId`.

3. **Provider existence check**: Always check `provider` AND `providerId` together (unique constraint on both).

4. **Email uniqueness**: The `email @unique` constraint doesn't enforce case-insensitivity. Normalize to lowercase in the service layer before Prisma creation.

5. **OAuth verification**: Verify OAuth subject ID with the provider before trusting it as `providerId`. Use provider SDK's verification methods.

6. **Index optimization**: Add an index on `(provider, providerId)` for efficient lookups. PostgreSQL doesn't automatically index composite unique constraints.

## Sources

- `docs/08-sprints/sprint-0.clarifications.md` (H-2 resolution)
- `prisma/schema.prisma` (User model with providerId field)
- `docs/03-database/entities.md` (User entity with providerId convention note)
- `docs/04-api/authentication.md` (register endpoint with providerId normalization)
- `docs/07-security/permissions.md` (RBAC with providerId-aware queries)
- `docs/02-architecture/deployment.md` (providerId convention in env setup)

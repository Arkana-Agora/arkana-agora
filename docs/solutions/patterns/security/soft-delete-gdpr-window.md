# Soft-Delete with LGPD 30-Day Window

> **Category**: security / data-compliance
> **Pattern Type**: Implementation pattern
> **Related**: `docs/07-security/lgpd.md`, `docs/03-database/entities.md`

## Problem

GDPR (and LGPD in Brazil) requires a 30-day right-to-erasure window. Deleting user data immediately violates privacy-by-design requirements. A soft-delete mechanism must track when a record was deleted to enable restoration within the legal window.

## Solution

Add a nullable timestamp field (`deletedAt DateTime?`) to the entity and filter active records using `isActive = true AND deletedAt IS NULL`. Restoration sets `deletedAt = NULL` and `isActive = true` within the 30-day window.

## Key Elements

### 1. Database Schema

```prisma
model User {
  id          String    @id @default(uuid())
  email       String    @unique
  isActive    Boolean   @default(true)
  deletedAt   DateTime? // Soft delete timestamp

  @@index([isActive, deletedAt]) // Optimize active user queries
}
```

**Gotcha:** `deletedAt` is nullable with no default. Existing records automatically have `deletedAt = NULL`, so no backfill is needed.

### 2. Query Pattern

```typescript
// Active users (soft-delete aware)
const activeUsers = await prisma.user.findMany({
  where: { isActive: true, deletedAt: null }
});

// Deactivate user (soft delete)
await prisma.user.update({
  where: { id },
  data: { isActive: false, deletedAt: new Date() }
});

// Restore user (within 30-day window)
await prisma.user.update({
  where: { id },
  data: { isActive: true, deletedAt: null }
});
```

**Gotcha:** Queries must explicitly check both `isActive` AND `deletedAt IS NULL`. Single checks (`isActive = true` OR `deletedAt = null`) bypass soft-delete logic.

### 3. Validation (30-Day Window)

```typescript
async function deleteUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  // Enforce 30-day restoration window
  if (user.deletedAt && daysSince(user.deletedAt) > 30) {
    throw new Error('User deletion is past the 30-day restoration window');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false, deletedAt: new Date() }
  });
}

async function restoreUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  // Ensure restoration is within 30-day window
  if (!user.deletedAt || daysSince(user.deletedAt) > 30) {
    throw new Error('Cannot restore user outside 30-day window');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: true, deletedAt: null }
  });
}
```

### 4. API Endpoint

```typescript
// DELETE /api/v1/auth/account
// - Soft deletes user (30-day reversible)
// - Returns 200 (user-initiated, no enumeration)
async function handleAccountDeletion(req: Request, res: Response) {
  const userId = req.user.id;

  // Enforce 30-day window
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user.deletedAt && daysSince(user.deletedAt) > 30) {
    return res.status(400).json({
      error: 'DELETION_PAST_WINDOW',
      message: 'Account deletion is no longer reversible'
    });
  }

  await deleteUser(userId);
  res.status(200).json({ message: 'Account deletion initiated' });
}
```

**Gotcha:** Always return 200 for user-initiated deletions (even failed) to prevent email enumeration attacks.

### 5. Migration

```typescript
// Add deletedAt to existing entities (no data loss)
await prisma.$executeRaw`
  ALTER TABLE users ADD COLUMN deletedAt TIMESTAMP NULL;
`;
```

**Gotcha:** Never use `ALTER COLUMN ... SET NOT NULL` without a default in a single migration. Use a 3-step sequence (nullable → backfill → NOT NULL).

## When to Use

- GDPR/LGPD compliance requirements
- Compliance with privacy-by-design principles
- Feature allowing user self-service account deletion
- Restoration paths for accidentally deleted data

## Related Patterns

- **Event-Driven Archival**: For data retention policies beyond 30 days
- **Data Minimization**: Keep only necessary data during soft-delete window

## Gotchas

1. **OR vs AND logic**: Queries must use `AND` (`isActive = true AND deletedAt = null`). OR logic (`isActive = true OR deletedAt = null`) returns both active and soft-deleted records.

2. **Index performance**: Add an index on `(isActive, deletedAt)` to optimize active user queries. Without an index, PostgreSQL performs sequential scans on large tables.

3. **REST API idempotency**: Use 404 for unknown IDs and 410 (Gone) for soft-deleted records in read operations.

4. **Edge cases**:
   - Concurrent deletions: Use transactional updates with error handling.
   - Foreign key cascades: Decide whether cascading deletes should hard-delete or skip.
   - Recovery window expiry: Auto-hard-delete after 30 days or mark as expired.

## Sources

- `docs/08-sprints/sprint-0.clarifications.md` (H-3 resolution)
- `docs/07-security/lgpd.md` (privacy-by-design requirement)
- `docs/03-database/entities.md` (User entity with deletedAt field)
- `docs/04-api/authentication.md` (account deletion contract)
- `docs/07-security/permissions.md` (RBAC with soft-delete aware queries)

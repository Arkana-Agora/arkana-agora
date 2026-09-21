# Data Model Requirements Quality Checklist

Plan: `docs/plans/20260921120000-sprint1-completion-plan.md`

## Schema Design

- [ ] CHK080 Are all new Prisma models explicitly listed with fields and types? [Completeness]
- [ ] CHK081 Are foreign key relationships defined for all models (User→UserProfile, Reading→ReadingCard)? [Completeness]
- [ ] CHK082 Are unique constraints documented (UserProfile.username, UserProfile.userId)? [Clarity]
- [ ] CHK083 Are index requirements documented for query performance (Reading.userId, Reading.createdAt)? [Clarity]

## Profile Extension

- [ ] CHK084 Is the UserProfile extension (username, birthPlace, privacy) field types documented? [Clarity]
- [ ] CHK085 Is the privacy JSON schema documented (which fields, valid values)? [Clarity]
- [ ] CHK086 Is the username uniqueness constraint behavior documented (case sensitivity, normalization)? [Edge Case]

## Reading Model

- [ ] CHK087 Is the Reading model schema explicitly defined (userId, deckId, spreadType, isDaily)? [Completeness]
- [ ] CHK088 Is the ReadingCard model schema explicitly defined (readingId, cardId, position, isReversed)? [Completeness]
- [ ] CHK089 Are reading lifecycle states documented (created, completed, archived)? [Clarity]
- [ ] CHK090 Is the daily reading flag (isDaily) usage documented? [Clarity]

## AI Models

- [ ] CHK091 Is the Interpretation model schema defined (readingId, userId, content, mode, mood, cached, cacheHash)? [Completeness]
- [ ] CHK092 Is the FollowUpMessage model schema defined (interpretationId, role, content)? [Completeness]
- [ ] CHK093 Is the AIDailyUsage model schema defined (userId, date, count)? [Completeness]
- [ ] CHK094 Is the cache hash computation documented (which fields, algorithm)? [Clarity]

## Arcana Data

- [ ] CHK095 Is the ARCANA_MAP data structure documented (22 arcanos, fields per entry)? [Completeness]
- [ ] CHK096 Is the Pythagorean table data structure documented (letter→number mapping)? [Completeness]
- [ ] CHK097 Are the tarot deck JSON data structures documented (RWS, Thoth, Lenormand)? [Completeness]

## Migration Strategy

- [ ] CHK098 Is the migration ordering documented (which migrations depend on which)? [Clarity]
- [ ] CHK099 Is the rollback strategy documented for each migration? [Edge Case]
- [ ] CHK100 Is the seed data strategy documented (deck data, spread layouts)? [Clarity]

## Data Integrity

- [ ] CHK101 Are cascading delete behaviors documented (User deleted → Profile, Sessions, Readings)? [Clarity]
- [ ] CHK102 Are soft delete behaviors documented for profile data? [Clarity]
- [ ] CHK103 Is the data retention policy documented for readings and interpretations? [Clarity]

## Cross-Cutting

- [ ] CHK104 Is the schema versioning strategy documented? [Clarity]
- [ ] CHK105 Are database performance requirements documented (query response times)? [Measurability]

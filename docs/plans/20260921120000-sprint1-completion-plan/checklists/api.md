# API Requirements Quality Checklist

Plan: `docs/plans/20260921120000-sprint1-completion-plan.md`

## API Design & Contracts

- [ ] CHK001 Are all API endpoints explicitly listed with HTTP method + path? [Completeness]
- [ ] CHK002 Are request/response schemas defined for every endpoint? [Completeness]
- [ ] CHK003 Are error response shapes consistent across all endpoints (error code, message, details)? [Consistency]
- [ ] CHK004 Are HTTP status codes explicitly mapped for each success/error scenario? [Clarity]
- [ ] CHK005 Are pagination formats defined for list endpoints (GET /readings, GET /readings history)? [Clarity]

## Rate Limiting & Throttling

- [ ] CHK006 Are rate limit thresholds explicitly stated per endpoint (readings 3/day free, 10/day Plus; AI 10/day + 3 interpretações; profile 10/min)? [Measurability]
- [ ] CHK007 Are rate limit response formats defined (429 body shape, Retry-After header)? [Clarity]
- [ ] CHK008 Is the rate limit key defined (per-user, per-IP, per-API-key)? [Clarity]
- [ ] CHK009 Are premium vs free tier limits documented separately? [Completeness]

## Authentication & Authorization

- [ ] CHK010 Are all protected endpoints marked as requiring Bearer authentication? [Completeness]
- [ ] CHK011 Are public endpoints (GET /decks, GET /spreads, landing page) explicitly marked as unauthenticated? [Completeness]
- [ ] CHK012 Is authorization scope defined (e.g., can user A read user B's private profile)? [Clarity]

## SSE Streaming

- [ ] CHK013 Are SSE event types defined for AI interpret and follow-up endpoints? [Clarity]
- [ ] CHK014 Is the SSE connection timeout defined? [Measurability]
- [ ] CHK015 Are SSE error events structured (error type, message, retryable flag)? [Clarity]
- [ ] CHK016 Is the cache hit response format differentiated from streaming response? [Clarity]

## Avatar Upload

- [ ] CHK017 Are presigned URL expiration times defined? [Measurability]
- [ ] CHK018 Is the max file size explicitly stated (5MB)? [Measurability]
- [ ] CHK019 Are accepted formats explicitly listed (JPEG, PNG, WebP)? [Completeness]
- [ ] CHK020 Is the avatar processing pipeline defined (sharp resize 400x400, WebP conversion)? [Clarity]

## Performance Targets

- [ ] CHK021 Is P95 < 500ms target defined for all API endpoints? [Measurability]
- [ ] CHK022 Are there separate performance targets for SSE streaming vs standard responses? [Clarity]

## Cross-Cutting

- [ ] CHK023 Are API versioning conventions documented (v1 prefix)? [Consistency]
- [ ] CHK024 Is request ID / correlation ID requirement documented? [Observability]
- [ ] CHK025 Are API response envelope formats consistent (data wrapper vs flat)? [Consistency]

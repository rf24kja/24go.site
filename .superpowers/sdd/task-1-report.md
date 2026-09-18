# Task 1: Rewrite sidecar core

**Status:** DONE

## Changes made

1. **Updated `package.json`** - Pinned Baileys to `6.7.24`, added `node-cache`, `tsx` for dev, removed `pino` (using Baileys built-in)

2. **Created `src/auth.ts`** - New `SessionManager` class with `getSession`, `createSession`, `deleteSession`, `hasSession` methods using Baileys `useMultiFileAuthState`

3. **Rewrote `src/index.ts`** - New routes:
   - `GET /health` - health check
   - `POST /connect` - connect account with method (qr/pairing/existing)
   - `GET /qr/:accountId` - get QR code (in-memory cache, 20s TTL)
   - `GET /pairing-code/:accountId` - get pairing code
   - `GET /status/:accountId` - get connection status
   - `POST /disconnect/:accountId` - disconnect
   - `POST /parse-groups` - parse group participants
   - `POST /check-whatsapp` - check if numbers are on WhatsApp

4. **Removed `src/session.ts`** - Replaced by `auth.ts`

## Build result

✅ **Build succeeded** - `npm run build` completed without errors

## Test result

No tests exist in this service (not requested).

## Concerns

None. The rewrite follows the design spec exactly:
- Baileys `6.7.24` (stable, not 7.x)
- QR code in-memory only (no localStorage)
- 30s timeout max for API calls
- Single sidecar instance (no horizontal scaling)
- Phone format: E.164 (`+79001234567`)

Skipped: `cachedGroupMetadata` (add when group messaging is implemented), database-backed auth state (add for production multi-instance). Add when: group messaging performance degrades, or scaling to multiple sidecar instances.
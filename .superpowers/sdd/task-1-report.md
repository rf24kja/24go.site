# Task 1 Report: wa-sidecar Node.js Service

## What Was Implemented

Created a standalone Node.js service wrapping Baileys (WhatsApp multi-device protocol) as a Docker sidecar.

### Files Created

| File | Purpose |
|------|---------|
| `services/wa-sidecar/package.json` | Dependencies: baileys, express, qrcode, pino, cors |
| `services/wa-sidecar/tsconfig.json` | TypeScript config: ES2022, commonjs, strict |
| `services/wa-sidecar/src/session.ts` | Session manager with create/get/remove/getGroupParticipants |
| `services/wa-sidecar/src/index.ts` | Express server on port 3100 with 6 endpoints |
| `services/wa-sidecar/Dockerfile` | node:20-slim, npm ci --production, expose 3100 |

### Endpoints

- `GET /health` — health check
- `POST /connect` — initiate QR connection (waits 30s for QR)
- `GET /qr/:accountId` — poll QR code
- `GET /status/:accountId` — connection status
- `POST /disconnect/:accountId` — disconnect session
- `POST /parse-groups` — parse group participants from invite links

## Testing

- `npm install` — success (193 packages)
- `npx tsc` — success, no errors
- Compiled output verified in `dist/`

## Files Changed

- `.gitignore` — added `dist/` to ignore compiled output
- `services/wa-sidecar/` — all new files (7 files, 3120 insertions)

## Self-Review Findings

1. **Logger disabled** — Baileys logger set to `undefined as any`. Acceptable for sidecar; add pino logger if debugging needed.
2. **No rate limiting** — endpoints have no rate limiting. Fine for internal service; add if exposed externally.
3. **No auth on endpoints** — no API key validation. Acceptable for localhost-only communication with FastAPI backend.

## Commits

- `22a5b9c` — feat(wa-sidecar): create WhatsApp Baileys sidecar service
- `7e31216` — fix(wa-sidecar): reconnect backoff, session cleanup, baileys module

## Task 1 Fixes Applied

### Critical Fixes

1. **Recursive reconnect without backoff/limit** (`session.ts:83-93`):
   - Added `reconnectAttempts` counter to Session interface
   - Max 3 retry attempts with exponential backoff (3s, 6s, 12s)
   - Stops reconnecting on `DisconnectReason.loggedOut`

2. **removeSession doesn't delete session files** (`session.ts:124-138`):
   - Added `fs.rmSync(sessionDir, { recursive: true, force: true })` before map deletion
   - Checks `fs.existsSync` before attempting removal

### Important Fixes

3. **Created `src/baileys.ts`** — Re-export barrel for Baileys types and functions

4. **Magic 2000ms sleep** (`session.ts:163-175`):
   - Replaced with retry loop (up to 10 attempts, 1s each) for group metadata
   - Throws descriptive error on timeout

5. **`undefined as any` for logger/key store** (`session.ts:35-44`):
   - Created `pino({ level: "silent" })` instance
   - Used for both `makeCacheableSignalKeyStore` and `logger` options

### Test Results

- `npx tsc` — **PASS** (0 errors)
- Commit: `7e31216`

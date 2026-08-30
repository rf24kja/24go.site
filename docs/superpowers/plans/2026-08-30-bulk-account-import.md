# Bulk Account Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bulk/mass account import for Telegram and VK accounts with batch creation and connect-all flow.

**Architecture:** Backend adds two new endpoints on the existing accounts router. Frontend adds a bulk import modal with textarea input, auto-connect flow, and code entry for each account. Minimal changes, reuses existing patterns.

**Tech Stack:** FastAPI (Pydantic, SQLAlchemy async), Next.js (React, Tailwind), existing api.ts client.

## Global Constraints

- Max 50 accounts per bulk create request
- Max 10 accounts per bulk connect request (Telegram rate limits)
- 2-second delay between Telegram code requests in connect-all
- Duplicate check by `account_identifier` within tenant
- Dark theme UI, consistent with existing design patterns
- TypeScript strict mode (`npx tsc --noEmit` must pass)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `services/backend/app/routers/accounts.py` | Modify | Add bulk create + bulk connect endpoints |
| `services/dashboard/src/lib/api.ts` | Modify | Add `bulkCreateAccounts` and `bulkConnectAccounts` API functions |
| `services/dashboard/src/app/(dashboard)/accounts/page.tsx` | Modify | Add Bulk Import button, modal, progress, code entry UI |

---

### Task 1: Backend — Bulk Create Endpoint

**Files:**
- Modify: `services/backend/app/routers/accounts.py:65-89` (after existing create_account)

**Interfaces:**
- Consumes: `AccountCreate` schema from `app.schemas`
- Produces: `{"created": int, "errors": [{"index": int, "error": str}], "accounts": [{"id": str, "account_identifier": str}]}`

- [ ] **Step 1: Add Pydantic model for bulk request**

At the top of `accounts.py`, after the existing `ConnectPhoneRequest` models, add:

```python
class BulkAccountItem(BaseModel):
    platform: str
    account_identifier: str

class BulkCreateRequest(BaseModel):
    accounts: list[BulkAccountItem]
```

- [ ] **Step 2: Add bulk create endpoint**

After the `create_account` function (line 89), add:

```python
@router.post("/bulk")
async def bulk_create_accounts(
    body: BulkCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if len(body.accounts) > 50:
        raise HTTPException(400, "Max 50 accounts per request")

    # Fetch existing identifiers for duplicate check
    identifiers = [a.account_identifier for a in body.accounts]
    existing = await db.execute(
        select(AccountPool.account_identifier).where(
            AccountPool.tenant_id == current_user.tenant_id,
            AccountPool.account_identifier.in_(identifiers),
        )
    )
    existing_set = {row[0] for row in existing.all()}

    created = []
    errors = []

    for i, item in enumerate(body.accounts):
        if item.account_identifier in existing_set:
            errors.append({"index": i, "error": f"Duplicate: {item.account_identifier}"})
            continue
        account = AccountPool(
            tenant_id=current_user.tenant_id,
            platform=item.platform,
            account_identifier=item.account_identifier,
        )
        db.add(account)
        await db.flush()
        await db.refresh(account)
        created.append({"id": str(account.id), "account_identifier": item.account_identifier})
        existing_set.add(item.account_identifier)

    await db.commit()

    for c in created:
        await log_event(
            url=settings.DATABASE_URL.replace("+asyncpg", ""),
            tenant_id=current_user.tenant_id, action="created", entity_type="account",
            entity_id=c["id"], new_value={"account_identifier": c["account_identifier"]},
            user_id=current_user.id, ip_address=request.client.host if request else None,
        )

    return {"created": len(created), "errors": errors, "accounts": created}
```

- [ ] **Step 3: Verify syntax**

Run: `cd services/backend && python -c "from app.routers.accounts import router"`

Expected: No import errors

---

### Task 2: Backend — Bulk Connect Endpoint

**Files:**
- Modify: `services/backend/app/routers/accounts.py` (after bulk create endpoint)

**Interfaces:**
- Consumes: list of account UUIDs
- Produces: `{"sent": int, "failed": [{"account_id": str, "error": str}]}`

- [ ] **Step 1: Add Pydantic model for bulk connect**

After `BulkCreateRequest`:

```python
class BulkConnectRequest(BaseModel):
    account_ids: list[str]
```

- [ ] **Step 2: Add bulk connect endpoint**

```python
@router.post("/connect-all")
async def bulk_connect_accounts(
    body: BulkConnectRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if len(body.account_ids) > 10:
        raise HTTPException(400, "Max 10 accounts per connect request (Telegram rate limits)")

    import os, asyncio, json
    api_id = int(os.getenv("TG_API_ID", "0"))
    api_hash = os.getenv("TG_API_HASH", "")
    if not api_id or not api_hash:
        raise HTTPException(500, "Telegram API credentials not configured")

    import redis
    r = redis.Redis.from_url(settings.REDIS_URL.replace("rediss://", "redis://"))

    sent = 0
    failed = []

    for idx, account_id_str in enumerate(body.account_ids):
        try:
            account_id = UUID(account_id_str)
            result = await db.execute(
                select(AccountPool).where(
                    AccountPool.id == account_id,
                    AccountPool.tenant_id == current_user.tenant_id,
                )
            )
            account = result.scalar_one_or_none()
            if not account:
                failed.append({"account_id": account_id_str, "error": "Account not found"})
                continue

            from telethon import TelegramClient
            from telethon.sessions import StringSession

            client = TelegramClient(StringSession(), api_id, api_hash)
            await client.connect()
            sent_code = await client.send_code_request(account.account_identifier)
            session_string = client.session.save()
            await client.disconnect()

            r.setex(f"tg_code:{account_id}", 600, json.dumps({
                "phone": account.account_identifier,
                "phone_code_hash": str(sent_code.phone_code_hash),
                "session_string": session_string,
            }))

            sent += 1
            await log_event(
                url=settings.DATABASE_URL.replace("+asyncpg", ""),
                tenant_id=current_user.tenant_id, action="connected", entity_type="account",
                entity_id=account_id_str,
                new_value={"phone": account.account_identifier},
                user_id=current_user.id, ip_address=request.client.host if request else None,
            )
        except Exception as e:
            failed.append({"account_id": account_id_str, "error": str(e)[:200]})

        # Rate limit: 2s delay between requests (skip after last)
        if idx < len(body.account_ids) - 1:
            await asyncio.sleep(2)

    return {"sent": sent, "failed": failed}
```

- [ ] **Step 3: Verify syntax**

Run: `cd services/backend && python -c "from app.routers.accounts import router"`

Expected: No import errors

---

### Task 3: Frontend — Add API Functions

**Files:**
- Modify: `services/dashboard/src/lib/api.ts:105-107` (after createAccount)

**Interfaces:**
- Produces: `bulkCreateAccounts(token, accounts)` and `bulkConnectAccounts(token, accountIds)`

- [ ] **Step 1: Add bulk API functions**

After the `createAccount` function (line 107), add:

```typescript
export async function bulkCreateAccounts(
  token: string,
  accounts: { platform: string; account_identifier: string }[]
) {
  return api<{ created: number; errors: { index: number; error: string }[]; accounts: { id: string; account_identifier: string }[] }>(
    "/api/v1/accounts/bulk",
    { method: "POST", body: JSON.stringify({ accounts }), token }
  );
}

export async function bulkConnectAccounts(token: string, accountIds: string[]) {
  return api<{ sent: number; failed: { account_id: string; error: string }[] }>(
    "/api/v1/accounts/connect-all",
    { method: "POST", body: JSON.stringify({ account_ids: accountIds }), token }
  );
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd services/dashboard && npx tsc --noEmit`

Expected: No errors

---

### Task 4: Frontend — Bulk Import Modal UI

**Files:**
- Modify: `services/dashboard/src/app/(dashboard)/accounts/page.tsx`

**Interfaces:**
- Consumes: `bulkCreateAccounts` and `bulkConnectAccounts` from api.ts

- [ ] **Step 1: Add imports**

Update the import from `@/lib/api` to include the new functions:

```typescript
import {
  getAccounts, createAccount, startListener, stopListener,
  getListenerStatus, connectTelegram, confirmTelegram, confirmPassword2FA,
  disconnectTelegram, getTelegramStatus,
  bulkCreateAccounts, bulkConnectAccounts,
} from "@/lib/api";
```

- [ ] **Step 2: Add state variables**

After the existing `connectError` state (line 61), add:

```typescript
// Bulk import state
const [showBulk, setShowBulk] = useState(false);
const [bulkPlatform, setBulkPlatform] = useState("telegram");
const [bulkPhones, setBulkPhones] = useState("");
const [bulkStep, setBulkStep] = useState<"input" | "importing" | "connecting" | "codes" | "done">("input");
const [bulkResult, setBulkResult] = useState<{ created: number; errors: { index: number; error: string }[]; accounts: { id: string; account_identifier: string }[] } | null>(null);
const [bulkConnectResult, setBulkConnectResult] = useState<{ sent: number; failed: { account_id: string; error: string }[] } | null>(null);
const [bulkCodes, setBulkCodes] = useState<Record<string, string>>({});
const [bulkBusy, setBulkBusy] = useState(false);
const [bulkError, setBulkError] = useState("");
```

- [ ] **Step 3: Add Bulk Import button**

In the header section (line 205-208), add a second button next to "+ Add Account":

```tsx
<div className="flex items-center justify-between">
  <h1 className="text-2xl font-semibold text-zinc-100">Accounts</h1>
  <div className="flex gap-2">
    <button onClick={() => { setShowBulk(true); setShowAdd(false); }}
      className="px-4 py-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-700 transition">
      Bulk Import
    </button>
    <button onClick={() => { setShowAdd(!showAdd); setShowBulk(false); }}
      className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200">
      + Add Account
    </button>
  </div>
</div>
```

- [ ] **Step 4: Add bulk import modal**

Before the closing `</div>` of the page (after the connect modal), add the bulk import modal:

```tsx
{/* ── Bulk Import Modal ──────────────────────────────────────────── */}
{showBulk && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => !bulkBusy && setShowBulk(false)}>
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
      {bulkStep === "input" && (
        <>
          <h2 className="text-lg font-bold text-zinc-100">Bulk Import Accounts</h2>
          <p className="text-xs text-zinc-500">Enter phone numbers, one per line. Max 50 accounts.</p>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Platform</label>
            <select value={bulkPlatform} onChange={(e) => setBulkPlatform(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
              <option value="telegram">Telegram</option>
              <option value="vkontakte">VKontakte</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Phone Numbers (one per line)</label>
            <textarea rows={6} placeholder="+66123456789&#10;+66987654321&#10;+33612345678" value={bulkPhones}
              onChange={(e) => setBulkPhones(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono resize-none" />
          </div>
          {bulkPhones.trim() && (
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-xs text-zinc-400 mb-1">Preview: {bulkPhones.trim().split("\n").filter(l => l.trim()).length} accounts</p>
              <div className="flex flex-wrap gap-1">
                {bulkPhones.trim().split("\n").filter(l => l.trim()).slice(0, 10).map((p, i) => (
                  <span key={i} className="px-2 py-0.5 bg-zinc-700 rounded text-xs text-zinc-300">{p.trim()}</span>
                ))}
                {bulkPhones.trim().split("\n").filter(l => l.trim()).length > 10 && (
                  <span className="px-2 py-0.5 text-xs text-zinc-500">+{bulkPhones.trim().split("\n").filter(l => l.trim()).length - 10} more</span>
                )}
              </div>
            </div>
          )}
          {bulkError && <p className="text-xs text-rose-400">{bulkError}</p>}
          <div className="flex gap-3">
            <button onClick={handleBulkImport} disabled={bulkBusy || !bulkPhones.trim()}
              className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {bulkBusy ? "Importing..." : "Import Accounts"}
            </button>
            <button onClick={() => setShowBulk(false)} disabled={bulkBusy}
              className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">Cancel</button>
          </div>
        </>
      )}

      {bulkStep === "importing" && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-zinc-300">Creating accounts...</p>
        </div>
      )}

      {bulkStep === "connecting" && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-zinc-300">Sending verification codes...</p>
          <p className="text-xs text-zinc-500 mt-1">This may take a moment (2s delay between each)</p>
        </div>
      )}

      {bulkStep === "codes" && (
        <>
          <h2 className="text-lg font-bold text-zinc-100">Enter Verification Codes</h2>
          <p className="text-xs text-zinc-500">
            Codes sent to {bulkConnectResult?.sent ?? 0} accounts.
            {bulkConnectResult?.failed && bulkConnectResult.failed.length > 0 &&
              ` ${bulkConnectResult.failed.length} failed to send.`}
          </p>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {(bulkResult?.accounts || []).filter(a =>
              !bulkConnectResult?.failed?.some(f => f.account_id === a.id)
            ).map((acct) => (
              <div key={acct.id} className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-mono w-28 truncate" title={acct.account_identifier}>
                  {acct.account_identifier}
                </span>
                <input type="text" placeholder="Code" value={bulkCodes[acct.id] || ""}
                  onChange={(e) => setBulkCodes(prev => ({ ...prev, [acct.id]: e.target.value }))}
                  className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 font-mono" />
              </div>
            ))}
          </div>
          {bulkError && <p className="text-xs text-rose-400">{bulkError}</p>}
          <div className="flex gap-3">
            <button onClick={handleBulkConfirmCodes} disabled={bulkBusy}
              className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {bulkBusy ? "Confirming..." : "Confirm All Codes"}
            </button>
            <button onClick={() => { setBulkStep("done"); load(); }} disabled={bulkBusy}
              className="py-2 px-3 bg-zinc-800 text-zinc-400 rounded-lg text-xs">Skip for now</button>
          </div>
        </>
      )}

      {bulkStep === "done" && (
        <>
          <h2 className="text-lg font-bold text-zinc-100">Import Complete</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-emerald-400">✓</span>
              <span className="text-zinc-300">{bulkResult?.created ?? 0} accounts created</span>
            </div>
            {bulkResult?.errors && bulkResult.errors.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-amber-400">⚠</span>
                <span className="text-zinc-400">{bulkResult.errors.length} duplicates skipped</span>
              </div>
            )}
            {bulkConnectResult && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-400">✓</span>
                <span className="text-zinc-300">{bulkConnectResult.sent} codes sent</span>
              </div>
            )}
            {bulkConnectResult?.failed && bulkConnectResult.failed.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-rose-400">✗</span>
                <span className="text-zinc-400">{bulkConnectResult.failed.length} codes failed</span>
              </div>
            )}
          </div>
          <button onClick={() => { setShowBulk(false); setBulkStep("input"); setBulkPhones(""); setBulkResult(null); setBulkConnectResult(null); setBulkCodes({}); }}
            className="w-full py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm mt-4">
            Close
          </button>
        </>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 5: Add handler functions**

Before the `handleAdd` function (line 179), add:

```typescript
// ── Bulk Import Flow ───────────────────────────────────────────
const handleBulkImport = async () => {
  if (!auth?.token) return;
  const phones = bulkPhones.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (phones.length === 0) return;
  if (phones.length > 50) { setBulkError("Max 50 accounts per import"); return; }

  setBulkBusy(true);
  setBulkError("");
  setBulkStep("importing");

  try {
    const accounts = phones.map(p => ({ platform: bulkPlatform, account_identifier: p }));
    const result = await bulkCreateAccounts(auth.token, accounts);
    setBulkResult(result);

    if (result.accounts.length === 0) {
      setBulkStep("done");
      setBulkBusy(false);
      return;
    }

    // Auto-connect: send codes
    setBulkStep("connecting");
    const connectResult = await bulkConnectAccounts(auth.token, result.accounts.map(a => a.id));
    setBulkConnectResult(connectResult);
    setBulkStep("codes");
  } catch (e: any) {
    setBulkError(e.message || "Import failed");
    setBulkStep("input");
  } finally {
    setBulkBusy(false);
  }
};

const handleBulkConfirmCodes = async () => {
  if (!auth?.token || !bulkResult) return;
  setBulkBusy(true);
  setBulkError("");

  try {
    const accountsToConfirm = bulkResult.accounts.filter(a => bulkCodes[a.id]);
    for (const acct of accountsToConfirm) {
      try {
        await confirmTelegram(auth.token, acct.id, acct.account_identifier, bulkCodes[acct.id]);
      } catch (e: any) {
        // Continue with others, show partial errors
      }
    }
    setBulkStep("done");
    load();
  } catch (e: any) {
    setBulkError(e.message || "Confirmation failed");
  } finally {
    setBulkBusy(false);
  }
};
```

- [ ] **Step 6: Verify TypeScript**

Run: `cd services/dashboard && npx tsc --noEmit`

Expected: No errors

---

### Task 5: Final Verification

- [ ] **Step 1: Verify backend imports**

Run: `cd services/backend && python -c "from app.routers.accounts import router; print('OK')"`

Expected: `OK`

- [ ] **Step 2: Verify frontend TypeScript**

Run: `cd services/dashboard && npx tsc --noEmit`

Expected: No errors

- [ ] **Step 3: Summary**

Report: files changed, endpoints added, UI components added.

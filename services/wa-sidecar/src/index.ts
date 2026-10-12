import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import NodeCache from 'node-cache'
import { sessionManager } from './auth.js'

const app = express()
// ponytail: service-to-service only — browsers have no business here
app.use(cors({ origin: false }))
app.use(express.json())

const SIDECAR_API_KEY = process.env.SIDECAR_API_KEY || ''

// ponytail: fail-closed — no key configured means no access, not open access
app.use((req, res, next) => {
  if (req.path === '/health') return next()
  if (!SIDECAR_API_KEY) {
    return res.status(503).json({ error: 'sidecar auth not configured' })
  }
  const got = req.header('X-Sidecar-Key') || ''
  const a = Buffer.from(got)
  const b = Buffer.from(SIDECAR_API_KEY)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'forbidden' })
  }
  next()
})

function assertAccountId(accountId: unknown): asserts accountId is string {
  if (typeof accountId !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(accountId)) {
    throw new Error('invalid account id')
  }
}

const logger = pino({ level: 'silent' })

const qrCache = new NodeCache({ stdTTL: 20 })
const pairingCache = new NodeCache({ stdTTL: 120 })
const connections = new Map<string, WASocket>()
// accountId -> groupJid -> {name, last_seen}
const knownGroups = new Map<string, Map<string, { name: string; last_seen: number }>>()

function validateE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone)
}

export { validateE164, normalizePhone };

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (!cleaned.startsWith('+')) {
    return '+' + cleaned
  }
  return cleaned
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms)
  )
  return Promise.race([promise, timeout])
}

// ponytail: anti-ban pause between groups, 15-45s random. Never remove.
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const MAX_GROUPS_PER_CALL = 5
const MAX_NUMBERS_PER_CALL = 100
const reconnectAttempts = new Map<string, number>()
const connectingNow = new Set<string>()

async function connectAccount(accountId: string, phoneNumber?: string, method?: string) {
  let session = await sessionManager.getSession(accountId)
  if (!session) {
    session = await sessionManager.createSession(accountId)
  }

  const version = await fetchLatestBaileysVersion().then(v => v.version).catch(() => undefined)
  if (!version) {
    console.log(`[wa] WARNING: could not fetch live WA version, using library default (may cause silent disconnects)`)
  } else {
    console.log(`[wa] using WA version ${(version as number[]).join('.')}`)
  }
  const sock = makeWASocket({
    version: version as any,
    // ponytail: full history on connect — we need the group list, and partial sync gives nothing
    syncFullHistory: true,
    auth: {
      creds: session.state.creds,
      keys: makeCacheableSignalKeyStore(session.state.keys, logger)
    },
    printQRInTerminal: false,
    logger
  })

  connections.set(accountId, sock)

  sock.ev.on('creds.update', session.saveCreds)

  // ponytail: learn group JIDs from history sync + live messages.
  // groupFetchAllParticipating is broken on this Baileys version — this is the fallback.
  if (!(sock as any).__groupsHooked) {
    (sock as any).__groupsHooked = true
    const learn = (id: string, name?: string) => {
      if (typeof id !== 'string' || !id.endsWith('@g.us')) return
      let known = knownGroups.get(accountId)
      if (!known) {
        known = new Map()
        knownGroups.set(accountId, known)
      }
      const prev = known.get(id)
      known.set(id, { name: name || prev?.name || '', last_seen: Date.now() })
      if (known.size > 500) {
        const oldest = [...known.entries()].sort((a, b) => a[1].last_seen - b[1].last_seen)[0]
        known.delete(oldest[0])
      }
    }
    sock.ev.on('messaging-history.set', ({ chats }: any) => {
      console.log(`[wa-debug] history-set: ${chats?.length || 0} chats`)
      for (const c of chats || []) learn(c.id, c.name)
    })
    sock.ev.on('messages.upsert', ({ messages, type }: any) => {
      // ponytail: log only JIDs + direction, never message content
      for (const m of messages || []) {
        console.log(`[wa-debug] upsert type=${type} fromMe=${m.key?.fromMe} remoteJid=${m.key?.remoteJid}`)
        learn(m.key?.remoteJid)
      }
    })
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrCache.set(accountId, qr)
    }

    if (connection === 'open') {
      qrCache.del(accountId)
      reconnectAttempts.delete(accountId)
    }

    if (connection === 'close') {
      connections.delete(accountId)
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      if (statusCode === DisconnectReason.loggedOut) {
        sessionManager.deleteSession(accountId)
        reconnectAttempts.delete(accountId)
      } else {
        // ponytail: exponential backoff, not a fixed 5s storm
        const n = (reconnectAttempts.get(accountId) || 0) + 1
        reconnectAttempts.set(accountId, n)
        const delay = Math.min(300000, 5000 * 2 ** Math.min(n, 6))
        console.log(`[wa] reconnect ${accountId} attempt ${n} in ${delay}ms`)
        setTimeout(() => {
          if (!connections.has(accountId)) {
            connectAccount(accountId, phoneNumber, method).catch(() => {})
          }
        }, delay)
      }
    }
  })

  return sock
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/connect', async (req, res) => {
  const { accountId, phoneNumber, method } = req.body
  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' })
  }
  try {
    assertAccountId(accountId)
  } catch {
    return res.status(400).json({ error: 'invalid account id' })
  }

  if (connections.has(accountId) || connectingNow.has(accountId)) {
    return res.status(409).json({ error: 'Account already connected' })
  }
  connectingNow.add(accountId)

  if (method === 'pairing' || method === 'pairing-code') {
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber required for pairing' })
    }
    const normalized = normalizePhone(phoneNumber)
    if (!validateE164(normalized)) {
      return res.status(400).json({ error: 'Invalid phone number. Must be E.164 format: +{country}{number}' })
    }
  }

  try {
    const sock = await connectAccount(accountId, phoneNumber, method)

    if ((method === 'pairing' || method === 'pairing-code') && phoneNumber) {
      const normalized = normalizePhone(phoneNumber)
      const code = await withTimeout(sock.requestPairingCode(normalized), 30000)
      pairingCache.set(accountId, code)
      return res.json({ status: 'pairing', code })
    }

    res.json({ status: 'connecting' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  } finally {
    connectingNow.delete(accountId)
  }
})

app.get('/qr/:accountId', (req, res) => {
  try {
    assertAccountId(req.params.accountId)
  } catch {
    return res.status(400).json({ error: 'invalid account id' })
  }
  const qr = qrCache.get<string>(req.params.accountId)
  if (!qr) {
    return res.status(404).json({ error: 'QR not available' })
  }
  res.json({ qr })
})

app.get('/pairing-code/:accountId', (req, res) => {
  try {
    assertAccountId(req.params.accountId)
  } catch {
    return res.status(400).json({ error: 'invalid account id' })
  }
  const code = pairingCache.get<string>(req.params.accountId)
  if (!code) {
    return res.status(404).json({ error: 'Code not available' })
  }
  res.json({ code })
})

app.get('/status/:accountId', (req, res) => {
  try {
    assertAccountId(req.params.accountId)
  } catch {
    return res.status(400).json({ error: 'invalid account id' })
  }
  const sock = connections.get(req.params.accountId)
  if (!sock) {
    return res.json({ status: 'disconnected' })
  }
  res.json({
    status: 'connected',
    phone: sock.user?.id?.split(':')[0],
    jid: sock.user?.id
  })
})

app.post('/disconnect/:accountId', (req, res) => {
  try {
    assertAccountId(req.params.accountId)
  } catch {
    return res.status(400).json({ error: 'invalid account id' })
  }
  const sock = connections.get(req.params.accountId)
  if (sock) {
    sock.end(undefined)
    connections.delete(req.params.accountId)
  }
  sessionManager.deleteSession(req.params.accountId)
  qrCache.del(req.params.accountId)
  pairingCache.del(req.params.accountId)
  knownGroups.delete(req.params.accountId)
  res.json({ removed: true })
})

// Groups learned from history sync + live messages (fallback when groupFetchAllParticipating fails)
app.get('/known-groups/:accountId', (req, res) => {
  try {
    assertAccountId(req.params.accountId)
  } catch {
    return res.status(400).json({ error: 'invalid account id' })
  }
  const known = knownGroups.get(req.params.accountId)
  if (!known) {
    return res.json({ groups: [], note: 'no sync data yet, wait for history sync or incoming messages' })
  }
  res.json({
    groups: [...known.entries()].map(([group_id, v]) => ({ group_id, name: v.name })),
  })
})

app.get('/my-groups/:accountId', async (req, res) => {  const sock = connections.get(req.params.accountId)
  try {
    assertAccountId(req.params.accountId)
  } catch {
    return res.status(400).json({ error: 'invalid account id' })
  }
  if (!sock) {
    return res.status(400).json({ error: 'Account not connected' })
  }
  try {
    // ponytail: 180s — first call after reconnect can be very slow, don't falsely report failure
    const participating = await withTimeout(sock.groupFetchAllParticipating(), 180000)
    const groups = Object.entries(participating).map(([id, g]: [string, any]) => ({
      group_id: id,
      name: g.subject || '',
      members_count: g.participants?.length || 0,
    }))
    res.json({ groups })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/parse-groups', async (req, res) => {
  const { accountId, groupLinks, groupIds, leave } = req.body
  // ponytail: leave=false when parsing own groups — never kick the user out of their groups
  const shouldLeave = leave !== false
  try {
    assertAccountId(accountId)
  } catch {
    return res.status(400).json({ error: 'invalid account id' })
  }
  if (!accountId || (!groupLinks && !groupIds)) {
    return res.status(400).json({ error: 'accountId and groupLinks/groupIds required' })
  }

  const sock = connections.get(accountId)
  if (!sock) {
    return res.status(400).json({ error: 'Account not connected' })
  }

  const links: string[] = (groupLinks || []).slice(0, MAX_GROUPS_PER_CALL)
  const ids: string[] = (groupIds || []).slice(0, MAX_GROUPS_PER_CALL)
  if ((groupLinks || []).length > MAX_GROUPS_PER_CALL || (groupIds || []).length > MAX_GROUPS_PER_CALL) {
    return res.status(400).json({ error: `Max ${MAX_GROUPS_PER_CALL} groups per call` })
  }

  const members: { phone?: string; name?: string; wa_id: string; group_id: string }[] = []
  const groups: { group_id: string; name: string; members_count: number; reachable_count: number }[] = []
  const errors: { target?: string; link?: string; error: string }[] = []

  const collect = (groupId: string, groupName: string, parts: any[]) => {
    let phones = 0
    for (const p of parts) {
      // LID participants (@lid) hide the real number — can't message them, skip
      if (typeof p.id === 'string' && p.id.endsWith('@s.whatsapp.net')) {
        const digits = p.id.split('@')[0]
        members.push({ phone: '+' + digits, wa_id: p.id, group_id: groupId })
        phones++
      }
    }
    groups.push({ group_id: groupId, name: groupName, members_count: parts.length, reachable_count: phones })
    return phones
  }

  try {
    // Already-joined groups: pure read, no join/leave — safest path
    for (const groupId of ids) {
      try {
        const metadata = await withTimeout(sock.groupMetadata(groupId), 30000)
        collect(groupId, (metadata as any).subject || '', (metadata as any).participants || [])
      } catch (err: any) {
        errors.push({ target: groupId, error: err.message })
      }
      if (ids.indexOf(groupId) < ids.length - 1 || links.length > 0) {
        await sleep(15000 + Math.random() * 30000)
      }
    }

    // Invite links: join -> read -> leave. Higher ban risk, use sparingly.
    for (const link of links) {
      try {
        const inviteMatch = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)
        if (!inviteMatch) {
          errors.push({ link, error: 'Invalid group link' })
          continue
        }

        const inviteCode = inviteMatch[1]

        const groupInfo = await withTimeout(sock.groupGetInviteInfo(inviteCode), 30000)
        if (!groupInfo) {
          errors.push({ link, error: 'Group not found' })
          continue
        }

        const groupId = await withTimeout(sock.groupAcceptInvite(inviteCode), 30000)
        if (!groupId) {
          errors.push({ link, error: 'Failed to join group' })
          continue
        }

        const metadata = await withTimeout(sock.groupMetadata(groupId), 30000)
        collect(groupId, (metadata as any).subject || (groupInfo as any).subject || '', (metadata as any).participants || [])

        // ponytail: leave after extracting, but the pause BEFORE next group is what matters
        if (shouldLeave) {
          try {
            await withTimeout(sock.groupLeave(groupId), 30000)
          } catch (e) {
            console.log(`Failed to leave group ${groupId}:`, e)
          }
        }
      } catch (err: any) {
        errors.push({ target: link, error: err.message })
      }
      if (links.indexOf(link) < links.length - 1) {
        await sleep(15000 + Math.random() * 30000)
      }
    }

    res.json({ members, groups, errors })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/check-whatsapp', async (req, res) => {
  const { accountId, numbers } = req.body
  if (!accountId || !numbers) {
    return res.status(400).json({ error: 'accountId and numbers required' })
  }
  if (!Array.isArray(numbers) || numbers.length > MAX_NUMBERS_PER_CALL) {
    return res.status(400).json({ error: `Max ${MAX_NUMBERS_PER_CALL} numbers per call` })
  }

  const sock = connections.get(accountId)
  if (!sock) {
    return res.status(400).json({ error: 'Account not connected' })
  }

  // Validate all numbers first
  for (const num of numbers) {
    const normalized = normalizePhone(num)
    if (!validateE164(normalized)) {
      return res.status(400).json({ error: `Invalid phone number: ${num}. Must be E.164 format` })
    }
  }

  try {
    // ponytail: sequential batches of 10, not Promise.all over thousands —
    // one flood of concurrent WA queries looks exactly like abuse.
    const results: { phone: string; exists: boolean }[] = []
    for (let i = 0; i < numbers.length; i += 10) {
      const batch = numbers.slice(i, i + 10)
      const out = await Promise.all(
        batch.map(async (phone: string) => {
          try {
            const normalized = normalizePhone(phone)
            const jid = normalized.substring(1) + '@s.whatsapp.net'
            const r = await withTimeout(sock.onWhatsApp(jid), 30000)
            const result = r?.[0]
            return { phone, exists: result?.exists ?? false }
          } catch {
            return { phone, exists: false }
          }
        })
      )
      results.push(...out)
      if (i + 10 < numbers.length) {
        await sleep(2000 + Math.random() * 3000)
      }
    }
    res.json({ results })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

const PORT = process.env.PORT || 3100

// ponytail: importable without side effects (tests import helpers;
// only listen when executed directly, not when imported)
import { pathToFileURL } from 'node:url'
const isMain = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1] ?? '').href
  } catch {
    return false
  }
})()
if (isMain) {
  app.listen(PORT, () => {
    console.log(`wa-sidecar listening on port ${PORT}`)
  })
}

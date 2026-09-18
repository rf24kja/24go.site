import express from 'express'
import cors from 'cors'
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import NodeCache from 'node-cache'
import { sessionManager } from './auth'

const app = express()
app.use(cors())
app.use(express.json())

const logger = pino({ level: 'silent' })

const qrCache = new NodeCache({ stdTTL: 20 })
const connections = new Map<string, WASocket>()

function validateE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone)
}

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

async function connectAccount(accountId: string, phoneNumber?: string, method?: string) {
  let session = await sessionManager.getSession(accountId)
  if (!session) {
    session = await sessionManager.createSession(accountId)
  }

  const sock = makeWASocket({
    auth: {
      creds: session.state.creds,
      keys: makeCacheableSignalKeyStore(session.state.keys, logger)
    },
    printQRInTerminal: false,
    logger
  })

  connections.set(accountId, sock)

  sock.ev.on('creds.update', session.saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrCache.set(accountId, qr)
    }

    if (connection === 'open') {
      qrCache.del(accountId)
    }

    if (connection === 'close') {
      connections.delete(accountId)
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      if (statusCode === DisconnectReason.loggedOut) {
        sessionManager.deleteSession(accountId)
      } else {
        // ponytail: basic reconnect, add exponential backoff if needed
        setTimeout(() => {
          if (!connections.has(accountId)) {
            connectAccount(accountId, phoneNumber, method).catch(() => {})
          }
        }, 5000)
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

  if (connections.has(accountId)) {
    return res.status(409).json({ error: 'Account already connected' })
  }

  if (method === 'pairing' && phoneNumber) {
    const normalized = normalizePhone(phoneNumber)
    if (!validateE164(normalized)) {
      return res.status(400).json({ error: 'Invalid phone number. Must be E.164 format: +{country}{number}' })
    }
  }

  try {
    const sock = await connectAccount(accountId, phoneNumber, method)

    if (method === 'pairing' && phoneNumber) {
      const normalized = normalizePhone(phoneNumber)
      const code = await withTimeout(sock.requestPairingCode(normalized), 30000)
      return res.json({ status: 'pairing', code })
    }

    res.json({ status: 'connecting' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/qr/:accountId', (req, res) => {
  const qr = qrCache.get<string>(req.params.accountId)
  if (!qr) {
    return res.status(404).json({ error: 'QR not available' })
  }
  res.json({ qr })
})

app.get('/pairing-code/:accountId', (req, res) => {
  const sock = connections.get(req.params.accountId)
  if (!sock) {
    return res.status(404).json({ error: 'Session not found' })
  }
  res.json({ status: 'pending' })
})

app.get('/status/:accountId', (req, res) => {
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
  const sock = connections.get(req.params.accountId)
  if (sock) {
    sock.end(undefined)
    connections.delete(req.params.accountId)
  }
  sessionManager.deleteSession(req.params.accountId)
  qrCache.del(req.params.accountId)
  res.json({ removed: true })
})

app.post('/parse-groups', async (req, res) => {
  const { accountId, groupLinks } = req.body
  if (!accountId || !groupLinks) {
    return res.status(400).json({ error: 'accountId and groupLinks required' })
  }

  const sock = connections.get(accountId)
  if (!sock) {
    return res.status(400).json({ error: 'Account not connected' })
  }

  try {
    const results: { link: string; participants: string[]; error?: string }[] = []

    for (const link of groupLinks) {
      try {
        const inviteMatch = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)
        if (!inviteMatch) {
          results.push({ link, participants: [], error: 'Invalid group link' })
          continue
        }

        const inviteCode = inviteMatch[1]

        const groupInfo = await withTimeout(sock.groupGetInviteInfo(inviteCode), 30000)
        if (!groupInfo) {
          results.push({ link, participants: [], error: 'Group not found' })
          continue
        }

        const groupId = await withTimeout(sock.groupAcceptInvite(inviteCode), 30000)
        if (!groupId) {
          results.push({ link, participants: [], error: 'Failed to join group' })
          continue
        }

        const metadata = await withTimeout(sock.groupMetadata(groupId), 30000)
        const participants = metadata.participants.map(p => p.id.split('@')[0])

        // ponytail: leave group after extracting participants
        try {
          await withTimeout(sock.groupLeave(groupId), 30000)
        } catch (e) {
          console.log(`Failed to leave group ${groupId}:`, e)
        }

        results.push({ link, participants })
      } catch (err: any) {
        results.push({ link, participants: [], error: err.message })
      }
    }

    res.json({ results })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/check-whatsapp', async (req, res) => {
  const { accountId, numbers } = req.body
  if (!accountId || !numbers) {
    return res.status(400).json({ error: 'accountId and numbers required' })
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
    const results = await Promise.all(
      numbers.map(async (phone: string) => {
        try {
          const normalized = normalizePhone(phone)
          const jid = normalized.substring(1) + '@s.whatsapp.net'
          const results = await withTimeout(sock.onWhatsApp(jid), 30000)
          const result = results?.[0]
          return { phone, exists: result?.exists ?? false }
        } catch {
          return { phone, exists: false }
        }
      })
    )
    res.json({ results })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

const PORT = process.env.PORT || 3100

app.listen(PORT, () => {
  console.log(`wa-sidecar listening on port ${PORT}`)
})

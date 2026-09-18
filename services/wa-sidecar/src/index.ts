import express from 'express'
import cors from 'cors'
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  makeCacheableSignalKeyStore,
  delay
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { toBuffer } from 'qrcode'
import pino from 'pino'
import NodeCache from 'node-cache'
import { sessionManager } from './auth'

const app = express()
app.use(cors())
app.use(express.json())

const logger = pino({ level: 'silent' })

// In-memory QR storage (no localStorage per spec)
const qrCache = new NodeCache({ stdTTL: 20 }) // 20s expiry

// Connection states per account
const connections = new Map<string, WASocket>()

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Connect account
app.post('/connect', async (req, res) => {
  const { accountId, phoneNumber, method } = req.body
  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' })
  }

  // Check if already connected
  if (connections.has(accountId)) {
    return res.status(409).json({ error: 'Account already connected' })
  }

  try {
    // Get or create session
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

    // Handle credentials update
    sock.ev.on('creds.update', session.saveCreds)

    // Handle connection updates
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        qrCache.set(accountId, qr)
      }

      if (connection === 'open') {
        qrCache.del(accountId) // Clear QR on successful connection
      }

      if (connection === 'close') {
        connections.delete(accountId)
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
        if (statusCode === DisconnectReason.loggedOut) {
          sessionManager.deleteSession(accountId)
        }
      }
    })

    // For pairing code method, request pairing code
    if (method === 'pairing' && phoneNumber) {
      const code = await sock.requestPairingCode(phoneNumber)
      return res.json({ status: 'pairing', code })
    }

    // For QR or existing session, return status
    res.json({ status: 'connecting' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get QR code
app.get('/qr/:accountId', (req, res) => {
  const qr = qrCache.get<string>(req.params.accountId)
  if (!qr) {
    return res.status(404).json({ error: 'QR not available' })
  }
  res.json({ qr })
})

// Get pairing code
app.get('/pairing-code/:accountId', (req, res) => {
  // Pairing code is returned in /connect response
  // This endpoint is for polling if needed
  const sock = connections.get(req.params.accountId)
  if (!sock) {
    return res.status(404).json({ error: 'Session not found' })
  }
  res.json({ status: 'pending' })
})

// Get connection status
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

// Disconnect
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

// Parse group participants
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
        // Extract invite code from link
        const inviteMatch = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)
        if (!inviteMatch) {
          results.push({ link, participants: [], error: 'Invalid group link' })
          continue
        }

        const inviteCode = inviteMatch[1]

        // Get group info without joining
        const groupInfo = await sock.groupGetInviteInfo(inviteCode)
        if (!groupInfo) {
          results.push({ link, participants: [], error: 'Group not found' })
          continue
        }

        // Join the group
        const groupId = await sock.groupAcceptInvite(inviteCode)
        if (!groupId) {
          results.push({ link, participants: [], error: 'Failed to join group' })
          continue
        }

        // Get participants from metadata
        const metadata = await sock.groupMetadata(groupId)
        const participants = metadata.participants.map(p => p.id.split('@')[0])

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

// Check if numbers are on WhatsApp
app.post('/check-whatsapp', async (req, res) => {
  const { accountId, numbers } = req.body
  if (!accountId || !numbers) {
    return res.status(400).json({ error: 'accountId and numbers required' })
  }

  const sock = connections.get(accountId)
  if (!sock) {
    return res.status(400).json({ error: 'Account not connected' })
  }

  try {
    const results = await Promise.all(
      numbers.map(async (phone: string) => {
        try {
          const result = await sock.onWhatsApp(phone)
          if (result && result[0]) {
            return { phone, exists: result[0].exists }
          }
          return { phone, exists: false }
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
import { useMultiFileAuthState, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys'
import path from 'path'
import fs from 'fs'

const SESSIONS_DIR = process.env.WA_SESSION_DIR || process.env.SESSIONS_DIR || '/data/wa/sessions'

export class SessionManager {
  private sessions: Map<string, any> = new Map()

  async getSession(accountId: string) {
    if (this.sessions.has(accountId)) {
      return this.sessions.get(accountId)
    }

    const sessionDir = path.join(SESSIONS_DIR, accountId)
    if (!fs.existsSync(sessionDir)) {
      return null
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    this.sessions.set(accountId, { state, saveCreds })
    return { state, saveCreds }
  }

  async createSession(accountId: string) {
    const sessionDir = path.join(SESSIONS_DIR, accountId)
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    this.sessions.set(accountId, { state, saveCreds })
    return { state, saveCreds }
  }

  deleteSession(accountId: string) {
    const sessionDir = path.join(SESSIONS_DIR, accountId)
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true })
    }
    this.sessions.delete(accountId)
  }

  hasSession(accountId: string): boolean {
    return this.sessions.has(accountId)
  }
}

export const sessionManager = new SessionManager()
import crypto from 'node:crypto'
import type { WASocket } from '@whiskeysockets/baileys'
interface Input { accountId: string; tenantId: string; recipient: string; text: string; confirmed: boolean }
interface Result { status: 'accepted' | 'failed' | 'unknown'; code: string; message_id?: string }
// A timeout is quarantined for this process: no automatic retry of an uncertain send.
export function createTextSender(connections: Map<string, WASocket>, connected: Set<string>, timeoutMs = 12000, cooldownMs = 30000) {
  const owners = new Map<string, string>()
  const blocked = new Set<string>()
  const nextAt = new Map<string, number>()
  return async (body: Input): Promise<Result> => {
    const fail = (code: string): Result => ({ status: 'failed', code })
    if (!body || typeof body.accountId !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(body.accountId) ||
        typeof body.tenantId !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(body.tenantId) ||
        typeof body.recipient !== 'string' || !/^\+[1-9]\d{7,14}$/.test(body.recipient) ||
        typeof body.text !== 'string' || !body.text.trim() || body.text.length > 2000 || body.confirmed !== true) return fail('invalid_input')
    const { accountId, tenantId } = body
    if (owners.has(accountId) && owners.get(accountId) !== tenantId) return fail('account_binding')
    const sock = connections.get(accountId)
    if (!sock?.user || !connected.has(accountId)) return fail('disconnected')
    if (blocked.has(accountId) || Date.now() < (nextAt.get(accountId) || 0)) return fail('send_locked')
    owners.set(accountId, tenantId)
    blocked.add(accountId)
    nextAt.set(accountId, Date.now() + cooldownMs)
    const id = crypto.randomBytes(16).toString('hex').toUpperCase()
    const jid = body.recipient.slice(1) + '@s.whatsapp.net'
    let timer: ReturnType<typeof setTimeout>
    let handler: (updates: any[]) => void
    let ackHandler: (node: any) => void
    const result = await new Promise<Result>(resolve => {
      const finish = (value: Result) => resolve(value)
      handler = updates => {
        for (const row of updates) {
          if (row.key?.id !== id || row.key?.remoteJid !== jid || row.key?.fromMe !== true) continue
          if (row.update?.status === 0) finish(fail('provider_rejected'))
          else if (Number.isInteger(row.update?.status) && row.update.status >= 2 && row.update.status <= 5)
            finish({ status: 'accepted', code: 'server_ack_not_delivery', message_id: id })
        }
      }
      ackHandler = node => {
        if (node?.tag !== 'ack' || node.attrs?.class !== 'message' || node.attrs?.id !== id || node.attrs?.from !== jid) return
        finish(node.attrs.error ? fail('provider_rejected') : { status: 'accepted', code: 'server_ack_not_delivery', message_id: id })
      }
      sock.ws?.on('CB:ack,class:message', ackHandler)
      sock.ev.on('messages.update', handler)
      timer = setTimeout(() => finish({ status: 'unknown', code: 'ack_timeout_do_not_retry' }), timeoutMs)
      // Do not parse SDK exceptions: their text can contain private provider/session data.
      Promise.resolve().then(() => sock.sendMessage(jid, { text: body.text, linkPreview: null }, { messageId: id }))
        .catch(() => finish({ status: 'unknown', code: 'transport_error_do_not_retry' }))
    })
    clearTimeout(timer!)
    sock.ev.off('messages.update', handler!)
    sock.ws?.off('CB:ack,class:message', ackHandler!)
    if (result.status !== 'unknown') blocked.delete(accountId)
    return result
  }
}

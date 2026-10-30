import fs from 'node:fs'
import path from 'node:path'

interface Intent { tenantId: string; messageId: string }
interface Last { tenantId: string; nextAt: number }

// An unresolved intent survives restarts; only its correlated terminal result removes it.
export function createSendState(directory: string) {
  function syncDirectory(target = directory) {
    const fd = fs.openSync(target, 'r')
    try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  }
  function writeExclusive(file: string, value: object) {
    const fd = fs.openSync(file, 'wx', 0o600)
    try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  }
  function last(accountId: string): Last | undefined {
    let value: Last
    try { value = JSON.parse(fs.readFileSync(path.join(directory, accountId + '.last.json'), 'utf8')) }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error }
    if (typeof value.tenantId !== 'string' || !Number.isFinite(value.nextAt) || value.nextAt < 0) throw Error('Invalid send state')
    return value
  }
  function check(accountId: string, tenantId: string): string | undefined {
    const previous = last(accountId)
    if (previous && previous.tenantId !== tenantId) return 'account_binding'
    if (previous && previous.nextAt > Date.now()) return 'send_locked'
  }
  return {
    acquire(accountId: string, tenantId: string, messageId: string): string | undefined {
      try {
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
        syncDirectory(path.dirname(directory))
        const denied = check(accountId, tenantId)
        if (denied) return denied
        const file = path.join(directory, accountId + '.intent')
        try { writeExclusive(file, { tenantId, messageId }) }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
          try {
            const pending: Intent = JSON.parse(fs.readFileSync(file, 'utf8'))
            if (typeof pending.tenantId === 'string' && pending.tenantId !== tenantId) return 'account_binding'
          } catch { /* A malformed existing intent must remain quarantined. */ }
          return 'send_locked'
        }
        syncDirectory()
        const raced = check(accountId, tenantId)
        if (raced) { fs.unlinkSync(file); syncDirectory(); return raced }
      } catch { return 'send_state_unavailable' }
    },
    complete(accountId: string, tenantId: string, messageId: string, nextAt: number): boolean {
      const intent = path.join(directory, accountId + '.intent')
      const temporary = path.join(directory, accountId + '.' + messageId + '.tmp')
      try {
        const pending: Intent = JSON.parse(fs.readFileSync(intent, 'utf8'))
        if (pending.tenantId !== tenantId || pending.messageId !== messageId) return false
        writeExclusive(temporary, { tenantId, nextAt })
        fs.renameSync(temporary, path.join(directory, accountId + '.last.json'))
        syncDirectory()
        fs.unlinkSync(intent)
        // Lost unlink can restore quarantine after a crash; the terminal record
        // is already durable before another sender can enter.
        return true
      } catch { return false }
    }
  }
}

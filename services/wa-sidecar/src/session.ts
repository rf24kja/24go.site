import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { toBuffer } from "qrcode";
import path from "path";
import fs from "fs";
import pino from "pino";

const SESSION_DIR = process.env.WA_SESSION_DIR || "/data/wa/sessions";

interface Session {
  sock: WASocket;
  qr: string | null;
  status: "connected" | "disconnected" | "qr_pending";
  phone: string;
  jid: string;
  reconnectAttempts: number;
}

const sessions = new Map<string, Session>();
const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_DELAY_MS = 3000;

export async function createSession(accountId: string): Promise<Session> {
  const sessionDir = path.join(SESSION_DIR, accountId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  let qrBuffer: Buffer | null = null;
  let resolveQr: ((buf: Buffer) => void) | null = null;

  const silentLogger = pino({ level: "silent" });

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
    },
    printQRInTerminal: false,
    logger: silentLogger,
  });

  const session: Session = {
    sock,
    qr: null,
    status: "disconnected",
    phone: "",
    jid: "",
    reconnectAttempts: 0,
  };

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      session.qr = qr;
      session.status = "qr_pending";

      toBuffer(qr).then((buf: Buffer) => {
        qrBuffer = buf;
        if (resolveQr) {
          resolveQr(buf);
          resolveQr = null;
        }
      });
    }

    if (connection === "open") {
      session.status = "connected";
      session.qr = null;
      const me = sock.user;
      if (me) {
        session.jid = me.id;
        session.phone = me.id.split(":")[0];
      }
    }

    if (connection === "close") {
      session.status = "disconnected";
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      if (
        statusCode !== DisconnectReason.loggedOut &&
        session.reconnectAttempts < MAX_RECONNECT_ATTEMPTS
      ) {
        session.reconnectAttempts++;
        const delay = BASE_DELAY_MS * Math.pow(2, session.reconnectAttempts - 1);
        setTimeout(() => createSession(accountId), delay);
      }
    }
  });

  sessions.set(accountId, session);

  // Wait up to 30s for QR
  if (!qrBuffer) {
    const qrPromise = new Promise<Buffer>((resolve) => {
      resolveQr = resolve;
      setTimeout(() => {
        if (resolveQr) {
          resolveQr(Buffer.alloc(0)); // Empty buffer on timeout
          resolveQr = null;
        }
      }, 30000);
    });
    qrBuffer = await qrPromise;
  }

  session.qr = qrBuffer && qrBuffer.length > 0
    ? `data:image/png;base64,${qrBuffer.toString("base64")}`
    : null;

  return session;
}

export function getSession(accountId: string): Session | undefined {
  return sessions.get(accountId);
}

export function removeSession(accountId: string): boolean {
  const session = sessions.get(accountId);
  if (session) {
    session.sock.end(undefined);
    sessions.delete(accountId);

    const sessionDir = path.join(SESSION_DIR, accountId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    return true;
  }
  return false;
}

export async function getGroupParticipants(
  accountId: string,
  groupLink: string
): Promise<string[]> {
  const session = sessions.get(accountId);
  if (!session || session.status !== "connected") {
    throw new Error("Session not connected");
  }

  // Extract group invite code from link
  const inviteMatch = groupLink.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
  if (!inviteMatch) {
    throw new Error("Invalid group link");
  }

  const inviteCode = inviteMatch[1];

  // Join the group
  const groupId = await session.sock.groupAcceptInvite(inviteCode);
  if (!groupId) {
    throw new Error("Failed to join group");
  }

  // Wait for group metadata to become available (up to 10s)
  let metadata;
  for (let i = 0; i < 10; i++) {
    try {
      metadata = await session.sock.groupMetadata(groupId);
      if (metadata) break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!metadata) {
    throw new Error("Timed out waiting for group metadata");
  }
  const participants = metadata.participants.map((p) => {
    // Extract phone number from JID
    const phone = p.id.split("@")[0];
    return phone;
  });

  return participants;
}

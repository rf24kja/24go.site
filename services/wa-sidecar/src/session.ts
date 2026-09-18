import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { toBuffer } from "qrcode";
import path from "path";

const SESSION_DIR = process.env.WA_SESSION_DIR || "/data/wa/sessions";

interface Session {
  sock: WASocket;
  qr: string | null;
  status: "connected" | "disconnected" | "qr_pending";
  phone: string;
  jid: string;
}

const sessions = new Map<string, Session>();

export async function createSession(accountId: string): Promise<Session> {
  const sessionDir = path.join(SESSION_DIR, accountId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  let qrBuffer: Buffer | null = null;
  let resolveQr: ((buf: Buffer) => void) | null = null;

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, undefined as any),
    },
    printQRInTerminal: false,
    logger: undefined as any,
  });

  const session: Session = {
    sock,
    qr: null,
    status: "disconnected",
    phone: "",
    jid: "",
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
      if (statusCode !== DisconnectReason.loggedOut) {
        // Reconnect on non-logout
        createSession(accountId);
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

  // Wait a moment for group metadata to sync
  await new Promise((r) => setTimeout(r, 2000));

  // Get group metadata
  const metadata = await session.sock.groupMetadata(groupId);
  const participants = metadata.participants.map((p) => {
    // Extract phone number from JID
    const phone = p.id.split("@")[0];
    return phone;
  });

  return participants;
}

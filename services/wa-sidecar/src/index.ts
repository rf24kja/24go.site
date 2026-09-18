import express from "express";
import cors from "cors";
import {
  createSession,
  getSession,
  removeSession,
  getGroupParticipants,
} from "./session";

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Initiate QR connection
app.post("/connect", async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) {
    return res.status(400).json({ error: "accountId required" });
  }

  try {
    const session = await createSession(accountId);
    res.json({
      status: session.status,
      qr: session.qr,
      phone: session.phone,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Poll QR code
app.get("/qr/:accountId", (req, res) => {
  const session = getSession(req.params.accountId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json({ qr: session.qr, status: session.status });
});

// Get connection status
app.get("/status/:accountId", (req, res) => {
  const session = getSession(req.params.accountId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json({
    status: session.status,
    phone: session.phone,
    jid: session.jid,
  });
});

// Disconnect
app.post("/disconnect/:accountId", (req, res) => {
  const removed = removeSession(req.params.accountId);
  res.json({ removed });
});

// Parse group participants
app.post("/parse-groups", async (req, res) => {
  const { accountId, groupLinks } = req.body;
  if (!accountId || !groupLinks) {
    return res.status(400).json({ error: "accountId and groupLinks required" });
  }

  try {
    const results: { link: string; participants: string[]; error?: string }[] =
      [];

    for (const link of groupLinks) {
      try {
        const participants = await getGroupParticipants(accountId, link);
        results.push({ link, participants });
      } catch (err: any) {
        results.push({ link, participants: [], error: err.message });
      }
    }

    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3100;

app.listen(PORT, () => {
  console.log(`wa-sidecar listening on port ${PORT}`);
});

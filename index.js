// backend/index.js
import express from "express";
import makeWASocket, { useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import P from "pino";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

let sessions = {};

app.post("/pair", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number required" });

    const { state, saveCreds } = await useMultiFileAuthState(`./auth_info/${phone}`);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: P({ level: "silent" }),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
      },
      printQRInTerminal: false,
      mobile: true, // Pair code instead of QR
    });

    sock.ev.on("creds.update", saveCreds);

    let code = await sock.requestPairingCode(phone);
    sessions[phone] = { sock, code };

    return res.json({ status: "success", code });
  } catch (err) {
    console.error("Pair error:", err);
    res.status(500).json({ error: "Failed to generate code" });
  }
});

// Bot Menu (example buttons)
app.post("/menu", (req, res) => {
  const { phone } = req.body;
  if (!sessions[phone]) return res.status(400).json({ error: "Session not found" });

  let sock = sessions[phone].sock;

  sock.sendMessage(`${phone}@s.whatsapp.net`, {
    text: "🔥 Xcorex MD Main Menu 🔥",
    footer: "Choose an option:",
    buttons: [
      { buttonId: "help", buttonText: { displayText: "📖 Help" }, type: 1 },
      { buttonId: "bugmenu", buttonText: { displayText: "🐞 Bug Menu" }, type: 1 },
      { buttonId: "owner", buttonText: { displayText: "👑 Owner" }, type: 1 }
    ],
    headerType: 1,
  });

  return res.json({ status: "menu sent" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Backend running on port " + PORT));

import express from "express";
import bodyParser from "body-parser";
import makeWASocket, { 
  useMultiFileAuthState, 
  makeCacheableSignalKeyStore 
} from "@whiskeysockets/baileys";
import { randomBytes } from "crypto";
import fs from "fs";

const app = express();
app.use(bodyParser.json());

let sessions = {}; // store active sessions

// Route: Generate Pair Code
app.post("/api/pair-code", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone number required" });

  try {
    // Ensure auth folder exists
    if (!fs.existsSync("./auth")) fs.mkdirSync("./auth");

    const { state, saveCreds } = await useMultiFileAuthState(`./auth/${phone}`);

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, undefined),
      },
      printQRInTerminal: false,
    });

    // Baileys method to generate pairing code
    const code = await sock.requestPairingCode(phone);
    console.log(`Pair code for ${phone}: ${code}`);
    res.json({ code });

    // When connected, generate session ID + send welcome msg
    sock.ev.on("connection.update", (update) => {
      const { connection } = update;
      if (connection === "open") {
        const sessionId = "sess_" + randomBytes(6).toString("hex");
        sessions[phone] = sessionId;

        sock.sendMessage(phone + "@s.whatsapp.net", {
          text: `Xcorex MD - ${sessionId}`,
        });
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Route: Get session by phone
app.get("/api/session/:phone", (req, res) => {
  const phone = req.params.phone;
  if (sessions[phone]) {
    res.json({ sessionId: sessions[phone] });
  } else {
    res.json({ error: "No active session for this number" });
  }
});

// Start server
app.listen(3001, () => console.log("✅ Backend running at http://localhost:3001"));

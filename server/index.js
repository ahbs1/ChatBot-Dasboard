/**
 * WHATSAGENT WORKER + API (Production Ready)
 * 
 * Setup on Linux Server:
 * 1. Upload this file (index.js) and package.json to a folder.
 * 2. Run `npm install`
 * 3. Create a .env file with your credentials.
 * 4. Run `npm start` (or use PM2: `pm2 start index.js --name wa-worker`)
 */

import 'dotenv/config';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import qrcodeTerminal from 'qrcode-terminal';
import express from 'express';
import QRCode from 'qrcode'; // For generating Base64 QR for API

// --- ROBUST BAILEYS IMPORT & POLYFILLS ---
const require = createRequire(import.meta.url);

// [FIX] Polyfill global 'crypto' for Node.js environments (STB/Node 18)
const nodeCrypto = require('crypto');
if (!global.crypto) {
    // Prefer webcrypto (Node 15+) as Baileys expects standard Web API behavior
    // Fallback to standard nodeCrypto if webcrypto is missing
    global.crypto = nodeCrypto.webcrypto || nodeCrypto;
}

const BaileysRaw = require('@whiskeysockets/baileys');

// 1. Extract makeWASocket
let makeWASocket = BaileysRaw.default || BaileysRaw;
if (makeWASocket && makeWASocket.default) {
    makeWASocket = makeWASocket.default;
}

// 2. Extract Named Exports
let useMultiFileAuthState = BaileysRaw.useMultiFileAuthState || (BaileysRaw.default && BaileysRaw.default.useMultiFileAuthState);
let DisconnectReason = BaileysRaw.DisconnectReason || (BaileysRaw.default && BaileysRaw.default.DisconnectReason);
let fetchLatestBaileysVersion = BaileysRaw.fetchLatestBaileysVersion || (BaileysRaw.default && BaileysRaw.default.fetchLatestBaileysVersion);

if (typeof makeWASocket !== 'function' || typeof useMultiFileAuthState !== 'function') {
    console.error("❌ CRITICAL ERROR: Failed to load Baileys functions. Check node_modules.");
    process.exit(1);
}

// --- CONFIG ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CONFIDENCE_THRESHOLD = 0.65;
const PORT = process.env.PORT || 3000;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
    console.error("❌ MISSING ENV VARS. Check .env file.");
    process.exit(1);
}

// Clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const app = express();
app.use(express.json());

// Session Store (InMemory for active sockets & QR Cache)
const sessions = {}; 
const qrCache = {}; // Cache QR codes for API response

/**
 * 1. AI Logic: RAG + Gemini Generation
 */
async function generateAIReply(userText, deviceId) {
    try {
        console.log(`[AI] Processing: "${userText}" for ${deviceId}`);
        
        const embedResult = await ai.models.embedContent({
            model: "text-embedding-004",
            content: userText
        });
        const embedding = embedResult.embedding.values;

        const { data: docs, error } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_threshold: CONFIDENCE_THRESHOLD, 
            match_count: 3,
            filter_device_id: deviceId
        });

        if (error) console.error("RAG Error:", error);
        
        if (!docs || docs.length === 0) {
            console.log("[AI] No context found. Triggering handover.");
            return null;
        }

        const contextText = docs.map(d => d.content).join("\n---\n");
        const prompt = `
        You are a helpful assistant for a business.
        Use ONLY the context below to answer the user.
        If the answer is not in the context, return exactly "NO_ANSWER".
        
        CONTEXT:
        ${contextText}
        
        USER QUESTION:
        ${userText}
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview", 
            contents: prompt
        });

        const reply = response.text ? response.text.trim() : "";
        if (reply.includes("NO_ANSWER") || reply.length < 5) return null;
        return reply;

    } catch (e) {
        console.error("[AI] Error:", e);
        return null;
    }
}

/**
 * 2. Handover Logic
 */
async function handleHandover(sock, remoteJid, deviceId, adminNumber) {
    console.log(`[Handover] Device ${deviceId} -> User ${remoteJid}`);
    await sock.sendMessage(remoteJid, { text: "Mohon tunggu sebentar, staf kami akan segera membantu Anda. 😊" });

    const waNumber = remoteJid.replace('@s.whatsapp.net', '');
    await supabase.from('conversations')
        .update({ mode: 'agent', last_active: new Date() })
        .eq('wa_number', waNumber);

    if (adminNumber) {
        const adminJid = adminNumber.includes('@') ? adminNumber : `${adminNumber}@s.whatsapp.net`;
        await sock.sendMessage(adminJid, { 
            text: `⚠️ *HANDOVER REQUEST*\n\nUser: wa.me/${waNumber}\nMsg: _(Bot tidak tahu jawaban)_\n\nSilakan cek Dashboard.`
        });
    }
}

/**
 * 3. Start a Single Device Connection (Logic Utama)
 */
async function startDevice(device) {
    if (sessions[device.id]) {
        console.log(`[Init] Device ${device.id} already running.`);
        return;
    }

    console.log(`[Init] Starting Device: ${device.name} (${device.id})`);

    // --- SESSION PERSISTENCE ---
    // Auth state disimpan di folder 'auth_info_{id}'.
    // Saat restart, Baileys membaca folder ini sehingga tidak perlu scan ulang.
    const { state, saveCreds } = await useMultiFileAuthState(`auth_info_${device.id}`);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        browser: ["WhatsAgent", "Linux Server", "1.0"],
        syncFullHistory: false
    });

    sessions[device.id] = sock;

    // Heartbeat
    const heartbeatParams = setInterval(async () => {
        try {
            await supabase.from('system_status').upsert({ id: device.id, updated_at: new Date() });
        } catch(e) { /* Silent fail */ }
    }, 60000);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log(`[QR] Device ${device.id} waiting for scan...`);
            qrCache[device.id] = qr; // Simpan QR string untuk API

            // Update Supabase
            await supabase.from('system_status').upsert({ 
                id: device.id, 
                status: 'qr_ready', 
                qr_code: qr, 
                updated_at: new Date() 
            });
        }

        if (connection === 'close') {
            clearInterval(heartbeatParams);
            delete sessions[device.id];
            delete qrCache[device.id];

            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[Close] Device ${device.id} disconnected. Reconnecting: ${shouldReconnect}`);
            
            await supabase.from('system_status').upsert({ 
                id: device.id, 
                status: 'disconnected', 
                updated_at: new Date() 
            });

            if (shouldReconnect) {
                setTimeout(() => startDevice(device), 3000);
            }
        } else if (connection === 'open') {
            console.log(`[Open] Device ${device.id} is READY!`);
            delete qrCache[device.id]; // Hapus QR jika sudah connect

            await supabase.from('system_status').upsert({ 
                id: device.id, 
                status: 'connected', 
                qr_code: null, 
                updated_at: new Date() 
            });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const m of messages) {
            if (!m.message || m.key.fromMe) continue;

            const remoteJid = m.key.remoteJid;
            const waNumber = remoteJid.replace('@s.whatsapp.net', '');
            const text = m.message.conversation || m.message.extendedTextMessage?.text;

            if (!text) continue;

            console.log(`[Inbound] ${device.name}: ${text}`);

            await supabase.from('messages').insert({ 
                conversation_id: waNumber, 
                message: text, 
                direction: 'inbound', 
                status: 'read' 
            });

            const { data: convo } = await supabase.from('conversations').select('*').eq('wa_number', waNumber).single();
            
            if (!convo) {
                await supabase.from('conversations').insert({ 
                    wa_number: waNumber, 
                    device_id: device.id, 
                    name: m.pushName || waNumber,
                    mode: 'bot'
                });
            } else {
                await supabase.from('conversations').update({ last_active: new Date() }).eq('wa_number', waNumber);
            }

            const currentMode = convo ? convo.mode : 'bot';
            if (currentMode === 'bot') {
                await sock.sendPresenceUpdate('composing', remoteJid);
                const reply = await generateAIReply(text, device.id);

                if (reply) {
                    await sock.sendMessage(remoteJid, { text: reply });
                    await supabase.from('messages').insert({ 
                        conversation_id: waNumber, 
                        message: reply, 
                        direction: 'outbound', 
                        status: 'sent' 
                    });
                } else {
                    await handleHandover(sock, remoteJid, device.id, device.admin_number);
                }
                await sock.sendPresenceUpdate('available', remoteJid);
            }
        }
    });
}

/**
 * 4. Outbound Listener (From Dashboard -> User)
 */
async function listenForDashboardMessages() {
    console.log("[System] Listening for Dashboard messages...");
    supabase
        .channel('outbound-messages')
        .on(
            'postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'messages', filter: 'status=eq.pending' }, 
            async (payload) => {
                const msg = payload.new;
                if (msg.direction !== 'outbound') return;

                const { data: convo } = await supabase.from('conversations').select('device_id').eq('wa_number', msg.conversation_id).single();

                if (!convo || !convo.device_id || !sessions[convo.device_id]) {
                    console.error("[Error] Device not connected.");
                    await supabase.from('messages').update({ status: 'failed' }).eq('id', msg.id);
                    return;
                }

                try {
                    await sessions[convo.device_id].sendMessage(`${msg.conversation_id}@s.whatsapp.net`, { text: msg.message });
                    await supabase.from('messages').update({ status: 'sent' }).eq('id', msg.id);
                } catch (e) {
                    console.error("[Outbound Error]", e);
                    await supabase.from('messages').update({ status: 'failed' }).eq('id', msg.id);
                }
            }
        )
        .subscribe();
}

/**
 * 5. EXPRESS API ENDPOINTS
 */

// Endpoint: Check Status / Get QR
app.get('/scan/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    
    // 1. Cek apakah device ada di DB
    const { data: device, error } = await supabase.from('devices').select('*').eq('id', deviceId).single();
    
    if (error || !device) {
        return res.status(404).json({ error: "Device not found in database" });
    }

    // 2. Jika sesi belum jalan, jalankan sekarang
    if (!sessions[deviceId]) {
        startDevice(device);
        // Beri waktu sebentar untuk inisialisasi
        await new Promise(r => setTimeout(r, 2000));
    }

    // 3. Cek status koneksi
    if (qrCache[deviceId]) {
        // Generate QR Code Image (Base64) agar bisa ditampilkan di browser
        try {
            const qrImage = await QRCode.toDataURL(qrCache[deviceId]);
            return res.json({ 
                status: 'qr_ready', 
                message: 'Scan this QR Code',
                qr_string: qrCache[deviceId],
                qr_image: qrImage 
            });
        } catch (e) {
            return res.status(500).json({ error: "Failed to generate QR image" });
        }
    } else if (sessions[deviceId]) {
        return res.json({ status: 'connected', message: 'Device is connected and ready.' });
    } else {
        return res.json({ status: 'initializing', message: 'Please wait, starting session...' });
    }
});

// Endpoint: List Active Sessions
app.get('/sessions', (req, res) => {
    const activeSessions = Object.keys(sessions);
    res.json({ active_count: activeSessions.length, devices: activeSessions });
});

/**
 * 6. Main Entry Point
 */
async function main() {
    // A. Start API Server
    app.listen(PORT, () => {
        console.log(`[API] Server running on port ${PORT}`);
    });

    // B. Start Outbound Listener
    listenForDashboardMessages();

    // C. Fetch Devices and Start Them
    const { data: devices, error } = await supabase.from('devices').select('*');
    if (!error && devices.length > 0) {
        for (const device of devices) {
            startDevice(device);
        }
    } else {
        console.log("No devices found in DB. Add one via Dashboard or POST /scan/:newId");
    }
    
    // Listen for NEW devices added via Dashboard
    supabase.channel('new-devices')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'devices' }, (payload) => {
             console.log("[System] New Device detected:", payload.new.name);
             startDevice(payload.new);
        })
        .subscribe();
}

main();
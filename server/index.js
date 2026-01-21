/**
 * WHATSAGENT WORKER + API (STB/Linux Optimized)
 * 
 * Fixes Applied:
 * 1. Removed 'cors' dependency (Use native headers) to fix install errors.
 * 2. Added Pairing Code Support.
 * 3. Increased Connection Timeouts.
 * 4. Added "Nuclear" Session Reset API.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import express from 'express';
import QRCode from 'qrcode'; 
import crypto from 'crypto';
import pino from 'pino';
import fs from 'fs';

// --- POLYFILLS ---
if (!global.crypto) {
    global.crypto = crypto.webcrypto || crypto;
}

// --- ROBUST BAILEYS IMPORT ---
import * as Baileys from '@whiskeysockets/baileys';

const getBaileysExport = (key) => {
    if (Baileys[key]) return Baileys[key];
    if (Baileys.default && Baileys.default[key]) return Baileys.default[key];
    if (key === 'makeWASocket' && typeof Baileys.default === 'function') return Baileys.default;
    return null;
};

const makeWASocket = getBaileysExport('makeWASocket') || Baileys.default;
const useMultiFileAuthState = getBaileysExport('useMultiFileAuthState');
const DisconnectReason = getBaileysExport('DisconnectReason');
const fetchLatestBaileysVersion = getBaileysExport('fetchLatestBaileysVersion');
const makeCacheableSignalKeyStore = getBaileysExport('makeCacheableSignalKeyStore');

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

// Middleware
app.use(express.json());

// --- MANUAL CORS (No dependency required) ---
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); // Allow any frontend to access
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Session Store
const sessions = {}; 
const qrCache = {}; 
const pairingCodeCache = {}; // Cache for Pairing Codes

// Logger (Low overhead for STB)
const logger = pino({ level: 'warn' }); 

/**
 * 1. AI Logic
 */
async function generateAIReply(userText, deviceId) {
    try {
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

        if (!docs || docs.length === 0) return null;

        const contextText = docs.map(d => d.content).join("\n---\n");
        const prompt = `You are a helpful assistant. Use ONLY context:\n${contextText}\n\nQ: ${userText}`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview", 
            contents: prompt
        });

        const reply = response.text ? response.text.trim() : "";
        if (reply.includes("NO_ANSWER") || reply.length < 5) return null;
        return reply;

    } catch (e) {
        console.error("[AI Error]", e.message);
        return null;
    }
}

/**
 * 2. Handover Logic
 */
async function handleHandover(sock, remoteJid, deviceId, adminNumber) {
    await sock.sendMessage(remoteJid, { text: "Mohon tunggu sebentar, staf kami akan segera membantu Anda. 😊" });
    const waNumber = remoteJid.replace('@s.whatsapp.net', '');
    
    await supabase.from('conversations')
        .update({ mode: 'agent', last_active: new Date() })
        .eq('wa_number', waNumber);

    if (adminNumber) {
        const adminJid = adminNumber.includes('@') ? adminNumber : `${adminNumber}@s.whatsapp.net`;
        await sock.sendMessage(adminJid, { 
            text: `⚠️ *HANDOVER REQUEST*\n\nUser: wa.me/${waNumber}\nMsg: _(Bot tidak tahu jawaban)_`
        });
    }
}

/**
 * 3. Start a Single Device Connection (Optimized)
 */
async function startDevice(device, usePairingCode = false) {
    if (sessions[device.id]) return;

    console.log(`[Init] Starting Device: ${device.name} (${device.id})`);

    const { state, saveCreds } = await useMultiFileAuthState(`auth_info_${device.id}`);
    
    // STB Optimization: Use specific browser config to avoid 401/515
    const sock = makeWASocket({
        logger: logger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: !usePairingCode, // Only print QR if NOT using pairing code
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Pretend to be Linux Chrome
        generateHighQualityLinkPreview: true,
        // TIMEOUT TWEAKS FOR SLOW DEVICES
        connectTimeoutMs: 60000, 
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000, 
        emitOwnEvents: true,
        fireInitQueries: false, 
        syncFullHistory: false
    });

    sessions[device.id] = sock;

    // --- PAIRING CODE LOGIC ---
    if (usePairingCode && !sock.authState.creds.registered) {
        try {
            // Wait 2 seconds for socket to initialize
            setTimeout(async () => {
                const phoneNumber = device.phone_number.replace(/[^0-9]/g, '');
                console.log(`[Pairing] Requesting code for ${phoneNumber}...`);
                
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`[Pairing] CODE: ${code}`);
                pairingCodeCache[device.id] = code;
            }, 4000);
        } catch (err) {
            console.error('[Pairing Error]', err);
        }
    }

    // Heartbeat
    const heartbeatParams = setInterval(async () => {
        try {
            await supabase.from('system_status').upsert({ id: device.id, updated_at: new Date() });
        } catch(e) {}
    }, 60000);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !usePairingCode) {
            console.log(`[QR] Device ${device.id} NEW QR GENERATED.`);
            qrCache[device.id] = qr; 
            await supabase.from('system_status').upsert({ 
                id: device.id, status: 'qr_ready', qr_code: qr, updated_at: new Date() 
            });
        }

        if (connection === 'close') {
            clearInterval(heartbeatParams);
            delete sessions[device.id];
            delete qrCache[device.id];
            delete pairingCodeCache[device.id];

            // ROBUST RECONNECT LOGIC
            const code = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = code !== DisconnectReason.loggedOut;
            
            console.log(`[Close] Device ${device.id} disconnected (Code: ${code}). Reconnecting: ${shouldReconnect}`);
            
            await supabase.from('system_status').upsert({ 
                id: device.id, status: 'disconnected', updated_at: new Date() 
            });

            if (shouldReconnect) {
                // Exponential backoff for STB stability
                setTimeout(() => startDevice(device, false), 5000); 
            } else {
                console.log(`[Stop] Device ${device.id} logged out. Clean session required.`);
                // Optional: fs.rmSync(`auth_info_${device.id}`, { recursive: true, force: true });
            }
        } else if (connection === 'open') {
            console.log(`[Open] Device ${device.id} is READY!`);
            delete qrCache[device.id]; 
            delete pairingCodeCache[device.id];

            await supabase.from('system_status').upsert({ 
                id: device.id, status: 'connected', qr_code: null, updated_at: new Date() 
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

            // Insert to DB
            await supabase.from('messages').insert({ 
                conversation_id: waNumber, message: text, direction: 'inbound', status: 'read' 
            });

            // Upsert Conversation
            const { data: convo } = await supabase.from('conversations').select('*').eq('wa_number', waNumber).single();
            if (!convo) {
                await supabase.from('conversations').insert({ 
                    wa_number: waNumber, device_id: device.id, name: m.pushName || waNumber, mode: 'bot'
                });
            } else {
                await supabase.from('conversations').update({ last_active: new Date() }).eq('wa_number', waNumber);
            }

            // AI or Handover
            const currentMode = convo ? convo.mode : 'bot';
            if (currentMode === 'bot') {
                await sock.sendPresenceUpdate('composing', remoteJid);
                const reply = await generateAIReply(text, device.id);

                if (reply) {
                    await sock.sendMessage(remoteJid, { text: reply });
                    await supabase.from('messages').insert({ 
                        conversation_id: waNumber, message: reply, direction: 'outbound', status: 'sent' 
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
 * 4. Outbound Listener
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
                    await supabase.from('messages').update({ status: 'failed' }).eq('id', msg.id);
                    return;
                }

                try {
                    await sessions[convo.device_id].sendMessage(`${msg.conversation_id}@s.whatsapp.net`, { text: msg.message });
                    await supabase.from('messages').update({ status: 'sent' }).eq('id', msg.id);
                } catch (e) {
                    await supabase.from('messages').update({ status: 'failed' }).eq('id', msg.id);
                }
            }
        )
        .subscribe();
}

/**
 * 5. EXPRESS API ENDPOINTS (ENHANCED)
 */

// A. Get QR Code
app.get('/scan/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    const { data: device } = await supabase.from('devices').select('*').eq('id', deviceId).single();
    if (!device) return res.status(404).json({ error: "Device not found" });

    if (!sessions[deviceId]) {
        startDevice(device, false); // Default to QR
        await new Promise(r => setTimeout(r, 2000));
    }

    if (sessions[deviceId]?.authState?.creds?.registered) {
         return res.json({ status: 'connected', message: 'Device is connected!' });
    }

    if (qrCache[deviceId]) {
        const qrImage = await QRCode.toDataURL(qrCache[deviceId]);
        return res.json({ status: 'qr_ready', qr_string: qrCache[deviceId], qr_image: qrImage });
    } 
    
    return res.json({ status: 'initializing', message: 'Please wait...' });
});

// B. Request Pairing Code (NEW - STABLE METHOD)
app.get('/pair-code/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    const { data: device } = await supabase.from('devices').select('*').eq('id', deviceId).single();
    if (!device) return res.status(404).json({ error: "Device not found" });

    // 1. If connected, return success
    if (sessions[deviceId]?.authState?.creds?.registered) {
        return res.json({ status: 'connected', message: 'Already connected' });
    }

    // 2. If code exists in cache, return it
    if (pairingCodeCache[deviceId]) {
        return res.json({ status: 'code_ready', code: pairingCodeCache[deviceId] });
    }

    // 3. Force restart with Pairing Code mode
    if (sessions[deviceId]) {
        sessions[deviceId].end(undefined); // Kill existing QR session
        delete sessions[deviceId];
    }

    startDevice(device, true); // TRUE = Use Pairing Code
    
    // Wait for code generation
    let attempts = 0;
    const checkCode = setInterval(() => {
        attempts++;
        if (pairingCodeCache[deviceId]) {
            clearInterval(checkCode);
            return res.json({ status: 'code_ready', code: pairingCodeCache[deviceId] });
        }
        if (attempts > 15) { // Wait 15s
            clearInterval(checkCode);
            return res.json({ status: 'timeout', message: 'Generating code took too long. Try again.' });
        }
    }, 1000);
});

// C. Reset Session (NUCLEAR OPTION)
app.post('/reset/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    const folder = `auth_info_${deviceId}`;

    if (sessions[deviceId]) {
        sessions[deviceId].end(undefined);
        delete sessions[deviceId];
    }

    try {
        if (fs.existsSync(folder)) {
            fs.rmSync(folder, { recursive: true, force: true });
            console.log(`[Reset] Deleted session for ${deviceId}`);
        }
        return res.json({ success: true, message: "Session deleted. Please rescan." });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

app.get('/sessions', (req, res) => {
    res.json({ devices: Object.keys(sessions) });
});

/**
 * 6. Main Entry
 */
async function main() {
    app.listen(PORT, () => {
        console.log(`[API] Server running on port ${PORT}`);
    });
    listenForDashboardMessages();

    // Auto-start existing devices
    const { data: devices } = await supabase.from('devices').select('*');
    if (devices) {
        devices.forEach(d => startDevice(d, false)); // Default to QR on boot
    }

    supabase.channel('new-devices')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'devices' }, (payload) => {
             startDevice(payload.new);
        })
        .subscribe();
}

main();
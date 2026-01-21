/**
 * WHATSAGENT WORKER + API (Whatsapp-Web.JS Version)
 * 
 * Logic Rewritten for stability using Puppeteer.
 * REQUIREMENT FOR STB/LINUX:
 * Run: sudo apt-get install chromium-browser
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import express from 'express';
import QRCode from 'qrcode'; 
import pino from 'pino';
import fs from 'fs';

// --- WHATSAPP-WEB.JS IMPORT (ESM Compatible) ---
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

// --- CONFIG ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CONFIDENCE_THRESHOLD = 0.65;
const PORT = process.env.PORT || 3000;

// Auto-detect Chromium Path (Common paths for Linux/STB/Mac/Win)
const getChromiumPath = () => {
    const paths = [
        '/usr/bin/chromium-browser', // Ubuntu/Debian/STB Armbian
        '/usr/bin/chromium',         // Arch/Alpine
        '/usr/bin/google-chrome-stable',
        '/snap/bin/chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    ];
    for (const path of paths) {
        if (fs.existsSync(path)) return path;
    }
    return null; // Let Puppeteer try to find it or download it
};

const EXECUTABLE_PATH = getChromiumPath();

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
    console.error("❌ MISSING ENV VARS. Check .env file.");
    process.exit(1);
}

// Clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const app = express();
const logger = pino({ level: 'info' }); 

// Middleware
app.use(express.json());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// --- CLIENT MANAGER ---
// whatsapp-web.js is heavy. We store clients here.
const clients = {}; 
const qrCache = {}; 

/**
 * 1. AI Logic (Same as before)
 */
async function generateAIReply(userText, deviceId) {
    try {
        const embedResult = await ai.models.embedContent({
            model: "text-embedding-004",
            content: userText
        });
        const embedding = embedResult.embedding.values;

        const { data: docs } = await supabase.rpc('match_documents', {
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
 * 2. Start a Client (WWJS)
 */
async function startDevice(device) {
    if (clients[device.id]) return;

    console.log(`[Init] Starting Device: ${device.name} (${device.id})`);
    
    // Config for STB/Low Resource
    const puppeteerConfig = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Prevent /dev/shm shared memory issues
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--single-process' // Helps on some ARM builds
        ]
    };

    if (EXECUTABLE_PATH) {
        console.log(`[Puppeteer] Using System Chromium: ${EXECUTABLE_PATH}`);
        puppeteerConfig.executablePath = EXECUTABLE_PATH;
    }

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: device.id, dataPath: './auth_sessions' }),
        puppeteer: puppeteerConfig,
        // Decrease restart/connection attempt frequency to save CPU
        qrMaxRetries: 5,
    });

    clients[device.id] = client;

    // --- EVENTS ---

    client.on('qr', async (qr) => {
        console.log(`[QR] Generated for ${device.name}`);
        qrCache[device.id] = qr;
        await supabase.from('system_status').upsert({ 
            id: device.id, status: 'qr_ready', qr_code: qr, updated_at: new Date() 
        });
    });

    client.on('ready', async () => {
        console.log(`[Ready] ${device.name} is connected!`);
        delete qrCache[device.id];
        await supabase.from('system_status').upsert({ 
            id: device.id, status: 'connected', qr_code: null, updated_at: new Date() 
        });
    });

    client.on('authenticated', () => {
        console.log(`[Auth] ${device.name} authenticated.`);
    });

    client.on('auth_failure', msg => {
        console.error(`[Auth Fail] ${device.name}:`, msg);
    });

    client.on('disconnected', async (reason) => {
        console.log(`[Disconnect] ${device.name} was logged out`, reason);
        delete clients[device.id];
        await supabase.from('system_status').upsert({ 
            id: device.id, status: 'disconnected', updated_at: new Date() 
        });
        // Auto Restart after 5s
        setTimeout(() => startDevice(device), 5000);
    });

    client.on('message', async (msg) => {
        // FILTER: Only process standard chat messages. Ignore 'e2e_notification', 'call_log', 'protocol', etc.
        if (msg.type !== 'chat') return;
        
        // FILTER: Ignore status updates (broadcasts from contacts)
        if (msg.isStatus) return;

        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const waNumber = contact.number;
        const text = msg.body;

        if (msg.fromMe || chat.isGroup) return;

        console.log(`[Inbound] ${device.name} from ${waNumber}: ${text}`);

        // Save Message
        await supabase.from('messages').insert({ 
            conversation_id: waNumber, message: text, direction: 'inbound', status: 'read' 
        });

        // Upsert Conversation
        const { data: convo } = await supabase.from('conversations').select('*').eq('wa_number', waNumber).single();
        if (!convo) {
            await supabase.from('conversations').insert({ 
                wa_number: waNumber, device_id: device.id, name: contact.pushname || contact.name || waNumber, mode: 'bot'
            });
        } else {
            await supabase.from('conversations').update({ last_active: new Date() }).eq('wa_number', waNumber);
        }

        // AI Logic
        const currentMode = convo ? convo.mode : 'bot';
        if (currentMode === 'bot') {
            chat.sendStateTyping();
            
            // Check Admin Handover Keyword (Optional)
            if (text.toLowerCase() === 'human' || text.toLowerCase() === 'admin') {
                await supabase.from('conversations').update({ mode: 'agent' }).eq('wa_number', waNumber);
                await client.sendMessage(msg.from, "Menghubungkan ke Admin... Mohon tunggu.");
                return;
            }

            const reply = await generateAIReply(text, device.id);

            if (reply) {
                // Add slight delay to make it feel natural
                await new Promise(r => setTimeout(r, 1500));
                await client.sendMessage(msg.from, reply);
                await supabase.from('messages').insert({ 
                    conversation_id: waNumber, message: reply, direction: 'outbound', status: 'sent' 
                });
            } else {
                // Handover
                await client.sendMessage(msg.from, "Maaf saya kurang mengerti. Saya sambungkan ke Admin ya. 😊");
                await supabase.from('conversations').update({ mode: 'agent' }).eq('wa_number', waNumber);
                
                if (device.admin_number) {
                    const adminJid = device.admin_number.includes('@') ? device.admin_number : `${device.admin_number}@c.us`;
                    client.sendMessage(adminJid, `⚠️ *HANDOVER NEEDED*\nUser: ${waNumber}\nMsg: ${text}`);
                }
            }
            chat.clearState();
        }
    });

    try {
        client.initialize();
    } catch (e) {
        console.error("Init Error:", e);
    }
}

/**
 * 4. Outbound Listener (Dashboard -> WA)
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

                if (!convo || !convo.device_id || !clients[convo.device_id]) {
                    console.warn("Client not found for outgoing message");
                    await supabase.from('messages').update({ status: 'failed' }).eq('id', msg.id);
                    return;
                }

                try {
                    const client = clients[convo.device_id];
                    const chatId = `${msg.conversation_id}@c.us`; // WWJS uses @c.us for contacts
                    await client.sendMessage(chatId, msg.message);
                    await supabase.from('messages').update({ status: 'sent' }).eq('id', msg.id);
                } catch (e) {
                    console.error("Send Error:", e);
                    await supabase.from('messages').update({ status: 'failed' }).eq('id', msg.id);
                }
            }
        )
        .subscribe();
}

/**
 * 5. API Endpoints
 */
// A. Get QR Code
app.get('/scan/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    const { data: device } = await supabase.from('devices').select('*').eq('id', deviceId).single();
    if (!device) return res.status(404).json({ error: "Device not found" });

    // Initialize if not running
    if (!clients[deviceId]) {
        startDevice(device);
        // Wait briefly for init
        await new Promise(r => setTimeout(r, 3000));
    }

    const client = clients[deviceId];
    
    // Check Status
    if (client.info && client.info.wid) {
         return res.json({ status: 'connected', message: 'Device is connected!' });
    }

    if (qrCache[deviceId]) {
        const qrImage = await QRCode.toDataURL(qrCache[deviceId]);
        return res.json({ status: 'qr_ready', qr_string: qrCache[deviceId], qr_image: qrImage });
    } 
    
    return res.json({ status: 'initializing', message: 'Initializing browser...' });
});

// B. Pairing Code (EXPERIMENTAL)
app.get('/pair-code/:deviceId', async (req, res) => {
    return res.json({ 
        status: 'error', 
        message: 'Pairing Code not reliable on STB architecture. Use QR.' 
    });
});

app.get('/sessions', (req, res) => {
    res.json({ devices: Object.keys(clients) });
});

app.post('/reset/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    if (clients[deviceId]) {
        try { await clients[deviceId].destroy(); } catch(e) {}
        delete clients[deviceId];
    }
    const path = `./auth_sessions/session-${deviceId}`;
    if (fs.existsSync(path)) {
        fs.rmSync(path, { recursive: true, force: true });
    }
    res.json({ success: true });
});

/**
 * 6. Main
 */
async function main() {
    app.listen(PORT, () => {
        console.log(`[API] Server running on port ${PORT}`);
    });
    listenForDashboardMessages();

    // Auto-start
    const { data: devices } = await supabase.from('devices').select('*');
    if (devices) {
        devices.forEach(d => startDevice(d));
    }

    supabase.channel('new-devices')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'devices' }, (payload) => {
             startDevice(payload.new);
        })
        .subscribe();
}

main();
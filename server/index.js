/**
 * WHATSAGENT WORKER (Production Ready)
 * 
 * Setup on Linux Server:
 * 1. Upload this file (index.js) and package.json to a folder.
 * 2. Run `npm install`
 * 3. Create a .env file with your credentials.
 * 4. Run `npm start` (or use PM2: `pm2 start index.js --name wa-worker`)
 */

import 'dotenv/config';
// FIX: Changed import style for makeWASocket to default import
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import qrcode from 'qrcode-terminal';
import fs from 'fs';

// --- CONFIG ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // Use Service Key for Backend!
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CONFIDENCE_THRESHOLD = 0.65;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
    console.error("❌ MISSING ENV VARS. Check .env file.");
    process.exit(1);
}

// Clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// Initialize GoogleGenAI with specific API key property
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Session Store (InMemory for active sockets)
const sessions = {}; 

/**
 * 1. AI Logic: RAG + Gemini Generation
 */
async function generateAIReply(userText, deviceId) {
    try {
        console.log(`[AI] Processing: "${userText}" for ${deviceId}`);
        
        // A. Embed Query
        const embedResult = await ai.models.embedContent({
            model: "text-embedding-004",
            content: userText
        });
        const embedding = embedResult.embedding.values;

        // B. Search Supabase (RAG)
        const { data: docs, error } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_threshold: CONFIDENCE_THRESHOLD, 
            match_count: 3,
            filter_device_id: deviceId
        });

        if (error) console.error("RAG Error:", error);
        
        // C. If no context found, signal Handover
        if (!docs || docs.length === 0) {
            console.log("[AI] No context found. Triggering handover.");
            return null;
        }

        const contextText = docs.map(d => d.content).join("\n---\n");
        console.log(`[AI] Found ${docs.length} relevant docs.`);

        // D. Generate Answer
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
            model: "gemini-3-flash-preview", // UPDATED: World-class model for text tasks
            contents: prompt
        });

        // CRITICAL FIX: use .text property, not .text() method
        const reply = response.text ? response.text.trim() : "";
        
        if (reply.includes("NO_ANSWER") || reply.length < 5) return null;

        return reply;

    } catch (e) {
        console.error("[AI] Error:", e);
        return null; // Fallback to handover on error
    }
}

/**
 * 2. Handover Logic: Notify Admin
 */
async function handleHandover(sock, remoteJid, deviceId, adminNumber) {
    console.log(`[Handover] Device ${deviceId} -> User ${remoteJid}`);

    // Notify User
    await sock.sendMessage(remoteJid, { 
        text: "Mohon tunggu sebentar, staf kami akan segera membantu Anda. 😊" 
    });

    // Switch DB Mode to 'agent'
    const waNumber = remoteJid.replace('@s.whatsapp.net', '');
    await supabase.from('conversations')
        .update({ mode: 'agent', last_active: new Date() })
        .eq('wa_number', waNumber);

    // Alert Admin
    if (adminNumber) {
        const adminJid = adminNumber.includes('@') ? adminNumber : `${adminNumber}@s.whatsapp.net`;
        await sock.sendMessage(adminJid, { 
            text: `⚠️ *HANDOVER REQUEST*\n\nUser: wa.me/${waNumber}\nMsg: _(Bot tidak tahu jawaban)_\n\nSilakan cek Dashboard.`
        });
    }
}

/**
 * 3. Start a Single Device Connection
 */
async function startDevice(device) {
    console.log(`[Init] Starting Device: ${device.name} (${device.id})`);

    const { state, saveCreds } = await useMultiFileAuthState(`auth_info_${device.id}`);
    const { version } = await fetchLatestBaileysVersion();

    // FIX: Removed .default property access
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true, // Useful for CLI debugging
        browser: ["WhatsAgent", "Linux Server", "1.0"],
        syncFullHistory: false
    });

    sessions[device.id] = sock;

    // --- HEARTBEAT LOOP (Per Device) ---
    // Updates Supabase every 60s to show "Connected" on Dashboard
    const heartbeatParams = setInterval(async () => {
        try {
            // Only update if connection is effectively open
            await supabase.from('system_status').upsert({ 
                id: device.id, 
                updated_at: new Date() 
            });
        } catch(e) { /* Silent fail */ }
    }, 60000);


    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log(`[QR] Device ${device.id} waiting for scan...`);
            // Update Supabase so Dashboard shows the QR
            // qrcode.generate(qr, { small: true }); // Optional: Show in terminal
            await supabase.from('system_status').upsert({ 
                id: device.id, 
                status: 'qr_ready', 
                qr_code: qr, 
                updated_at: new Date() 
            });
        }

        if (connection === 'close') {
            clearInterval(heartbeatParams);
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[Close] Device ${device.id} disconnected. Reconnecting: ${shouldReconnect}`);
            
            await supabase.from('system_status').upsert({ 
                id: device.id, 
                status: 'disconnected', 
                updated_at: new Date() 
            });

            if (shouldReconnect) {
                startDevice(device);
            }
        } else if (connection === 'open') {
            console.log(`[Open] Device ${device.id} is READY!`);
            await supabase.from('system_status').upsert({ 
                id: device.id, 
                status: 'connected', 
                qr_code: null, 
                updated_at: new Date() 
            });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // --- INBOUND MESSAGE HANDLING ---
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const m of messages) {
            if (!m.message || m.key.fromMe) continue;

            const remoteJid = m.key.remoteJid;
            const waNumber = remoteJid.replace('@s.whatsapp.net', '');
            const text = m.message.conversation || m.message.extendedTextMessage?.text;

            if (!text) continue;

            console.log(`[Inbound] ${device.name}: ${text}`);

            // 1. Save Message to DB
            await supabase.from('messages').insert({ 
                conversation_id: waNumber, 
                message: text, 
                direction: 'inbound', 
                status: 'read' 
            });

            // 2. Update/Create Conversation
            const { data: convo } = await supabase.from('conversations')
                .select('*')
                .eq('wa_number', waNumber)
                .single();
            
            if (!convo) {
                // New Contact
                await supabase.from('conversations').insert({ 
                    wa_number: waNumber, 
                    device_id: device.id, 
                    name: m.pushName || waNumber,
                    mode: 'bot'
                });
            } else {
                // Update timestamp
                await supabase.from('conversations')
                    .update({ last_active: new Date() })
                    .eq('wa_number', waNumber);
            }

            // 3. Bot Logic (Only if mode is 'bot')
            const currentMode = convo ? convo.mode : 'bot';
            if (currentMode === 'bot') {
                // Initial "Typing..." state
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
                    // Handover
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

                console.log(`[Outbound Request] To: ${msg.conversation_id}, Msg: ${msg.message}`);

                // Find which device owns this conversation
                const { data: convo } = await supabase.from('conversations')
                    .select('device_id')
                    .eq('wa_number', msg.conversation_id)
                    .single();

                if (!convo || !convo.device_id || !sessions[convo.device_id]) {
                    console.error("[Error] Device not found or not connected for this conversation.");
                    await supabase.from('messages').update({ status: 'failed' }).eq('id', msg.id);
                    return;
                }

                const sock = sessions[convo.device_id];
                const jid = `${msg.conversation_id}@s.whatsapp.net`;

                try {
                    await sock.sendMessage(jid, { text: msg.message });
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
 * 5. Main Entry Point
 */
async function main() {
    // A. Start Outbound Listener
    listenForDashboardMessages();

    // B. Fetch Devices and Start Them
    const { data: devices, error } = await supabase.from('devices').select('*');
    
    if (error) {
        console.error("Failed to fetch devices from DB:", error);
        return;
    }

    if (devices.length === 0) {
        console.log("No devices found in DB. Please add a device via the Dashboard first.");
    }

    // Start all devices
    for (const device of devices) {
        startDevice(device);
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
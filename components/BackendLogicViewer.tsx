import React, { useState } from 'react';
import { Button } from './Button';
import { Copy, Check, Server, Workflow, Bot, Smartphone, Mail } from 'lucide-react';

const WORKER_CODE = `// FILE: wa-worker-multidevice.js
// RUN: npm install @whiskeysockets/baileys @supabase/supabase-js @google/genai nodemailer

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');
const nodemailer = require('nodemailer'); // <--- IMPORT NODEMAILER

const SUPABASE_URL = 'YOUR_URL';
const SUPABASE_KEY = 'YOUR_SERVICE_KEY';
const GEMINI_API_KEY = 'YOUR_GEMINI_KEY';

// --- EMAIL CONFIG (For Alerts) ---
const transporter = nodemailer.createTransport({
    service: 'gmail', // or use host/port for other SMTP
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password' 
    }
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const sessions = {};

// Alert Function
async function sendDisconnectAlert(device, reason) {
    if (!device.alert_email) return;
    
    console.log(\`Sending alert to \${device.alert_email}...\`);
    const mailOptions = {
        from: '"WhatsAgent System" <your-email@gmail.com>',
        to: device.alert_email,
        subject: \`⚠️ ALERT: \${device.name} Disconnected\`,
        text: \`Your WhatsApp device "\${device.name}" has disconnected.\\nReason: \${reason}\\n\\nPlease open the dashboard and rescan the QR code immediately to resume bot operations.\`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Alert email sent successfully.');
    } catch (err) {
        console.error('Failed to send email alert:', err);
    }
}

async function startDevice(device) {
    const { id, name } = device;
    console.log(\`Starting device: \${name} (\${id})\`);

    const { state, saveCreds } = await useMultiFileAuthState(\`auth_info_\${id}\`);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['WhatsAgent', 'Chrome', '1.0.0']
    });

    sessions[id] = sock;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            await supabase.from('system_status').upsert({
                id: id, status: 'qr_ready', qr_code: qr, updated_at: new Date()
            });
        }

        if (connection === 'close') {
            const reason = lastDisconnect.error?.output?.statusCode;
            const shouldReconnect = reason !== DisconnectReason.loggedOut;
            
            await supabase.from('system_status').upsert({
                id: id, status: 'disconnected', qr_code: null, updated_at: new Date()
            });

            // TRIGGER ALERT IF NOT LOGGED OUT INTENTIONALLY
            if (shouldReconnect) {
                await sendDisconnectAlert(device, "Connection Lost / Network Issue");
                startDevice(device); // Auto reconnect attempt
            } else {
                await sendDisconnectAlert(device, "Logged Out from Mobile");
            }
        } else if (connection === 'open') {
            await supabase.from('system_status').upsert({
                id: id, status: 'connected', qr_code: null, updated_at: new Date()
            });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const m of messages) {
            if (!m.message || m.key.fromMe) continue;
            const sender = m.key.remoteJid.replace('@s.whatsapp.net', '');
            const text = m.message.conversation || m.message.extendedTextMessage?.text;

            await supabase.from('messages').insert({ conversation_id: sender, message: text, direction: 'inbound', status: 'read' });
            await processAI(sock, sender, text, id); 
        }
    });
}

async function processAI(sock, sender, text, deviceId) {
    const embeddingResp = await ai.models.embedContent({ model: 'text-embedding-004', content: text });
    const { data: contextDocs } = await supabase.rpc('match_documents', {
        query_embedding: embeddingResp.embedding.values, 
        match_threshold: 0.5, match_count: 3, filter_device_id: deviceId 
    });
    const context = contextDocs?.map(d => d.content).join('\\n') || '';
    const result = await ai.models.generateContent({ model: 'gemini-2.5-flash-latest', contents: \`Context: \${context} \\n User: \${text} \\n Answer helpfuly.\` });
    await sock.sendMessage(sender + '@s.whatsapp.net', { text: result.text });
}

async function main() {
    // Select all devices AND their email settings
    const { data: devices } = await supabase.from('devices').select('*');
    devices.forEach(startDevice);
}

main();`;

export const BackendLogicViewer: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(WORKER_CODE); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mt-6">
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Workflow size={18} className="text-purple-600" />
          Node.js Worker (With Email Alerts)
        </h3>
        <Button variant="secondary" onClick={handleCopy} className="text-xs h-8" icon={copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}>
          {copied ? 'Copied' : 'Copy Code'}
        </Button>
      </div>
      <div className="p-6">
        <div className="flex gap-2 mb-4 p-3 bg-blue-50 text-blue-700 text-xs rounded-lg border border-blue-100">
           <Mail size={16} />
           <p>
             I have updated the code to use <strong>Nodemailer</strong>. When the WhatsApp connection drops, 
             the worker will read the <code>alert_email</code> from the database and send an immediate warning.
           </p>
        </div>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed border border-gray-700 h-96">
          <code>{WORKER_CODE}</code>
        </pre>
      </div>
    </div>
  );
};
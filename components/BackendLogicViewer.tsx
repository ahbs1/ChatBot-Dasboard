import React, { useState } from 'react';
import { Button } from './Button';
import { Copy, Check, Server, Workflow, Bot, Smartphone, Mail, UserPlus } from 'lucide-react';

const WORKER_CODE = `// FILE: wa-worker-multidevice.js
// RUN: npm install @whiskeysockets/baileys @supabase/supabase-js @google/genai nodemailer

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI, SchemaType } = require('@google/genai');
const nodemailer = require('nodemailer');

const SUPABASE_URL = 'YOUR_URL';
const SUPABASE_KEY = 'YOUR_SERVICE_KEY';
const GEMINI_API_KEY = 'YOUR_GEMINI_KEY';

// --- EMAIL CONFIG ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: 'your-email@gmail.com', pass: 'your-app-password' }
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const sessions = {};

// ... (sendDisconnectAlert and startDevice functions remain same as before) ...

async function startDevice(device) {
    // ... (Connection logic same as previous) ...
    // Inside sock.ev.on('messages.upsert'):
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const m of messages) {
            if (!m.message || m.key.fromMe) continue;
            const sender = m.key.remoteJid.replace('@s.whatsapp.net', '');
            const text = m.message.conversation || m.message.extendedTextMessage?.text;

            // 1. Save Message
            await supabase.from('messages').insert({ conversation_id: sender, message: text, direction: 'inbound', status: 'read' });
            
            // 2. EXTRACT LEAD INFO (Background Process)
            // We don't await this so it doesn't block the reply speed
            extractAndSaveLead(text, sender, device.id);

            // 3. Generate Reply
            await processAI(sock, sender, text, device.id); 
        }
    });
}

// --- NEW: LEAD EXTRACTION LOGIC ---
async function extractAndSaveLead(text, phoneNumber, deviceId) {
    try {
        // Ask AI to specifically look for name and address in a structured JSON format
        const extractionPrompt = \`
            Analyze this message: "\${text}". 
            If the user mentions their Name or Address, extract it.
            Return JSON only: { "name": string | null, "address": string | null }.
            If no info is found, return null values.
        \`;

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash-latest',
            contents: extractionPrompt,
            config: { responseMimeType: 'application/json' }
        });

        const extracted = JSON.parse(result.text);

        // Only save if we found something useful
        if (extracted.name || extracted.address) {
            console.log("Lead Info Found:", extracted);
            
            // UPSERT: Updates if phone_number+device_id exists, Inserts if new.
            // This prevents duplicates!
            const updates = {
                device_id: deviceId,
                phone_number: phoneNumber,
                updated_at: new Date()
            };
            if (extracted.name) updates.name = extracted.name;
            if (extracted.address) updates.address = extracted.address;

            const { error } = await supabase
                .from('leads')
                .upsert(updates, { onConflict: 'device_id, phone_number' });

            if (error) console.error("Failed to save lead:", error);
        }
    } catch (e) {
        console.error("Extraction error:", e);
    }
}

async function processAI(sock, sender, text, deviceId) {
    // ... (RAG and Response logic same as before) ...
    const embeddingResp = await ai.models.embedContent({ model: 'text-embedding-004', content: text });
    // ...
}

async function main() {
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
          Node.js Worker (With Auto Lead Extraction)
        </h3>
        <Button variant="secondary" onClick={handleCopy} className="text-xs h-8" icon={copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}>
          {copied ? 'Copied' : 'Copy Code'}
        </Button>
      </div>
      <div className="p-6">
        <div className="flex gap-2 mb-4 p-3 bg-green-50 text-green-700 text-xs rounded-lg border border-green-100">
           <UserPlus size={16} />
           <p>
             <strong>Feature Added:</strong> The worker now uses Gemini to analyze every incoming message. 
             If it detects a <strong>Name</strong> or <strong>Address</strong>, it performs a database <code>UPSERT</code>. 
             This automatically saves/updates the lead information without creating duplicates.
           </p>
        </div>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed border border-gray-700 h-96">
          <code>{WORKER_CODE}</code>
        </pre>
      </div>
    </div>
  );
};
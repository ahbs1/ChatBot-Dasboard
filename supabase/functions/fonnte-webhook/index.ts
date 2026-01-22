// DEPLOYMENT:
// 1. Upload this file to GitHub inside: supabase/functions/fonnte-webhook/index.ts
// 2. Connect your Supabase Project to GitHub via the Supabase Dashboard.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare Deno to avoid TypeScript errors
declare const Deno: any;

// Access environment variables securely
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper: Normalize phone numbers for comparison
// Removes non-digits, converts '08' prefix to '628'
function normalizePhone(phone: string | number | undefined | null): string {
  if (!phone) return "";
  let p = String(phone).replace(/\D/g, ''); // Remove all non-digits
  if (p.startsWith('0')) {
    p = '62' + p.slice(1);
  }
  return p;
}

serve(async (req) => {
  try {
    // 1. Parse Fonnte Payload
    const payload = await req.json();
    console.log("📥 RECEIVED WEBHOOK:", JSON.stringify(payload)); 

    // Robust field extraction
    // 'sender' is who sent the message. 
    // 'target' is who receives it (useful if sender is me).
    let senderRaw = payload.sender || payload.pengirim;
    let targetRaw = payload.target || payload.penerima;
    const message = payload.message || payload.pesan || payload.text;
    const name = payload.name || "Unknown";
    const devicePhone = payload.device; // The bot's number receiving/sending the message
    const isFromMe = payload.me === true || payload.fromMe === true;

    // Validation
    if (!senderRaw || !message) {
      console.log("⚠️ Ignored: Missing sender or message fields");
      return new Response(JSON.stringify({ status: "ignored", reason: "missing_fields" }), { headers: { "Content-Type": "application/json" } });
    }

    const sender = normalizePhone(senderRaw);
    const device = normalizePhone(devicePhone);
    const target = normalizePhone(targetRaw);

    // 2. Determine Direction & Conversation ID
    // If sender matches the connected device number, it's an OUTBOUND message (sent from phone)
    let direction = 'inbound';
    let conversationId = sender; // Default: chat ID is the sender

    if (sender === device || isFromMe) {
        direction = 'outbound';
        // If I sent it, the conversation ID is the TARGET (the person I sent it to)
        // If target is missing (sometimes Fonnte doesn't send it in webhook), we might lose context.
        conversationId = target || sender; 
        console.log(`📤 Detected Outbound Message to ${conversationId}`);
    } else {
        console.log(`📥 Detected Inbound Message from ${conversationId}`);
    }
    
    // 3. Find Device ID (Smart Matching)
    let deviceId = null;
    if (devicePhone) {
        const { data: allDevices } = await supabase
            .from('devices')
            .select('id, phone_number');
        
        if (allDevices && allDevices.length > 0) {
            const matchedDevice = allDevices.find(d => 
                normalizePhone(d.phone_number) === device
            );

            if (matchedDevice) {
                deviceId = matchedDevice.id;
            }
        }
    }

    // 4. Ensure Conversation Exists (UPSERT)
    // Only update name/last_active if it's inbound or a new chat
    const conversationData = {
      wa_number: conversationId,
      name: direction === 'inbound' ? name : undefined, // Don't overwrite name with "Unknown" on outbound
      last_active: new Date(),
      ...(deviceId ? { device_id: deviceId } : {}) 
    };

    // Clean undefined keys
    Object.keys(conversationData).forEach(key => conversationData[key] === undefined && delete conversationData[key]);

    const { error: convoError } = await supabase
        .from('conversations')
        .upsert(conversationData, { onConflict: 'wa_number' });

    if (convoError) {
        console.error("❌ Failed to upsert conversation:", convoError);
        // Continue anyway to try inserting message
    }

    // 5. Insert Message
    // Check if message already exists (deduplication based on timestamp/content rough match could be added here, but ID is usually different)
    const { error: msgError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      message: message,
      direction: direction,
      status: direction === 'outbound' ? 'sent' : 'read'
    });

    if (msgError) {
        console.error("❌ Message Insert Error:", msgError);
        throw msgError;
    }

    console.log("✅ Message Saved & Realtime Triggered");

    return new Response(JSON.stringify({ status: "ok" }), { 
      status: 200,
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    console.error("🔥 Webhook Fatal Error:", err);
    return new Response(JSON.stringify({ error: err.message, code: err.code }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
});
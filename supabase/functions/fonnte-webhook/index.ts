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
function normalizePhone(phone: string | number): string {
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
    let sender = payload.sender || payload.pengirim;
    const message = payload.message || payload.pesan || payload.text;
    const name = payload.name || "Unknown";
    const devicePhone = payload.device; // The bot's number receiving the message

    // Validation
    if (!sender || !message) {
      console.log("⚠️ Ignored: Missing sender or message fields");
      return new Response(JSON.stringify({ status: "ignored", reason: "missing_fields" }), { headers: { "Content-Type": "application/json" } });
    }

    sender = String(sender).trim();
    
    // 2. Find Device ID (Smart Matching)
    let deviceId = null;
    if (devicePhone) {
        // Fetch all devices to perform fuzzy matching in JS
        const { data: allDevices } = await supabase
            .from('devices')
            .select('id, phone_number');
        
        if (allDevices && allDevices.length > 0) {
            const incomingNorm = normalizePhone(devicePhone);
            
            // Find matched device by normalized number
            const matchedDevice = allDevices.find(d => 
                normalizePhone(d.phone_number) === incomingNorm
            );

            if (matchedDevice) {
                deviceId = matchedDevice.id;
                console.log(`✅ Device Matched: ${incomingNorm} -> ID: ${deviceId}`);
            } else {
                console.warn(`⚠️ No device found matching: ${devicePhone} (Normalized: ${incomingNorm})`);
            }
        }
    }

    // 3. Ensure Conversation Exists (UPSERT)
    // We include device_id to organize chats automatically
    const conversationData = {
      wa_number: sender,
      name: name,
      last_active: new Date(),
      ...(deviceId ? { device_id: deviceId } : {}) 
    };

    const { error: convoError } = await supabase
        .from('conversations')
        .upsert(conversationData, { onConflict: 'wa_number' });

    if (convoError) {
        console.error("❌ Failed to upsert conversation:", convoError);
        throw convoError;
    }

    // 4. Insert Message
    const { error: msgError } = await supabase.from('messages').insert({
      conversation_id: sender,
      message: message,
      direction: 'inbound',
      status: 'read'
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

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

serve(async (req) => {
  try {
    // 1. Parse Fonnte Payload
    const payload = await req.json();
    console.log("📥 RECEIVED WEBHOOK:", JSON.stringify(payload)); 

    // Fonnte sometimes sends 'pesan' instead of 'message' depending on the mode/device
    // Also handling sender vs pengirim
    const sender = payload.sender || payload.pengirim;
    const message = payload.message || payload.pesan || payload.text;
    const name = payload.name || "Unknown";

    // Validation
    if (!sender || !message) {
      console.log("⚠️ Ignored: Missing sender or message fields");
      return new Response(JSON.stringify({ status: "ignored", reason: "missing_fields" }), { headers: { "Content-Type": "application/json" } });
    }

    // 2. Ensure Conversation Exists
    const { error: convoError } = await supabase.from('conversations').upsert({
      wa_number: sender,
      name: name,
      last_active: new Date()
    }, { onConflict: 'wa_number' });

    if (convoError) {
        console.error("❌ Convo Error:", convoError);
        throw convoError;
    }

    // 3. Insert Message
    const { error: msgError } = await supabase.from('messages').insert({
      conversation_id: sender,
      message: message,
      direction: 'inbound',
      status: 'read'
    });

    if (msgError) {
        console.error("❌ Message Insert Error:", msgError);
        // Specifically catch the Sequence Permission error to give a better log
        if (msgError.code === '42501') {
            console.error("🚨 CRITICAL PERMISSION ERROR: Run 'GRANT USAGE ON SEQUENCE messages_id_seq...' in Supabase SQL Editor!");
        }
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

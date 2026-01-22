import React, { useState } from 'react';
import { Button } from './Button';
import { Copy, Check, Database, Globe, AlertTriangle, Terminal, ChevronRight, ChevronDown } from 'lucide-react';

const SQL_SETUP = `-- 1. Enable Extensions
create extension if not exists vector;

-- 2. Create Devices Table (Updated for Fonnte)
create table if not exists devices (
  id text primary key, 
  name text not null, 
  phone_number text, 
  color text default 'bg-blue-500', 
  fonnte_token text, -- Stores Fonnte API Key
  alert_email text, 
  admin_number text, 
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Knowledge Base (RAG)
create table if not exists knowledge_base (
  id bigserial primary key,
  device_id text references devices(id) on delete cascade,
  content text,
  embedding vector(768), 
  metadata jsonb
);

-- 4. Create Leads (CRM)
create table if not exists leads (
  id bigserial primary key,
  device_id text references devices(id) on delete cascade,
  phone_number text not null,
  name text,
  address text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(device_id, phone_number) 
);

-- 5. Create Conversations
create table if not exists conversations (
  wa_number text primary key, 
  device_id text references devices(id) on delete set null,
  name text,
  mode text check (mode in ('bot', 'agent')) default 'bot',
  last_active timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Create Messages
create table if not exists messages (
  id bigserial primary key,
  conversation_id text references conversations(wa_number) on delete cascade,
  message text not null,
  direction text check (direction in ('inbound', 'outbound')) not null,
  status text check (status in ('pending', 'sent', 'delivered', 'read', 'failed')) default 'sent',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Realtime
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;

-- 8. Similarity Search Function
create or replace function match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_device_id text
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    kb.id,
    kb.content,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding) as similarity
  from knowledge_base kb
  where 
    kb.device_id = filter_device_id
    and 1 - (kb.embedding <=> query_embedding) > match_threshold
  order by kb.embedding <=> query_embedding
  limit match_count;
end;
$$;
`;

const EDGE_FUNCTION_CODE = `// FILE: supabase/functions/fonnte-webhook/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Access environment variables securely
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  try {
    // 1. Parse Fonnte Payload
    const payload = await req.json();
    console.log("Fonnte Payload:", payload);

    // Fonnte sends: { sender: "628...", message: "text", name: "Name", device: "token/id" }
    const { sender, message, name, device } = payload;

    // Filter: Ignore status updates or empty messages
    if (!sender || !message) {
      return new Response(JSON.stringify({ status: "ignored" }), { headers: { "Content-Type": "application/json" } });
    }

    // 2. Insert Message into Database
    const { error: msgError } = await supabase.from('messages').insert({
      conversation_id: sender,
      message: message,
      direction: 'inbound',
      status: 'read' // Fonnte webhooks are typically 'received' messages
    });

    if (msgError) throw msgError;

    // 3. Upsert Conversation / Lead
    // We try to update the 'last_active' timestamp. If specific device mapping is needed,
    // you might need to query the 'devices' table using the Fonnte token first.
    
    // For now, we assume standard mapping or update existing:
    const { error: convoError } = await supabase.from('conversations').upsert({
      wa_number: sender,
      name: name || sender,
      last_active: new Date(),
      // 'device_id' will be null for new chats unless we query the devices table.
      // Ideally, perform a lookup here if you manage multiple devices.
    }, { onConflict: 'wa_number' });

    if (convoError) throw convoError;

    // 4. (Optional) Auto-reply Logic via Gemini could be triggered here
    // or handled by the frontend listening to Realtime changes.

    return new Response(JSON.stringify({ status: "ok" }), { 
      status: 200,
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error("Webhook Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400, // Return 400 so Fonnte knows something went wrong, or 200 to suppress retries
      headers: { "Content-Type": "application/json" } 
    });
  }
});
`;

export const DatabaseSetup: React.FC = () => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedEdge, setCopiedEdge] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="space-y-6 mt-6">
      
      {/* 1. DATABASE SCHEMA */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <Database size={18} className="text-blue-600" />
            1. Supabase Database Schema (SQL)
          </h3>
          <Button 
            variant="secondary" 
            onClick={() => copyToClipboard(SQL_SETUP, setCopiedSql)} 
            className="text-xs h-8"
            icon={copiedSql ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          >
            {copiedSql ? 'Copied' : 'Copy SQL'}
          </Button>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Run this in the <strong>SQL Editor</strong> of your Supabase dashboard to create the necessary tables.
          </p>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed border border-gray-700 max-h-64">
            <code>{SQL_SETUP}</code>
          </pre>
        </div>
      </div>

      {/* 2. EDGE FUNCTION */}
      <div className="bg-white rounded-lg shadow-sm border border-red-200 overflow-hidden">
        <div className="p-4 bg-red-50 border-b border-red-200 flex justify-between items-center">
          <h3 className="font-semibold text-red-800 flex items-center gap-2">
            <Globe size={18} />
            2. Webhook Handler (Edge Function)
          </h3>
          <Button 
            variant="secondary" 
            onClick={() => copyToClipboard(EDGE_FUNCTION_CODE, setCopiedEdge)} 
            className="text-xs h-8"
            icon={copiedEdge ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          >
            {copiedEdge ? 'Copied' : 'Copy Code'}
          </Button>
        </div>
        <div className="p-6">
          
          <div className="flex items-start gap-3 bg-red-100 p-3 rounded-lg mb-6 border border-red-200">
             <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />
             <div>
                <p className="text-sm font-bold text-red-800">DO NOT RUN THIS IN SQL EDITOR!</p>
                <p className="text-xs text-red-700 mt-1">
                    This is TypeScript code for a server-side function. It must be deployed via CLI.
                </p>
             </div>
          </div>

          <button 
            onClick={() => setShowTutorial(!showTutorial)}
            className="w-full flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg mb-4 hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Terminal size={16} />
                Tutorial: How to Deploy this Function
            </span>
            {showTutorial ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {showTutorial && (
              <div className="bg-gray-800 text-gray-200 p-4 rounded-lg text-xs font-mono mb-4 space-y-3 border border-gray-700">
                  <div>
                      <p className="text-green-400 font-bold"># 1. Install Supabase CLI (Terminal)</p>
                      <p className="opacity-70">npm install -g supabase</p>
                  </div>
                  <div>
                      <p className="text-green-400 font-bold"># 2. Login to Supabase</p>
                      <p className="opacity-70">supabase login</p>
                  </div>
                  <div>
                      <p className="text-green-400 font-bold"># 3. Create Function</p>
                      <p className="opacity-70">supabase functions new fonnte-webhook</p>
                  </div>
                  <div>
                      <p className="text-green-400 font-bold"># 4. Paste Code</p>
                      <p className="opacity-70">Copy the code below and paste it into: <strong>supabase/functions/fonnte-webhook/index.ts</strong></p>
                  </div>
                  <div>
                      <p className="text-green-400 font-bold"># 5. Deploy</p>
                      <p className="opacity-70">supabase functions deploy fonnte-webhook --no-verify-jwt</p>
                  </div>
                  <div>
                      <p className="text-green-400 font-bold"># 6. Copy URL to Fonnte</p>
                      <p className="opacity-70">Get the URL from terminal output and paste to Fonnte Dashboard Webhook URL.</p>
                  </div>
              </div>
          )}

          <pre className="bg-gray-900 text-purple-100 p-4 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed border border-gray-700 max-h-80">
            <code>{EDGE_FUNCTION_CODE}</code>
          </pre>
        </div>
      </div>

    </div>
  );
};

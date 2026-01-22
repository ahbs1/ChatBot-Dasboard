import React, { useState } from 'react';
import { Button } from './Button';
import { Copy, Check, Database, Terminal, Globe } from 'lucide-react';

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

const EDGE_FUNCTION_CODE = `// SUPABASE EDGE FUNCTION: 'fonnte-webhook'
// 1. Create function: supabase functions new fonnte-webhook
// 2. Deploy: supabase functions deploy fonnte-webhook --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  try {
    const { sender, message, device } = await req.json(); // Fonnte Payload
    
    // 1. Find the device by phone number (Fonnte 'device' field usually contains the sender device info)
    // Note: You might need to adjust logic to match Fonnte's specific device ID or Token
    // For simplicity, we assume we find the device that has this 'sender' as a contact OR generic mapping.
    // Ideally, match 'device' from payload to 'phone_number' in devices table.
    
    // 2. Insert Message
    const { error } = await supabase.from('messages').insert({
      conversation_id: sender, // The user's phone number
      message: message,
      direction: 'inbound',
      status: 'read'
    });
    
    // 3. Update/Create Conversation
    await supabase.from('conversations').upsert({
      wa_number: sender,
      last_active: new Date(),
      // Simple logic: if new, default to 'bot'
    }, { onConflict: 'wa_number', ignoreDuplicates: false });

    return new Response(JSON.stringify({ status: "ok" }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 });
  }
});
`;

export const DatabaseSetup: React.FC = () => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedEdge, setCopiedEdge] = useState(false);

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
            1. Supabase Database Schema
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
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed border border-gray-700 max-h-64">
            <code>{SQL_SETUP}</code>
          </pre>
        </div>
      </div>

      {/* 2. EDGE FUNCTION */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <Globe size={18} className="text-purple-600" />
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
          <p className="text-sm text-gray-600 mb-4">
             You need to deploy this function to Supabase to receive messages from Fonnte.
             <br/>
             <strong>Webhook URL:</strong> <code>https://[your-project-ref].supabase.co/functions/v1/fonnte-webhook</code>
          </p>
          <pre className="bg-gray-900 text-purple-100 p-4 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed border border-gray-700 max-h-64">
            <code>{EDGE_FUNCTION_CODE}</code>
          </pre>
        </div>
      </div>

    </div>
  );
};

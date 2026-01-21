import React, { useState } from 'react';
import { Button } from './Button';
import { Copy, Check, Database, Terminal, Clock } from 'lucide-react';

const SQL_SETUP = `-- 1. Enable Extensions
create extension if not exists vector;
create extension if not exists pg_cron;

-- 2. Create Devices Table
create table if not exists devices (
  id text primary key, 
  name text not null, 
  phone_number text, 
  color text default 'bg-blue-500', 
  alert_email text, 
  admin_number text, -- Stores Admin WA for alerts
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

-- 7. Create System Status (For Heartbeat & QR)
create table if not exists system_status (
  id text primary key, 
  status text check (status in ('connecting', 'connected', 'qr_ready', 'disconnected')) default 'disconnected',
  qr_code text, 
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Enable Realtime for Messages & Status
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table system_status;

-- 9. Similarity Search Function (RPC)
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

-- 10. Heartbeat Monitor (Optional: prevent idle)
insert into system_status (id, status, updated_at)
values ('heartbeat', 'connected', now())
on conflict (id) do nothing;
`;

export const DatabaseSetup: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SETUP);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Database size={18} className="text-blue-600" />
          Supabase Database Setup
        </h3>
        <Button 
          variant="secondary" 
          onClick={handleCopy} 
          className="text-xs h-8"
          icon={copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
        >
          {copied ? 'Copied' : 'Copy SQL'}
        </Button>
      </div>
      
      <div className="p-6">
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start gap-2">
          <Clock size={16} className="mt-0.5" />
          <div>
            <strong>Ready for Deployment:</strong> 
            <p className="mt-1 text-xs">
              This SQL script prepares your Supabase project for the Linux Worker. 
              Run this in the Supabase <strong>SQL Editor</strong>.
            </p>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs text-gray-400 font-mono">SQL</span>
          </div>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed border border-gray-700">
            <div className="flex gap-2 mb-2 text-gray-500 border-b border-gray-700 pb-2">
              <Terminal size={14} />
              <span>SQL Editor</span>
            </div>
            <code>{SQL_SETUP}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
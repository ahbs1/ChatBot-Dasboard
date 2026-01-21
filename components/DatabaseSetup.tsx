import React, { useState } from 'react';
import { Button } from './Button';
import { Copy, Check, Database, Terminal, Clock } from 'lucide-react';

const SQL_SETUP = `-- 1. Enable Vector Extension (for RAG)
create extension if not exists vector;

-- 2. Create Devices Table
create table if not exists devices (
  id text primary key, 
  name text not null, 
  phone_number text, 
  color text default 'bg-blue-500', 
  alert_email text, 
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Knowledge Base Table
create table if not exists knowledge_base (
  id bigserial primary key,
  device_id text references devices(id) on delete cascade,
  content text,
  embedding vector(768), 
  metadata jsonb
);

-- 4. Create Leads Table (NEW: Stores extracted customer data)
create table if not exists leads (
  id bigserial primary key,
  device_id text references devices(id) on delete cascade,
  phone_number text not null,
  name text,
  address text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- CONSTRAINT: One lead per phone number per device.
  unique(device_id, phone_number) 
);

-- 5. Create Conversations Table
create table if not exists conversations (
  wa_number text primary key, 
  device_id text references devices(id) on delete set null,
  name text,
  mode text check (mode in ('bot', 'agent')) default 'bot',
  last_active timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Create Messages Table
create table if not exists messages (
  id bigserial primary key,
  conversation_id text references conversations(wa_number) on delete cascade,
  message text not null,
  direction text check (direction in ('inbound', 'outbound')) not null,
  status text check (status in ('pending', 'sent', 'delivered', 'read', 'failed')) default 'sent',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Create System Status Table
create table if not exists system_status (
  id text primary key, 
  status text check (status in ('connecting', 'connected', 'qr_ready', 'disconnected')) default 'disconnected',
  qr_code text, 
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Create Similarity Search Function
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
    knowledge_base.id,
    knowledge_base.content,
    knowledge_base.metadata,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  from knowledge_base
  where 
    knowledge_base.device_id = filter_device_id
    and 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  order by knowledge_base.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 9. PREVENT PAUSE (Heartbeat Cron Job)
-- IMPORTANT: Enable 'pg_cron' in Supabase Dashboard > Database > Extensions first!
create extension if not exists pg_cron;

-- Insert a dummy heartbeat record if not exists
insert into system_status (id, status, updated_at)
values ('heartbeat', 'connected', now())
on conflict (id) do nothing;

-- Schedule a job to run every day at midnight (UTC)
-- This updates the record, counting as 'Database Activity' to prevent pausing.
select cron.schedule(
  'daily-heartbeat',
  '0 0 * * *', 
  $$ update system_status set updated_at = now() where id = 'heartbeat' $$
);`;

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
          Supabase Database Setup (With Anti-Pause Cron)
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
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 flex items-start gap-2">
          <Clock size={16} className="mt-0.5" />
          <div>
            <strong>Prevent Project Pausing:</strong> 
            <p className="mt-1 text-xs">
              Added Section 9 to the SQL. This sets up <code>pg_cron</code> to update a 'heartbeat' record every day at midnight. 
              This artificial activity keeps your Free Tier Supabase project alive.
              <br/>
              <em>Note: You might need to enable the <strong>pg_cron</strong> extension manually in the Supabase Dashboard under "Database" {'>'} "Extensions" if this script fails.</em>
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
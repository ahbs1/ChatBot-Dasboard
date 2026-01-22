import React, { useState } from 'react';
import { Button } from './Button';
import { Copy, Check, Database, Globe, AlertTriangle, Terminal, Github, ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react';

const SQL_SETUP = `-- ⚠️ 1. FIX PERMISSIONS (CRITICAL FIX)
-- Jalankan ini untuk mengatasi "permission denied for sequence"
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Create Tables (Idempotent - aman dijalankan berulang)
create table if not exists devices (id text primary key, name text not null, phone_number text, color text default 'bg-blue-500', fonnte_token text, alert_email text, admin_number text, created_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table if not exists conversations (wa_number text primary key, device_id text references devices(id) on delete set null, name text, mode text check (mode in ('bot', 'agent')) default 'bot', last_active timestamp with time zone default timezone('utc'::text, now()) not null);
create table if not exists messages (id bigserial primary key, conversation_id text references conversations(wa_number) on delete cascade, message text not null, direction text check (direction in ('inbound', 'outbound')) not null, status text check (status in ('pending', 'sent', 'delivered', 'read', 'failed')) default 'sent', created_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table if not exists knowledge_base (id bigserial primary key, device_id text references devices(id) on delete cascade, content text, embedding vector(768), metadata jsonb);
create table if not exists leads (id bigserial primary key, device_id text references devices(id) on delete cascade, phone_number text not null, name text, address text, updated_at timestamp with time zone default timezone('utc'::text, now()) not null, unique(device_id, phone_number));

-- 3. DISABLE SECURITY (RLS) FOR DASHBOARD
alter table devices disable row level security;
alter table conversations disable row level security;
alter table messages disable row level security;
alter table knowledge_base disable row level security;
alter table leads disable row level security;

-- 4. ENABLE REALTIME (SAFE MODE)
-- Menggunakan DO block agar tidak error jika tabel sudah ada di realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE leads;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 5. Vector Function
create or replace function match_documents (query_embedding vector(768), match_threshold float, match_count int, filter_device_id text)
returns table (id bigint, content text, metadata jsonb, similarity float)
language plpgsql
as $$
begin
  return query
  select kb.id, kb.content, kb.metadata, 1 - (kb.embedding <=> query_embedding) as similarity
  from knowledge_base kb
  where kb.device_id = filter_device_id and 1 - (kb.embedding <=> query_embedding) > match_threshold
  order by kb.embedding <=> query_embedding
  limit match_count;
end;
$$;
`;

const EDGE_FUNCTION_CODE = `// FILE: supabase/functions/fonnte-webhook/index.ts
// Lihat file fisik di project Anda untuk kode lengkap.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ... (Kode lengkap ada di file fisik) ...
`;

export const DatabaseSetup: React.FC = () => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [deployMode, setDeployMode] = useState<'cli' | 'github'>('github');

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="space-y-8 mt-6">
      
      {/* 1. DATABASE FIX */}
      <div className="bg-white rounded-lg shadow-sm border border-red-200 overflow-hidden ring-2 ring-red-100">
        <div className="p-4 bg-red-50 border-b border-red-200 flex justify-between items-center">
          <h3 className="font-bold text-red-800 flex items-center gap-2">
            <ShieldAlert size={20} />
            1. Perbaikan Database (Script Baru & Aman)
          </h3>
          <Button 
            variant="danger" 
            onClick={() => copyToClipboard(SQL_SETUP, setCopiedSql)} 
            className="text-xs h-8"
            icon={copiedSql ? <Check size={14} /> : <Copy size={14} />}
          >
            {copiedSql ? 'Copied' : 'Copy SQL Fix'}
          </Button>
        </div>
        <div className="p-6">
          <div className="bg-green-50 border border-green-200 p-3 rounded mb-4 text-xs text-green-800">
             <strong>UPDATE:</strong> Script ini sudah diperbarui agar tidak error "Relation already exists". <br/>
             Silakan copy dan jalankan sekali lagi di Supabase SQL Editor untuk memastikan 100% aman.
          </div>
          <pre className="bg-gray-900 text-yellow-100 p-4 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed border border-gray-700 max-h-48">
            <code>{SQL_SETUP}</code>
          </pre>
        </div>
      </div>

      {/* 2. EDGE FUNCTION */}
      <div className="bg-white rounded-lg shadow-sm border border-purple-200 overflow-hidden">
        <div className="p-4 bg-purple-50 border-b border-purple-200">
          <h3 className="font-semibold text-purple-800 flex items-center gap-2 mb-1">
            <Globe size={18} />
            2. Webhook / Edge Function
          </h3>
          <p className="text-xs text-purple-600">Pastikan URL Webhook di Fonnte sudah benar (lihat tutorial Deploy via GitHub di bawah).</p>
        </div>

        <div className="p-4 border-b border-gray-100 bg-white">
            <div className="flex gap-4">
                <button 
                    onClick={() => setDeployMode('github')}
                    className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-all ${deployMode === 'github' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                >
                    <Github size={16} />
                    Cara Tanpa Terminal (GitHub)
                </button>
                <button 
                    onClick={() => setDeployMode('cli')}
                    className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-all ${deployMode === 'cli' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                >
                    <Terminal size={16} />
                    Cara Terminal (CLI)
                </button>
            </div>
        </div>

        <div className="p-6 bg-gray-50">
          {deployMode === 'github' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                      <h4 className="font-bold text-blue-900 text-sm mb-2">Langkah Deploy:</h4>
                      <ol className="list-decimal list-inside text-xs text-blue-800 space-y-2 leading-relaxed">
                          <li>Upload project ini ke <strong>GitHub</strong>.</li>
                          <li>Buka Dashboard Supabase &gt; Edge Functions &gt; <strong>Connect to GitHub</strong>.</li>
                          <li>Setelah status "Active", copy URL Function.</li>
                          <li>Paste ke Fonnte &gt; Device &gt; Webhook URL.</li>
                      </ol>
                  </div>
              </div>
          )}
           {deployMode === 'cli' && (
             <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="bg-gray-900 text-gray-200 p-4 rounded-lg font-mono text-xs space-y-3">
                      <p className="text-green-400">supabase functions deploy fonnte-webhook --no-verify-jwt</p>
                  </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

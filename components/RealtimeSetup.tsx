import React, { useState } from 'react';
import { Button } from './Button';
import { Copy, Check, Radio, Activity } from 'lucide-react';

const REALTIME_CODE = `import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const useRealtimeChat = (
  onNewMessage: (msg: any) => void,
  onConversationUpdate: (conv: any) => void
) => {
  useEffect(() => {
    // Subscribe to changes in the 'messages' table
    const messageSub = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('New Message:', payload.new);
          onNewMessage(payload.new);
        }
      )
      .subscribe();

    // Subscribe to changes in the 'conversations' table (e.g. status/mode changes)
    const conversationSub = supabase
      .channel('public:conversations')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          console.log('Conversation Updated:', payload.new);
          onConversationUpdate(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageSub);
      supabase.removeChannel(conversationSub);
    };
  }, [onNewMessage, onConversationUpdate]);
};`;

export const RealtimeSetup: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(REALTIME_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mt-6">
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Activity size={18} className="text-red-500" />
          Real-time Listener (Module 3)
        </h3>
        <Button 
          variant="secondary" 
          onClick={handleCopy} 
          className="text-xs h-8"
          icon={copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
        >
          {copied ? 'Copied' : 'Copy Code'}
        </Button>
      </div>
      
      <div className="p-6">
        <div className="mb-4 text-sm text-gray-600">
           <p className="mb-2">
             To make the dashboard update instantly when the Bot (Edge Function) or WhatsApp sends a message, use <strong>Supabase Realtime</strong>.
           </p>
           <ul className="list-disc ml-5 space-y-1 text-gray-500 text-xs">
             <li>Listens for <code>INSERT</code> events on the <code>messages</code> table.</li>
             <li>Listens for <code>UPDATE</code> events on the <code>conversations</code> table (e.g., switching Bot/Human mode).</li>
             <li>No need for page refreshes or polling.</li>
           </ul>
        </div>

        <div className="relative group">
          <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs text-gray-400 font-mono">React Hook</span>
          </div>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed border border-gray-700">
            <code>{REALTIME_CODE}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
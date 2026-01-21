import React, { useState } from 'react';
import { Button } from './Button';
import { Copy, Check, Activity, AlertTriangle, Database } from 'lucide-react';

const REALTIME_CODE = `// This logic is ALREADY RUNNING in 'hooks/useRealtime.ts'
// You do NOT need to add this manually anywhere.

const messageSub = supabase
  .channel('public:messages')
  .on('postgres_changes', { event: 'INSERT', ... }, (payload) => {
      console.log('New Message:', payload.new);
  })
  .subscribe();

// REQUIREMENT:
// You MUST run the SQL command below in Supabase to enable this:
// "alter publication supabase_realtime add table messages;"`;

export const RealtimeSetup: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText("alter publication supabase_realtime add table messages, conversations, system_status;");
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
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left: Explanation */}
          <div>
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-green-100 p-2 rounded-full text-green-700 mt-1">
                <Check size={16} />
              </div>
              <div>
                <h4 className="font-bold text-gray-800 text-sm">Frontend Code: Installed ✅</h4>
                <p className="text-xs text-gray-500 mt-1">
                  The React code to <i>listen</i> for changes is already built into this app (`hooks/useRealtime.ts`). You don't need to do anything with the code block on the right.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-orange-100 p-2 rounded-full text-orange-700 mt-1">
                <Database size={16} />
              </div>
              <div>
                <h4 className="font-bold text-gray-800 text-sm">Database Config: Required ⚠️</h4>
                <p className="text-xs text-gray-500 mt-1">
                  By default, Supabase creates tables silently. You must explicitly tell Supabase to <strong>Broadcast</strong> changes to the frontend.
                </p>
                
                <div className="mt-3 bg-orange-50 border border-orange-200 p-3 rounded-lg">
                  <p className="text-xs font-bold text-orange-800 mb-1">Run this SQL in Supabase:</p>
                  <code className="block text-[10px] font-mono bg-white p-2 border rounded text-gray-700 mb-2">
                    alter publication supabase_realtime add table messages, conversations, system_status;
                  </code>
                  <Button 
                    variant="secondary" 
                    onClick={handleCopy} 
                    className="text-[10px] h-6 px-2 w-full"
                    icon={copied ? <Check size={10} /> : <Copy size={10} />}
                  >
                    {copied ? 'Copied to Clipboard' : 'Copy SQL Command'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Code Viewer */}
          <div className="relative group">
            <div className="absolute top-0 right-0 p-2 opacity-50">
              <span className="text-xs text-gray-400 font-mono">hooks/useRealtime.ts</span>
            </div>
            <pre className="bg-gray-900 text-gray-400 p-4 rounded-lg overflow-x-auto text-[10px] font-mono leading-relaxed border border-gray-700 h-full flex flex-col justify-center">
              <code>{REALTIME_CODE}</code>
            </pre>
          </div>

        </div>
      </div>
    </div>
  );
};
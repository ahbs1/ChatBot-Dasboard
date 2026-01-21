import React, { useState } from 'react';
import { Button } from './Button';
import { Check, Copy, Server, FileText, Download, Terminal } from 'lucide-react';

export const BackendLogicViewer: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mt-6">
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Server size={18} className="text-purple-600" />
          Linux Worker Files (Generated)
        </h3>
      </div>
      
      <div className="p-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h4 className="font-bold text-green-800 text-sm mb-2 flex items-center gap-2">
            <Check size={16} /> 
            Files Generated Successfully
          </h4>
          <p className="text-xs text-green-700 leading-relaxed">
            I have generated the actual code files for your Linux server. 
            Please check the project folder structure:
          </p>
          <ul className="list-disc list-inside mt-2 text-xs text-green-800 font-mono">
            <li>/server/index.js (The Main Worker Logic)</li>
            <li>/server/package.json (Dependencies)</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-bold text-gray-800 text-sm">Deployment Instructions (Linux/VPS)</h4>
          
          <div className="bg-gray-900 text-gray-200 p-4 rounded-lg font-mono text-xs shadow-inner">
            <p className="text-gray-500 mb-2"># 1. On your server, create a folder</p>
            <p className="mb-2">mkdir wa-worker && cd wa-worker</p>
            
            <p className="text-gray-500 mb-2 mt-4"># 2. Upload 'server/index.js' and 'server/package.json' here</p>
            <p className="text-gray-500 mb-2"># (You do NOT need to upload the frontend files)</p>
            
            <p className="text-gray-500 mb-2 mt-4"># 3. Install dependencies</p>
            <p className="mb-2">npm install</p>

            <p className="text-gray-500 mb-2 mt-4"># 4. Create .env file</p>
            <p className="mb-1">echo "SUPABASE_URL=..." >> .env</p>
            <p className="mb-1">echo "SUPABASE_SERVICE_KEY=..." >> .env</p>
            <p className="mb-2">echo "GEMINI_API_KEY=..." >> .env</p>

            <p className="text-gray-500 mb-2 mt-4"># 5. Start with PM2 (Background Process)</p>
            <p className="mb-2">npm install -g pm2</p>
            <p className="mb-2">pm2 start index.js --name wa-worker</p>
            
            <p className="text-gray-500 mb-2 mt-4"># 6. Enable Auto-Restart on Reboot (Power Failure Safe)</p>
            <p className="mb-2">pm2 startup</p>
            <p className="text-gray-500 mb-2"># Run the command output by the line above, then:</p>
            <p className="mb-2">pm2 save</p>

            <p className="text-gray-500 mb-2 mt-4"># Useful Commands</p>
            <p className="mb-1">pm2 logs wa-worker  # View logs/QR Code</p>
            <p className="mb-1">pm2 restart wa-worker</p>
            <p className="mb-1">pm2 stop wa-worker</p>
          </div>
        </div>
      </div>
    </div>
  );
};
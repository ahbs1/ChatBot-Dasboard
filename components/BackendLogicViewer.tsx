import React, { useState } from 'react';
import { Button } from './Button';
import { Check, Copy, Server, FileText, Download, Terminal, AlertTriangle } from 'lucide-react';

export const BackendLogicViewer: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mt-6">
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Server size={18} className="text-purple-600" />
          Linux Worker Files (Updated for whatsapp-web.js)
        </h3>
      </div>
      
      <div className="p-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h4 className="font-bold text-green-800 text-sm mb-2 flex items-center gap-2">
            <Check size={16} /> 
            Code Switched to Puppeteer Engine
          </h4>
          <p className="text-xs text-green-700 leading-relaxed">
             We have switched from Baileys to <strong>whatsapp-web.js</strong> for better stability.
             <br/>
             Since you are on an STB/Linux, you <strong>MUST install Chromium</strong> manually.
          </p>
        </div>

        {/* Troubleshooting Section */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
             <h4 className="font-bold text-red-800 text-sm mb-2 flex items-center gap-2">
                <AlertTriangle size={16} />
                CRITICAL STB REQUIREMENT
             </h4>
             <p className="text-xs text-red-800 mb-2">
                 Puppeteer needs a browser. On ARM devices (STB), downloading Chrome automatically fails.
                 Run this command on your terminal:
             </p>
             <div className="bg-black text-white p-3 rounded font-mono text-[10px] space-y-2">
                 <p>sudo apt-get update</p>
                 <p>sudo apt-get install chromium-browser -y</p>
                 <p className="text-gray-500"># Or simply 'chromium' on some distros</p>
             </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-bold text-gray-800 text-sm">Update Instructions</h4>
          
          <div className="bg-gray-900 text-gray-200 p-4 rounded-lg font-mono text-xs shadow-inner">
            <p className="text-gray-500 mb-2"># 1. Update your code files first (Upload new index.js & package.json)</p>
            
            <p className="text-gray-500 mb-2 mt-4"># 2. Clean old node_modules</p>
            <p className="mb-2">cd /root/wa-worker</p>
            <p className="mb-2">rm -rf node_modules package-lock.json</p>
            
            <p className="text-gray-500 mb-2 mt-4"># 3. Install dependencies</p>
            <p className="mb-2">npm install</p>

            <p className="text-gray-500 mb-2 mt-4"># 4. Install Chromium (System Browser)</p>
            <p className="mb-2">apt install chromium</p>

            <p className="text-gray-500 mb-2 mt-4"># 5. Restart Worker</p>
            <p className="mb-2">pm2 restart wa-worker</p>
            <p className="mb-1">pm2 logs wa-worker</p>
          </div>
        </div>
      </div>
    </div>
  );
};
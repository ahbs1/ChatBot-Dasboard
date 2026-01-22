import React from 'react';
import { Server, Check, ArrowRight, Globe } from 'lucide-react';

export const BackendLogicViewer: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mt-6">
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Globe size={18} className="text-green-600" />
          Fonnte Webhook Integration
        </h3>
      </div>
      
      <div className="p-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h4 className="font-bold text-green-800 text-sm mb-2 flex items-center gap-2">
            <Check size={16} /> 
            Serverless Architecture
          </h4>
          <p className="text-xs text-green-700 leading-relaxed">
             We have removed the need for a local Node.js worker. 
             <br/>
             <strong>Outbound:</strong> Messages are sent directly via Fonnte API from the dashboard (or edge function).
             <br/>
             <strong>Inbound:</strong> Messages are received via Supabase Edge Functions (Webhook).
          </p>
        </div>

        <div className="space-y-4">
          <h4 className="font-bold text-gray-800 text-sm">How Data Flows</h4>
          
          <div className="flex items-center gap-4 text-xs font-mono bg-gray-100 p-4 rounded-lg">
             <div className="flex flex-col items-center">
                <span className="font-bold">WhatsApp</span>
                <span className="text-gray-500">(User)</span>
             </div>
             <ArrowRight className="text-gray-400" size={16} />
             <div className="flex flex-col items-center">
                <span className="font-bold text-green-600">Fonnte</span>
                <span className="text-gray-500">(Cloud API)</span>
             </div>
             <ArrowRight className="text-gray-400" size={16} />
             <div className="flex flex-col items-center">
                <span className="font-bold text-purple-600">Supabase</span>
                <span className="text-gray-500">(Edge Function)</span>
             </div>
             <ArrowRight className="text-gray-400" size={16} />
             <div className="flex flex-col items-center">
                <span className="font-bold">Dashboard</span>
                <span className="text-gray-500">(Realtime)</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Key, Database, Globe, Smartphone, MessageSquare } from 'lucide-react';

interface GuideStepProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

const GuideStep: React.FC<GuideStepProps> = ({ title, icon: Icon, children, isOpen, onToggle }) => (
  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm mb-4">
    <button 
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${isOpen ? 'bg-wa-green text-white' : 'bg-gray-200 text-gray-500'}`}>
          <Icon size={20} />
        </div>
        <span className={`font-semibold ${isOpen ? 'text-gray-900' : 'text-gray-600'}`}>{title}</span>
      </div>
      {isOpen ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
    </button>
    {isOpen && (
      <div className="p-6 border-t border-gray-100 text-sm text-gray-700 leading-relaxed space-y-4">
        {children}
      </div>
    )}
  </div>
);

export const IntegrationGuide: React.FC = () => {
  const [openStep, setOpenStep] = useState<number | null>(0);

  const toggle = (index: number) => setOpenStep(openStep === index ? null : index);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl">
        <h2 className="text-xl font-bold text-blue-900 mb-2">Fonnte Integration Guide</h2>
        <p className="text-blue-700 text-sm">
          Follow these steps to connect your WhatsApp using Fonnte Cloud API.
        </p>
      </div>

      <div>
        {/* Step 1: Fonnte Account */}
        <GuideStep 
          title="1. Fonnte Account & Token" 
          icon={MessageSquare} 
          isOpen={openStep === 0} 
          onToggle={() => toggle(0)}
        >
          <ul className="list-disc pl-5 space-y-2">
            <li>Register at <a href="https://fonnte.com" className="text-blue-600 underline" target="_blank">fonnte.com</a>.</li>
            <li>Connect your WhatsApp number in their dashboard.</li>
            <li>Go to <strong>API</strong> menu and copy your <strong>API Token</strong>.</li>
          </ul>
        </GuideStep>

        {/* Step 2: Configure Dashboard */}
        <GuideStep 
          title="2. Add Device in Dashboard" 
          icon={Smartphone} 
          isOpen={openStep === 1} 
          onToggle={() => toggle(1)}
        >
          <ul className="list-disc pl-5 space-y-2">
            <li>Go to the <strong>Devices</strong> tab in this app.</li>
            <li>Click <strong>Add Device</strong>.</li>
            <li>Enter the Name, WhatsApp Number, and paste the <strong>Fonnte API Token</strong>.</li>
          </ul>
        </GuideStep>

        {/* Step 3: Database & Webhook */}
        <GuideStep 
          title="3. Deploy Webhook (Supabase)" 
          icon={Database} 
          isOpen={openStep === 2} 
          onToggle={() => toggle(2)}
        >
          <p>To receive incoming messages:</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Go to the <strong>Config</strong> tab here and copy the <strong>Edge Function Code</strong>.</li>
            <li>Deploy this function to Supabase: <code>supabase functions deploy fonnte-webhook</code>.</li>
            <li>Get the function URL: <code>https://[project].supabase.co/functions/v1/fonnte-webhook</code>.</li>
            <li>Go to <a href="https://md.fonnte.com/new/device.php" target="_blank" className="text-blue-600 underline">Fonnte Device Settings</a>.</li>
            <li>Paste the URL into the <strong>Webhook URL</strong> field.</li>
            <li>Enable <strong>Webhook Status</strong>.</li>
          </ol>
        </GuideStep>

        {/* Step 4: Testing */}
        <GuideStep 
          title="4. Test Connection" 
          icon={Globe} 
          isOpen={openStep === 3} 
          onToggle={() => toggle(3)}
        >
          <p>Send a message from your phone to the connected WhatsApp number. It should appear in this dashboard instantly!</p>
        </GuideStep>
      </div>
    </div>
  );
};

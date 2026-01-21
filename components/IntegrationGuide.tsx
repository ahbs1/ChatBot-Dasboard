import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Key, Database, Server, Globe, Smartphone, CheckCircle2 } from 'lucide-react';

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
        <h2 className="text-xl font-bold text-blue-900 mb-2">Complete Integration Guide</h2>
        <p className="text-blue-700 text-sm">
          Follow these 5 steps to get your WhatsAgent AI fully operational.
        </p>
      </div>

      <div>
        {/* Step 1: API Keys */}
        <GuideStep 
          title="1. Get API Keys & Services" 
          icon={Key} 
          isOpen={openStep === 0} 
          onToggle={() => toggle(0)}
        >
          <p>Before writing code, you need two external services:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Google Gemini API:</strong> Go to <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline">Google AI Studio</a>. Create a new API Key. This powers the chatbot brain.
            </li>
            <li>
              <strong>Supabase:</strong> Go to <a href="https://supabase.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline">Supabase.com</a> and create a new project.
              <ul className="list-disc pl-5 mt-1 text-gray-500 text-xs">
                <li>Go to <strong>Project Settings</strong> {'>'} <strong>API</strong>.</li>
                <li>Copy the <code>Project URL</code>.</li>
                <li>Copy the <code>anon public</code> key (for Frontend).</li>
                <li>Copy the <code>service_role</code> secret key (for Backend Worker).</li>
              </ul>
            </li>
          </ul>
        </GuideStep>

        {/* Step 2: Database */}
        <GuideStep 
          title="2. Database Initialization" 
          icon={Database} 
          isOpen={openStep === 1} 
          onToggle={() => toggle(1)}
        >
          <p>You need to create the tables in Supabase to store messages and knowledge base vectors.</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Copy the SQL script provided in the <strong>"Supabase Database Setup"</strong> section below.</li>
            <li>Go to your Supabase Dashboard {'>'} <strong>SQL Editor</strong>.</li>
            <li>Paste the script and click <strong>Run</strong>.</li>
            <li>This creates tables like <code>messages</code>, <code>devices</code>, and enables <code>pgvector</code> extension.</li>
          </ol>
        </GuideStep>

        {/* Step 3: Frontend Deployment */}
        <GuideStep 
          title="3. Frontend Deployment (Netlify/Vercel)" 
          icon={Globe} 
          isOpen={openStep === 2} 
          onToggle={() => toggle(2)}
        >
          <p>Deploy this dashboard so you can access it from anywhere.</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Push this code to <strong>GitHub</strong>.</li>
            <li>Import the repo in Netlify or Vercel.</li>
            <li><strong>Crucial:</strong> Add Environment Variables in the deployment settings:
               <div className="bg-gray-100 p-3 rounded mt-2 font-mono text-xs overflow-x-auto">
                 VITE_SUPABASE_URL=https://your-project.supabase.co<br/>
                 VITE_SUPABASE_ANON_KEY=your-public-anon-key<br/>
                 VITE_GEMINI_API_KEY=your-gemini-key
               </div>
            </li>
            <li>Deploy. Your dashboard is now live!</li>
          </ul>
        </GuideStep>

        {/* Step 4: Backend Worker */}
        <GuideStep 
          title="4. Backend Worker Setup (VPS)" 
          icon={Server} 
          isOpen={openStep === 3} 
          onToggle={() => toggle(3)}
        >
          <p>The backend runs the WhatsApp socket (Baileys) and handles AI processing. It needs to stay alive 24/7.</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Get a Linux VPS (DigitalOcean, AWS, or Railway).</li>
            <li>Install Node.js: <code>sudo apt install nodejs npm</code>.</li>
            <li>Create a folder <code>wa-worker</code>.</li>
            <li>Upload the content of the <code>server/</code> folder (index.js, package.json).</li>
            <li>Run <code>npm install</code>.</li>
            <li>Create a <code>.env</code> file:
               <div className="bg-gray-100 p-3 rounded mt-2 font-mono text-xs overflow-x-auto">
                 SUPABASE_URL=...<br/>
                 SUPABASE_SERVICE_KEY=... (Must use SERVICE ROLE key here)<br/>
                 GEMINI_API_KEY=...
               </div>
            </li>
            <li>Start with PM2: <code>pm2 start index.js --name wa-worker</code>.</li>
            <li>Setup auto-restart: <code>pm2 startup</code> then <code>pm2 save</code>.</li>
          </ol>
        </GuideStep>

        {/* Step 5: Connect WhatsApp */}
        <GuideStep 
          title="5. Connect WhatsApp Device" 
          icon={Smartphone} 
          isOpen={openStep === 4} 
          onToggle={() => toggle(4)}
        >
          <p>Final step to link your real WhatsApp number.</p>
          <ol className="list-decimal pl-5 space-y-2">
             <li>Open this Dashboard. Go to <strong>WhatsApp Devices</strong> tab.</li>
             <li>Add a new Device (Give it a name and Admin number).</li>
             <li>The backend worker will pick up the new device request.</li>
             <li>Wait for the Status to change to <strong>QR Ready</strong> on the screen.</li>
             <li>Scan the QR code using your WhatsApp (Linked Devices).</li>
             <li>Once connected, the AI will start listening to incoming messages automatically!</li>
          </ol>
        </GuideStep>
      </div>
    </div>
  );
};
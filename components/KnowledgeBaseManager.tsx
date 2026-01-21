import React, { useState } from 'react';
import { RAGDocument, Device } from '../types';
import { generateEmbedding } from '../services/geminiService';
import { supabase } from '../lib/supabaseClient';
import { Button } from './Button';
import { BookOpen, Plus, FileText, Trash2, Cpu, CheckCircle, AlertTriangle, Smartphone } from 'lucide-react';

interface KnowledgeBaseManagerProps {
  documents: RAGDocument[];
  devices: Device[];
  onAddDocuments: (newDocs: RAGDocument[]) => void;
}

export const KnowledgeBaseManager: React.FC<KnowledgeBaseManagerProps> = ({ documents, devices, onAddDocuments }) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(devices[0]?.id || '');
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Filter docs for display based on selection
  const filteredDocs = documents.filter(d => d.deviceId === selectedDeviceId);
  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  const handleProcess = async () => {
    if (!inputText.trim() || !title.trim() || !selectedDeviceId) return;

    setIsProcessing(true);
    setStatusMsg(null);
    
    try {
      // 1. Chunking Logic
      const chunkSize = 500;
      const chunks: string[] = [];
      for (let i = 0; i < inputText.length; i += chunkSize) {
        chunks.push(inputText.slice(i, i + chunkSize));
      }

      const newDocs: RAGDocument[] = [];
      let successCount = 0;

      // 2. Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // A. Generate Embedding via Gemini
        const embedding = await generateEmbedding(chunk);

        if (!embedding) {
          console.error(`Failed to generate embedding for chunk ${i}`);
          continue;
        }

        const metadata = {
          source: 'admin_dashboard',
          title: title,
          chunk_index: i,
          original_length: inputText.length
        };

        // B. Save to Supabase DB (With Device ID!)
        const { data, error } = await supabase
          .from('knowledge_base')
          .insert({
            device_id: selectedDeviceId, // <--- CRITICAL: Isolate data
            content: chunk,
            embedding: embedding,
            metadata: metadata
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          newDocs.push({
            id: data.id.toString(),
            deviceId: selectedDeviceId,
            title: `${title} (Part ${i + 1})`,
            content: chunk,
            similarity: 1, 
            metadata: { ...metadata }
          });
          successCount++;
        }
      }

      onAddDocuments(newDocs);
      setInputText('');
      setTitle('');
      setStatusMsg({ type: 'success', text: `Saved ${successCount} chunks for ${selectedDevice?.name}.` });

    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: `Error: ${err.message || 'Failed'}` });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 bg-gray-50 p-8 overflow-y-auto h-full">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        
        {/* Left Column: Upload Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Plus size={20} className="text-wa-green" />
              Add Knowledge
            </h2>
            
            <div className="space-y-4">
              {/* Device Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Device (Business)</label>
                <div className="relative">
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="w-full border-gray-300 rounded-lg text-sm p-2.5 bg-gray-50 focus:ring-wa-green focus:border-wa-green appearance-none"
                  >
                    {devices.map(dev => (
                      <option key={dev.id} value={dev.id}>{dev.name} ({dev.phoneNumber})</option>
                    ))}
                  </select>
                  <Smartphone className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={16} />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Knowledge will ONLY be used by this specific bot.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Brick Pricing 2024"
                  className="w-full border-gray-300 rounded-lg text-sm p-2.5 bg-gray-50 focus:ring-wa-green focus:border-wa-green"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content (Text)</label>
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste info here..."
                  className="w-full h-48 border-gray-300 rounded-lg text-sm p-2.5 bg-gray-50 focus:ring-wa-green focus:border-wa-green resize-none"
                />
              </div>

              {statusMsg && (
                <div className={`p-3 rounded-md text-xs flex items-center gap-2 ${statusMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {statusMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                  {statusMsg.text}
                </div>
              )}

              <div className="pt-2">
                <Button 
                  onClick={handleProcess} 
                  isLoading={isProcessing} 
                  disabled={!inputText.trim() || !title.trim() || !selectedDeviceId}
                  className="w-full"
                  icon={<Cpu size={16} />}
                >
                  Save to {selectedDevice?.name || 'Device'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: List of Documents */}
        <div className="lg:col-span-2 flex flex-col h-full overflow-hidden">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
              <div className="flex items-center gap-3">
                 <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <BookOpen size={20} className="text-purple-600" />
                  Knowledge Base
                </h2>
                {selectedDevice && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${selectedDevice.color} bg-opacity-10 text-gray-700 flex items-center gap-1`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedDevice.color}`}></span>
                    Filtered: {selectedDevice.name}
                  </span>
                )}
              </div>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                {filteredDocs.length} Vectors
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <FileText size={48} className="mb-2 opacity-20" />
                  <p>No knowledge for this device yet.</p>
                </div>
              ) : (
                filteredDocs.map((doc) => (
                  <div key={doc.id} className="group flex flex-col bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                         <div className="bg-purple-100 p-1.5 rounded text-purple-600">
                            <FileText size={16} />
                         </div>
                         <h3 className="font-semibold text-gray-800 text-sm">{doc.title}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                         <button className="text-gray-300 hover:text-red-500 transition-colors p-1">
                           <Trash2 size={14} />
                         </button>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2 rounded mb-2 font-mono">
                      {doc.content.substring(0, 120)}...
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
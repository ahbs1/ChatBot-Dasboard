import React, { useState, useEffect, useCallback } from 'react';
import { Contact, Message, SenderType, AppView, RAGDocument, Direction, Device } from './types';
import { MOCK_CONTACTS, MOCK_MESSAGES, MOCK_RAG_DOCS, MOCK_DEVICES } from './constants';
import { ChatList } from './components/ChatList';
import { ChatWindow } from './components/ChatWindow';
import { KnowledgePanel } from './components/KnowledgePanel';
import { KnowledgeBaseManager } from './components/KnowledgeBaseManager';
import { DatabaseSetup } from './components/DatabaseSetup';
import { BackendLogicViewer } from './components/BackendLogicViewer';
import { RealtimeSetup } from './components/RealtimeSetup';
import { DeviceManager } from './components/DeviceManager';
import { MessageSquare, BookOpen, Settings, LayoutGrid, Smartphone } from 'lucide-react';
import { useRealtime } from './hooks/useRealtime';
import { supabase } from './lib/supabaseClient';
import { generateEmbedding } from './services/geminiService';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>(AppView.DASHBOARD);
  
  // State
  const [devices, setDevices] = useState<Device[]>(MOCK_DEVICES);
  const [contacts, setContacts] = useState<Contact[]>(MOCK_CONTACTS);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>(MOCK_MESSAGES);
  const [ragDocs, setRagDocs] = useState<RAGDocument[]>(MOCK_RAG_DOCS);
  
  // Computed
  const selectedContact = contacts.find(c => c.id === selectedContactId);
  const currentMessages = selectedContactId ? (allMessages[selectedContactId] || []) : [];

  // --- Realtime Integration ---
  
  const handleRealtimeMessage = useCallback((newMsg: Message, contactId: string) => {
    // 1. Add message to state
    setAllMessages(prev => {
      const existing = prev[contactId] || [];
      if (existing.some(m => m.id === newMsg.id)) return prev;
      return {
        ...prev,
        [contactId]: [...existing, newMsg]
      };
    });

    // 2. Update Sidebar
    setContacts(prev => prev.map(c => 
      c.id === contactId 
        ? { 
            ...c, 
            lastMessage: newMsg.text, 
            lastMessageTime: newMsg.timestamp,
            unreadCount: (selectedContactId !== contactId) ? c.unreadCount + 1 : c.unreadCount
          } 
        : c
    ).sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()));
  }, [selectedContactId]);

  const handleRealtimeContactUpdate = useCallback((contactId: string, updates: Partial<Contact>) => {
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, ...updates } : c));
  }, []);

  useRealtime(handleRealtimeMessage, handleRealtimeContactUpdate);

  // ----------------------------

  const updateContactLastMessage = (contactId: string, text: string) => {
    setContacts(prev => prev.map(c => 
      c.id === contactId 
        ? { ...c, lastMessage: text, lastMessageTime: new Date() } 
        : c
    ).sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()));
  };

  const handleSendMessage = async (text: string, sender: SenderType, teachBot: boolean) => {
    if (!selectedContactId || !selectedContact) return;

    const tempId = 'temp-' + Date.now();
    const newMessage: Message = {
      id: tempId,
      text,
      sender,
      direction: Direction.OUTBOUND,
      timestamp: new Date(),
      status: 'sent'
    };

    setAllMessages(prev => ({
      ...prev,
      [selectedContactId]: [...(prev[selectedContactId] || []), newMessage]
    }));
    updateContactLastMessage(selectedContactId, text);

    // 1. Send Message via Supabase/Worker
    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedContactId,
        message: text,
        direction: 'outbound',
        status: 'pending'
      });
      if (error) throw error;
    } catch (err) {
      console.error("Failed to insert message:", err);
    }

    // 2. Train Bot (If checked)
    if (teachBot) {
      // Find the last user question to associate this answer with
      const history = allMessages[selectedContactId] || [];
      const lastUserMsg = [...history].reverse().find(m => m.direction === Direction.INBOUND);
      
      if (lastUserMsg) {
        console.log("Training bot with pair:", lastUserMsg.text, "->", text);
        try {
          // A. Create a comprehensive content block (Q&A format helps context)
          const newKnowledgeContent = `Q: ${lastUserMsg.text}\nA: ${text}`;
          
          // B. Generate Embedding for the QUESTION (so similar questions find this)
          // Alternatively, we embed the whole Q&A. Embedding the Q implies "If user asks X, retrieve this".
          const embedding = await generateEmbedding(newKnowledgeContent);

          if (embedding) {
            const { data, error: kbError } = await supabase.from('knowledge_base').insert({
              device_id: selectedContact.deviceId,
              content: newKnowledgeContent,
              embedding: embedding,
              metadata: {
                type: 'human_correction',
                original_question: lastUserMsg.text,
                added_at: new Date().toISOString()
              }
            }).select().single();

            if (!kbError && data) {
              // Update local state to show instant feedback in Knowledge Panel
              const newDoc: RAGDocument = {
                id: data.id.toString(),
                deviceId: selectedContact.deviceId,
                title: 'Human Correction (New)',
                content: newKnowledgeContent,
                similarity: 1,
                metadata: data.metadata
              };
              setRagDocs(prev => [newDoc, ...prev]);
              // Optional: Show toast "Bot learned!"
            }
          }
        } catch (trainErr) {
          console.error("Failed to train bot:", trainErr);
        }
      }
    }
  };

  const handleToggleBot = async (isActive: boolean) => {
    if (!selectedContactId) return;
    setContacts(prev => prev.map(c => c.id === selectedContactId ? { ...c, isBotActive: isActive } : c));
    try {
      await supabase.from('conversations').update({ mode: isActive ? 'bot' : 'agent' }).eq('wa_number', selectedContactId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDocuments = (newDocs: RAGDocument[]) => {
    setRagDocs(prev => [...newDocs, ...prev]);
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans antialiased">
      {/* Sidebar Navigation */}
      <div className="w-16 bg-gray-900 text-white flex flex-col items-center py-6 gap-6 z-20">
        <div className="mb-4">
           <LayoutGrid className="text-wa-light" size={28} />
        </div>
        
        <button 
          onClick={() => setActiveView(AppView.DASHBOARD)}
          className={`p-3 rounded-xl transition-all ${activeView === AppView.DASHBOARD ? 'bg-wa-green text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'}`}
          title="Dashboard"
        >
          <MessageSquare size={20} />
        </button>
        
        <button 
          onClick={() => setActiveView(AppView.KNOWLEDGE)}
          className={`p-3 rounded-xl transition-all ${activeView === AppView.KNOWLEDGE ? 'bg-wa-green text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'}`}
          title="Knowledge Base"
        >
          <BookOpen size={20} />
        </button>

        <button 
          onClick={() => setActiveView(AppView.DEVICES)}
          className={`p-3 rounded-xl transition-all ${activeView === AppView.DEVICES ? 'bg-wa-green text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'}`}
          title="WhatsApp Devices"
        >
          <Smartphone size={20} />
        </button>

        <div className="mt-auto">
          <button 
            onClick={() => setActiveView(AppView.SETTINGS)}
            className={`p-3 rounded-xl transition-all ${activeView === AppView.SETTINGS ? 'bg-wa-green text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'}`}
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        
        {activeView === AppView.DASHBOARD && (
          <>
            <ChatList 
              contacts={contacts} 
              devices={devices}
              selectedContactId={selectedContactId} 
              onSelectContact={(c) => setSelectedContactId(c.id)} 
            />

            {selectedContact ? (
              <ChatWindow 
                contact={selectedContact}
                messages={currentMessages}
                ragDocs={ragDocs.filter(d => d.deviceId === selectedContact.deviceId)} 
                onSendMessage={handleSendMessage}
                onToggleBot={handleToggleBot}
              />
            ) : (
              <div className="flex-1 bg-wa-bg flex flex-col items-center justify-center border-b-8 border-wa-green">
                 <div className="bg-white p-8 rounded-full shadow-lg mb-6">
                    <LayoutGrid size={64} className="text-wa-green" />
                 </div>
                 <h1 className="text-3xl font-light text-gray-700 mb-2">WhatsAgent Multi-Device</h1>
                 <p className="text-gray-500 max-w-md text-center">
                   Select a conversation from the left. <br/>
                   You can filter by business using the tabs above the chat list.
                 </p>
              </div>
            )}

            {selectedContact && (
              <KnowledgePanel 
                documents={ragDocs.filter(d => d.deviceId === selectedContact.deviceId)} 
                isVisible={true}
              />
            )}
          </>
        )}

        {activeView === AppView.KNOWLEDGE && (
           <KnowledgeBaseManager 
             documents={ragDocs}
             devices={devices}
             onAddDocuments={handleAddDocuments}
           />
        )}

        {activeView === AppView.DEVICES && (
           <DeviceManager devices={devices} />
        )}
        
        {activeView === AppView.SETTINGS && (
           <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
             <div className="max-w-3xl mx-auto space-y-6">
               <h1 className="text-2xl font-bold text-gray-800">System Integration (Multi-Device)</h1>
               <DatabaseSetup />
               <BackendLogicViewer />
               <RealtimeSetup />
             </div>
           </div>
        )}

      </div>
    </div>
  );
};

export default App;
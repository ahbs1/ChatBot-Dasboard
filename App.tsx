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
import { LeadsTable } from './components/LeadsTable'; 
import { MessageSquare, BookOpen, Settings, LayoutGrid, Smartphone, Users, Activity } from 'lucide-react';
import { useRealtime } from './hooks/useRealtime';
import { supabase } from './lib/supabaseClient';
import { generateEmbedding } from './services/geminiService';

// Helper for Fonnte Token
const getFonnteToken = () => {
    // @ts-ignore
    return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FONNTE_TOKEN) || process.env.VITE_FONNTE_TOKEN || '';
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>(AppView.DASHBOARD);
  
  // State
  const [devices, setDevices] = useState<Device[]>([]); // Init empty
  const [contacts, setContacts] = useState<Contact[]>([]); // Init empty
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>({});
  const [ragDocs, setRagDocs] = useState<RAGDocument[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  
  // Computed
  const selectedContact = contacts.find(c => c.id === selectedContactId);
  const currentMessages = selectedContactId ? (allMessages[selectedContactId] || []) : [];

  // --- 1. INITIAL DATA FETCHING ---
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingInitial(true);
      try {
        // A. Fetch Devices
        const { data: dbDevices } = await supabase.from('devices').select('*');
        if (dbDevices && dbDevices.length > 0) {
            setDevices(dbDevices.map((d:any) => ({
                id: d.id,
                name: d.name,
                phoneNumber: d.phone_number,
                color: d.color,
                status: 'disconnected', // Default, realtime will update
                alertEmail: d.alert_email
            })));
        } else {
            setDevices(MOCK_DEVICES); // Fallback for Demo
        }

        // B. Fetch Conversations (Contacts)
        const { data: dbConvos } = await supabase.from('conversations').select('*').order('last_active', { ascending: false });
        if (dbConvos && dbConvos.length > 0) {
             const mappedContacts: Contact[] = dbConvos.map((c: any) => ({
                 id: c.wa_number,
                 deviceId: c.device_id || 'unknown',
                 name: c.name || c.wa_number,
                 phoneNumber: c.wa_number,
                 avatar: `https://ui-avatars.com/api/?name=${c.name || 'User'}&background=random`,
                 lastMessage: '...',
                 lastMessageTime: new Date(c.last_active),
                 unreadCount: 0,
                 isBotActive: c.mode === 'bot',
                 tags: []
             }));
             setContacts(mappedContacts);
        } else {
             setContacts(MOCK_CONTACTS); // Fallback
             setAllMessages(MOCK_MESSAGES);
        }
        
        // C. Fetch RAG Docs
        const { data: dbDocs } = await supabase.from('knowledge_base').select('*').limit(50);
        if (dbDocs) {
            setRagDocs(dbDocs.map((d: any) => ({
                id: d.id.toString(),
                deviceId: d.device_id,
                title: d.metadata?.title || 'Untitled',
                content: d.content,
                similarity: 1,
                metadata: d.metadata
            })));
        }

      } catch (error) {
        console.error("Error fetching initial data:", error);
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchInitialData();
  }, []);

  // Fetch messages when selecting a contact
  useEffect(() => {
      if (!selectedContactId) return;
      if (allMessages[selectedContactId]) return; // Already loaded

      const fetchMessages = async () => {
          const { data } = await supabase.from('messages')
              .select('*')
              .eq('conversation_id', selectedContactId)
              .order('created_at', { ascending: true });
          
          if (data) {
              const mappedMsgs: Message[] = data.map((m: any) => ({
                  id: m.id.toString(),
                  text: m.message,
                  sender: m.direction === 'inbound' ? SenderType.USER : (m.direction === 'outbound' ? SenderType.AGENT : SenderType.BOT),
                  direction: m.direction === 'inbound' ? Direction.INBOUND : Direction.OUTBOUND,
                  timestamp: new Date(m.created_at),
                  status: m.status
              }));
              
              setAllMessages(prev => ({
                  ...prev,
                  [selectedContactId]: mappedMsgs
              }));
          }
      };
      fetchMessages();
  }, [selectedContactId]);


  // --- Realtime Integration ---
  
  const handleRealtimeMessage = useCallback((newMsg: Message, contactId: string) => {
    setAllMessages(prev => {
      const existing = prev[contactId] || [];
      if (existing.some(m => m.id === newMsg.id)) return prev;
      return {
        ...prev,
        [contactId]: [...existing, newMsg]
      };
    });

    setContacts(prev => {
        const exists = prev.find(c => c.id === contactId);
        if (exists) {
            return prev.map(c => 
                c.id === contactId 
                  ? { 
                      ...c, 
                      lastMessage: newMsg.text, 
                      lastMessageTime: newMsg.timestamp,
                      unreadCount: (selectedContactId !== contactId) ? c.unreadCount + 1 : c.unreadCount
                    } 
                  : c
              ).sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
        } else {
            // New Contact from Realtime!
            return [{
                id: contactId,
                deviceId: 'unknown', // Ideally we get this from DB join
                name: contactId,
                phoneNumber: contactId,
                avatar: `https://ui-avatars.com/api/?name=${contactId}`,
                lastMessage: newMsg.text,
                lastMessageTime: newMsg.timestamp,
                unreadCount: 1,
                isBotActive: true,
                tags: ['New']
            }, ...prev];
        }
    });
  }, [selectedContactId]);

  const handleRealtimeContactUpdate = useCallback((contactId: string, updates: Partial<Contact>) => {
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, ...updates } : c));
  }, []);

  useRealtime(handleRealtimeMessage, handleRealtimeContactUpdate);

  // --- KEEP ALIVE LOGIC ---
  useEffect(() => {
    const heartbeat = async () => {
      try {
        console.log('💓 Heartbeat');
        await supabase.from('system_status').upsert({
          id: 'heartbeat',
          status: 'connected',
          updated_at: new Date().toISOString()
        });
      } catch (err) { /* silent fail */ }
    };
    heartbeat();
    const intervalId = setInterval(heartbeat, 1000 * 60 * 60);
    return () => clearInterval(intervalId);
  }, []);

  // ----------------------------

  const updateContactLastMessage = (contactId: string, text: string) => {
    setContacts(prev => prev.map(c => 
      c.id === contactId 
        ? { ...c, lastMessage: text, lastMessageTime: new Date() } 
        : c
    ).sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()));
  };

  const trainBotWithPair = async (question: string, answer: string, deviceId: string) => {
      try {
        const newKnowledgeContent = `Q: ${question}\nA: ${answer}`;
        const embedding = await generateEmbedding(newKnowledgeContent);

        if (embedding) {
          const { data, error: kbError } = await supabase.from('knowledge_base').insert({
            device_id: deviceId,
            content: newKnowledgeContent,
            embedding: embedding,
            metadata: { type: 'correction', original_question: question }
          }).select().single();

          if (!kbError && data) {
            setRagDocs(prev => [{
              id: data.id.toString(),
              deviceId: deviceId,
              title: 'Correction',
              content: newKnowledgeContent,
              similarity: 1,
              metadata: data.metadata
            }, ...prev]);
          }
        }
      } catch (trainErr) {
        console.error("Failed to train bot:", trainErr);
      }
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
      status: 'pending'
    };

    // 1. Optimistic Update
    setAllMessages(prev => ({
      ...prev,
      [selectedContactId]: [...(prev[selectedContactId] || []), newMessage]
    }));
    updateContactLastMessage(selectedContactId, text);

    // 2. SEND TO FONNTE (Real WhatsApp)
    const token = getFonnteToken();
    if (token) {
        try {
            const formData = new FormData();
            formData.append('target', selectedContactId);
            formData.append('message', text);
            // formData.append('url', 'https://md.fonnte.com/images/wa-logo.png'); // Optional Media

            const res = await fetch('https://api.fonnte.com/send', {
                method: 'POST',
                headers: { 'Authorization': token },
                body: formData
            });
            const result = await res.json();
            console.log("Fonnte Send Result:", result);
            
            // Mark as sent if successful
            if (result.status) {
                 setAllMessages(prev => ({
                    ...prev,
                    [selectedContactId]: prev[selectedContactId].map(m => m.id === tempId ? { ...m, status: 'sent' } : m)
                 }));
            }
        } catch (fonnteErr) {
            console.error("Fonnte API Error:", fonnteErr);
        }
    } else {
        console.warn("⚠️ No Fonnte Token found in .env (VITE_FONNTE_TOKEN). Message saved to DB but NOT sent to WA.");
    }

    // 3. Save to Supabase
    try {
      await supabase.from('messages').insert({
        conversation_id: selectedContactId,
        message: text,
        direction: 'outbound',
        status: 'sent'
      });
    } catch (err) {
      console.error("Failed to insert message:", err);
    }

    // 4. Train Bot
    if (teachBot) {
      const history = allMessages[selectedContactId] || [];
      const lastUserMsg = [...history].reverse().find(m => m.direction === Direction.INBOUND);
      if (lastUserMsg) {
        await trainBotWithPair(lastUserMsg.text, text, selectedContact.deviceId);
      }
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    if (!selectedContactId || !selectedContact) return;

    // 1. Update Local State UI
    setAllMessages(prev => ({
      ...prev,
      [selectedContactId]: prev[selectedContactId].map(m => 
        m.id === messageId ? { ...m, text: newText } : m
      )
    }));

    // 2. Update DB
    if (!messageId.startsWith('temp-')) {
       try {
         await supabase.from('messages').update({ message: newText }).eq('id', messageId);
       } catch (e) {
         console.error("Failed to update message DB", e);
       }
    }

    // 3. TRAIN BOT
    const messages = allMessages[selectedContactId];
    const msgIndex = messages.findIndex(m => m.id === messageId);
    
    const historyBefore = messages.slice(0, msgIndex);
    const lastUserMsg = [...historyBefore].reverse().find(m => m.direction === Direction.INBOUND);

    if (lastUserMsg) {
      await trainBotWithPair(lastUserMsg.text, newText, selectedContact.deviceId);
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

  const handleAddDevice = async (newDevice: Device) => {
     setDevices(prev => [...prev, newDevice]);
     try {
       await supabase.from('devices').insert({
         id: newDevice.id,
         name: newDevice.name,
         phone_number: newDevice.phoneNumber,
         color: newDevice.color,
         alert_email: newDevice.alertEmail
       });
     } catch (e) { console.warn(e); }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    setDevices(prev => prev.filter(d => d.id !== deviceId));
    try { await supabase.from('devices').delete().eq('id', deviceId); } catch (e) { console.warn(e); }
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
          onClick={() => setActiveView(AppView.LEADS)} 
          className={`p-3 rounded-xl transition-all ${activeView === AppView.LEADS ? 'bg-wa-green text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'}`}
          title="Captured Leads"
        >
          <Users size={20} />
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

        <div className="mt-auto flex flex-col items-center gap-4">
          <div className="text-[10px] text-gray-500 flex flex-col items-center" title="System Heartbeat Active">
             <Activity size={12} className="text-green-500 animate-pulse" />
          </div>

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
                onEditMessage={handleEditMessage} 
                onToggleBot={handleToggleBot}
              />
            ) : (
              <div className="flex-1 bg-wa-bg flex flex-col items-center justify-center border-b-8 border-wa-green">
                 {loadingInitial ? (
                    <div className="animate-spin text-wa-green mb-4"><Activity size={40} /></div>
                 ) : (
                    <div className="bg-white p-8 rounded-full shadow-lg mb-6">
                        <LayoutGrid size={64} className="text-wa-green" />
                    </div>
                 )}
                 <h1 className="text-3xl font-light text-gray-700 mb-2">WhatsAgent Multi-Device</h1>
                 <p className="text-gray-500 max-w-md text-center">
                   Select a conversation from the left. <br/>
                   Make sure your Fonnte Webhook is active.
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

        {activeView === AppView.LEADS && (
           <LeadsTable devices={devices} /> 
        )}

        {activeView === AppView.KNOWLEDGE && (
           <KnowledgeBaseManager 
             documents={ragDocs}
             devices={devices}
             onAddDocuments={handleAddDocuments}
           />
        )}

        {activeView === AppView.DEVICES && (
           <DeviceManager 
              devices={devices} 
              onAddDevice={handleAddDevice}
              onDeleteDevice={handleDeleteDevice}
           />
        )}
        
        {activeView === AppView.SETTINGS && (
           <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
             <div className="max-w-3xl mx-auto space-y-6">
               <h1 className="text-2xl font-bold text-gray-800">System Integration (Deployment Mode)</h1>
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
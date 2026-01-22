import React, { useState, useEffect, useCallback } from 'react';
import { Contact, Message, SenderType, AppView, RAGDocument, Direction, Device, Product } from './types';
import { MOCK_CONTACTS, MOCK_MESSAGES, MOCK_RAG_DOCS, MOCK_DEVICES } from './constants';
import { ChatList } from './components/ChatList';
import { ChatWindow } from './components/ChatWindow';
import { KnowledgePanel } from './components/KnowledgePanel';
import { KnowledgeBaseManager } from './components/KnowledgeBaseManager';
import { DatabaseSetup } from './components/DatabaseSetup';
import { BackendLogicViewer } from './components/BackendLogicViewer';
import { IntegrationGuide } from './components/IntegrationGuide';
import { DeviceManager } from './components/DeviceManager';
import { LeadsTable } from './components/LeadsTable'; 
import { MessageSquare, BookOpen, Settings, LayoutGrid, Smartphone, Users, Activity } from 'lucide-react';
import { useRealtime } from './hooks/useRealtime';
import { supabase } from './lib/supabaseClient';
import { generateEmbedding } from './services/geminiService';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>(AppView.DASHBOARD);
  
  // State
  const [devices, setDevices] = useState<Device[]>([]); 
  const [contacts, setContacts] = useState<Contact[]>([]); 
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>({});
  const [ragDocs, setRagDocs] = useState<RAGDocument[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Master AI Toggle State
  const [isGlobalAiActive, setIsGlobalAiActive] = useState<boolean>(true);
  
  // Computed
  const selectedContact = contacts.find(c => c.id === selectedContactId);
  const currentMessages = selectedContactId ? (allMessages[selectedContactId] || []) : [];

  // --- 1. INITIAL DATA FETCHING ---
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
      setLoadingInitial(true);
      try {
        const { data: dbDevices } = await supabase.from('devices').select('*');
        if (dbDevices && dbDevices.length > 0) {
            setDevices(dbDevices.map((d:any) => ({
                id: d.id,
                name: d.name,
                phoneNumber: d.phone_number,
                color: d.color,
                fonnteToken: d.fonnte_token, 
                alertEmail: d.alert_email,
                adminNumber: d.admin_number
            })));
        } else {
            setDevices(MOCK_DEVICES); 
        }

        const { data: dbSettings } = await supabase.from('system_settings').select('*').eq('key', 'is_ai_enabled').single();
        if (dbSettings) {
            setIsGlobalAiActive(dbSettings.value);
        }

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
             setContacts(MOCK_CONTACTS); 
             setAllMessages(MOCK_MESSAGES);
        }
        
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

  const fetchMessagesForContact = async (contactId: string) => {
      const { data } = await supabase.from('messages')
          .select('*')
          .eq('conversation_id', contactId)
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
              [contactId]: mappedMsgs
          }));
      }
  };

  useEffect(() => {
      if (!selectedContactId) return;
      if (allMessages[selectedContactId]) return; 
      fetchMessagesForContact(selectedContactId);
  }, [selectedContactId]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    if (selectedContactId) {
        await fetchMessagesForContact(selectedContactId);
    }
    // Optional: Refresh contacts too
    const { data: dbConvos } = await supabase.from('conversations').select('*').order('last_active', { ascending: false });
    if (dbConvos) {
        setContacts(prev => {
            // Update existing contacts with new data but keep local state if needed
            return dbConvos.map((c: any) => ({
                 id: c.wa_number,
                 deviceId: c.device_id || 'unknown',
                 name: c.name || c.wa_number,
                 phoneNumber: c.wa_number,
                 avatar: `https://ui-avatars.com/api/?name=${c.name || 'User'}&background=random`,
                 lastMessage: '...', // In a real app we'd fetch the last msg too
                 lastMessageTime: new Date(c.last_active),
                 unreadCount: 0,
                 isBotActive: c.mode === 'bot',
                 tags: []
             }));
        });
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleRealtimeMessage = useCallback((newMsg: Message, contactId: string) => {
    setAllMessages(prev => {
      const existing = prev[contactId] || [];
      const index = existing.findIndex(m => m.id === newMsg.id);
      if (index !== -1) {
          const updated = [...existing];
          updated[index] = newMsg;
          return { ...prev, [contactId]: updated };
      }
      return { ...prev, [contactId]: [...existing, newMsg] };
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
            return [{
                id: contactId,
                deviceId: 'unknown', 
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

  const handleRealtimeSettingsUpdate = useCallback((key: string, value: any) => {
    if (key === 'is_ai_enabled') {
        setIsGlobalAiActive(value);
    }
  }, []);

  useRealtime(handleRealtimeMessage, handleRealtimeContactUpdate, handleRealtimeSettingsUpdate);

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
          await supabase.from('knowledge_base').insert({
            device_id: deviceId,
            content: newKnowledgeContent,
            embedding: embedding,
            metadata: { type: 'correction', original_question: question }
          });
        }
      } catch (trainErr) {
        console.error("Failed to train bot:", trainErr);
      }
  };

  const handleSendMessage = async (text: string, sender: SenderType, teachBot: boolean, attachment?: Product) => {
    if (!selectedContactId || !selectedContact) return;
    let targetDeviceId = selectedContact.deviceId;
    if ((!targetDeviceId || targetDeviceId === 'unknown') && devices.length === 1) {
        targetDeviceId = devices[0].id;
        supabase.from('conversations').update({ device_id: targetDeviceId }).eq('wa_number', selectedContactId).then();
    }
    const device = devices.find(d => d.id === targetDeviceId);
    if (!device?.fonnteToken) {
        alert("Error: No Fonnte Token configured.");
        return;
    }

    try {
      const { data, error } = await supabase.from('messages').insert({
        conversation_id: selectedContactId,
        message: text,
        direction: 'outbound',
        status: 'sent',
        image_url: attachment?.image || null
      }).select().single();

      if (error) throw error;
      if (data) {
          const newMessage: Message = {
            id: data.id.toString(),
            text: text,
            imageUrl: attachment?.image, 
            sender: sender,
            direction: Direction.OUTBOUND,
            timestamp: new Date(data.created_at),
            status: 'sent'
          };
          setAllMessages(prev => ({
            ...prev,
            [selectedContactId]: [...(prev[selectedContactId] || []), newMessage]
          }));
          updateContactLastMessage(selectedContactId, text);
          const formData = new FormData();
          formData.append('target', selectedContactId);
          formData.append('message', text); 
          if (attachment?.image) formData.append('url', attachment.image);
          fetch('https://api.fonnte.com/send', {
              method: 'POST',
              headers: { 'Authorization': device.fonnteToken },
              body: formData
          }).then(res => res.json()).catch(err => console.error(err));
      }
    } catch (err) {
      console.error(err);
    }

    if (teachBot && targetDeviceId && targetDeviceId !== 'unknown') {
      const history = allMessages[selectedContactId] || [];
      const lastUserMsg = [...history].reverse().find(m => m.direction === Direction.INBOUND);
      if (lastUserMsg) await trainBotWithPair(lastUserMsg.text, text, targetDeviceId);
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    if (!selectedContactId || !selectedContact) return;
    setAllMessages(prev => ({
      ...prev,
      [selectedContactId]: prev[selectedContactId].map(m => m.id === messageId ? { ...m, text: newText } : m)
    }));
    try {
        await supabase.from('messages').update({ message: newText }).eq('id', messageId);
    } catch (e) { console.error(e); }
  };

  const handleToggleBot = async (isActive: boolean) => {
    if (!selectedContactId) return;
    setContacts(prev => prev.map(c => c.id === selectedContactId ? { ...c, isBotActive: isActive } : c));
    try {
      await supabase.from('conversations').update({ mode: isActive ? 'bot' : 'agent' }).eq('wa_number', selectedContactId);
    } catch (err) { console.error(err); }
  };

  const handleToggleGlobalAi = async (active: boolean) => {
    setIsGlobalAiActive(active);
    try {
      await supabase.from('system_settings').upsert({ key: 'is_ai_enabled', value: active }, { onConflict: 'key' });
    } catch (err) { console.error(err); }
  };

  const handleAddDocuments = (newDocs: RAGDocument[]) => setRagDocs(prev => [...newDocs, ...prev]);
  const handleAddDevice = async (newDevice: Device) => {
     setDevices(prev => [...prev, newDevice]);
     try {
       await supabase.from('devices').insert({
         id: newDevice.id, name: newDevice.name, phone_number: newDevice.phoneNumber, color: newDevice.color, fonnte_token: newDevice.fonnteToken, alert_email: newDevice.alertEmail, admin_number: newDevice.adminNumber
       });
     } catch (e) { console.warn(e); }
  };
  const handleDeleteDevice = async (deviceId: string) => {
    setDevices(prev => prev.filter(d => d.id !== deviceId));
    try { await supabase.from('devices').delete().eq('id', deviceId); } catch (e) { console.warn(e); }
  };

  return (
    <div className="flex h-dvh bg-gray-100 font-sans antialiased overflow-hidden">
      
      {/* Sidebar Navigation - DESKTOP ONLY */}
      <div className="hidden md:flex w-16 bg-gray-900 text-white flex-col items-center py-6 gap-6 z-30 shrink-0">
        <div className="mb-4">
           <LayoutGrid className="text-wa-light" size={28} />
        </div>
        <button onClick={() => setActiveView(AppView.DASHBOARD)} className={`p-3 rounded-xl transition-all ${activeView === AppView.DASHBOARD ? 'bg-wa-green text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'}`}><MessageSquare size={20} /></button>
        <button onClick={() => setActiveView(AppView.LEADS)} className={`p-3 rounded-xl transition-all ${activeView === AppView.LEADS ? 'bg-wa-green text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'}`}><Users size={20} /></button>
        <button onClick={() => setActiveView(AppView.KNOWLEDGE)} className={`p-3 rounded-xl transition-all ${activeView === AppView.KNOWLEDGE ? 'bg-wa-green text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'}`}><BookOpen size={20} /></button>
        <button onClick={() => setActiveView(AppView.DEVICES)} className={`p-3 rounded-xl transition-all ${activeView === AppView.DEVICES ? 'bg-wa-green text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'}`}><Smartphone size={20} /></button>
        <div className="mt-auto"><button onClick={() => setActiveView(AppView.SETTINGS)} className={`p-3 rounded-xl transition-all ${activeView === AppView.SETTINGS ? 'bg-wa-green text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'}`}><Settings size={20} /></button></div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col h-full overflow-hidden relative">
        <div className="flex flex-1 overflow-hidden relative">
          {activeView === AppView.DASHBOARD && (
            <>
              {/* Chat List: Hidden on Mobile if Contact Selected */}
              <div className={`${selectedContactId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 h-full bg-white border-r border-gray-200 z-10 shrink-0`}>
                <ChatList 
                    contacts={contacts} 
                    devices={devices}
                    selectedContactId={selectedContactId} 
                    onSelectContact={(c) => setSelectedContactId(c.id)} 
                    isGlobalAiActive={isGlobalAiActive}
                    onToggleGlobalAi={handleToggleGlobalAi}
                />
              </div>

              {/* Chat Window: Hidden on Mobile if NO Contact Selected */}
              <div className={`${!selectedContactId ? 'hidden md:flex' : 'flex'} flex-1 h-full bg-wa-bg relative overflow-hidden`}>
                {selectedContact ? (
                    <ChatWindow 
                        contact={selectedContact}
                        messages={currentMessages}
                        ragDocs={ragDocs.filter(d => d.deviceId === selectedContact.deviceId)} 
                        onSendMessage={handleSendMessage}
                        onEditMessage={handleEditMessage} 
                        onToggleBot={handleToggleBot}
                        onBack={() => setSelectedContactId(null)} 
                        isGlobalAiActive={isGlobalAiActive}
                        onRefresh={handleManualRefresh}
                        isRefreshing={isRefreshing}
                    />
                ) : (
                    <div className="flex-1 bg-wa-bg flex flex-col items-center justify-center border-b-8 border-wa-green h-full">
                        {loadingInitial ? (
                            <div className="animate-spin text-wa-green mb-4"><Activity size={40} /></div>
                        ) : (
                            <div className="bg-white p-8 rounded-full shadow-lg mb-6"><LayoutGrid size={64} className="text-wa-green" /></div>
                        )}
                        <h1 className="text-3xl font-light text-gray-700 mb-2">WhatsAgent</h1>
                        <p className="text-gray-500 max-w-md text-center text-sm px-4">Pilih chat untuk memulai percakapan.</p>
                    </div>
                )}
              </div>

              {/* Knowledge Panel - Desktop Only */}
              {selectedContact && (
                <div className="hidden xl:flex h-full shrink-0">
                    <KnowledgePanel documents={ragDocs.filter(d => d.deviceId === selectedContact.deviceId)} isVisible={true} />
                </div>
              )}
            </>
          )}

          {activeView === AppView.LEADS && <div className="flex-1 h-full overflow-hidden"><LeadsTable devices={devices} /></div>}
          {activeView === AppView.KNOWLEDGE && <div className="flex-1 h-full overflow-hidden"><KnowledgeBaseManager documents={ragDocs} devices={devices} onAddDocuments={handleAddDocuments} /></div>}
          {activeView === AppView.DEVICES && <div className="flex-1 h-full overflow-hidden"><DeviceManager devices={devices} onAddDevice={handleAddDevice} onDeleteDevice={handleDeleteDevice} /></div>}
          {activeView === AppView.SETTINGS && <div className="flex-1 bg-gray-50 p-4 md:p-8 pb-24 overflow-y-auto h-full"><div className="max-w-3xl mx-auto space-y-6"><h1 className="text-2xl font-bold text-gray-800">System Configuration</h1><IntegrationGuide /><hr className="border-gray-200 my-8" /><h2 className="text-xl font-bold text-gray-700">Database & Webhook</h2><DatabaseSetup /><BackendLogicViewer /></div></div>}
        </div>

        {/* Bottom Navigation Bar - MOBILE ONLY - HIDDEN WHEN CHAT IS OPEN */}
        {!selectedContactId && (
            <div className="md:hidden bg-white border-t border-gray-200 flex justify-around items-center h-16 shrink-0 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-safe">
                <button onClick={() => setActiveView(AppView.DASHBOARD)} className={`p-2 flex flex-col items-center gap-1 w-full ${activeView === AppView.DASHBOARD ? 'text-wa-green' : 'text-gray-400'}`}><MessageSquare size={20} /><span className="text-[10px] font-medium">Chats</span></button>
                <button onClick={() => setActiveView(AppView.LEADS)} className={`p-2 flex flex-col items-center gap-1 w-full ${activeView === AppView.LEADS ? 'text-wa-green' : 'text-gray-400'}`}><Users size={20} /><span className="text-[10px] font-medium">Leads</span></button>
                <button onClick={() => setActiveView(AppView.KNOWLEDGE)} className={`p-2 flex flex-col items-center gap-1 w-full ${activeView === AppView.KNOWLEDGE ? 'text-wa-green' : 'text-gray-400'}`}><BookOpen size={20} /><span className="text-[10px] font-medium">RAG</span></button>
                <button onClick={() => setActiveView(AppView.DEVICES)} className={`p-2 flex flex-col items-center gap-1 w-full ${activeView === AppView.DEVICES ? 'text-wa-green' : 'text-gray-400'}`}><Smartphone size={20} /><span className="text-[10px] font-medium">Config</span></button>
            </div>
        )}
      </div>
    </div>
  );
};

export default App;
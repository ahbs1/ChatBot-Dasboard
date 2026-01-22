import React, { useState, useRef, useEffect } from 'react';
import { Contact, Message, SenderType, RAGDocument, Direction, Product } from '../types';
import { MessageBubble } from './MessageBubble';
import { Button } from './Button';
import { generateAgentDraft } from '../services/geminiService';
import { ContactInfo } from './ContactInfo';
import { ProductPicker } from './ProductPicker';
import { Send, ToggleLeft, ToggleRight, Sparkles, AlertCircle, BookPlus, ArrowLeft, Paperclip, X, ZapOff } from 'lucide-react';
import { MOCK_DEVICES } from '../constants'; 

interface ChatWindowProps {
  contact: Contact;
  messages: Message[];
  ragDocs: RAGDocument[];
  onSendMessage: (text: string, sender: SenderType, teachBot: boolean, attachment?: Product) => void;
  onEditMessage: (messageId: string, newText: string) => void;
  onToggleBot: (active: boolean) => void;
  onBack?: () => void; 
  isGlobalAiActive?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
  contact, 
  messages, 
  ragDocs,
  onSendMessage, 
  onEditMessage,
  onToggleBot,
  onBack,
  isGlobalAiActive = true
}) => {
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [teachBot, setTeachBot] = useState(false); 
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showContactInfo]); 

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText, SenderType.AGENT, teachBot);
    setInputText('');
    setTeachBot(false); 
  };
  
  const handleProductSelect = (product: Product) => {
      const caption = `*${product.name}*\n${product.description}\n\nHarga: Rp ${product.price.toLocaleString()}`;
      onSendMessage(caption, SenderType.AGENT, false, product);
      setShowProductPicker(false);
      setShowAttachments(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGenerateDraft = async () => {
    if (contact.isBotActive && isGlobalAiActive) return; 
    setIsGenerating(true);
    const draft = await generateAgentDraft(messages, ragDocs, inputText);
    setInputText(draft);
    setIsGenerating(false);
    setTeachBot(true);
  };

  const device = MOCK_DEVICES.find(d => d.id === contact.deviceId) || MOCK_DEVICES[0];
  const isBotResponding = contact.isBotActive && isGlobalAiActive;

  return (
    <div className="flex h-full w-full overflow-hidden flex-col md:flex-row relative">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full bg-wa-bg relative min-w-0 overflow-hidden">
            {/* Header */}
            <div className="bg-wa-header px-4 py-3 border-b border-gray-300 flex justify-between items-center shadow-sm z-30 h-16 shrink-0">
                <div className="flex items-center gap-3 cursor-pointer overflow-hidden" onClick={() => setShowContactInfo(!showContactInfo)}>
                    {onBack && (
                        <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="md:hidden p-1 -ml-2 text-gray-600 hover:bg-gray-200 rounded-full">
                            <ArrowLeft size={22} />
                        </button>
                    )}
                    <img src={contact.avatar} alt={contact.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    <div className="min-w-0">
                        <h3 className="font-semibold text-gray-800 truncate leading-tight">{contact.name}</h3>
                        <p className={`text-[10px] md:text-xs truncate ${isBotResponding ? 'text-blue-600' : 'text-orange-500'}`}>
                        {isBotResponding ? 'Bot Aktif' : contact.isBotActive ? 'Bot Jeda (Master OFF)' : 'Mode Manual'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3 shrink-0">
                    <button onClick={() => onToggleBot(!contact.isBotActive)} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                      {contact.isBotActive ? <ToggleRight size={28} className="text-blue-500" /> : <ToggleLeft size={28} className="text-orange-500" />}
                    </button>
                    <button onClick={() => setShowContactInfo(!showContactInfo)} className="text-gray-600 hover:bg-gray-200 p-2 rounded-full hidden md:block">
                        <AlertCircle size={20} />
                    </button>
                </div>
            </div>

            {/* Global Warning */}
            {contact.isBotActive && !isGlobalAiActive && (
               <div className="bg-orange-600 text-white text-[10px] md:text-[11px] py-1 px-4 flex items-center justify-center gap-2 font-bold z-20 shrink-0">
                  <ZapOff size={14} /> MASTER AI MATI. Bot tidak akan menjawab otomatis.
               </div>
            )}

            {/* Messages Area */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-2 relative scroll-smooth"
                style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat' }}
            >
                <div className="absolute inset-0 bg-wa-bg opacity-90 -z-10" />
                {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} onEdit={onEditMessage} />
                ))}
            </div>

            {/* Catalog Overlay */}
            {showProductPicker && <ProductPicker onSelect={handleProductSelect} onClose={() => setShowProductPicker(false)} />}

            {/* Input Area */}
            <div className="shrink-0 bg-wa-header border-t border-gray-300 relative z-40 pb-safe">
                {isBotResponding ? (
                    <div className="p-3 flex items-center justify-center gap-2 text-gray-500 bg-gray-100 text-xs text-center">
                        <AlertCircle size={16} />
                        <span>Bot Aktif. Matikan bot untuk membalas manual.</span>
                    </div>
                ) : (
                    <div className="p-2 md:p-3 flex flex-col gap-1 max-w-5xl mx-auto w-full">
                        <div className="flex justify-center items-center">
                            <label className={`flex items-center gap-2 text-[10px] md:text-xs cursor-pointer transition-colors ${teachBot ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
                                <input type="checkbox" checked={teachBot} onChange={(e) => setTeachBot(e.target.checked)} className="rounded text-green-600 w-3 h-3"/>
                                <span>Ajari Bot</span>
                            </label>
                        </div>

                        <div className="flex gap-2 items-end w-full">
                            <button onClick={() => { setShowAttachments(!showAttachments); setShowProductPicker(false); }} className={`p-2 rounded-full mb-1 flex-shrink-0 ${showAttachments ? 'bg-gray-200 text-gray-800' : 'text-gray-500'}`}>
                                 {showAttachments ? <X size={24} /> : <Paperclip size={24} />}
                            </button>

                            <div className="flex-1 bg-white rounded-2xl border border-gray-300 shadow-sm flex items-end overflow-hidden min-h-[44px]">
                                <textarea
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ketik pesan..."
                                    className="w-full max-h-32 p-3 bg-transparent border-none focus:ring-0 resize-none text-sm leading-tight"
                                    rows={1}
                                />
                                <button onClick={handleGenerateDraft} disabled={isGenerating} className="m-2 p-1.5 text-purple-600 hover:bg-purple-50 rounded-full flex-shrink-0">
                                     <Sparkles size={18} className={isGenerating ? "animate-pulse" : ""} />
                                </button>
                            </div>
                            
                            <button onClick={handleSend} disabled={!inputText.trim()} className="mb-1 p-3 bg-wa-green text-white rounded-full shadow-md flex-shrink-0 transition-transform active:scale-95">
                                <Send size={20} />
                            </button>
                        </div>

                        {showAttachments && !showProductPicker && (
                            <div className="absolute bottom-full left-4 mb-2 bg-white rounded-lg shadow-xl border border-gray-100 flex flex-col p-2 gap-1 animate-in slide-in-from-bottom-2 duration-200">
                                <button onClick={() => setShowProductPicker(true)} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 rounded-md text-gray-700 text-sm whitespace-nowrap">
                                    <div className="bg-purple-500 text-white p-2 rounded-full"><BookPlus size={16}/></div>
                                    Katalog Produk
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Right Sidebar: Contact Info */}
        {showContactInfo && (
            <div className="fixed md:relative inset-0 md:inset-auto h-full shadow-xl z-50 md:z-30 shrink-0 bg-white md:block">
                <ContactInfo contact={contact} device={device} onClose={() => setShowContactInfo(false)} />
            </div>
        )}
    </div>
  );
};
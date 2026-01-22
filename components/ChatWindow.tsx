
import React, { useState, useRef, useEffect } from 'react';
import { Contact, Message, SenderType, RAGDocument, Direction, Product } from '../types';
import { MessageBubble } from './MessageBubble';
import { Button } from './Button';
import { generateAgentDraft } from '../services/geminiService';
import { ContactInfo } from './ContactInfo';
import { ProductPicker } from './ProductPicker';
import { Send, Phone, MoreVertical, ToggleLeft, ToggleRight, Sparkles, AlertCircle, BookPlus, Info, ArrowLeft, Search, Paperclip, X, ZapOff } from 'lucide-react';
import { MOCK_DEVICES } from '../constants'; 

interface ChatWindowProps {
  contact: Contact;
  messages: Message[];
  ragDocs: RAGDocument[];
  onSendMessage: (text: string, sender: SenderType, teachBot: boolean, attachment?: Product) => void;
  onEditMessage: (messageId: string, newText: string) => void;
  onToggleBot: (active: boolean) => void;
  onBack?: () => void; 
  isGlobalAiActive?: boolean; // NEW
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
  contact, 
  messages, 
  ragDocs,
  onSendMessage, 
  onEditMessage,
  onToggleBot,
  onBack,
  isGlobalAiActive = true // DEFAULT
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
    <div className="flex h-full w-full overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full bg-wa-bg relative min-w-0">
            {/* Header */}
            <div className="bg-wa-header px-4 py-3 border-b border-gray-300 flex justify-between items-center shadow-sm z-10 sticky top-0 h-16">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowContactInfo(!showContactInfo)}>
                    {onBack && (
                        <button 
                        onClick={(e) => { e.stopPropagation(); onBack(); }}
                        className="md:hidden p-1 -ml-2 text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                        >
                        <ArrowLeft size={22} />
                        </button>
                    )}

                    <img src={contact.avatar} alt={contact.name} className="w-10 h-10 rounded-full object-cover" />
                    <div className="min-w-0">
                        <h3 className="font-semibold text-gray-800 truncate max-w-[150px] md:max-w-xs">{contact.name}</h3>
                        <p className={`text-xs truncate ${isBotResponding ? 'text-blue-600' : 'text-orange-500'}`}>
                        {isBotResponding ? 'AI Bot is active' : contact.isBotActive ? 'Bot paused (Master OFF)' : 'Manual Mode'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 md:gap-3">
                    <div className="flex items-center gap-2 bg-white px-2 md:px-3 py-1.5 rounded-full border shadow-sm mr-2">
                        <span className={`hidden md:inline text-xs font-bold ${contact.isBotActive ? 'text-blue-600' : 'text-orange-500'}`}>
                        {contact.isBotActive ? 'Bot Setting' : 'Manual'}
                        </span>
                        <button 
                        onClick={() => onToggleBot(!contact.isBotActive)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        title="Toggle Bot"
                        >
                        {contact.isBotActive ? (
                            <ToggleRight size={24} className="text-blue-500" />
                        ) : (
                            <ToggleLeft size={24} className="text-orange-500" />
                        )}
                        </button>
                    </div>
                    
                    <button className="text-gray-600 hover:bg-gray-200 p-2 rounded-full hidden md:block" title="Search">
                        <Search size={20} />
                    </button>
                    
                    <button 
                        onClick={() => setShowContactInfo(!showContactInfo)}
                        className={`text-gray-600 hover:bg-gray-200 p-2 rounded-full hidden md:block ${showContactInfo ? 'bg-gray-200' : ''}`}
                        title="Contact Info"
                    >
                        <MoreVertical size={20} />
                    </button>
                </div>
            </div>

            {/* Global Warning for active bot chat */}
            {contact.isBotActive && !isGlobalAiActive && (
               <div className="bg-orange-600 text-white text-[11px] py-1 px-4 flex items-center justify-center gap-2 font-bold animate-in slide-in-from-top">
                  <ZapOff size={14} />
                  MASTER AI IS OFF. Bot will NOT automatically respond to this customer.
               </div>
            )}

            {/* Messages */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 relative"
                style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', opacity: 0.95 }}
            >
                <div className="absolute inset-0 bg-wa-bg opacity-90 -z-10" />
                {messages.map((msg) => (
                <MessageBubble 
                    key={msg.id} 
                    message={msg} 
                    onEdit={onEditMessage} 
                />
                ))}
            </div>

            {showProductPicker && (
                <ProductPicker 
                    onSelect={handleProductSelect} 
                    onClose={() => setShowProductPicker(false)} 
                />
            )}

            {showAttachments && !showProductPicker && (
                 <div className="absolute bottom-20 left-4 bg-white rounded-lg shadow-xl border border-gray-100 flex flex-col p-2 gap-1 animate-in slide-in-from-bottom-2 duration-200 z-50">
                     <button 
                        onClick={() => setShowProductPicker(true)}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 rounded-md text-gray-700 text-sm"
                     >
                         <div className="bg-purple-500 text-white p-2 rounded-full"><BookPlus size={16}/></div>
                         Catalog
                     </button>
                     <button className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 rounded-md text-gray-700 text-sm opacity-50 cursor-not-allowed">
                         <div className="bg-blue-500 text-white p-2 rounded-full"><Phone size={16}/></div>
                         Document (Soon)
                     </button>
                 </div>
            )}

            {/* Input Area */}
            {isBotResponding ? (
                <div className="bg-gray-100 p-4 border-t border-gray-300 flex items-center justify-center gap-2 text-gray-500 md:pb-4 h-[88px]">
                    <AlertCircle size={18} />
                    <span className="text-sm">Bot is active. Toggle to take over.</span>
                </div>
            ) : (
                <div className="bg-wa-header p-2 md:p-3 border-t border-gray-300 flex flex-col gap-1 md:pb-2 relative">
                
                <div className="flex justify-between items-center px-2">
                     <div className="w-4"></div> 
                    <label className={`flex items-center gap-2 text-xs cursor-pointer transition-colors ${teachBot ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
                        <input 
                            type="checkbox" 
                            checked={teachBot} 
                            onChange={(e) => setTeachBot(e.target.checked)}
                            className="rounded text-green-600 focus:ring-green-500 w-3 h-3"
                        />
                        <span>Train Bot</span>
                    </label>
                </div>

                <div className="flex gap-2 items-end max-w-4xl mx-auto w-full">
                    
                    <button
                        onClick={() => { setShowAttachments(!showAttachments); setShowProductPicker(false); }}
                        className={`mb-2 p-2 rounded-full transition-colors flex-shrink-0 ${showAttachments ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-200'}`}
                    >
                         {showAttachments ? <X size={24} /> : <Paperclip size={24} />}
                    </button>

                    <div className="flex-1 bg-white rounded-2xl border border-gray-300 shadow-sm flex items-end">
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="w-full max-h-32 p-3 bg-transparent border-none focus:ring-0 resize-none rounded-2xl text-sm"
                        rows={1}
                        style={{ minHeight: '44px' }}
                    />
                    <button
                        onClick={handleGenerateDraft}
                        disabled={isGenerating}
                        className="m-2 p-1.5 text-purple-600 hover:bg-purple-50 rounded-full transition-colors"
                        title="AI Magic"
                    >
                         <Sparkles size={18} className={isGenerating ? "animate-pulse" : ""} />
                    </button>
                    </div>
                    
                    <button 
                        onClick={handleSend}
                        disabled={!inputText.trim()}
                        className="mb-2 p-3 bg-wa-green text-white rounded-full hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:scale-95 shadow-md flex items-center justify-center"
                    >
                        <Send size={20} />
                    </button>
                </div>
                </div>
            )}
        </div>

        {/* Right Sidebar: Contact Info */}
        {showContactInfo && (
            <div className="hidden md:block h-full shadow-xl z-20">
                <ContactInfo 
                    contact={contact} 
                    device={device}
                    onClose={() => setShowContactInfo(false)} 
                />
            </div>
        )}
    </div>
  );
};

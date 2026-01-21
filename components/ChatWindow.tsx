import React, { useState, useRef, useEffect } from 'react';
import { Contact, Message, SenderType, RAGDocument, Direction } from '../types';
import { MessageBubble } from './MessageBubble';
import { Button } from './Button';
import { generateAgentDraft } from '../services/geminiService';
import { Send, Phone, MoreVertical, ToggleLeft, ToggleRight, Sparkles, AlertCircle, BookPlus, Info, ArrowLeft } from 'lucide-react';

interface ChatWindowProps {
  contact: Contact;
  messages: Message[];
  ragDocs: RAGDocument[];
  onSendMessage: (text: string, sender: SenderType, teachBot: boolean) => void;
  onEditMessage: (messageId: string, newText: string) => void;
  onToggleBot: (active: boolean) => void;
  onBack?: () => void; // New prop for mobile navigation
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
  contact, 
  messages, 
  ragDocs,
  onSendMessage, 
  onEditMessage,
  onToggleBot,
  onBack
}) => {
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [teachBot, setTeachBot] = useState(false); 
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText, SenderType.AGENT, teachBot);
    setInputText('');
    setTeachBot(false); 
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGenerateDraft = async () => {
    if (contact.isBotActive) return; 
    
    setIsGenerating(true);
    const draft = await generateAgentDraft(messages, ragDocs, inputText);
    setInputText(draft);
    setIsGenerating(false);
    setTeachBot(true);
  };

  const lastUserMessage = [...messages].reverse().find(m => m.direction === Direction.INBOUND);

  return (
    <div className="flex flex-col h-full bg-wa-bg w-full relative">
      {/* Header */}
      <div className="bg-wa-header px-4 py-3 border-b border-gray-300 flex justify-between items-center shadow-sm z-10 sticky top-0">
        <div className="flex items-center gap-3">
          {/* Mobile Back Button */}
          {onBack && (
            <button 
              onClick={onBack}
              className="md:hidden p-1 -ml-2 text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
            >
              <ArrowLeft size={22} />
            </button>
          )}

          <img src={contact.avatar} alt={contact.name} className="w-10 h-10 rounded-full object-cover" />
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-800 truncate max-w-[150px] md:max-w-xs">{contact.name}</h3>
            <p className="text-xs text-gray-500 truncate">
              {contact.isBotActive ? 'Bot active' : 'Human active'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 bg-white px-2 md:px-3 py-1.5 rounded-full border shadow-sm">
            <span className={`hidden md:inline text-xs font-bold ${contact.isBotActive ? 'text-blue-600' : 'text-orange-500'}`}>
              {contact.isBotActive ? 'AI Mode' : 'Manual'}
            </span>
            <button 
              onClick={() => onToggleBot(!contact.isBotActive)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              {contact.isBotActive ? (
                <ToggleRight size={24} className="text-blue-500" />
              ) : (
                <ToggleLeft size={24} className="text-orange-500" />
              )}
            </button>
          </div>
          <button className="text-gray-600 hover:bg-gray-200 p-2 rounded-full hidden md:block">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

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
            onEdit={onEditMessage} // Pass the handler
          />
        ))}
      </div>

      {/* Input Area */}
      {contact.isBotActive ? (
        <div className="bg-gray-100 p-4 border-t border-gray-300 flex items-center justify-center gap-2 text-gray-500 pb-20 md:pb-4">
           <AlertCircle size={18} />
           <span className="text-sm">Bot is active. Toggle to take over.</span>
        </div>
      ) : (
        <div className="bg-wa-header p-3 border-t border-gray-300 flex flex-col gap-2 pb-20 md:pb-3">
          
          {/* Teach Bot Option */}
          <div className="flex justify-end px-2">
            <label className={`flex items-center gap-2 text-xs cursor-pointer transition-colors ${teachBot ? 'text-green-600 font-semibold' : 'text-gray-500'}`}>
              <input 
                type="checkbox" 
                checked={teachBot} 
                onChange={(e) => setTeachBot(e.target.checked)}
                className="rounded text-green-600 focus:ring-green-500"
              />
              <BookPlus size={14} />
              <span className="hidden md:inline">Train Bot (Save this answer)</span>
              <span className="md:hidden">Train Bot</span>
            </label>
          </div>

          <div className="flex gap-2 items-end max-w-4xl mx-auto w-full">
            
            {/* AI Assist Button */}
            <button
              onClick={handleGenerateDraft}
              disabled={isGenerating}
              className="mb-1 p-2 text-purple-600 hover:bg-purple-100 rounded-full transition-colors flex-shrink-0 relative group"
              title="Generate Draft with AI"
            >
              <Sparkles size={20} className={isGenerating ? "animate-pulse" : ""} />
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
            </div>
            
            <button 
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="mb-1 p-3 bg-wa-green text-white rounded-full hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:scale-95 shadow-md flex items-center justify-center"
              title={teachBot ? "Send and Save to Knowledge Base" : "Send Message"}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
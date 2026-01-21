import React, { useState, useRef, useEffect } from 'react';
import { Contact, Message, SenderType, RAGDocument, Direction } from '../types';
import { MessageBubble } from './MessageBubble';
import { Button } from './Button';
import { generateAgentDraft } from '../services/geminiService';
import { Send, Phone, MoreVertical, ToggleLeft, ToggleRight, Sparkles, AlertCircle, BookPlus, Info } from 'lucide-react';

interface ChatWindowProps {
  contact: Contact;
  messages: Message[];
  ragDocs: RAGDocument[];
  onSendMessage: (text: string, sender: SenderType, teachBot: boolean) => void;
  onToggleBot: (active: boolean) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
  contact, 
  messages, 
  ragDocs,
  onSendMessage, 
  onToggleBot 
}) => {
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [teachBot, setTeachBot] = useState(false); // State for learning toggle
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText, SenderType.AGENT, teachBot);
    setInputText('');
    setTeachBot(false); // Reset toggle after send
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGenerateDraft = async () => {
    if (contact.isBotActive) return; // Only for human agents
    
    setIsGenerating(true);
    const draft = await generateAgentDraft(messages, ragDocs, inputText);
    setInputText(draft);
    setIsGenerating(false);
    // Automatically suggest teaching if the agent requested a draft (implying they might edit it)
    setTeachBot(true);
  };

  // Find the last user message to show context for teaching
  const lastUserMessage = [...messages].reverse().find(m => m.direction === Direction.INBOUND);

  return (
    <div className="flex flex-col h-full bg-wa-bg w-full">
      {/* Header */}
      <div className="bg-wa-header px-4 py-3 border-b border-gray-300 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-3">
          <img src={contact.avatar} alt={contact.name} className="w-10 h-10 rounded-full object-cover" />
          <div>
            <h3 className="font-semibold text-gray-800">{contact.name}</h3>
            <p className="text-xs text-gray-500">
              {contact.isBotActive ? 'Bot is handling conversation' : 'Human agent active'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border shadow-sm">
            <span className={`text-xs font-bold ${contact.isBotActive ? 'text-blue-600' : 'text-orange-500'}`}>
              {contact.isBotActive ? 'AI Mode' : 'Manual Mode'}
            </span>
            <button 
              onClick={() => onToggleBot(!contact.isBotActive)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              {contact.isBotActive ? (
                <ToggleRight size={28} className="text-blue-500" />
              ) : (
                <ToggleLeft size={28} className="text-orange-500" />
              )}
            </button>
          </div>
          <button className="text-gray-600 hover:bg-gray-200 p-2 rounded-full">
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
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Input Area */}
      {contact.isBotActive ? (
        <div className="bg-gray-100 p-4 border-t border-gray-300 flex items-center justify-center gap-2 text-gray-500">
           <AlertCircle size={18} />
           <span className="text-sm">Bot is active. Click the toggle above to take over.</span>
        </div>
      ) : (
        <div className="bg-wa-header p-3 border-t border-gray-300 flex flex-col gap-2">
          
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
              <span>Train Bot (Save this answer to Knowledge Base)</span>
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
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                Draft & Learn
              </span>
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
          
          <div className="text-center">
             <span className="text-[10px] text-gray-400">
               {teachBot && lastUserMessage ? `Learning from Q: "${lastUserMessage.text.substring(0, 30)}..."` : 'Press Enter to send'}
             </span>
          </div>
        </div>
      )}
    </div>
  );
};
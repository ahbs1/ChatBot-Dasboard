import React from 'react';
import { Message, SenderType, Direction } from '../types';
import { Check, CheckCheck, Bot, User } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.direction === Direction.INBOUND;
  // If outbound, check if it was sent by Bot or Agent (usually stored in metadata or inferred)
  // For UI display, we use the sender helper
  const isBot = !isUser && message.sender === SenderType.BOT;

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div 
        className={`relative max-w-[70%] px-4 py-2 rounded-lg shadow-sm border ${
          isUser 
            ? 'bg-white text-gray-900 rounded-tl-none border-gray-200' 
            : isBot 
              ? 'bg-gray-100 text-gray-800 rounded-tr-none border-gray-200' 
              : 'bg-wa-chat text-gray-900 rounded-tr-none border-green-200'
        }`}
      >
        {/* Sender Label for internal clarity */}
        {!isUser && (
          <div className="flex items-center gap-1 mb-1 opacity-70">
            {isBot ? <Bot size={12} /> : <User size={12} />}
            <span className="text-[10px] font-bold uppercase tracking-wide">
              {isBot ? 'AI Bot' : 'Agent'}
            </span>
          </div>
        )}

        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.text}
        </p>
        
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[10px] text-gray-500">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && (
            <span className="text-gray-500">
              {message.status === 'read' ? <CheckCheck size={14} className="text-blue-500" /> : <Check size={14} />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
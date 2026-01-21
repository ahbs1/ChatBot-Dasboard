import React, { useState } from 'react';
import { Message, SenderType, Direction } from '../types';
import { Check, CheckCheck, Bot, User, Pencil, X, Save, BrainCircuit } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  onEdit?: (messageId: string, newText: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(message.text);

  const isUser = message.direction === Direction.INBOUND;
  const isBot = !isUser && message.sender === SenderType.BOT;
  const isAgent = !isUser && message.sender === SenderType.AGENT;
  
  // Only allow editing for Outbound messages (Bot or Agent)
  const canEdit = !isUser && onEdit;

  const handleSave = () => {
    if (editedText.trim() !== message.text && onEdit) {
      onEdit(message.id, editedText);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedText(message.text);
    setIsEditing(false);
  };

  return (
    <div className={`flex w-full mb-4 group ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div 
        className={`relative max-w-[70%] px-4 py-2 rounded-lg shadow-sm border ${
          isUser 
            ? 'bg-white text-gray-900 rounded-tl-none border-gray-200' 
            : isBot 
              ? 'bg-gray-100 text-gray-800 rounded-tr-none border-gray-200' 
              : 'bg-wa-chat text-gray-900 rounded-tr-none border-green-200'
        }`}
      >
        {/* Header Label */}
        {!isUser && (
          <div className="flex items-center justify-between mb-1 opacity-70">
            <div className="flex items-center gap-1">
              {isBot ? <Bot size={12} /> : <User size={12} />}
              <span className="text-[10px] font-bold uppercase tracking-wide">
                {isBot ? 'AI Bot' : 'Agent'}
              </span>
            </div>
            
            {/* Edit Button (Visible on Hover) */}
            {canEdit && !isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/5 rounded text-gray-500"
                title="Edit & Train Bot"
              >
                <Pencil size={12} />
              </button>
            )}
          </div>
        )}

        {/* Content Area */}
        {isEditing ? (
          <div className="mt-1">
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full text-sm p-2 border rounded bg-white focus:ring-1 focus:ring-green-500 outline-none resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button 
                onClick={handleCancel}
                className="p-1 text-gray-500 hover:text-gray-700 bg-gray-200 rounded"
                title="Cancel"
              >
                <X size={14} />
              </button>
              <button 
                onClick={handleSave}
                className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-green-600 hover:bg-green-700 rounded shadow-sm"
                title="Save & Learn"
              >
                <BrainCircuit size={12} />
                <span>Fix & Learn</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {message.text}
          </p>
        )}
        
        {/* Footer Info */}
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
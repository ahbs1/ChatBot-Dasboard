
import React, { useState } from 'react';
import { Message, SenderType, Direction } from '../types';
import { Check, CheckCheck, Bot, User, Pencil, X, BrainCircuit } from 'lucide-react';

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

  // Status Icon Logic
  const renderStatusIcon = () => {
      if (message.status === 'read') return <CheckCheck size={14} className="text-blue-500" />;
      if (message.status === 'delivered') return <CheckCheck size={14} className="text-gray-400" />;
      return <Check size={14} className="text-gray-400" />; // Sent or Pending
  };

  return (
    <div className={`flex w-full mb-3 group ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div 
        className={`relative max-w-[70%] rounded-lg shadow-sm border overflow-hidden ${
          isUser 
            ? 'bg-white text-gray-900 rounded-tl-none border-gray-200' 
            : isBot 
              ? 'bg-gray-100 text-gray-800 rounded-tr-none border-gray-200' 
              : 'bg-wa-chat text-gray-900 rounded-tr-none border-green-200'
        }`}
      >
        {/* Optional: Header Label for Bot/Agent */}
        {!isUser && (
          <div className="flex items-center justify-between px-2 pt-1 mb-1 opacity-70">
            <div className="flex items-center gap-1">
              {isBot ? <Bot size={10} /> : <User size={10} />}
              <span className="text-[9px] font-bold uppercase tracking-wide">
                {isBot ? 'AI Bot' : 'Agent'}
              </span>
            </div>
            
            {/* Edit Button (Visible on Hover) */}
            {canEdit && !isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-black/5 rounded text-gray-500"
                title="Edit & Train Bot"
              >
                <Pencil size={10} />
              </button>
            )}
          </div>
        )}

        {/* Image Content (If Product/Media) */}
        {message.imageUrl && (
            <div className="w-full mb-1">
                <img src={message.imageUrl} alt="Attachment" className="w-full h-auto object-cover max-h-64" />
            </div>
        )}

        {/* Text Content Area */}
        <div className="px-3 pb-1 pt-1">
            {isEditing ? (
            <div className="mt-1 pb-2">
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
                    <span>Fix</span>
                </button>
                </div>
            </div>
            ) : (
            <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                {message.text}
            </p>
            )}
            
            {/* Footer Info */}
            <div className={`flex items-center gap-1 mt-1 mb-0.5 ${isUser ? 'justify-end' : 'justify-end'}`}>
            <span className="text-[10px] text-gray-500 min-w-fit">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {!isUser && (
                <span className="ml-0.5">
                {renderStatusIcon()}
                </span>
            )}
            </div>
        </div>
      </div>
    </div>
  );
};

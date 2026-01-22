
import React from 'react';
import { Contact, Device } from '../types';
import { X, Phone, Tag, Smartphone, Clock, Bell, Trash2, Ban } from 'lucide-react';

interface ContactInfoProps {
  contact: Contact;
  device?: Device;
  onClose: () => void;
}

export const ContactInfo: React.FC<ContactInfoProps> = ({ contact, device, onClose }) => {
  return (
    <div className="w-80 h-full border-l border-gray-200 bg-white flex flex-col overflow-y-auto animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="h-14 flex items-center px-4 border-b border-gray-200 bg-gray-50">
        <button onClick={onClose} className="mr-4 text-gray-600 hover:text-gray-900">
           <X size={20} />
        </button>
        <span className="font-semibold text-gray-800">Contact Info</span>
      </div>

      {/* Profile Pic & Name */}
      <div className="flex flex-col items-center py-8 bg-white border-b border-gray-100 shadow-sm">
        <img 
            src={contact.avatar} 
            alt={contact.name} 
            className="w-24 h-24 rounded-full object-cover mb-4 border-4 border-gray-50"
        />
        <h2 className="text-xl font-semibold text-gray-800">{contact.name}</h2>
        <p className="text-gray-500 text-sm mt-1">{contact.phoneNumber}</p>
      </div>

      {/* Info Section */}
      <div className="p-4 space-y-6">
        
        {/* About / Labels */}
        <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Labels</h3>
            <div className="flex flex-wrap gap-2">
                {contact.tags.length > 0 ? contact.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium border border-gray-200 flex items-center gap-1">
                        <Tag size={12} /> {tag}
                    </span>
                )) : (
                    <span className="text-sm text-gray-400 italic">No labels</span>
                )}
            </div>
        </div>

        {/* Source Device */}
        <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Source Inbox</h3>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className={`w-8 h-8 rounded-full ${device?.color || 'bg-gray-400'} bg-opacity-20 flex items-center justify-center text-gray-700`}>
                    <Smartphone size={16} />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-700">{device?.name || 'Unknown Device'}</p>
                    <p className="text-xs text-gray-500">{device?.phoneNumber}</p>
                </div>
            </div>
        </div>

        {/* Interactions */}
        <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Activity</h3>
            <div className="text-sm text-gray-600 space-y-3">
                <div className="flex items-center gap-3">
                    <Clock size={16} className="text-gray-400" />
                    <span>Last active: {contact.lastMessageTime.toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-3">
                    <Bell size={16} className="text-gray-400" />
                    <span>Notifications: On</span>
                </div>
            </div>
        </div>

      </div>

      {/* Actions */}
      <div className="mt-auto p-4 border-t border-gray-100 bg-gray-50 space-y-2">
        <button className="w-full py-2.5 flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium">
            <Ban size={16} /> Block {contact.name}
        </button>
        <button className="w-full py-2.5 flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium">
            <Trash2 size={16} /> Delete Chat
        </button>
      </div>
    </div>
  );
};

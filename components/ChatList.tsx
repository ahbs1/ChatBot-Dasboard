import React, { useState } from 'react';
import { Contact, Device } from '../types';
import { Bot, User, Search, Filter, Smartphone } from 'lucide-react';

interface ChatListProps {
  contacts: Contact[];
  devices: Device[];
  selectedContactId: string | null;
  onSelectContact: (contact: Contact) => void;
}

export const ChatList: React.FC<ChatListProps> = ({ contacts, devices, selectedContactId, onSelectContact }) => {
  const [filterDeviceId, setFilterDeviceId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Filter Logic
  const filteredContacts = contacts.filter(c => {
    const matchesDevice = filterDeviceId === 'all' || c.deviceId === filterDeviceId;
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.phoneNumber.includes(searchTerm);
    return matchesDevice && matchesSearch;
  });

  // Helper to get device info
  const getDevice = (id: string) => devices.find(d => d.id === id);

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-full md:w-80 lg:w-96">
      {/* Header */}
      <div className="p-4 bg-wa-header border-b sticky top-0 z-10 space-y-3">
        <div className="flex justify-between items-center">
           <h2 className="font-bold text-gray-700 text-lg">Chats</h2>
           <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
             {filteredContacts.length}
           </span>
        </div>
        
        {/* Device Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button 
             onClick={() => setFilterDeviceId('all')}
             className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
               filterDeviceId === 'all' 
                 ? 'bg-gray-800 text-white border-gray-800' 
                 : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
             }`}
          >
            All Inboxes
          </button>
          {devices.map(dev => (
            <button 
              key={dev.id}
              onClick={() => setFilterDeviceId(dev.id)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors border flex items-center gap-1 ${
                filterDeviceId === dev.id
                  ? 'bg-white border-transparent shadow-sm ring-2 ring-offset-1'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
              style={filterDeviceId === dev.id ? { borderColor: 'currentColor', color: 'black' } : {}}
            >
              <span className={`w-2 h-2 rounded-full ${dev.color}`}></span>
              {dev.name}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b bg-white">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search name or number..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-100 border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-wa-green focus:bg-white transition-all outline-none"
          />
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No conversations found.
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const dev = getDevice(contact.deviceId);
            return (
              <div 
                key={contact.id}
                onClick={() => onSelectContact(contact)}
                className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                  selectedContactId === contact.id ? 'bg-gray-100' : ''
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <img 
                    src={contact.avatar} 
                    alt={contact.name} 
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  {contact.isBotActive ? (
                    <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-1 border-2 border-white" title="Bot Active">
                      <Bot size={10} />
                    </div>
                  ) : (
                    <div className="absolute -bottom-1 -right-1 bg-wa-green text-white rounded-full p-1 border-2 border-white" title="Human Taken Over">
                      <User size={10} />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="ml-3 flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {contact.name}
                    </h3>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {contact.lastMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {/* Device Badge (Unified Inbox View) */}
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600 truncate max-w-[140px]">
                      {contact.lastMessage}
                    </p>
                    {contact.unreadCount > 0 && (
                      <span className="bg-wa-light text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {contact.unreadCount}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mt-1.5">
                    {/* Device Label */}
                    {dev && (
                       <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${dev.color} bg-opacity-10 text-gray-700`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dev.color}`}></span>
                          {dev.name}
                       </span>
                    )}
                    
                    <div className="flex gap-1">
                      {contact.tags.slice(0, 1).map(tag => (
                        <span key={tag} className="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
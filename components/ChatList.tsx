
import React, { useState } from 'react';
import { Contact, Device } from '../types';
import { Bot, User, Search, Smartphone, Zap, ZapOff, AlertCircle } from 'lucide-react';

interface ChatListProps {
  contacts: Contact[];
  devices: Device[];
  selectedContactId: string | null;
  onSelectContact: (contact: Contact) => void;
  isGlobalAiActive: boolean;
  onToggleGlobalAi: (active: boolean) => void;
}

export const ChatList: React.FC<ChatListProps> = ({ 
  contacts, 
  devices, 
  selectedContactId, 
  onSelectContact,
  isGlobalAiActive,
  onToggleGlobalAi
}) => {
  const [filterDeviceId, setFilterDeviceId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContacts = contacts.filter(c => {
    const matchesDevice = filterDeviceId === 'all' || c.deviceId === filterDeviceId;
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.phoneNumber.includes(searchTerm);
    return matchesDevice && matchesSearch;
  });

  const getDevice = (id: string) => devices.find(d => d.id === id);

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-full md:w-80 lg:w-96">
      {/* Global Bot Toggle Header */}
      <div className={`p-4 transition-colors border-b ${isGlobalAiActive ? 'bg-wa-header' : 'bg-orange-50'}`}>
        <div className="flex justify-between items-center mb-3">
           <h2 className="font-bold text-gray-700 text-lg">Chats</h2>
           <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isGlobalAiActive ? 'text-green-600' : 'text-orange-600'}`}>
                AI Master: {isGlobalAiActive ? 'ON' : 'OFF'}
              </span>
              <button 
                onClick={() => onToggleGlobalAi(!isGlobalAiActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isGlobalAiActive ? 'bg-wa-green' : 'bg-gray-300'}`}
              >
                <span className={`${isGlobalAiActive ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
              </button>
           </div>
        </div>

        {!isGlobalAiActive && (
          <div className="flex items-center gap-2 text-orange-700 bg-orange-100 p-2 rounded-md mb-3 text-[11px] font-medium border border-orange-200 animate-pulse">
            <ZapOff size={14} />
            <span>AI Bot is temporarily disabled for all numbers.</span>
          </div>
        )}
        
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
            // Effective Bot status: depends on individual AND global toggle
            const isEffectiveBot = contact.isBotActive && isGlobalAiActive;

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
                    <div 
                      className={`absolute -bottom-1 -right-1 text-white rounded-full p-1 border-2 border-white ${isGlobalAiActive ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-gray-400 opacity-80'}`} 
                      title={isGlobalAiActive ? "Bot Active" : "Bot Disabled by Master Switch"}
                    >
                      <Bot size={10} />
                    </div>
                  ) : (
                    <div className="absolute -bottom-1 -right-1 bg-wa-green text-white rounded-full p-1 border-2 border-white shadow-sm" title="Human Taken Over">
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

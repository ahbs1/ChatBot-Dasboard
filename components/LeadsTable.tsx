import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Lead, Device } from '../types';
import { User, MapPin, Search, Calendar, Phone } from 'lucide-react';

interface LeadsTableProps {
  devices: Device[];
}

export const LeadsTable: React.FC<LeadsTableProps> = ({ devices }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDeviceId, setFilterDeviceId] = useState<string>('all');

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    // In a real app, this would query Supabase 'leads' table
    // Mocking response for UI demonstration as we don't have real backend connected in this preview
    const { data, error } = await supabase.from('leads').select('*').order('updated_at', { ascending: false });
    
    if (data) {
        setLeads(data.map((d: any) => ({
            id: d.id,
            deviceId: d.device_id,
            phoneNumber: d.phone_number,
            name: d.name,
            address: d.address,
            lastInteraction: new Date(d.updated_at)
        })));
    } else {
        // Fallback mock data if table doesn't exist yet
        setLeads([
            { id: 1, deviceId: devices[0]?.id, phoneNumber: '6281234567890', name: 'Alice Johnson', address: 'Jl. Sudirman No. 45, Jakarta', lastInteraction: new Date() },
            { id: 2, deviceId: devices[1]?.id, phoneNumber: '6281398765432', name: 'Budi Santoso', address: 'Komp. Permata Hijau Blok A2', lastInteraction: new Date(Date.now() - 86400000) }
        ]);
    }
    setLoading(false);
  };

  const filteredLeads = leads.filter(lead => {
    const matchesDevice = filterDeviceId === 'all' || lead.deviceId === filterDeviceId;
    const matchesSearch = (lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           lead.phoneNumber.includes(searchTerm) || 
                           lead.address?.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesDevice && matchesSearch;
  });

  return (
    <div className="flex-1 bg-gray-50 p-4 md:p-8 pb-24 h-full overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-2xl font-bold text-gray-800">Leads Captured</h1>
           <p className="text-sm text-gray-500">Customer data automatically extracted by AI from conversations.</p>
        </div>
        <div className="bg-white px-3 py-1 rounded-full border text-xs font-medium text-gray-600 hidden md:block">
            Total: {filteredLeads.length}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex gap-2 items-center w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <span className="text-xs font-bold text-gray-500 uppercase mr-2 hidden md:inline">Filter:</span>
            <button 
                onClick={() => setFilterDeviceId('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border whitespace-nowrap ${
                filterDeviceId === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
                }`}
            >
                All
            </button>
            {devices.map(dev => (
                <button 
                key={dev.id}
                onClick={() => setFilterDeviceId(dev.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border flex items-center gap-1 whitespace-nowrap ${
                    filterDeviceId === dev.id ? 'bg-white border-blue-500 text-blue-600 ring-1 ring-blue-500' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
                }`}
                >
                <span className={`w-2 h-2 rounded-full ${dev.color}`}></span>
                {dev.name}
                </button>
            ))}
        </div>

        <div className="relative w-full md:w-64">
            <input 
                type="text" 
                placeholder="Search name, phone, address..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-wa-green focus:border-wa-green outline-none"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase border-b">Customer</th>
                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase border-b">Contact Info</th>
                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase border-b">Detected Address</th>
                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase border-b">Source Device</th>
                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase border-b">Last Updated</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredLeads.map((lead) => {
                        const dev = devices.find(d => d.id === lead.deviceId);
                        return (
                            <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700">
                                            <User size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{lead.name || 'Unknown Name'}</p>
                                            <p className="text-xs text-gray-400">ID: {lead.id}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Phone size={14} className="text-gray-400" />
                                        {lead.phoneNumber}
                                    </div>
                                </td>
                                <td className="p-4">
                                    {lead.address ? (
                                        <div className="flex items-start gap-2 max-w-xs">
                                            <MapPin size={14} className="text-red-500 mt-1 flex-shrink-0" />
                                            <span className="text-sm text-gray-700">{lead.address}</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">Not detected yet</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    {dev ? (
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${dev.color} bg-opacity-10 text-gray-700`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${dev.color}`}></span>
                                            {dev.name}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 text-xs">-</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <Calendar size={12} />
                                        {lead.lastInteraction.toLocaleDateString()} {lead.lastInteraction.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {filteredLeads.length === 0 && (
                        <tr>
                            <td colSpan={5} className="p-12 text-center text-gray-400">
                                No leads found matching your criteria.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};
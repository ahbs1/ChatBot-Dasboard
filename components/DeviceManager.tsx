import React, { useEffect, useState } from 'react';
import { Smartphone, Plus, Trash, UserCheck, Pencil, Save, X, Key, Globe, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Device } from '../types';
import { Button } from './Button';

interface DeviceManagerProps {
  devices: Device[];
  onAddDevice: (device: Device) => void;
  onDeleteDevice?: (deviceId: string) => void;
}

export const DeviceManager: React.FC<DeviceManagerProps> = ({ devices, onAddDevice, onDeleteDevice }) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  
  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formFonnteToken, setFormFonnteToken] = useState('');
  const [formAdminNumber, setFormAdminNumber] = useState('');

  // Initial Selection
  useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices]);

  // Handle Device Selection Change
  useEffect(() => {
    if (selectedDeviceId) {
      const dev = devices.find(d => d.id === selectedDeviceId);
      if (dev && isEditing) {
        populateForm(dev);
      }
    }
  }, [selectedDeviceId]);

  const populateForm = (dev: Device) => {
    setFormName(dev.name);
    setFormPhone(dev.phoneNumber);
    setFormFonnteToken(dev.fonnteToken || '');
    setFormAdminNumber(dev.adminNumber || '');
  };

  const handleEditClick = (dev: Device, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDeviceId(dev.id);
    populateForm(dev);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    clearForm();
  };

  const clearForm = () => {
    setFormName('');
    setFormPhone('');
    setFormFonnteToken('');
    setFormAdminNumber('');
  };

  // --- FORM SUBMISSION ---

  const handleSubmit = async () => {
    if (!formName.trim()) return;

    if (isEditing && selectedDeviceId) {
        try {
            await supabase.from('devices').update({
                name: formName,
                phone_number: formPhone,
                fonnte_token: formFonnteToken, // Save Token
                admin_number: formAdminNumber
            }).eq('id', selectedDeviceId);
            window.location.reload(); 
        } catch (e) {
            console.error(e);
            alert("Failed to update device");
        }
    } else {
        const id = `dev_${Date.now()}`;
        const newDevice: Device = {
            id,
            name: formName,
            phoneNumber: formPhone || 'No Number',
            color: 'bg-blue-500',
            fonnteToken: formFonnteToken,
            adminNumber: formAdminNumber
        };
        onAddDevice(newDevice);
        setSelectedDeviceId(id);
    }
    
    clearForm();
    setIsEditing(false);
  };

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  return (
    <div className="flex-1 bg-gray-50 flex flex-col h-full p-4 md:p-8 pb-24 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Fonnte Device Manager</h1>
          <p className="text-sm text-gray-500">Manage your WhatsApp connections via Fonnte API.</p>
        </div>
        <a 
          href="https://fonnte.com" 
          target="_blank" 
          rel="noreferrer"
          className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-lg flex items-center gap-2 hover:bg-gray-50 text-gray-600"
        >
          <Globe size={14} /> Fonnte Dashboard <ExternalLink size={12}/>
        </a>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Device List & Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-4">Connected Accounts</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {devices.map(dev => (
                <div 
                  key={dev.id}
                  onClick={() => { setSelectedDeviceId(dev.id); setIsEditing(false); clearForm(); }}
                  className={`p-3 rounded-lg flex items-center justify-between cursor-pointer border transition-all ${
                    selectedDeviceId === dev.id 
                      ? 'bg-blue-50 border-blue-200 shadow-sm' 
                      : 'bg-white border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-8 h-8 rounded-full ${dev.color} bg-opacity-20 flex-shrink-0 flex items-center justify-center text-gray-700`}>
                      <Smartphone size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">{dev.name}</h4>
                      <p className="text-xs text-gray-500 truncate">{dev.phoneNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                     <button 
                       onClick={(e) => handleEditClick(dev, e)}
                       className="text-gray-400 hover:text-blue-500 p-1.5 rounded-md hover:bg-blue-50 transition-colors"
                       title="Edit Config"
                     >
                       <Pencil size={14} />
                     </button>
                     {onDeleteDevice && (
                       <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteDevice(dev.id); }}
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                        title="Delete Device"
                       >
                         <Trash size={14} />
                       </button>
                     )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center mb-3">
                 <h4 className="text-xs font-bold text-gray-400 uppercase">
                    {isEditing ? 'Edit Configuration' : 'Add New Fonnte Device'}
                 </h4>
                 {isEditing && (
                    <button onClick={handleCancelEdit} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                        <X size={12}/> Cancel
                    </button>
                 )}
              </div>
              
              <div className="space-y-3">
                <input 
                  className="w-full text-sm p-2 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                  placeholder="Device Name (e.g. Sales Bot)"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                />
                <input 
                  className="w-full text-sm p-2 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                  placeholder="WhatsApp Number (e.g. 6281...)"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                />

                <div className="relative">
                   <Key size={14} className="absolute top-2.5 left-2.5 text-gray-400" />
                   <input 
                     className="w-full text-sm p-2 pl-8 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono text-xs" 
                     placeholder="Fonnte API Token"
                     value={formFonnteToken}
                     onChange={e => setFormFonnteToken(e.target.value)}
                     type="password"
                   />
                </div>
                
                <div className="relative">
                   <UserCheck size={14} className="absolute top-2.5 left-2.5 text-gray-400" />
                   <input 
                     className="w-full text-sm p-2 pl-8 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                     placeholder="Admin WA Number (Alerts)"
                     value={formAdminNumber}
                     onChange={e => setFormAdminNumber(e.target.value)}
                   />
                </div>

                <Button 
                    onClick={handleSubmit} 
                    className={`w-full text-xs ${isEditing ? 'bg-orange-600 hover:bg-orange-700' : 'bg-wa-green hover:bg-green-700'}`} 
                    icon={isEditing ? <Save size={14}/> : <Plus size={14}/>}
                    disabled={!formName.trim()}
                >
                  {isEditing ? 'Update Configuration' : 'Add Device'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Info Panel */}
        <div className="lg:col-span-2">
          {selectedDevice ? (
            <div className="flex flex-col gap-6">
              
              <div className="bg-white p-8 rounded-xl shadow-xl border border-gray-100 text-center max-w-lg mx-auto w-full relative overflow-hidden">
                {/* Status Bar */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${selectedDevice.fonnteToken ? 'bg-green-500' : 'bg-red-400'}`} />

                <div className="mb-6">
                   <h2 className="text-xl font-bold text-gray-800">
                     {selectedDevice.name}
                   </h2>
                   <p className="text-xs text-gray-400">{selectedDevice.phoneNumber}</p>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 min-h-[200px] flex items-center justify-center mb-6 relative">
                  
                  {selectedDevice.fonnteToken ? (
                    <div className="flex flex-col items-center text-green-600 animate-in fade-in zoom-in duration-500">
                      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                        <CheckCircle2 size={40} />
                      </div>
                      <span className="font-bold text-lg">Token Configured</span>
                      <p className="text-xs text-green-600/70 mt-1 max-w-[250px] text-center">
                        This device is ready to send messages via Fonnte API. Ensure the Webhook is set up to receive messages.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-red-500">
                      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
                        <Key size={32} />
                      </div>
                      <span className="font-bold">Missing Token</span>
                      <p className="text-xs text-red-400 mt-1">Please edit this device and add your Fonnte API Token.</p>
                    </div>
                  )}

                </div>

                <div className="text-left bg-blue-50 p-4 rounded-lg border border-blue-100">
                   <h4 className="text-xs font-bold text-blue-800 flex items-center gap-2 mb-2">
                      <AlertCircle size={14}/> Important: Webhook Setup
                   </h4>
                   <p className="text-[11px] text-blue-700 leading-relaxed">
                     To receive incoming messages from this number, you must paste the <strong>Supabase Edge Function URL</strong> into the Fonnte Dashboard Webhook field. Check the <strong>Config</strong> tab for the code.
                   </p>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
              <Smartphone size={48} className="mb-4 opacity-20" />
              <p>Select a device to view details.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

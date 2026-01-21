import React, { useEffect, useState, useRef } from 'react';
import { Smartphone, RefreshCw, CheckCircle, WifiOff, Plus, Trash, BellRing, Info, Mail } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Device } from '../types';
import { Button } from './Button';

interface DeviceManagerProps {
  devices: Device[];
  onAddDevice: (device: Device) => void;
  onDeleteDevice?: (deviceId: string) => void;
}

export const DeviceManager: React.FC<DeviceManagerProps> = ({ devices, onAddDevice, onDeleteDevice }) => {
  // NOTE: We use 'devices' from props now, so the list is synced with App.tsx
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<string>('disconnected');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  const prevStatusRef = useRef<string>('disconnected');

  // Form State
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDevicePhone, setNewDevicePhone] = useState('');
  const [newDeviceEmail, setNewDeviceEmail] = useState('');

  // Set initial selection
  useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  // --- Realtime Status Monitoring for Selected Device ---
  useEffect(() => {
    if (!selectedDeviceId) return;

    const fetchStatus = async () => {
      const { data } = await supabase
        .from('system_status')
        .select('*')
        .eq('id', selectedDeviceId)
        .single();
      
      if (data) {
        handleStatusChange(data.status, data.qr_code, new Date(data.updated_at));
      } else {
        setDeviceStatus('connecting'); 
      }
    };
    fetchStatus();

    const channel = supabase
      .channel(`device:${selectedDeviceId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'system_status', filter: `id=eq.${selectedDeviceId}` },
        (payload) => {
          handleStatusChange(payload.new.status, payload.new.qr_code, new Date(payload.new.updated_at));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDeviceId]);

  const handleStatusChange = (newStatus: string, newQr: string | null, updated: Date) => {
    setDeviceStatus(newStatus);
    setQrCode(newQr);
    setLastUpdated(updated);

    if (prevStatusRef.current === 'connected' && newStatus === 'disconnected') {
      triggerDisconnectAlert();
    }
    prevStatusRef.current = newStatus;
  };

  const triggerDisconnectAlert = () => {
    if (Notification.permission === 'granted') {
      const devName = devices.find(d => d.id === selectedDeviceId)?.name || 'Device';
      new Notification('⚠️ WhatsApp Disconnected', {
        body: `Device ${devName} lost connection.`,
        icon: '/favicon.ico'
      });
    }
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.log("Audio autoplay blocked", e));
  };

  const getRandomColor = () => {
    const colors = ['bg-blue-500', 'bg-orange-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handleAddSubmit = () => {
    if (!newDeviceName.trim()) return;

    const id = `dev_${Date.now()}`;
    const color = getRandomColor();
    
    const newDevice: Device = {
      id,
      name: newDeviceName,
      phoneNumber: newDevicePhone || 'No Number',
      color,
      status: 'disconnected',
      alertEmail: newDeviceEmail
    };

    // Pass to parent to update Global State + DB
    onAddDevice(newDevice);

    // Reset Form
    setNewDeviceName('');
    setNewDevicePhone('');
    setNewDeviceEmail('');
    
    // Auto select new device
    setSelectedDeviceId(id);
  };

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  return (
    <div className="flex-1 bg-gray-50 flex flex-col h-full p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Device Management</h1>
        <div className="text-xs text-gray-500 flex items-center gap-2">
           <BellRing size={14} className={Notification.permission === 'granted' ? "text-green-500" : "text-gray-400"} />
           {Notification.permission === 'granted' ? "Browser Alerts On" : "Enable Browser Notifications"}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Device List */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-4">Your Businesses</h3>
            <div className="space-y-2">
              {devices.map(dev => (
                <div 
                  key={dev.id}
                  onClick={() => setSelectedDeviceId(dev.id)}
                  className={`p-3 rounded-lg flex items-center justify-between cursor-pointer border transition-all ${
                    selectedDeviceId === dev.id 
                      ? 'bg-blue-50 border-blue-200 shadow-sm' 
                      : 'bg-white border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${dev.color} bg-opacity-20 flex items-center justify-center text-gray-700`}>
                      <Smartphone size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{dev.name}</h4>
                      <p className="text-xs text-gray-500">{dev.phoneNumber || 'No Number'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                     {selectedDeviceId === dev.id && <CheckCircle size={16} className="text-blue-500" />}
                     {onDeleteDevice && (
                       <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteDevice(dev.id); }}
                        className="text-gray-300 hover:text-red-500 p-1"
                       >
                         <Trash size={14} />
                       </button>
                     )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Add New Device</h4>
              <div className="space-y-3">
                <input 
                  className="w-full text-sm p-2 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none" 
                  placeholder="Device Name (e.g. Toko Bata)"
                  value={newDeviceName}
                  onChange={e => setNewDeviceName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSubmit()}
                />
                <input 
                  className="w-full text-sm p-2 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none" 
                  placeholder="Phone Number (e.g. 6281...)"
                  value={newDevicePhone}
                  onChange={e => setNewDevicePhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSubmit()}
                />
                <input 
                  className="w-full text-sm p-2 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none" 
                  placeholder="Alert Email (Required for notifications)"
                  value={newDeviceEmail}
                  onChange={e => setNewDeviceEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSubmit()}
                />
                <Button 
                    onClick={handleAddSubmit} 
                    className="w-full text-xs" 
                    icon={<Plus size={14}/>}
                    disabled={!newDeviceName.trim()}
                >
                  Add Device
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: QR & Status Panel */}
        <div className="lg:col-span-2">
          {selectedDevice ? (
            <div className="flex flex-col gap-6">
              
              <div className="bg-white p-8 rounded-xl shadow-xl border border-gray-100 text-center max-w-lg mx-auto w-full">
                
                <div className="mb-4">
                   <h2 className="text-xl font-bold text-gray-800">
                     {selectedDevice.name}
                   </h2>
                   <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
                     {selectedDevice.alertEmail ? (
                       <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-xs">
                         <Mail size={12} /> Email Alerts: Active
                       </span>
                     ) : (
                       <span className="text-orange-500 text-xs">No email set for alerts</span>
                     )}
                   </p>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 min-h-[300px] flex items-center justify-center mb-6 relative">
                  
                  {deviceStatus === 'connecting' && (
                    <div className="flex flex-col items-center text-gray-400 animate-pulse">
                      <RefreshCw className="animate-spin mb-2" />
                      <span className="text-xs">Waiting for worker...</span>
                    </div>
                  )}

                  {deviceStatus === 'disconnected' && (
                    <div className="flex flex-col items-center text-red-500 animate-pulse">
                      <WifiOff size={48} className="mb-4" />
                      <span className="font-bold">Disconnected</span>
                      <p className="text-xs text-gray-500 mt-2 max-w-[200px]">
                        The worker is running, but WhatsApp is not connected.
                        {selectedDevice.alertEmail && <span className="block mt-2 font-semibold text-red-600">Alert sent to {selectedDevice.alertEmail}</span>}
                      </p>
                    </div>
                  )}

                  {deviceStatus === 'qr_ready' && qrCode && (
                    <div className="flex flex-col items-center">
                      <div className="relative group">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCode)}`} 
                          alt="Scan QR" 
                          className="w-56 h-56 mix-blend-multiply border-4 border-white shadow-lg rounded-lg"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-4 animate-pulse">Scan with WhatsApp (Linked Devices)</p>
                    </div>
                  )}

                  {deviceStatus === 'connected' && (
                    <div className="flex flex-col items-center text-green-600">
                      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
                        <CheckCircle size={40} />
                      </div>
                      <span className="font-semibold text-lg">Connected & Ready</span>
                      <p className="text-xs text-green-600/70 mt-1">Bot is listening for messages</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400 border-t pt-4">
                   <span>Last Update: {lastUpdated.toLocaleTimeString()}</span>
                   <span className={`px-2 py-0.5 rounded text-white ${deviceStatus === 'connected' ? 'bg-green-500' : 'bg-orange-400'}`}>
                     {deviceStatus.toUpperCase()}
                   </span>
                </div>
              </div>

              {/* Instructions Panel */}
              {deviceStatus === 'qr_ready' && (
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg max-w-lg mx-auto w-full flex gap-3">
                  <div className="bg-blue-100 p-2 h-fit rounded-full text-blue-600">
                    <Info size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-800 text-sm mb-1">How to Connect?</h4>
                    <ol className="list-decimal list-inside text-xs text-blue-700 space-y-1">
                      <li>Open <strong>WhatsApp Business</strong> on your phone.</li>
                      <li>Go to <strong>Settings</strong> > <strong>Linked Devices</strong>.</li>
                      <li>Scan the QR code.</li>
                    </ol>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
              <Smartphone size={48} className="mb-4 opacity-20" />
              <p>Select a business device from the list to manage.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
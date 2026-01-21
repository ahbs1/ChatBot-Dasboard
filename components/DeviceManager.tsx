import React, { useEffect, useState, useRef } from 'react';
import { Smartphone, RefreshCw, CheckCircle, WifiOff, Plus, Trash, BellRing, Info, Mail, UserCheck, Pencil, QrCode, Keyboard, Server, Save, X } from 'lucide-react';
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
  const [deviceStatus, setDeviceStatus] = useState<string>('disconnected');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Connection Mode State
  const [connectMode, setConnectMode] = useState<'qr' | 'pairing'>('qr');
  const [workerUrl, setWorkerUrl] = useState<string>('http://localhost:3000'); // Default dev URL
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [isLoadingCode, setIsLoadingCode] = useState(false);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAdminNumber, setFormAdminNumber] = useState('');

  const prevStatusRef = useRef<string>('disconnected');

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
      setPairingCode(null);
      setQrImageUrl(null);
      setConnectMode('qr'); // Reset to default
    }
  }, [selectedDeviceId]);

  const populateForm = (dev: Device) => {
    setFormName(dev.name);
    setFormPhone(dev.phoneNumber);
    setFormEmail(dev.alertEmail || '');
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
    setFormEmail('');
    setFormAdminNumber('');
  };

  // --- Realtime Status Monitoring ---
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

  const handleStatusChange = (newStatus: string, rawQrString: string | null, updated: Date) => {
    setDeviceStatus(newStatus);
    setLastUpdated(updated);
    
    // If backend provides raw QR string via Supabase, we can use it, 
    // OR we can rely on the manual fetch below for the Base64 image which is safer
    if (newStatus === 'qr_ready' && rawQrString) {
      // We'll let the fallback renderer handle the raw string if needed, 
      // but prefer fetching image from API if user clicks refresh
    }

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

  // --- API CALLS TO WORKER ---

  const fetchQrFromApi = async () => {
    if (!selectedDeviceId) return;
    setIsLoadingCode(true);
    try {
      const res = await fetch(`${workerUrl}/scan/${selectedDeviceId}`);
      const data = await res.json();
      if (data.qr_image) {
        setQrImageUrl(data.qr_image);
      }
      if (data.status) setDeviceStatus(data.status);
    } catch (e) {
      alert("Failed to reach Worker API. Check URL.");
    } finally {
      setIsLoadingCode(false);
    }
  };

  const fetchPairingCode = async () => {
    if (!selectedDeviceId) return;
    setIsLoadingCode(true);
    setPairingCode(null);
    try {
      const res = await fetch(`${workerUrl}/pair-code/${selectedDeviceId}`);
      const data = await res.json();
      if (data.code) {
        setPairingCode(data.code);
      } else if (data.status === 'connected') {
        setDeviceStatus('connected');
        alert("Device is already connected!");
      } else {
        alert(data.message || "Failed to get code");
      }
    } catch (e) {
      alert("Failed to reach Worker API. Check URL.");
    } finally {
      setIsLoadingCode(false);
    }
  };

  // --- FORM SUBMISSION ---

  const handleSubmit = async () => {
    if (!formName.trim()) return;

    if (isEditing && selectedDeviceId) {
        // UPDATE Existing
        try {
            await supabase.from('devices').update({
                name: formName,
                phone_number: formPhone,
                alert_email: formEmail,
                admin_number: formAdminNumber
            }).eq('id', selectedDeviceId);
            
            // Optimistic Update handled by Parent usually, but here we can force reload or rely on parent
            // Ideally onAddDevice prop should be renamed to onUpsertDevice or handled differently
            // For now, reload page or rely on Realtime if implemented in App.tsx for devices list
            window.location.reload(); // Simple refresh to reflect changes
        } catch (e) {
            console.error(e);
            alert("Failed to update device");
        }
    } else {
        // CREATE New
        const id = `dev_${Date.now()}`;
        const newDevice: Device = {
            id,
            name: formName,
            phoneNumber: formPhone || 'No Number',
            color: 'bg-blue-500',
            status: 'disconnected',
            alertEmail: formEmail,
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
    <div className="flex-1 bg-gray-50 flex flex-col h-full p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Device Management</h1>
        <div className="flex items-center gap-4">
             {/* Worker URL Config */}
             <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                <Server size={14} className="text-gray-400"/>
                <input 
                  value={workerUrl} 
                  onChange={(e) => setWorkerUrl(e.target.value)}
                  className="text-xs text-gray-600 outline-none w-40 bg-transparent"
                  placeholder="Worker URL (e.g. http://localhost:3000)"
                />
             </div>
             <div className="text-xs text-gray-500 flex items-center gap-2">
                <BellRing size={14} className={Notification.permission === 'granted' ? "text-green-500" : "text-gray-400"} />
             </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Device List & Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-4">Your Businesses</h3>
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
                       title="Edit Device"
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
                    {isEditing ? 'Edit Device' : 'Add New Device'}
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
                  placeholder="Device Name (e.g. Toko Bata)"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                />
                <input 
                  className="w-full text-sm p-2 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                  placeholder="Phone Number (e.g. 6281...)"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                />
                
                <div className="relative">
                   <UserCheck size={14} className="absolute top-2.5 left-2.5 text-gray-400" />
                   <input 
                     className="w-full text-sm p-2 pl-8 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                     placeholder="Admin WA (Alerts)"
                     value={formAdminNumber}
                     onChange={e => setFormAdminNumber(e.target.value)}
                   />
                </div>

                <div className="relative">
                   <Mail size={14} className="absolute top-2.5 left-2.5 text-gray-400" />
                   <input 
                     className="w-full text-sm p-2 pl-8 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                     placeholder="Admin Email"
                     value={formEmail}
                     onChange={e => setFormEmail(e.target.value)}
                   />
                </div>

                <Button 
                    onClick={handleSubmit} 
                    className={`w-full text-xs ${isEditing ? 'bg-orange-600 hover:bg-orange-700' : 'bg-wa-green hover:bg-green-700'}`} 
                    icon={isEditing ? <Save size={14}/> : <Plus size={14}/>}
                    disabled={!formName.trim()}
                >
                  {isEditing ? 'Update Device' : 'Add Device'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Connection Panel */}
        <div className="lg:col-span-2">
          {selectedDevice ? (
            <div className="flex flex-col gap-6">
              
              <div className="bg-white p-8 rounded-xl shadow-xl border border-gray-100 text-center max-w-lg mx-auto w-full relative overflow-hidden">
                {/* Status Bar */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${deviceStatus === 'connected' ? 'bg-green-500' : 'bg-orange-400'}`} />

                <div className="mb-6">
                   <h2 className="text-xl font-bold text-gray-800">
                     {selectedDevice.name}
                   </h2>
                   <p className="text-xs text-gray-400">{selectedDevice.phoneNumber}</p>
                </div>

                {deviceStatus !== 'connected' && (
                    <div className="flex justify-center gap-2 mb-6">
                        <button 
                           onClick={() => setConnectMode('qr')}
                           className={`px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 transition-all ${connectMode === 'qr' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            <QrCode size={14} /> Scan QR
                        </button>
                        <button 
                           onClick={() => setConnectMode('pairing')}
                           className={`px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 transition-all ${connectMode === 'pairing' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            <Keyboard size={14} /> Pairing Code
                        </button>
                    </div>
                )}

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 min-h-[320px] flex items-center justify-center mb-6 relative">
                  
                  {/* --- CONNECTED STATE --- */}
                  {deviceStatus === 'connected' && (
                    <div className="flex flex-col items-center text-green-600 animate-in fade-in zoom-in duration-500">
                      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                        <CheckCircle size={48} />
                      </div>
                      <span className="font-bold text-xl">Connected</span>
                      <p className="text-xs text-green-600/70 mt-1">Bot is online & listening</p>
                    </div>
                  )}

                  {/* --- DISCONNECTED / QR MODE --- */}
                  {deviceStatus !== 'connected' && connectMode === 'qr' && (
                    <div className="flex flex-col items-center w-full">
                       {qrImageUrl ? (
                           <div className="relative group">
                                <img 
                                    src={qrImageUrl} 
                                    alt="Scan QR" 
                                    className="w-56 h-56 mix-blend-multiply border-4 border-white shadow-lg rounded-lg"
                                />
                                <div className="mt-4 text-xs text-gray-500 flex flex-col items-center gap-2">
                                    <p>Scan with WhatsApp (Linked Devices)</p>
                                    <button onClick={fetchQrFromApi} className="text-blue-500 hover:underline flex items-center gap-1">
                                        <RefreshCw size={12} /> Refresh Code
                                    </button>
                                </div>
                           </div>
                       ) : (
                           <div className="text-center">
                               {deviceStatus === 'qr_ready' ? (
                                   <div className="flex flex-col items-center gap-3">
                                       <QrCode size={48} className="text-gray-300" />
                                       <p className="text-sm text-gray-500">QR Code is ready but not displayed.</p>
                                       <Button onClick={fetchQrFromApi} isLoading={isLoadingCode} variant="secondary" className="text-xs">
                                           Click to Load QR Image
                                       </Button>
                                   </div>
                               ) : (
                                   <div className="flex flex-col items-center gap-3 animate-pulse">
                                       <RefreshCw size={32} className="text-gray-300 animate-spin" />
                                       <p className="text-xs text-gray-400">Connecting to worker...</p>
                                   </div>
                               )}
                           </div>
                       )}
                    </div>
                  )}

                  {/* --- DISCONNECTED / PAIRING CODE MODE --- */}
                  {deviceStatus !== 'connected' && connectMode === 'pairing' && (
                     <div className="flex flex-col items-center w-full max-w-xs">
                        {pairingCode ? (
                            <div className="animate-in slide-in-from-bottom duration-300 text-center">
                                <p className="text-xs text-gray-500 mb-2 font-medium">Enter this code on your phone:</p>
                                <div className="bg-white border-2 border-dashed border-gray-300 p-4 rounded-xl mb-4">
                                    <span className="text-3xl font-mono font-bold tracking-widest text-gray-800">
                                        {pairingCode.slice(0,4)}-{pairingCode.slice(4)}
                                    </span>
                                </div>
                                <div className="text-[10px] text-left text-gray-500 bg-blue-50 p-3 rounded-lg space-y-1">
                                    <p>1. Open WhatsApp on Phone</p>
                                    <p>2. Settings &gt; Linked Devices</p>
                                    <p>3. Link a Device &gt; <strong>Link with phone number</strong></p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center">
                                <div className="bg-orange-50 p-3 rounded-full text-orange-500 mb-3 mx-auto w-fit">
                                    <Smartphone size={24} />
                                </div>
                                <p className="text-sm font-medium text-gray-700 mb-1">Link with Phone Number</p>
                                <p className="text-xs text-gray-400 mb-4 px-4">
                                    Use this if scanning QR code is difficult or camera is broken.
                                </p>
                                <Button 
                                    onClick={fetchPairingCode} 
                                    isLoading={isLoadingCode}
                                    className="w-full"
                                >
                                    Generate Pairing Code
                                </Button>
                            </div>
                        )}
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
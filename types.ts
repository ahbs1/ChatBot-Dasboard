
export enum Direction {
  INBOUND = 'inbound',   // From User
  OUTBOUND = 'outbound'  // From Bot or Agent
}

export enum SenderType {
  USER = 'user',
  BOT = 'bot',
  AGENT = 'agent'
}

export interface Device {
  id: string;          // UUID or Unique String
  name: string;        // Friendly Name (e.g., "Toko Bata")
  phoneNumber: string; // The WA Number linked to Fonnte
  color: string;       // UI Badge Color
  fonnteToken?: string; // Fonnte API Token
  alertEmail?: string; 
  adminNumber?: string;
}

export interface Lead {
  id: number;
  deviceId: string;
  phoneNumber: string;
  name?: string;
  address?: string;
  lastInteraction: Date;
}

export interface Message {
  id: string;
  text: string;
  imageUrl?: string; 
  sender: SenderType; 
  direction: Direction;
  timestamp: Date;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface Contact {
  id: string; // wa_number
  deviceId: string;
  name: string;
  phoneNumber: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isBotActive: boolean; // Individual setting
  tags: string[];
}

export interface GlobalSettings {
  isAiEnabled: boolean;
}

export interface RAGDocument {
  id: string;
  deviceId: string;
  title: string;
  content: string;
  similarity: number;
  metadata?: Record<string, any>;
}

export interface Product {
    id: string;
    name: string;
    price: number;
    description: string;
    image: string;
}

export enum AppView {
  DASHBOARD = 'dashboard',
  KNOWLEDGE = 'knowledge',
  LEADS = 'leads',
  DEVICES = 'devices',
  SETTINGS = 'settings'
}

// --- Database Schema Types ---

export interface DBDevice {
  id: string;
  name: string;
  phone_number: string;
  color: string;
  fonnte_token?: string;
  alert_email?: string; 
  admin_number?: string;
  created_at: string;
}

export interface DBConversation {
  wa_number: string;
  device_id: string; 
  name: string;
  mode: 'bot' | 'agent';
  last_active: string;
}

export interface DBMessage {
  id: number;
  conversation_id: string;
  message: string;
  direction: 'inbound' | 'outbound';
  status: string;
  created_at: string;
}

export interface DBSystemSettings {
  id: string;
  key: string;
  value: any;
}

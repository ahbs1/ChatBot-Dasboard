import { Contact, SenderType, Message, RAGDocument, Direction, Device } from './types';

export const MOCK_DEVICES: Device[] = [
  {
    id: 'dev_1',
    name: 'Jasa Konstruksi',
    phoneNumber: '62811111111',
    color: 'bg-blue-500'
  },
  {
    id: 'dev_2',
    name: 'Toko Bata Merah',
    phoneNumber: '62822222222',
    color: 'bg-orange-500'
  }
];

export const MOCK_CONTACTS: Contact[] = [
  {
    id: '6281234567890', 
    deviceId: 'dev_1', // Belongs to Konstruksi
    name: 'Alice Johnson',
    phoneNumber: '6281234567890',
    avatar: 'https://picsum.photos/id/64/200/200',
    lastMessage: 'I need help with my invoice.',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 5),
    unreadCount: 1,
    isBotActive: true,
    tags: ['Project A', 'Urgent']
  },
  {
    id: '6281398765432',
    deviceId: 'dev_2', // Belongs to Toko Bata
    name: 'Budi Santoso',
    phoneNumber: '6281398765432',
    avatar: 'https://picsum.photos/id/91/200/200',
    lastMessage: 'Bata merah 1000 pcs ready?',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2),
    unreadCount: 0,
    isBotActive: false, 
    tags: ['Sales', 'New']
  },
  {
    id: '15550192837',
    deviceId: 'dev_1', // Belongs to Konstruksi
    name: 'Charlie Davis',
    phoneNumber: '15550192837',
    avatar: 'https://picsum.photos/id/103/200/200',
    lastMessage: 'Is the pricing negotiable?',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24),
    unreadCount: 0,
    isBotActive: true,
    tags: ['Inquiry']
  }
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
  '6281234567890': [
    {
      id: 'm1',
      text: 'Hello, I have an issue with my latest invoice.',
      sender: SenderType.USER,
      direction: Direction.INBOUND,
      timestamp: new Date(Date.now() - 1000 * 60 * 6),
      status: 'read'
    },
    {
      id: 'm2',
      text: 'Hi Alice! I can help with that. Could you please provide your invoice number?',
      sender: SenderType.BOT,
      direction: Direction.OUTBOUND,
      timestamp: new Date(Date.now() - 1000 * 60 * 5.5),
      status: 'read'
    }
  ],
  '6281398765432': [
    {
      id: 'm4',
      text: 'Bata merah 1000 pcs ready?',
      sender: SenderType.USER,
      direction: Direction.INBOUND,
      timestamp: new Date(Date.now() - 1000 * 60 * 120),
      status: 'read'
    },
    {
      id: 'm5',
      text: 'Halo Pak Budi, ready stok banyak. Mau dikirim kemana?',
      sender: SenderType.BOT,
      direction: Direction.OUTBOUND,
      timestamp: new Date(Date.now() - 1000 * 60 * 119),
      status: 'read'
    }
  ]
};

export const MOCK_RAG_DOCS: RAGDocument[] = [
  {
    id: 'd1',
    deviceId: 'dev_1',
    title: 'Refund Policy (Konstruksi)',
    content: 'Refunds are processed within 5-7 business days.',
    similarity: 0.92,
    metadata: { source: 'policy.pdf' }
  },
  {
    id: 'd2',
    deviceId: 'dev_2',
    title: 'Harga Bata Merah',
    content: 'Harga per pcs Rp 800. Minimal pembelian 500 pcs.',
    similarity: 0.85,
    metadata: { source: 'pricing_bata.xlsx' }
  }
];
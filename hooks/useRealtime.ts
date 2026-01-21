import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Message, Contact, Direction, SenderType } from '../types';

export const useRealtime = (
  onNewMessage: (msg: Message, contactId: string) => void,
  onContactUpdate: (contactId: string, updates: Partial<Contact>) => void
) => {
  useEffect(() => {
    // 1. Listen to New Messages (Insertions)
    const messageSub = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new;
          
          // Convert DB Message to UI Message
          const uiMsg: Message = {
            id: newMsg.id.toString(),
            text: newMsg.message,
            direction: newMsg.direction as Direction,
            sender: newMsg.direction === 'inbound' ? SenderType.USER : SenderType.BOT, // Simplified logic
            timestamp: new Date(newMsg.created_at),
            status: newMsg.status as any
          };

          // Trigger callback
          onNewMessage(uiMsg, newMsg.conversation_id);
        }
      )
      .subscribe();

    // 2. Listen to Conversation Updates (e.g. Mode switching)
    const conversationSub = supabase
      .channel('public:conversations')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          const updatedConvo = payload.new;
          // Map DB columns to Contact interface
          onContactUpdate(updatedConvo.wa_number, {
             isBotActive: updatedConvo.mode === 'bot',
             // name: updatedConvo.name // Optional update
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageSub);
      supabase.removeChannel(conversationSub);
    };
  }, [onNewMessage, onContactUpdate]);
};
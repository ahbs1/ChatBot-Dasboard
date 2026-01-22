
import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Message, Contact, Direction, SenderType } from '../types';

export const useRealtime = (
  onNewMessage: (msg: Message, contactId: string) => void,
  onContactUpdate: (contactId: string, updates: Partial<Contact>) => void,
  onSettingsUpdate?: (key: string, value: any) => void
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
          const uiMsg: Message = {
            id: newMsg.id.toString(),
            text: newMsg.message,
            imageUrl: newMsg.image_url,
            direction: newMsg.direction as Direction,
            sender: newMsg.direction === 'inbound' ? SenderType.USER : SenderType.BOT,
            timestamp: new Date(newMsg.created_at),
            status: newMsg.status as any
          };
          onNewMessage(uiMsg, newMsg.conversation_id);
        }
      )
      .subscribe();

    // 2. Listen to Conversation Updates
    const conversationSub = supabase
      .channel('public:conversations')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          const updatedConvo = payload.new;
          onContactUpdate(updatedConvo.wa_number, {
             isBotActive: updatedConvo.mode === 'bot',
          });
        }
      )
      .subscribe();

    // 3. Listen to System Settings Updates (Global Toggle)
    const settingsSub = supabase
      .channel('public:system_settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'system_settings' },
        (payload) => {
          if (onSettingsUpdate) {
            onSettingsUpdate(payload.new.key, payload.new.value);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageSub);
      supabase.removeChannel(conversationSub);
      supabase.removeChannel(settingsSub);
    };
  }, [onNewMessage, onContactUpdate, onSettingsUpdate]);
};

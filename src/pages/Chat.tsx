import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Send, 
  Users, 
  MessageCircle, 
  User,
  Loader2,
  Check,
  CheckCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    full_name: string;
  };
}

interface UserProfile {
  user_id: string;
  full_name: string;
  email: string | null;
}

export default function Chat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedChat, setSelectedChat] = useState<string | null>(null); // null = grupo general
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all users for chat list
  const { data: users = [] } = useQuery({
    queryKey: ['chat_users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .order('full_name');
      if (error) throw error;
      return data as UserProfile[];
    },
  });

  // Fetch messages for selected chat
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['chat_messages', selectedChat],
    queryFn: async () => {
      let query = supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (selectedChat === null) {
        // General chat - messages where recipient_id is null
        query = query.is('recipient_id', null);
      } else {
        // Private chat - messages between current user and selected user
        query = query.or(
          `and(sender_id.eq.${user?.id},recipient_id.eq.${selectedChat}),and(sender_id.eq.${selectedChat},recipient_id.eq.${user?.id})`
        );
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;

      // Get sender names
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: senderProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', senderIds);

      const profilesMap = new Map(senderProfiles?.map(p => [p.user_id, p]) || []);
      
      return data.map(msg => ({
        ...msg,
        sender: profilesMap.get(msg.sender_id),
      })) as ChatMessage[];
    },
    enabled: !!user,
  });

  // Get unread counts per chat
  const { data: unreadCounts = {} } = useQuery({
    queryKey: ['unread_counts', user?.id],
    queryFn: async () => {
      if (!user?.id) return {};
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('sender_id, recipient_id')
        .eq('is_read', false)
        .neq('sender_id', user.id);

      if (error) throw error;

      const counts: Record<string, number> = { general: 0 };
      
      data.forEach(msg => {
        if (msg.recipient_id === null) {
          counts['general'] = (counts['general'] || 0) + 1;
        } else if (msg.recipient_id === user.id) {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
        }
      });

      return counts;
    },
    enabled: !!user,
  });

  // Subscribe to realtime messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('chat_messages_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          // Refresh if message is relevant to current view
          const isRelevant = 
            (selectedChat === null && newMsg.recipient_id === null) ||
            (selectedChat && (newMsg.sender_id === selectedChat || newMsg.recipient_id === selectedChat));
          
          if (isRelevant) {
            refetchMessages();
          }
          
          // Always update unread counts
          queryClient.invalidateQueries({ queryKey: ['unread_counts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedChat, refetchMessages, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when viewing chat
  useEffect(() => {
    if (!user || messages.length === 0) return;

    const unreadMessages = messages.filter(
      m => !m.is_read && m.sender_id !== user.id
    );

    if (unreadMessages.length > 0) {
      const markAsRead = async () => {
        await supabase
          .from('chat_messages')
          .update({ is_read: true })
          .in('id', unreadMessages.map(m => m.id));
        
        queryClient.invalidateQueries({ queryKey: ['unread_counts'] });
      };
      markAsRead();
    }
  }, [messages, user, queryClient]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    setIsSending(true);
    try {
      const { error } = await supabase.from('chat_messages').insert({
        sender_id: user.id,
        recipient_id: selectedChat,
        message: newMessage.trim(),
      });

      if (error) throw error;
      
      setNewMessage('');
      refetchMessages();
    } catch (error: any) {
      toast.error(error.message || 'Error al enviar mensaje');
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const selectedUserName = selectedChat
    ? users.find(u => u.user_id === selectedChat)?.full_name || 'Usuario'
    : 'Chat General';

  const otherUsers = users.filter(u => u.user_id !== user?.id);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar - Chat List */}
        <div className="w-72 border-r bg-muted/30 flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Chat Interno
            </h2>
          </div>

          <ScrollArea className="flex-1">
            {/* General Chat */}
            <div
              className={cn(
                "p-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-center gap-3",
                selectedChat === null && "bg-muted"
              )}
              onClick={() => setSelectedChat(null)}
            >
              <Avatar className="h-10 w-10 bg-primary">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Users className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">Chat General</p>
                <p className="text-xs text-muted-foreground">Todos los usuarios</p>
              </div>
              {(unreadCounts['general'] || 0) > 0 && (
                <Badge variant="destructive" className="rounded-full h-5 min-w-5 flex items-center justify-center">
                  {unreadCounts['general']}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Private Chats */}
            <div className="p-2">
              <p className="text-xs text-muted-foreground px-2 py-1">Conversaciones privadas</p>
            </div>
            
            {otherUsers.map((chatUser) => (
              <div
                key={chatUser.user_id}
                className={cn(
                  "p-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-center gap-3",
                  selectedChat === chatUser.user_id && "bg-muted"
                )}
                onClick={() => setSelectedChat(chatUser.user_id)}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-secondary">
                    {getInitials(chatUser.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{chatUser.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{chatUser.email}</p>
                </div>
                {(unreadCounts[chatUser.user_id] || 0) > 0 && (
                  <Badge variant="destructive" className="rounded-full h-5 min-w-5 flex items-center justify-center">
                    {unreadCounts[chatUser.user_id]}
                  </Badge>
                )}
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className={selectedChat === null ? 'bg-primary text-primary-foreground' : 'bg-secondary'}>
                {selectedChat === null ? (
                  <Users className="h-5 w-5" />
                ) : (
                  getInitials(selectedUserName)
                )}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{selectedUserName}</h3>
              <p className="text-xs text-muted-foreground">
                {selectedChat === null ? 'Mensaje visible para todos' : 'Conversación privada'}
              </p>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No hay mensajes aún</p>
                  <p className="text-sm">¡Envía el primer mensaje!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwnMessage = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-3",
                        isOwnMessage && "flex-row-reverse"
                      )}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className={isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-secondary'}>
                          {getInitials(msg.sender?.full_name || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "max-w-[70%] space-y-1",
                        isOwnMessage && "text-right"
                      )}>
                        <div className="flex items-center gap-2">
                          {!isOwnMessage && (
                            <span className="text-xs font-medium">{msg.sender?.full_name}</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(msg.created_at), 'HH:mm', { locale: es })}
                          </span>
                        </div>
                        <div className={cn(
                          "rounded-lg px-3 py-2 inline-block",
                          isOwnMessage 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted"
                        )}>
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        </div>
                        {isOwnMessage && (
                          <div className="flex justify-end">
                            {msg.is_read ? (
                              <CheckCheck className="h-3 w-3 text-blue-500" />
                            ) : (
                              <Check className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2"
            >
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Escribe un mensaje${selectedChat === null ? ' para todos' : ''}...`}
                className="flex-1"
                disabled={isSending}
              />
              <Button type="submit" disabled={isSending || !newMessage.trim()}>
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

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
  Loader2,
  Check,
  CheckCheck,
  Paperclip,
  Camera,
  Mic,
  Square,
  Image as ImageIcon,
  File,
  Play,
  Pause,
  Bell,
  BellOff,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  file_url?: string | null;
  file_type?: string | null;
  file_name?: string | null;
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
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
      if (permission === 'granted') {
        toast.success('Notificaciones activadas');
      } else {
        toast.error('Permiso de notificaciones denegado');
      }
    } else {
      toast.error('Tu navegador no soporta notificaciones');
    }
  };

  // Show desktop notification
  const showNotification = (title: string, body: string) => {
    if (notificationsEnabled && document.hidden && 'Notification' in window) {
      try {
        const NotificationConstructor = window.Notification as unknown as new (title: string, options?: NotificationOptions) => Notification;
        const notification = new NotificationConstructor(title, {
          body,
          icon: '/favicon.ico',
        });
        
        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
      } catch (e) {
        console.error('Error showing notification:', e);
      }
    }
  };

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
        query = query.is('recipient_id', null);
      } else {
        query = query.or(
          `and(sender_id.eq.${user?.id},recipient_id.eq.${selectedChat}),and(sender_id.eq.${selectedChat},recipient_id.eq.${user?.id})`
        );
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;

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
          
          // Show notification if message is from someone else
          if (newMsg.sender_id !== user.id) {
            const senderName = users.find(u => u.user_id === newMsg.sender_id)?.full_name || 'Nuevo mensaje';
            const msgPreview = newMsg.file_type 
              ? `📎 ${newMsg.file_type === 'audio' ? 'Audio' : newMsg.file_type === 'image' ? 'Imagen' : 'Archivo'}`
              : newMsg.message.substring(0, 50);
            showNotification(senderName, msgPreview);
          }
          
          const isRelevant = 
            (selectedChat === null && newMsg.recipient_id === null) ||
            (selectedChat && (newMsg.sender_id === selectedChat || newMsg.recipient_id === selectedChat));
          
          if (isRelevant) {
            refetchMessages();
          }
          
          queryClient.invalidateQueries({ queryKey: ['unread_counts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedChat, users, refetchMessages, queryClient, notificationsEnabled]);

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

  // Upload file to storage
  const uploadFile = async (file: File, type: 'image' | 'audio' | 'file'): Promise<{ url: string; name: string } | null> => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop() || 'bin';
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      toast.error('Error al subir archivo');
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('chat-files')
      .getPublicUrl(fileName);

    return { url: publicUrl, name: file.name };
  };

  // Send message with optional file
  const sendMessage = async (fileData?: { url: string; name: string; type: 'image' | 'audio' | 'file' }) => {
    if (!user) return;
    if (!newMessage.trim() && !fileData) return;

    setIsSending(true);
    try {
      const { error } = await supabase.from('chat_messages').insert({
        sender_id: user.id,
        recipient_id: selectedChat,
        message: newMessage.trim() || (fileData ? '' : ''),
        file_url: fileData?.url || null,
        file_type: fileData?.type || null,
        file_name: fileData?.name || null,
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

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'file' | 'image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo es muy grande (máx 10MB)');
      return;
    }

    setIsSending(true);
    const fileData = await uploadFile(file, type);
    if (fileData) {
      await sendMessage({ ...fileData, type });
    }
    setIsSending(false);
    
    // Reset input
    if (e.target) e.target.value = '';
  };

  // Handle camera capture
  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSending(true);
    const fileData = await uploadFile(file, 'image');
    if (fileData) {
      await sendMessage({ ...fileData, type: 'image' });
    }
    setIsSending(false);
    
    if (e.target) e.target.value = '';
  };

  // Start audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Create file from blob
        const fileName = `audio_${Date.now()}.webm`;
        const file = Object.assign(audioBlob, { name: fileName }) as File;
        
        setIsSending(true);
        const fileData = await uploadFile(file, 'audio');
        if (fileData) {
          await sendMessage({ ...fileData, type: 'audio' });
        }
        setIsSending(false);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Recording error:', error);
      toast.error('No se pudo acceder al micrófono');
    }
  };

  // Stop audio recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Play/pause audio
  const toggleAudio = (audioUrl: string) => {
    let audio = audioRefs.current.get(audioUrl);
    
    if (!audio) {
      audio = new Audio(audioUrl);
      audioRefs.current.set(audioUrl, audio);
      
      audio.onended = () => {
        setPlayingAudio(null);
      };
    }

    if (playingAudio === audioUrl) {
      audio.pause();
      setPlayingAudio(null);
    } else {
      // Pause any currently playing audio
      if (playingAudio) {
        const currentAudio = audioRefs.current.get(playingAudio);
        currentAudio?.pause();
      }
      audio.play();
      setPlayingAudio(audioUrl);
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

  // Render message content
  const renderMessageContent = (msg: ChatMessage, isOwnMessage: boolean) => {
    return (
      <div className={cn(
        "rounded-lg px-3 py-2 inline-block max-w-full",
        isOwnMessage 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted"
      )}>
        {/* Image */}
        {msg.file_type === 'image' && msg.file_url && (
          <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
            <img 
              src={msg.file_url} 
              alt="Imagen" 
              className="max-w-[250px] max-h-[200px] rounded-lg object-cover mb-1"
            />
          </a>
        )}

        {/* Audio */}
        {msg.file_type === 'audio' && msg.file_url && (
          <div className="flex items-center gap-2 min-w-[150px]">
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-8 w-8", isOwnMessage && "text-primary-foreground hover:bg-primary-foreground/20")}
              onClick={() => toggleAudio(msg.file_url!)}
            >
              {playingAudio === msg.file_url ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <div className="flex-1 h-1 bg-current/30 rounded-full" />
            <span className="text-xs opacity-70">Audio</span>
          </div>
        )}

        {/* File */}
        {msg.file_type === 'file' && msg.file_url && (
          <a 
            href={msg.file_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:underline"
          >
            <File className="h-4 w-4" />
            <span className="text-sm truncate max-w-[200px]">{msg.file_name || 'Archivo'}</span>
          </a>
        )}

        {/* Text message */}
        {msg.message && (
          <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
        )}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar - Chat List */}
        <div className="w-72 border-r bg-muted/30 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Chat Interno
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={notificationsEnabled ? () => setNotificationsEnabled(false) : requestNotificationPermission}
              title={notificationsEnabled ? 'Desactivar notificaciones' : 'Activar notificaciones'}
            >
              {notificationsEnabled ? (
                <Bell className="h-4 w-4 text-green-500" />
              ) : (
                <BellOff className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
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
                        {renderMessageContent(msg, isOwnMessage)}
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
            {/* Recording indicator */}
            {isRecording && (
              <div className="flex items-center gap-3 mb-3 p-2 bg-destructive/10 rounded-lg">
                <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm font-medium text-destructive">
                  Grabando... {formatTime(recordingTime)}
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={stopRecording}
                  className="ml-auto"
                >
                  <Square className="h-3 w-3 mr-1" />
                  Detener
                </Button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-2"
            >
              {/* Hidden file inputs */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileSelect(e, 'file')}
                className="hidden"
                accept="*/*"
              />
              <input
                type="file"
                ref={cameraInputRef}
                onChange={handleCameraCapture}
                className="hidden"
                accept="image/*"
                capture="environment"
              />

              {/* Attachment menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="icon" disabled={isSending || isRecording}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <File className="h-4 w-4 mr-2" />
                    Archivo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => handleFileSelect(e as any, 'image');
                    input.click();
                  }}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Imagen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
                    <Camera className="h-4 w-4 mr-2" />
                    Tomar foto
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Audio recording button */}
              <Button
                type="button"
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isSending}
              >
                {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>

              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Escribe un mensaje${selectedChat === null ? ' para todos' : ''}...`}
                className="flex-1"
                disabled={isSending || isRecording}
              />
              
              <Button type="submit" disabled={isSending || isRecording || !newMessage.trim()}>
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


import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatService, ChatMessage } from '@/services/chatService';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface ChatRoomProps {
  chatRoomId: string;
  chatRoomName: string;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ chatRoomId, chatRoomName }) => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  const { data: messages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ['chatMessages', chatRoomId],
    queryFn: () => chatService.getChatMessages(chatRoomId),
    refetchInterval: 5000,
  });
  
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || !currentEmployee) return;
    
    try {
      setIsSending(true);
      await chatService.sendMessage(chatRoomId, currentEmployee.id, message.trim());
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['chatMessages', chatRoomId] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  const getMessageTimestamp = (dateString: string) => {
    const date = parseISO(dateString);
    return format(date, 'MMM d, h:mm a');
  };
  
  const isOwnMessage = (employeeId: string) => {
    return currentEmployee?.id === employeeId;
  };
  
  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="border-b bg-gray-50 p-4">
        <CardTitle className="text-lg flex items-center">
          <MessageCircle className="h-5 w-5 mr-2 text-blue-600" />
          {chatRoomName}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full p-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <p className="text-gray-500">Loading messages...</p>
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map(msg => (
                <div 
                  key={msg.id} 
                  className={`flex ${
                    isOwnMessage(msg.employee_id) ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div 
                    className={`flex max-w-[80%] ${
                      isOwnMessage(msg.employee_id) ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <Avatar className={`h-8 w-8 ${
                      isOwnMessage(msg.employee_id) ? 'ml-2' : 'mr-2'
                    }`}>
                      <AvatarFallback className={`${
                        isOwnMessage(msg.employee_id) 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {msg.employee_name ? getInitials(msg.employee_name) : '??'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div>
                      <div 
                        className={`rounded-lg px-4 py-2 ${
                          isOwnMessage(msg.employee_id)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                      </div>
                      <div 
                        className={`text-xs text-gray-500 mt-1 ${
                          isOwnMessage(msg.employee_id) ? 'text-right' : 'text-left'
                        }`}
                      >
                        <span className="font-medium">{msg.employee_name}</span>
                        {' '}· {getMessageTimestamp(msg.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex justify-center items-center h-full">
              <p className="text-gray-500">No messages yet. Start the conversation!</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
      
      <CardFooter className="p-4 border-t bg-gray-50">
        <form onSubmit={handleSendMessage} className="w-full flex gap-2">
          <Input
            placeholder="Type your message..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="flex-1"
            disabled={isSending || !currentEmployee}
          />
          <Button 
            type="submit" 
            disabled={isSending || !message.trim() || !currentEmployee}
          >
            <Send className="h-4 w-4 mr-1" />
            Send
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default ChatRoom;

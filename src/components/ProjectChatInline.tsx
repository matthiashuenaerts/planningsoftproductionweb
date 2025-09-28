import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { projectChatService, ProjectMessage } from '@/services/projectChatService';
import { useAuth } from '@/context/AuthContext';
import { Send, Paperclip, X, MessageCircle, Users, Reply } from 'lucide-react';
import { format } from 'date-fns';

interface ProjectChatInlineProps {
  projectId: string;
  projectName: string;
  onUnreadCountChange: (count: number) => void;
}

export const ProjectChatInline: React.FC<ProjectChatInlineProps> = ({
  projectId,
  projectName,
  onUnreadCountChange
}) => {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<{id: string, name: string}[]>([]);
  const [replyToMessage, setReplyToMessage] = useState<ProjectMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const data = await projectChatService.getProjectMessages(projectId);
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const members = await projectChatService.getProjectTeamMembers(projectId);
      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((!newMessage.trim() && !selectedFile) || isSending) return;

    try {
      setIsSending(true);
      
      // Optimistic update - add message immediately to UI
      const optimisticMessage: ProjectMessage = {
        id: `temp-${Date.now()}`,
        project_id: projectId,
        employee_id: currentEmployee?.id || '',
        employee_name: currentEmployee?.name || 'You',
        message: newMessage.trim(),
        file_url: selectedFile ? URL.createObjectURL(selectedFile) : undefined,
        file_name: selectedFile?.name,
        file_type: selectedFile?.type,
        is_image: selectedFile?.type.startsWith('image/') || false,
        target_user_ids: selectedUsers.length > 0 ? selectedUsers : null,
        reply_to_message_id: replyToMessage?.id || null,
        reply_to_message: replyToMessage,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      
      // Clear form immediately
      const messageToSend = newMessage.trim();
      const fileToSend = selectedFile;
      const targetUsers = selectedUsers.length > 0 ? selectedUsers : undefined;
      const replyTo = replyToMessage?.id;
      
      setNewMessage('');
      setSelectedFile(null);
      setSelectedUsers([]);
      setReplyToMessage(null);
      
      // Send actual message
      const sentMessage = await projectChatService.sendMessage(
        projectId, 
        messageToSend, 
        fileToSend || undefined,
        targetUsers,
        replyTo
      );
      
      // Replace optimistic message with real one
      setMessages(prev => prev.map(msg => 
        msg.id === optimisticMessage.id ? sentMessage : msg
      ));
      
      toast({
        title: 'Message sent',
        description: selectedUsers.length > 0 
          ? `Message sent to ${selectedUsers.length} user(s)` 
          : 'Your message has been sent successfully'
      });
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')));
      
      // Restore form values
      setNewMessage(newMessage);
      setSelectedFile(selectedFile);
      
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select a file smaller than 10MB',
          variant: 'destructive'
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUserSelection = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleReplyToMessage = (message: ProjectMessage) => {
    setReplyToMessage(message);
    // Auto-select the original sender for reply
    if (message.employee_id && !selectedUsers.includes(message.employee_id)) {
      setSelectedUsers(prev => [...prev, message.employee_id]);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return format(date, 'HH:mm');
    } else if (diffInHours < 48) {
      return 'Yesterday ' + format(date, 'HH:mm');
    } else {
      return format(date, 'dd/MM HH:mm');
    }
  };

  const isOwnMessage = (employeeId: string) => {
    return currentEmployee?.id === employeeId;
  };

  useEffect(() => {
    loadMessages();
    loadTeamMembers();
    
    // Mark messages as read when chat loads
    projectChatService.markMessagesAsRead(projectId).then(() => {
      onUnreadCountChange(0);
    });

    // Subscribe to real-time updates
    const channel = projectChatService.subscribeToMessages(projectId, (newMessage) => {
      setMessages(prev => {
        // Don't add if it's already there (avoid duplicates from optimistic updates)
        if (prev.some(msg => msg.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
    });

    return () => {
      channel.unsubscribe();
    };
  }, [projectId, onUnreadCountChange]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const renderMessage = (message: ProjectMessage) => {
    const isOwn = isOwnMessage(message.employee_id);
    const isOptimistic = message.id.startsWith('temp-');
    const isTargeted = message.target_user_ids && message.target_user_ids.length > 0;
    
    return (
      <div
        key={message.id}
        className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''} mb-4 ${isOptimistic ? 'opacity-70' : ''}`}
      >
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback className="text-xs">
            {getInitials(message.employee_name || 'Unknown')}
          </AvatarFallback>
        </Avatar>
        
        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
          {/* Reply indicator */}
          {message.reply_to_message && (
            <div className={`text-xs text-muted-foreground mb-1 p-2 bg-muted/50 rounded border-l-2 border-primary ${
              isOwn ? 'text-right' : 'text-left'
            }`}>
              <span className="font-medium">Replying to {message.reply_to_message.employee_name}: </span>
              <span>{message.reply_to_message.message?.substring(0, 50)}...</span>
            </div>
          )}

          {/* Target users indicator */}
          {isTargeted && (
            <div className={`flex items-center gap-1 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <Users className="w-3 h-3" />
              <span className="text-xs text-muted-foreground">
                To: {message.target_user_ids?.map(id => 
                  teamMembers.find(m => m.id === id)?.name || 'Unknown'
                ).join(', ')}
              </span>
            </div>
          )}
          
          <div className={`rounded-lg px-3 py-2 relative group ${
            isOwn 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted'
          } ${isTargeted ? 'border-2 border-primary/20' : ''}`}>
            {message.message && (
              <p className="text-sm whitespace-pre-wrap">{message.message}</p>
            )}
            
            {message.file_url && (
              <div className="mt-2">
                {message.is_image ? (
                  <img
                    src={message.file_url}
                    alt={message.file_name || 'Image'}
                    className="max-w-full max-h-64 rounded cursor-pointer"
                    onClick={() => window.open(message.file_url, '_blank')}
                  />
                ) : (
                  <a
                    href={message.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm underline hover:no-underline"
                  >
                    <Paperclip className="w-4 h-4" />
                    {message.file_name}
                  </a>
                )}
              </div>
            )}

            {/* Reply button */}
            {!isOwn && (
              <Button
                size="sm"
                variant="ghost"
                className="absolute -bottom-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleReplyToMessage(message)}
              >
                <Reply className="w-3 h-3" />
                Reply
              </Button>
            )}
          </div>
          
          <div className={`flex items-center gap-2 mt-1 text-xs text-muted-foreground ${
            isOwn ? 'flex-row-reverse' : ''
          }`}>
            <span>{message.employee_name}</span>
            <span>•</span>
            <span>{formatMessageTime(message.created_at)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="h-[700px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Project Chat - {projectName}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col min-h-0 p-4">
        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">No messages yet. Start the conversation!</div>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map(renderMessage)}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
        
        <div className="border-t pt-4 mt-4">
          {/* Reply indicator */}
          {replyToMessage && (
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded mb-2 border-l-2 border-primary">
              <Reply className="w-4 h-4" />
              <span className="text-sm flex-1">
                Replying to <strong>{replyToMessage.employee_name}</strong>: {replyToMessage.message?.substring(0, 30)}...
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReplyToMessage(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Selected users indicator */}
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-2 p-2 bg-primary/10 rounded mb-2">
              <Users className="w-4 h-4 text-primary" />
              <div className="flex flex-wrap gap-1 flex-1">
                {selectedUsers.map(userId => {
                  const user = teamMembers.find(m => m.id === userId);
                  return (
                    <Badge key={userId} variant="secondary" className="text-xs">
                      {user?.name || 'Unknown'}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-1 h-3 w-3 p-0"
                        onClick={() => handleUserSelection(userId, false)}
                      >
                        <X className="w-2 h-2" />
                      </Button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* File selection indicator */}
          {selectedFile && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded mb-2">
              <Paperclip className="w-4 h-4" />
              <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeSelectedFile}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
            
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
            >
              <Paperclip className="w-4 h-4" />
            </Button>

            {/* User selection popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={isSending}
                >
                  <Users className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Select recipients</h4>
                    <p className="text-sm text-muted-foreground">
                      Leave empty to send to everyone
                    </p>
                  </div>
                  <div className="grid gap-2 max-h-40 overflow-y-auto">
                    {teamMembers
                      .filter(member => member.id !== currentEmployee?.id)
                      .map((member) => (
                        <div key={member.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={member.id}
                            checked={selectedUsers.includes(member.id)}
                            onCheckedChange={(checked) => 
                              handleUserSelection(member.id, checked as boolean)
                            }
                          />
                          <label
                            htmlFor={member.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {member.name}
                          </label>
                        </div>
                      ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={selectedUsers.length > 0 
                ? `Message to ${selectedUsers.length} user(s)...` 
                : "Type your message..."
              }
              className="flex-1"
              disabled={isSending}
            />
            
            <Button type="submit" disabled={isSending || (!newMessage.trim() && !selectedFile)}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
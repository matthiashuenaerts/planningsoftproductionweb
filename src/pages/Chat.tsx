
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatService, ChatRoom as ChatRoomType } from '@/services/chatService';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import ChatRoom from '@/components/chat/ChatRoom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Users } from 'lucide-react';

const Chat = () => {
  const { currentEmployee } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomType | null>(null);
  
  const { data: chatRooms, isLoading } = useQuery<ChatRoomType[]>({
    queryKey: ['chatRooms', currentEmployee?.role],
    queryFn: () => chatService.getChatRooms(currentEmployee?.role || ''),
    enabled: !!currentEmployee?.role,
  });

  if (currentEmployee?.role === 'workstation') {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-4xl mx-auto p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Chat not available for workstation users</h1>
            <p className="text-gray-600">Chat functionality is not available for workstation role users.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Chat</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat Rooms List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Chat Rooms
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <p className="text-gray-500">Loading chat rooms...</p>
                  ) : chatRooms && chatRooms.length > 0 ? (
                    <div className="space-y-2">
                      {chatRooms.map(room => (
                        <Button
                          key={room.id}
                          variant={selectedRoom?.id === room.id ? "default" : "outline"}
                          className="w-full justify-start"
                          onClick={() => setSelectedRoom(room)}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          {room.name}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No chat rooms available</p>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Chat Room Content */}
            <div className="lg:col-span-2">
              {selectedRoom ? (
                <ChatRoom 
                  chatRoomId={selectedRoom.id} 
                  chatRoomName={selectedRoom.name}
                />
              ) : (
                <Card className="h-[600px] flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Select a chat room</h3>
                    <p className="text-gray-500">Choose a chat room from the left to start messaging</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;

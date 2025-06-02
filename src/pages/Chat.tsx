
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import ChatRoom from '@/components/chat/ChatRoom';
import { chatService, ChatRoom as ChatRoomType } from '@/services/chatService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Users } from 'lucide-react';

const Chat = () => {
  const { currentEmployee } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomType | null>(null);
  
  const { data: chatRooms = [], isLoading } = useQuery({
    queryKey: ['chatRooms', currentEmployee?.role],
    queryFn: () => chatService.getChatRooms(currentEmployee?.role || ''),
    enabled: !!currentEmployee?.role,
  });

  // Auto-select first room if none selected
  React.useEffect(() => {
    if (chatRooms.length > 0 && !selectedRoom) {
      setSelectedRoom(chatRooms[0]);
    }
  }, [chatRooms, selectedRoom]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="ml-64 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Team Chat</h1>
          <p className="text-gray-600 mt-2">Communicate with your team members</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chat Rooms List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-lg flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Chat Rooms
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {chatRooms.map(room => (
                    <Button
                      key={room.id}
                      variant={selectedRoom?.id === room.id ? "secondary" : "ghost"}
                      className="w-full justify-start p-3 h-auto"
                      onClick={() => setSelectedRoom(room)}
                    >
                      <div className="flex items-center space-x-2">
                        <MessageCircle className="h-4 w-4" />
                        <div className="text-left">
                          <div className="font-medium">{room.name}</div>
                          {room.description && (
                            <div className="text-xs text-gray-500">{room.description}</div>
                          )}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Room */}
          <div className="lg:col-span-3">
            {selectedRoom ? (
              <ChatRoom 
                key={selectedRoom.id}
                roomId={selectedRoom.id} 
                roomName={selectedRoom.name}
              />
            ) : (
              <Card className="h-[600px] flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a chat room to start messaging</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;

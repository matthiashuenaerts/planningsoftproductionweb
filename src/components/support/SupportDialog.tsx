import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, LifeBuoy } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import SupportTicketList from './SupportTicketList';
import SupportTicketForm from './SupportTicketForm';
import SupportTicketChat from './SupportTicketChat';

interface SupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SupportDialog: React.FC<SupportDialogProps> = ({ open, onOpenChange }) => {
  const [view, setView] = useState<'list' | 'new' | 'chat'>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleTicketCreated = () => {
    setView('list');
  };

  const handleViewTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setView('chat');
  };

  const handleClose = () => {
    setView('list');
    setSelectedTicketId(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" />
            Support
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {view === 'list' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setView('new')} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Ticket
                </Button>
              </div>
              <SupportTicketList onViewTicket={handleViewTicket} />
            </div>
          )}

          {view === 'new' && (
            <SupportTicketForm
              onCancel={() => setView('list')}
              onCreated={handleTicketCreated}
            />
          )}

          {view === 'chat' && selectedTicketId && (
            <SupportTicketChat
              ticketId={selectedTicketId}
              onBack={() => { setView('list'); setSelectedTicketId(null); }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupportDialog;

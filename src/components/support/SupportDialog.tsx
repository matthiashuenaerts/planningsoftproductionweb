import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, LifeBuoy } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
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
  const isMobile = useIsMobile();

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

  const dialogClass = isMobile
    ? 'max-w-[calc(100vw-1.5rem)] w-[calc(100vw-1.5rem)] p-4 max-h-[90vh] overflow-hidden flex flex-col'
    : 'max-w-2xl max-h-[85vh] overflow-hidden flex flex-col';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isMobile ? 'text-base' : ''}`}>
            <LifeBuoy className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
            Support
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {view === 'list' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button onClick={() => setView('new')} size="sm" className={isMobile ? 'w-full h-10' : ''}>
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

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { useLanguage } from '@/context/LanguageContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download, Eye, ExternalLink, X, Calendar, Euro } from 'lucide-react';
import { format } from 'date-fns';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDrawerLayout } from '@/hooks/useDrawerLayout';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/10 text-primary',
  paid: 'bg-green-500/10 text-green-600 dark:text-green-400',
  overdue: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

const statusTranslationKeys: Record<string, string> = {
  draft: 'inv_status_draft',
  sent: 'inv_status_sent',
  paid: 'inv_status_paid',
  overdue: 'inv_status_overdue',
  cancelled: 'inv_status_cancelled',
};

const monthKeys = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const InvoiceRow: React.FC<{ invoice: any; onPreview: (url: string) => void }> = ({ invoice, onPreview }) => {
  const { t } = useLanguage();
  const signedUrl = useSignedUrl('invoices', invoice.pdf_path);
  const isMobile = useIsMobile();
  const drawerLayout = useDrawerLayout();

  const handleDownload = () => {
    if (signedUrl) {
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = `invoice-${invoice.year}-${String(invoice.month).padStart(2, '0')}.pdf`;
      a.click();
    }
  };

  const handleOpenNewTab = () => {
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    }
  };

  const handlePreview = () => {
    if (signedUrl) {
      onPreview(signedUrl);
    }
  };

  if (isMobile) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-3 active:scale-[0.98] transition-transform">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">
                {monthKeys[invoice.month - 1]} {invoice.year}
              </p>
              {invoice.amount != null && (
                <p className="text-base font-bold text-foreground mt-0.5">
                  €{Number(invoice.amount).toFixed(2)}
                </p>
              )}
            </div>
          </div>
          <Badge className={`${statusColors[invoice.status] || ''} border-0 text-xs font-medium px-2.5 py-1`}>
            {t(statusTranslationKeys[invoice.status] || invoice.status)}
          </Badge>
        </div>

        {invoice.payment_deadline && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{t('inv_due')}: {format(new Date(invoice.payment_deadline), 'dd/MM/yyyy')}</span>
          </div>
        )}

        {invoice.pdf_path && (
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 text-xs gap-1.5"
              onClick={handleOpenNewTab}
              disabled={!signedUrl}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('inv_open_new_tab')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 text-xs gap-1.5"
              onClick={handleDownload}
              disabled={!signedUrl}
            >
              <Download className="h-3.5 w-3.5" />
              {t('inv_download')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="font-medium text-sm text-foreground">
            {monthKeys[invoice.month - 1]} {invoice.year}
          </p>
          {invoice.amount != null && (
            <p className="text-xs text-muted-foreground">€{Number(invoice.amount).toFixed(2)}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {invoice.payment_deadline && (
          <span className="text-xs text-muted-foreground">
            {t('inv_due')}: {format(new Date(invoice.payment_deadline), 'dd/MM/yyyy')}
          </span>
        )}
        <Badge className={`${statusColors[invoice.status] || ''} border-0 text-xs`}>
          {t(statusTranslationKeys[invoice.status] || invoice.status)}
        </Badge>
        {invoice.pdf_path && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handlePreview} disabled={!signedUrl} title={t('inv_preview')}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleOpenNewTab} disabled={!signedUrl} title={t('inv_open_new_tab')}>
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDownload} disabled={!signedUrl} title={t('inv_download')}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const Invoices: React.FC = () => {
  const { currentEmployee } = useAuth();
  const { tenant } = useTenant();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const drawerLayout = useDrawerLayout();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  const paidCount = invoices?.filter((i: any) => i.status === 'paid').length || 0;
  const overdueCount = invoices?.filter((i: any) => i.status === 'overdue').length || 0;

  return (
    <div className="flex min-h-screen bg-background">
      <Navbar />
      <main className={`flex-1 min-w-0 overflow-x-hidden ${drawerLayout ? 'pt-16 px-4 pb-6' : 'ml-64 p-6'}`}>
        {/* Header */}
        <div className={`${isMobile ? 'pt-2 pb-4' : 'mb-6'}`}>
          <h1 className={`font-bold text-foreground ${isMobile ? 'text-xl' : 'text-2xl'}`}>
            {t('inv_invoices')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('inv_billing_history')}</p>
        </div>

        {/* Summary cards on mobile */}
        {isMobile && invoices && invoices.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-green-500/10 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">{t(statusTranslationKeys.paid)}</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{paidCount}</p>
            </div>
            <div className="bg-destructive/10 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">{t(statusTranslationKeys.overdue)}</p>
              <p className="text-xl font-bold text-destructive">{overdueCount}</p>
            </div>
          </div>
        )}

        {/* Invoice list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : !invoices?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">{t('inv_no_invoices')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className={`space-y-${isMobile ? '3' : '2'}`}>
            {invoices.map((inv: any) => (
              <InvoiceRow key={inv.id} invoice={inv} onPreview={setPreviewUrl} />
            ))}
          </div>
        )}

        {/* PDF Preview (desktop only) */}
        {previewUrl && !isMobile && (
          <Card className="mt-4">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <span className="text-sm font-medium text-foreground">{t('inv_preview')}</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => window.open(previewUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  {t('inv_open_new_tab')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPreviewUrl(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardContent className="p-0">
              <iframe
                src={previewUrl}
                className="w-full border-0 rounded-b-lg"
                style={{ height: '80vh' }}
                title="Invoice Preview"
              />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Invoices;
